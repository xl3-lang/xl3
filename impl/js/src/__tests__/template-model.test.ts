import { describe, expect, it } from 'vitest';
import { toTemplateModel } from '../template-model.js';
import type { ParsedTemplate } from '../types.js';

describe('toTemplateModel', () => {
  it('removes the live workbook without mutating the parsed template', () => {
    const parsed: ParsedTemplate = {
      workbook: { marker: 'live-workbook' } as unknown as ParsedTemplate['workbook'],
      meta: {
        name: 'sample',
        description: '',
        source_sheet: 'Data',
        output_file_pattern: 'output.xlsx',
        match_pattern: '',
      },
      variables: [],
      fileGroupKeys: [],
      sheetTemplates: [],
      listSheets: {},
      configVars: {},
      inputs: [],
      sources: [],
      warnings: [],
    };

    const model = toTemplateModel(parsed);

    expect('workbook' in model).toBe(false);
    expect('workbook' in parsed).toBe(true);
    expect(model.meta).toEqual(parsed.meta);
  });
});
