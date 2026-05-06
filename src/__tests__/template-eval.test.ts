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
