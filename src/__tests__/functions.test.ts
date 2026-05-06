import { describe, expect, it } from 'vitest';
import { functions, isEmpty, isTruthy } from '../functions.js';

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
