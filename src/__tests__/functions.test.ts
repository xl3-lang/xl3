import { describe, expect, it } from 'vitest';
import {
  functions,
  isEmpty,
  isTruthy,
  canonicalString,
  compareValues,
} from '../functions.js';

describe('TEXT', () => {
  it('formats the XTL 0.1 date token subset', () => {
    // ADR-0017: dates are read in UTC (matching ExcelJS' timezone-naive
    // representation), so test inputs use Date.UTC(...) too.
    expect(functions.TEXT(new Date(Date.UTC(2026, 4, 3, 9, 8, 7)), 'YYYY-MM-DD HH:mm:ss'))
      .toBe('2026-05-03 09:08:07');
    expect(functions.TEXT(new Date(Date.UTC(2026, 4, 3)), 'YY/MM/dd')).toBe('26/05/03');
  });

  it('formats the XTL 0.1 numeric subset', () => {
    expect(functions.TEXT(1234.5, '#,##0')).toBe('1,235');
    expect(functions.TEXT(1234.5, '0.00')).toBe('1234.50');
    expect(functions.TEXT(1234.5, '#,##0.00')).toBe('1,234.50');
    expect(functions.TEXT(-2.5, '0')).toBe('-3');
    expect(functions.TEXT(-2.345, '0.00')).toBe('-2.35');
    expect(functions.TEXT(45000, '#,##0')).toBe('45,000');
  });

  it('leaves unsupported formats implementation-defined via string fallback', () => {
    expect(functions.TEXT(1234.5, '$0.00')).toBe('1234.5');
  });
});

describe('isEmpty (ADR-0007)', () => {
  it('treats null, undefined, "", and whitespace-only strings as empty', () => {
    expect(isEmpty(null)).toBe(true);
    expect(isEmpty(undefined)).toBe(true);
    expect(isEmpty('')).toBe(true);
    expect(isEmpty('   ')).toBe(true);
    expect(isEmpty('\t\n  ')).toBe(true);
  });

  it('treats numbers (including 0), booleans, dates, and non-empty strings as non-empty', () => {
    expect(isEmpty(0)).toBe(false);
    expect(isEmpty(1)).toBe(false);
    expect(isEmpty(false)).toBe(false);
    expect(isEmpty(true)).toBe(false);
    expect(isEmpty(new Date())).toBe(false);
    expect(isEmpty('x')).toBe(false);
    expect(isEmpty(' x ')).toBe(false);
  });
});

describe('IFEMPTY', () => {
  it('returns the fallback for empty values per ADR-0007', () => {
    expect(functions.IFEMPTY('', '-')).toBe('-');
    expect(functions.IFEMPTY('   ', '-')).toBe('-');
    expect(functions.IFEMPTY(null, '-')).toBe('-');
    expect(functions.IFEMPTY(undefined, '-')).toBe('-');
  });

  it('preserves non-empty values, including 0 and false', () => {
    expect(functions.IFEMPTY('hello', '-')).toBe('hello');
    expect(functions.IFEMPTY(0, '-')).toBe(0);
    expect(functions.IFEMPTY(false, '-')).toBe(false);
  });
});

describe('isTruthy (ADR-0008)', () => {
  it('treats false, 0, and empty values as falsy', () => {
    expect(isTruthy(false)).toBe(false);
    expect(isTruthy(0)).toBe(false);
    expect(isTruthy('')).toBe(false);
    expect(isTruthy('  ')).toBe(false);
    expect(isTruthy(null)).toBe(false);
    expect(isTruthy(undefined)).toBe(false);
  });

  it('treats every other value as truthy, including the strings "0" and "false"', () => {
    expect(isTruthy(true)).toBe(true);
    expect(isTruthy(1)).toBe(true);
    expect(isTruthy(-1)).toBe(true);
    expect(isTruthy('hello')).toBe(true);
    expect(isTruthy('0')).toBe(true);
    expect(isTruthy('false')).toBe(true);
    expect(isTruthy('FALSE')).toBe(true);
    expect(isTruthy(new Date())).toBe(true);
  });
});

