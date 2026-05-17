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
