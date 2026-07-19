import { describe, expect, it } from 'vitest';
import { isDirectiveExpression, parseDirective } from '../directive-parser.js';

describe('isDirectiveExpression', () => {
  it('returns true for known directive prefixes', () => {
    expect(isDirectiveExpression('@filter [x] = 1')).toBe(true);
    expect(isDirectiveExpression('@sort [x] desc')).toBe(true);
    expect(isDirectiveExpression('@top 5')).toBe(true);
    expect(isDirectiveExpression('@repeat right')).toBe(true);
  });

  it('is case-insensitive on the directive name', () => {
    expect(isDirectiveExpression('@FILTER [x] = 1')).toBe(true);
    expect(isDirectiveExpression('@Sort [x]')).toBe(true);
  });

  it('returns false for non-directive expressions', () => {
    expect(isDirectiveExpression('[x]')).toBe(false);
    expect(isDirectiveExpression('SUM([x])')).toBe(false);
    expect(isDirectiveExpression('@unknown thing')).toBe(false);
  });
});

describe('parseDirective: filter', () => {
  it('parses comparison filters with all operators', () => {
    expect(parseDirective('@filter [Status] = "Open"')).toEqual({
      kind: 'filter', field: 'Status', op: '=', value: 'Open',
    });
    expect(parseDirective('@filter [qty] > 10')).toEqual({
      kind: 'filter', field: 'qty', op: '>', value: 10,
    });
    expect(parseDirective('@filter [qty] >= 10')).toEqual({
      kind: 'filter', field: 'qty', op: '>=', value: 10,
    });
    expect(parseDirective('@filter [qty] != 0')).toEqual({
      kind: 'filter', field: 'qty', op: '!=', value: 0,
    });
  });

  it('parses in / !in with a __lists__ structured reference', () => {
    expect(parseDirective('@filter [Customer] in __lists__[Allowed]')).toEqual({
      kind: 'filter', field: 'Customer', op: 'in', value: '', listRef: 'Allowed',
    });
    expect(parseDirective('@filter [Customer] !in __lists__[Excluded]')).toEqual({
      kind: 'filter', field: 'Customer', op: '!in', value: '', listRef: 'Excluded',
    });
  });

  it('rejects in / !in without the __lists__[name] structured form', () => {
    expect(parseDirective('@filter [Customer] in NotAList')).toBeNull();
    expect(parseDirective('@filter [Customer] in _Allowed')).toBeNull();
  });
});

describe('parseDirective: sort', () => {
  it('defaults to asc when direction is omitted', () => {
    expect(parseDirective('@sort [total]')).toEqual({
      kind: 'sort', field: 'total', order: 'asc',
    });
  });

  it('parses asc and desc explicitly, case-insensitive', () => {
    expect(parseDirective('@sort [total] desc')).toEqual({
      kind: 'sort', field: 'total', order: 'desc',
    });
    expect(parseDirective('@sort [total] DESC')).toEqual({
      kind: 'sort', field: 'total', order: 'desc',
    });
  });
});

describe('parseDirective: top', () => {
  it('parses a positive integer count', () => {
    expect(parseDirective('@top 10')).toEqual({ kind: 'top', count: 10 });
  });

  it('rejects non-positive or non-numeric counts', () => {
    expect(parseDirective('@top 0')).toBeNull();
    expect(parseDirective('@top -3')).toBeNull();
    expect(parseDirective('@top abc')).toBeNull();
  });
});

describe('parseDirective: repeat right', () => {
  it('defaults colSpan to 1 when number is omitted (XTL 0.1)', () => {
    expect(parseDirective('@repeat right')).toEqual({
      kind: 'repeat', direction: 'right', colSpan: 1,
    });
  });

  it('uses the explicit colSpan when provided', () => {
    expect(parseDirective('@repeat right 3')).toEqual({
      kind: 'repeat', direction: 'right', colSpan: 3,
    });
  });

  it('rejects non-positive colSpan', () => {
    expect(parseDirective('@repeat right 0')).toBeNull();
  });

  it('rejects unknown directions', () => {
    expect(parseDirective('@repeat down')).toBeNull();
  });
});