describe('IF (ADR-0008)', () => {
  it('routes truthy and falsy values to the matching branch', () => {
    expect(functions.IF(true, 'y', 'n')).toBe('y');
    expect(functions.IF(false, 'y', 'n')).toBe('n');
    expect(functions.IF(0, 'y', 'n')).toBe('n');
    expect(functions.IF(1, 'y', 'n')).toBe('y');
    expect(functions.IF('', 'y', 'n')).toBe('n');
    expect(functions.IF('  ', 'y', 'n')).toBe('n');
    expect(functions.IF('hello', 'y', 'n')).toBe('y');
  });

  it('does not special-case the strings "0" or "false"', () => {
    expect(functions.IF('0', 'y', 'n')).toBe('y');
    expect(functions.IF('false', 'y', 'n')).toBe('y');
  });
});

describe('canonicalString (ADR-0009)', () => {
  it('renders empty values as the empty string', () => {
    expect(canonicalString(null)).toBe('');
    expect(canonicalString(undefined)).toBe('');
    expect(canonicalString('')).toBe('');
    expect(canonicalString('   ')).toBe('');
  });

  it('renders Booleans uppercase per Excel convention', () => {
    expect(canonicalString(true)).toBe('TRUE');
    expect(canonicalString(false)).toBe('FALSE');
  });

  it('renders numbers with shortest round-trippable form', () => {
    expect(canonicalString(0)).toBe('0');
    expect(canonicalString(1)).toBe('1');
    expect(canonicalString(1.5)).toBe('1.5');
    expect(canonicalString(-3.14)).toBe('-3.14');
    expect(canonicalString(1234)).toBe('1234');
  });

  it('passes strings through verbatim', () => {
    expect(canonicalString('hello')).toBe('hello');
    expect(canonicalString('  hello  ')).toBe('  hello  ');
  });
});

describe('compareValues (ADR-0009)', () => {
  it('treats two empty values as equal', () => {
    expect(compareValues('', '')).toBe(0);
    expect(compareValues(null, '   ')).toBe(0);
    expect(compareValues(undefined, null)).toBe(0);
  });

  it('orders empty values below non-empty values', () => {
    expect(compareValues('', 'x')).toBe(-1);
    expect(compareValues('x', '')).toBe(1);
    expect(compareValues(null, 0)).toBe(-1);
  });

  it('compares numbers and numeric strings numerically', () => {
    expect(compareValues(2, 10)).toBe(-1);
    expect(compareValues('2', 10)).toBe(-1);
    expect(compareValues('150', 100)).toBe(1);
    expect(compareValues(5, 5)).toBe(0);
  });

  it('compares Booleans with FALSE < TRUE', () => {
    expect(compareValues(false, true)).toBe(-1);
    expect(compareValues(true, false)).toBe(1);
    expect(compareValues(true, true)).toBe(0);
  });

  it('falls back to code-point string order for mixed/non-numeric types', () => {
    // No locale collation: ASCII A (0x41) < CJK 가 (0xAC00).
    expect(compareValues('Acme', '가나')).toBe(-1);
    expect(compareValues('가나', 'Acme')).toBe(1);
  });

  it('uses canonical string forms in the fallback (TRUE/FALSE uppercase)', () => {
    // "TRUE" < "x" because 'T' (0x54) < 'x' (0x78). canonicalString(true) = "TRUE".
    expect(compareValues(true, 'x')).toBe(-1);
  });
});

describe('eq/ne/gt/lt via compareValues (ADR-0009)', () => {
  it('routes IF comparison ops through compareValues', () => {
    expect(functions.eq('150', 150)).toBe(true);
    expect(functions.gt('200', 150)).toBe(true);
    expect(functions.lt(0, 1)).toBe(true);
    expect(functions.eq(true, true)).toBe(true);
    expect(functions.ne('TRUE', true)).toBe(false); // canonical string match
  });

  it('handles non-numeric mixed comparisons via canonical-string fallback', () => {
    // "foo" is not numeric. "100" is. Mixed → fallback to string compare.
    // canonicalString("foo") = "foo"; canonicalString(100) = "100".
    // "100" < "foo" code-point order. So foo > 100 in fallback.
    expect(functions.gt('foo', 100)).toBe(true);
  });
});

