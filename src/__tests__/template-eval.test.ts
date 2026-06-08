import { describe, expect, it } from 'vitest';
import { normalizeTemplate } from '../normalizer.js';
import { evalCell } from '../template-eval.js';

describe('ROW()', () => {
  it('returns the current repeat-block row index', () => {
    const normalized = normalizeTemplate('{{ ROW() }}', new Set());
    expect(evalCell(normalized, { __rownum: 3 })).toBe(3);
  });

  it('throws outside a repeat block', () => {
    const normalized = normalizeTemplate('{{ ROW() }}', new Set());
    expect(() => evalCell(normalized, {})).toThrow(
      'ROW() called outside a repeat block',
    );
  });
});

describe('COUNT([field])', () => {
  it('counts non-empty values from the current row set', () => {
    const normalized = normalizeTemplate('{{ COUNT([Memo]) }}', new Set(['Memo']));
    expect(evalCell(normalized, {
      Rows: [
        { Memo: 'hello' },
        { Memo: '' },
        { Memo: null },
        { Memo: 'world' },
      ],
    })).toBe(2);
  });
});

// Issue #52: the normalizer used to fold chained arithmetic
// right-associatively. These pin the actual COMPUTED VALUE (not just the
// IR shape) — the data is chosen so left- and right-associative groupings
// diverge, so a regression changes the number, not just the tree.
describe('chained arithmetic value semantics (issue #52)', () => {
  const cols = new Set(['a', 'b', 'c', 'd', 'Total']);
  const val = (tmpl: string, ctx: Record<string, unknown>) =>
    evalCell(normalizeTemplate(tmpl, cols), ctx);

  it('a / b * c is (a / b) * c, not a / (b * c)', () => {
    expect(val('{{ [a] / [b] * [c] }}', { a: 12, b: 2, c: 3 })).toBe(18); // bug → 2
  });

  it('a - b - c is (a - b) - c', () => {
    expect(val('{{ [a] - [b] - [c] }}', { a: 12, b: 2, c: 3 })).toBe(7); // bug → 13
  });

  it('a - b + c is (a - b) + c', () => {
    expect(val('{{ [a] - [b] + [c] }}', { a: 12, b: 2, c: 3 })).toBe(13); // bug → 7
  });

  it('a / b / c is (a / b) / c', () => {
    expect(val('{{ [a] / [b] / [c] }}', { a: 12, b: 2, c: 3 })).toBe(2); // bug → 18
  });

  it('* binds tighter than +: a + b * c = a + (b * c)', () => {
    expect(val('{{ [a] + [b] * [c] }}', { a: 12, b: 2, c: 3 })).toBe(18);
  });

  it('longer mixed-precedence chain: (a + b * c) - d', () => {
    expect(val('{{ [a] + [b] * [c] - [d] }}', { a: 10, b: 2, c: 3, d: 4 })).toBe(12);
  });

  it('author parentheses override precedence: (a + b) * c', () => {
    expect(val('{{ ([a] + [b]) * [c] }}', { a: 2, b: 3, c: 4 })).toBe(20);
  });

  it('the originating VAT cell rounds to 188, not 18,764', () => {
    // Total 2063.6 → /1.1 = 1876 (공급가액) → *0.1 = 187.6 → "188".
    // The right-associative bug computed Total / (1.1 * 0.1) = 18,764.
    expect(val('{{ TEXT([Total] / 1.1 * 0.1, "#,##0") }}', { Total: 2063.6 })).toBe('188');
  });

  it('parentheses on the right operand group correctly', () => {
    expect(val('{{ [a] * ([b] + [c]) }}', { a: 2, b: 3, c: 4 })).toBe(14);
  });

  it('a cell wrapped entirely in parens evaluates its interior', () => {
    // `{{ ([a] + [b]) }}` used to return the literal string "[a] + [b]".
    expect(val('{{ ([a] + [b]) }}', { a: 3, b: 4 })).toBe(7);
    expect(val('{{ ((([a] / [b])) * [c]) }}', { a: 12, b: 2, c: 3 })).toBe(18);
  });

  it('a parenthesized sub-expression inside a function arg evaluates', () => {
    expect(val('{{ ROUND(([a] + [b]) / [c], 0) }}', { a: 7, b: 5, c: 4 })).toBe(3);
  });
});
