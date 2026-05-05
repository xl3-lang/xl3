import { describe, expect, it } from 'vitest';
import { functions } from '../functions.js';

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