describe('concat uses canonical string form (ADR-0009)', () => {
  it('renders booleans uppercase and integers without trailing decimal', () => {
    expect(functions.concat(true, ' (', 0, ')')).toBe('TRUE (0)');
    expect(functions.concat(false, '/', true)).toBe('FALSE/TRUE');
  });

  it('renders empty values as the empty string', () => {
    expect(functions.concat('[', null, ']')).toBe('[]');
    expect(functions.concat('[', '   ', ']')).toBe('[]');
  });
});

describe('COUNT([field])', () => {
  it('counts non-empty values in the provided row set per ADR-0007', () => {
    expect(functions.countRows([
      { Memo: 'hello' },
      { Memo: '' },
      { Memo: null },
      { Memo: '   ' },
      { Memo: 'world' },
      { Memo: 0 },
      { Memo: false },
    ], 'Memo')).toBe(4);
  });
});

describe('date arithmetic (ADR-0019 amendment, 2026-05-18)', () => {
  it('YEAR/MONTH/DAY extract UTC components', () => {
    const d = new Date(Date.UTC(2026, 4, 18, 9, 30, 0));  // 2026-05-18T09:30Z
    expect(functions.YEAR(d)).toBe(2026);
    expect(functions.MONTH(d)).toBe(5);
    expect(functions.DAY(d)).toBe(18);
  });

  it('YEAR accepts an ISO date string and reads UTC', () => {
    expect(functions.YEAR('2026-05-18')).toBe(2026);
    expect(functions.MONTH('2026-12-31')).toBe(12);
    expect(functions.DAY('2026-12-31')).toBe(31);
  });

  it('YEAR rejects non-date input with type-mismatch', () => {
    expect(() => functions.YEAR('not a date')).toThrow(/YEAR\(\) expected a date/);
  });

  it('EOMONTH returns the last day of the offset month at UTC midnight', () => {
    const d = new Date(Date.UTC(2026, 4, 18));  // 2026-05-18
    const eom = functions.EOMONTH(d, 0) as Date;
    expect(eom.getUTCFullYear()).toBe(2026);
    expect(eom.getUTCMonth()).toBe(4);   // May
    expect(eom.getUTCDate()).toBe(31);
    expect(eom.getUTCHours()).toBe(0);

    const eomNext = functions.EOMONTH(d, 1) as Date;
    expect(eomNext.getUTCMonth()).toBe(5); // June
    expect(eomNext.getUTCDate()).toBe(30);

    const eomPrev = functions.EOMONTH(d, -3) as Date;
    expect(eomPrev.getUTCFullYear()).toBe(2026);
    expect(eomPrev.getUTCMonth()).toBe(1); // February
    expect(eomPrev.getUTCDate()).toBe(28);
  });

  it('EDATE returns the same day-of-month, clamped at month length', () => {
    const d = new Date(Date.UTC(2026, 0, 31));  // 2026-01-31
    const e1 = functions.EDATE(d, 1) as Date;
    // Jan-31 + 1 month → Feb has only 28 days in 2026, clamp.
    expect(e1.getUTCMonth()).toBe(1);
    expect(e1.getUTCDate()).toBe(28);

    const eNeg = functions.EDATE(d, -1) as Date;
    expect(eNeg.getUTCMonth()).toBe(11);
    expect(eNeg.getUTCFullYear()).toBe(2025);
    expect(eNeg.getUTCDate()).toBe(31);
  });

  it('DATEDIF returns whole-unit counts; negative when start > end', () => {
    const a = new Date(Date.UTC(2025, 0, 1));
    const b = new Date(Date.UTC(2026, 4, 18));
    expect(functions.DATEDIF(a, b, 'Y')).toBe(1);
    expect(functions.DATEDIF(a, b, 'M')).toBe(16);
    expect(functions.DATEDIF(a, b, 'D')).toBe(502);
    expect(functions.DATEDIF(b, a, 'M')).toBe(-16);
  });

  it('DATEDIF unit must be Y, M, or D (case-insensitive)', () => {
    const a = new Date(Date.UTC(2025, 0, 1));
    const b = new Date(Date.UTC(2026, 0, 1));
    expect(functions.DATEDIF(a, b, 'y')).toBe(1);
    expect(() => functions.DATEDIF(a, b, 'W')).toThrow(/DATEDIF\(\) unit must be/);
  });
});

