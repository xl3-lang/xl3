import { describe, expect, it } from 'vitest';
import {
  isDataExpression,
  isAggregateExpression,
  normalizeTemplate,
  extractColumnRefs,
} from '../normalizer.js';

describe('isDataExpression', () => {
  it('returns true when the expression contains a [field] reference', () => {
    expect(isDataExpression('[Customer]')).toBe(true);
    expect(isDataExpression('[a] + [b]')).toBe(true);
  });

  it('returns false for bare names and literals', () => {
    expect(isDataExpression('Customer')).toBe(false);
    expect(isDataExpression('"text"')).toBe(false);
    expect(isDataExpression('123')).toBe(false);
  });
});

describe('isAggregateExpression', () => {
  it('detects SUM/AVG/MIN/MAX/COUNT calls', () => {
    expect(isAggregateExpression('SUM([total])')).toBe(true);
    expect(isAggregateExpression('AVERAGE([price])')).toBe(true);
    expect(isAggregateExpression('MIN([d])')).toBe(true);
    expect(isAggregateExpression('MAX([d])')).toBe(true);
    expect(isAggregateExpression('COUNT()')).toBe(true);
    expect(isAggregateExpression('COUNT([customer])')).toBe(true);
  });

  it('is case-insensitive on the function name', () => {
    expect(isAggregateExpression('sum([x])')).toBe(true);
    expect(isAggregateExpression('Sum([x])')).toBe(true);
  });

  it('returns false for non-aggregate expressions', () => {
    expect(isAggregateExpression('[total]')).toBe(false);
    expect(isAggregateExpression('IF([x] > 1, "y", "n")')).toBe(false);
    expect(isAggregateExpression('ROUND([x], 0)')).toBe(false);
  });
});

describe('extractColumnRefs', () => {
  it('returns the bracketed columns in the order they appear', () => {
    expect(extractColumnRefs('[a] + [b]')).toEqual(['a', 'b']);
    expect(extractColumnRefs('IF([qty] > 10, [a], [b])')).toEqual([
      'qty', 'a', 'b',
    ]);
  });

  it('deduplicates repeated columns while preserving first-seen order', () => {
    expect(extractColumnRefs('[a] + [a] + [b] - [a]')).toEqual(['a', 'b']);
  });

  it('trims whitespace inside brackets', () => {
    expect(extractColumnRefs('[ Customer Name ]')).toEqual(['Customer Name']);
  });

  it('returns an empty list when no bracketed columns are present', () => {
    expect(extractColumnRefs('Customer')).toEqual([]);
    expect(extractColumnRefs('"text"')).toEqual([]);
  });
});

