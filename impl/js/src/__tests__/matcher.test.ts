import { describe, expect, it } from 'vitest';
import { batchMatch } from '../matcher.js';
import type { TemplateMeta } from '../types.js';

function meta(overrides: Partial<TemplateMeta>): TemplateMeta {
  return {
    name: '',
    description: '',
    source_sheet: 'Data',
    output_file_pattern: 'output.xlsx',
    match_pattern: '',
    ...overrides,
  };
}

describe('batchMatch', () => {
  it('matches globs against both the basename and full filename', () => {
    const templates = [
      { id: 'basename', meta: meta({ match_pattern: '2026-??_*' }) },
      { id: 'extension', meta: meta({ match_pattern: '*.csv' }) },
    ];

    expect(batchMatch(['2026-05_customer.xlsx', 'source.csv'], templates)).toEqual([
      {
        filename: '2026-05_customer.xlsx',
        templateId: 'basename',
        matchedBy: 'pattern',
      },
      { filename: 'source.csv', templateId: 'extension', matchedBy: 'pattern' },
    ]);
  });

  it('uses the literal part of a pattern and then template-name similarity', () => {
    const templates = [
      { id: 'literal', meta: meta({ match_pattern: '*거래처*' }) },
      { id: 'name', meta: meta({ name: 'renewal-report' }) },
    ];

    expect(batchMatch(['월간-거래처-정산.xlsx', 'renewal-report-may.xlsx'], templates)).toEqual([
      { filename: '월간-거래처-정산.xlsx', templateId: 'literal', matchedBy: 'pattern' },
      { filename: 'renewal-report-may.xlsx', templateId: 'name', matchedBy: 'name' },
    ]);
  });

  it('normalizes Unicode and returns an explicit unmatched result', () => {
    const decomposed = 'Cafe\u0301';
    const templates = [{ id: 'nfc', meta: meta({ match_pattern: '*Café*' }) }];

    expect(batchMatch([`${decomposed}.xlsx`, 'other.xlsx'], templates)).toEqual([
      { filename: `${decomposed}.xlsx`, templateId: 'nfc', matchedBy: 'pattern' },
      { filename: 'other.xlsx', templateId: '', matchedBy: '' },
    ]);
  });
});