describe('HYPERLINK (ADR-0039)', () => {
  it('returns a marker the renderer unwraps to text+hyperlink', () => {
    const r = functions.HYPERLINK('https://example.com', '보기');
    expect(r).toEqual({ __xl3_hyperlink__: 'https://example.com', text: '보기' });
  });

  it('falls back to the URL as label when label is empty', () => {
    expect(functions.HYPERLINK('https://example.com', '')).toEqual({
      __xl3_hyperlink__: 'https://example.com',
      text: 'https://example.com',
    });
  });

  it('stringifies the marker to its visible label (canonicalString)', () => {
    const r = functions.HYPERLINK('https://x.com', '바로가기');
    expect(canonicalString(r)).toBe('바로가기');
  });

  it('rejects an empty url with type-mismatch', () => {
    expect(() => functions.HYPERLINK('', 'label')).toThrow(/url argument must be a non-empty string/);
    expect(() => functions.HYPERLINK('   ', 'label')).toThrow(/url argument must be a non-empty string/);
  });
});

describe('string functions (ADR-0044)', () => {
  it('UPPER converts letters to uppercase; non-strings via canonicalString', () => {
    expect(functions.UPPER('acme')).toBe('ACME');
    expect(functions.UPPER('서울')).toBe('서울');           // Korean has no case
    expect(functions.UPPER(true)).toBe('TRUE');             // canonicalString first
    expect(functions.UPPER(123)).toBe('123');
    expect(functions.UPPER(null)).toBe('');
    expect(functions.UPPER('')).toBe('');
  });

  it('LOWER mirrors UPPER', () => {
    expect(functions.LOWER('ACME')).toBe('acme');
    expect(functions.LOWER(true)).toBe('true');             // canonicalString gives "TRUE", then lowercased
  });

  it('TRIM strips leading and trailing whitespace; preserves internal', () => {
    expect(functions.TRIM('  acme  ')).toBe('acme');
    expect(functions.TRIM('a  b\tc')).toBe('a  b\tc');      // internal preserved (XTL diverges from Excel TRIM here)
    expect(functions.TRIM('\n   \t서울 강남구  \n')).toBe('서울 강남구');
    expect(functions.TRIM(null)).toBe('');
  });

  it('TRIM preserves U+200B / U+FEFF zero-width characters (ADR-0007 carve-out)', () => {
    // H3 review-followup: ECMAScript .trim() would strip these as whitespace;
    // ADR-0007 explicitly classifies them as content. TRIM must honor that.
    expect(functions.TRIM('​hello')).toBe('​hello');
    expect(functions.TRIM('﻿hello')).toBe('﻿hello');
    expect(functions.TRIM('hello​')).toBe('hello​');
    expect(functions.TRIM('  ​ hello ​  ')).toBe('​ hello ​');
  });
});

describe('IFERROR (ADR-0044)', () => {
  it('returns the value when it is not an error-cell marker', () => {
    expect(functions.IFERROR(42, 'fallback')).toBe(42);
    expect(functions.IFERROR('ok', 'fallback')).toBe('ok');
    expect(functions.IFERROR(0, 'fallback')).toBe(0);
    expect(functions.IFERROR(false, 'fallback')).toBe(false);
    expect(functions.IFERROR('', 'fallback')).toBe('');
  });

  it('returns the fallback when value is an error-cell marker (#DIV/0!)', () => {
    const divErr = { __xl3_error__: '#DIV/0!' };
    expect(functions.IFERROR(divErr, 'guarded')).toBe('guarded');
  });

  it('arity-mismatch on wrong number of args', () => {
    expect(() => functions.IFERROR(1)).toThrow(/IFERROR\(\) takes exactly 2 arguments/);
    expect(() => functions.IFERROR(1, 2, 3)).toThrow(/IFERROR\(\) takes exactly 2 arguments/);
  });
});