describe('normalizeTemplate', () => {
  const cols = new Set(['Customer', 'price', 'quantity', 'a', 'b', 'c', 'd', 'amount', 'Total']);

  it('rewrites a single bracket reference to an index call', () => {
    expect(normalizeTemplate('{{ [Customer] }}', cols)).toBe(
      '{{ index . "Customer" }}',
    );
  });

  it('rewrites simple arithmetic into prefix function form', () => {
    expect(normalizeTemplate('{{ [price] * [quantity] }}', cols)).toBe(
      '{{ mul (index . "price") (index . "quantity") }}',
    );
  });

  // Issue #52: chained same-precedence arithmetic must be LEFT-associative,
  // and `*`/`/` must bind tighter than `+`/`-`. The old first-operator
  // split produced right-associative output (`a / b * c` → `a / (b * c)`),
  // mis-scaling e.g. VAT cells by ~100x.
  describe('chained arithmetic (issue #52)', () => {
    it('is left-associative for division then multiplication', () => {
      // (a / b) * c, NOT a / (b * c)
      expect(normalizeTemplate('{{ [a] / [b] * [c] }}', cols)).toBe(
        '{{ mul (div (index . "a") (index . "b")) (index . "c") }}',
      );
    });

    it('is left-associative for repeated subtraction', () => {
      expect(normalizeTemplate('{{ [a] - [b] - [c] }}', cols)).toBe(
        '{{ sub (sub (index . "a") (index . "b")) (index . "c") }}',
      );
    });

    it('is left-associative for mixed +/-', () => {
      expect(normalizeTemplate('{{ [a] - [b] + [c] }}', cols)).toBe(
        '{{ add (sub (index . "a") (index . "b")) (index . "c") }}',
      );
    });

    it('is left-associative for repeated division', () => {
      expect(normalizeTemplate('{{ [a] / [b] / [c] }}', cols)).toBe(
        '{{ div (div (index . "a") (index . "b")) (index . "c") }}',
      );
    });

    it('gives * / higher precedence than + -', () => {
      // a + (b * c)
      expect(normalizeTemplate('{{ [a] + [b] * [c] }}', cols)).toBe(
        '{{ add (index . "a") (mul (index . "b") (index . "c")) }}',
      );
      // (a * b) + c
      expect(normalizeTemplate('{{ [a] * [b] + [c] }}', cols)).toBe(
        '{{ add (mul (index . "a") (index . "b")) (index . "c") }}',
      );
    });

    it('honors author parentheses to override precedence', () => {
      // (a + b) * c
      expect(normalizeTemplate('{{ ([a] + [b]) * [c] }}', cols)).toBe(
        '{{ mul (add (index . "a") (index . "b")) (index . "c") }}',
      );
    });

    it('normalizes a chained arithmetic function argument', () => {
      // The originating VAT bug: TEXT([합계] / 1.1 * 0.1, ...) must be
      // ((합계 / 1.1) * 0.1), not (합계 / (1.1 * 0.1)).
      expect(
        normalizeTemplate('{{ TEXT([Total] / 1.1 * 0.1, "#,##0") }}', cols),
      ).toBe('{{ TEXT (mul (div (index . "Total") 1.1) 0.1) "#,##0" }}');
    });

    it('folds a longer mixed-precedence chain correctly', () => {
      // (a + (b * c)) - d
      expect(normalizeTemplate('{{ [a] + [b] * [c] - [d] }}', cols)).toBe(
        '{{ sub (add (index . "a") (mul (index . "b") (index . "c"))) (index . "d") }}',
      );
    });

    it('handles parenthesized groups on both operands', () => {
      expect(normalizeTemplate('{{ ([a] + [b]) * ([c] - [d]) }}', cols)).toBe(
        '{{ mul (add (index . "a") (index . "b")) (sub (index . "c") (index . "d")) }}',
      );
    });

    it('accepts Source[Column] arithmetic operands (old regex missed these)', () => {
      expect(normalizeTemplate('{{ Customers[Rate] * [amount] }}', cols)).toBe(
        '{{ mul (sourceCell "Customers" "Rate") (index . "amount") }}',
      );
    });

    it('accepts function-call operands inside a chain', () => {
      expect(normalizeTemplate('{{ ABS([a]) + [b] }}', cols)).toBe(
        '{{ add (ABS (index . "a")) (index . "b") }}',
      );
      expect(normalizeTemplate('{{ [a] * ROUND([b], 2) }}', cols)).toBe(
        '{{ mul (index . "a") (ROUND (index . "b") 2) }}',
      );
    });

    it('keeps the (0 - [col]) negation idiom intact inside a chain', () => {
      // ADR-0028: unary minus is spelled (0 - [col]); it must survive as
      // a parenthesized sub-expression, not get re-associated.
      expect(normalizeTemplate('{{ (0 - [a]) * [b] }}', cols)).toBe(
        '{{ mul (sub 0 (index . "a")) (index . "b") }}',
      );
    });
  });

  it('rewrites SUM aggregates to sumRows', () => {
    expect(normalizeTemplate('{{ SUM([price]) }}', cols)).toBe(
      '{{ sumRows .Rows "price" }}',
    );
  });

  it('rewrites COUNT() to len .Rows', () => {
    expect(normalizeTemplate('{{ COUNT() }}', cols)).toBe('{{ len .Rows }}');
  });

  it('rewrites ROW() to the __ROW__ sentinel (eval-time check)', () => {
    expect(normalizeTemplate('{{ ROW() }}', cols)).toBe('{{ __ROW__ }}');
  });

  it('rewrites TODAY() to the TODAY function token', () => {
    expect(normalizeTemplate('{{ TODAY() }}', cols)).toBe('{{ TODAY }}');
  });

  it('preserves non-template text outside {{ }} blocks', () => {
    expect(normalizeTemplate('Hello {{ [Customer] }}!', cols)).toBe(
      'Hello {{ index . "Customer" }}!',
    );
  });

  it('rewrites & concatenation into a concat call', () => {
    expect(normalizeTemplate('{{ [Customer] & " (" & [price] & ")" }}', cols)).toBe(
      '{{ concat (index . "Customer") " (" (index . "price") ")" }}',
    );
  });
});
