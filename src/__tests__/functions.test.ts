import { describe, expect, it } from 'vitest';
import { functions, isEmpty } from '../functions.js';

describe('TEXT', () => {
  it('formats the XTL 0.1 date token subset', () => {
    expect(functions.TEXT(new Date(2026, 4, 3, 9, 8, 7), 'YYYY-MM-DD HH:mm:ss'))
      .toBe('2026-05-03 09:08:07');
    expect(functions.TEXT(new Date(2026, 4, 3), 'YY/MM/dd')).toBe('26/05/03');
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