describe('IFS (ADR-0044)', () => {
  it('returns the first truthy branch value', () => {
    expect(functions.IFS(false, 'a', true, 'b', true, 'c')).toBe('b');
    expect(functions.IFS(0, 'a', 1, 'b')).toBe('b');                    // 0 is falsy
    expect(functions.IFS('non-empty', 'first')).toBe('first');
  });

  it('the "TRUE, default" idiom is the canonical fallback', () => {
    expect(functions.IFS(false, 'a', false, 'b', true, 'default')).toBe('default');
  });

  it('H2 review-followup — bare TRUE / FALSE literals are real booleans, not strings', () => {
    // Pre-fix, `IFS(false, "a", FOO, "b")` would have matched FOO because
    // non-empty strings are truthy. Now bare TRUE / FALSE evaluate to real
    // booleans; bare FOO falls through to ctx lookup and (per ADR-0028 if
    // applicable) eventually surfaces as a literal string only when no
    // context entry matches. The IFS idiom `(..., TRUE, default)` is sound
    // by design, not by accident.
    // This test calls the function directly with real booleans to confirm
    // the function-level semantics — the literal-recognition path lives in
    // template-eval and is exercised by fixture 128.
    expect(functions.IFS(false, 'a', true, 'b')).toBe('b');
    expect(functions.IFS(false, 'a', false, 'b', true, 'default')).toBe('default');
  });

  it('throws xl3/eval/no-match when no condition is truthy', () => {
    expect(() => functions.IFS(false, 'a', 0, 'b')).toThrow(/IFS\(\) no condition matched/);
  });

  it('arity-mismatch on odd or zero arguments', () => {
    expect(() => functions.IFS()).toThrow(/IFS\(\) requires an even number/);
    expect(() => functions.IFS(true, 'a', false)).toThrow(/IFS\(\) requires an even number/);
  });
});

describe('DATE (ADR-0044)', () => {
  it('composes a UTC-midnight date from 1-based month', () => {
    const d = functions.DATE(2026, 5, 18) as Date;
    expect(d.getUTCFullYear()).toBe(2026);
    expect(d.getUTCMonth()).toBe(4);                   // May = 4 (0-indexed in JS)
    expect(d.getUTCDate()).toBe(18);
    expect(d.getUTCHours()).toBe(0);
  });

  it('rolls over out-of-range month/day (matches Excel DATE semantics)', () => {
    const d = functions.DATE(2026, 13, 1) as Date;
    expect(d.getUTCFullYear()).toBe(2027);
    expect(d.getUTCMonth()).toBe(0);

    const e = functions.DATE(2026, 2, 30) as Date;     // 2026-02-30 → 2026-03-02
    expect(e.getUTCMonth()).toBe(2);
    expect(e.getUTCDate()).toBe(2);
  });

  it('rejects negative year', () => {
    expect(() => functions.DATE(-1, 1, 1)).toThrow(/DATE\(\) year must be non-negative/);
  });

  it('rejects non-finite arguments per argument name', () => {
    expect(() => functions.DATE('abc', 1, 1)).toThrow(/DATE\(\) year must be a finite number/);
    expect(() => functions.DATE(2026, 'xyz', 1)).toThrow(/DATE\(\) month must be a finite number/);
    expect(() => functions.DATE(2026, 1, '')).toThrow(/DATE\(\) day must be a finite number/);
  });

  it('truncates fractional components', () => {
    const d = functions.DATE(2026.7, 5.5, 18.9) as Date;
    expect(d.getUTCFullYear()).toBe(2026);
    expect(d.getUTCMonth()).toBe(4);
    expect(d.getUTCDate()).toBe(18);
  });
});
