import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import {
  convertJson,
  validateSource,
  validateSourceJson,
  writeConfigSheet,
} from '../index.js';
import type { Xl3SourceJson } from '../types.js';

async function toBuffer(workbook: ExcelJS.Workbook): Promise<ArrayBuffer> {
  return await workbook.xlsx.writeBuffer() as ArrayBuffer;
}

async function basicTemplate(sourceTable = '1'): Promise<ArrayBuffer> {
  const workbook = new ExcelJS.Workbook();
  writeConfigSheet(workbook, {
    name: 'Validator',
    description: '',
    source_sheet: 'Raw',
    source_table: sourceTable,
    output_file_pattern: '{{ [Customer] }}.xlsx',
    match_pattern: '*',
  });
  const report = workbook.addWorksheet('Report');
  report.getCell('A1').value = '{{ @filter [Status] = "Open" }}';
  report.getCell('A2').value = '{{ [Customer] }}';
  report.getCell('B2').value = '{{ [Amount] }}';
  return toBuffer(workbook);
}

async function sourceWorkbook(headers: string[], sheetName = 'Raw'): Promise<ArrayBuffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(sheetName);
  headers.forEach((header, idx) => {
    sheet.getCell(1, idx + 1).value = header;
  });
  return toBuffer(workbook);
}

function codes(report: Awaited<ReturnType<typeof validateSource>>): string[] {
  return report.diagnostics.map((d) => d.code);
}

describe('validateSource', () => {
  it('returns ok with the source contract when required headers are present', async () => {
    const report = await validateSource(
      await basicTemplate(),
      await sourceWorkbook(['Customer', 'Status', 'Amount']),
    );

    expect(report.ok).toBe(true);
    expect(report.diagnostics).toEqual([]);
    expect(report.contract.sources).toHaveLength(1);
    expect(report.contract.sources[0]!.name).toBe('default');
    expect(new Set(report.contract.sources[0]!.requiredColumns)).toEqual(
      new Set(['Customer', 'Status', 'Amount']),
    );
  });

  it('treats a missing bare [Column] reference as xl3/source/unknown-column', async () => {
    const report = await validateSource(
      await basicTemplate(),
      await sourceWorkbook(['Customer', 'Status']),
    );

    expect(report.ok).toBe(false);
    expect(report.diagnostics).toEqual([
      expect.objectContaining({
        code: 'xl3/source/unknown-column',
        severity: 'error',
        source: 'default',
        column: 'Amount',
      }),
    ]);
  });

  it('collects multiple header diagnostics instead of stopping at the first one', async () => {
    const workbook = new ExcelJS.Workbook();
    const raw = workbook.addWorksheet('Raw');
    raw.getCell('A1').value = 'Customer';
    raw.getCell('B1').value = '';
    raw.getCell('C1').value = 'Customer';
    raw.getCell('D1').value = 'Rows';
    const report = await validateSource(await basicTemplate(), await toBuffer(workbook));

    expect(report.ok).toBe(false);
    expect(codes(report)).toEqual(expect.arrayContaining([
      'xl3/source/missing-header',
      'xl3/source/duplicate-name',
      'xl3/source/reserved-column-name',
    ]));
  });

  it('returns uncached header formula errors as diagnostics', async () => {
    const workbook = new ExcelJS.Workbook();
    const raw = workbook.addWorksheet('Raw');
    raw.getCell('A1').value = 'Customer';
    raw.getCell('B1').value = { formula: '1+1' };
    raw.getCell('C1').value = 'Status';
    raw.getCell('D1').value = 'Amount';

    const validation = await validateSource(await basicTemplate(), await toBuffer(workbook));

    expect(validation.ok).toBe(false);
    expect(validation.diagnostics).toEqual([
      expect.objectContaining({
        code: 'xl3/cell/formula-no-cache',
        source: 'default',
        sheet: 'Raw',
      }),
    ]);
  });

  it('includes @sort, @group, file group keys, and sheet group keys in the contract', async () => {
    const workbook = new ExcelJS.Workbook();
    writeConfigSheet(workbook, {
      name: 'Validator',
      description: '',
      source_sheet: 'Raw',
      source_table: '1',
      output_file_pattern: '{{ Region }}.xlsx',
      match_pattern: '*',
    });
    const report = workbook.addWorksheet('{{ Branch }}');
    report.getCell('A1').value = '{{ @sort [SortKey] }}';
    report.getCell('A2').value = '{{ @group [GroupKey] }}';
    report.getCell('A3').value = '{{ [Customer] }}';

    const validation = await validateSource(
      await toBuffer(workbook),
      await sourceWorkbook(['Customer']),
    );

    expect(validation.ok).toBe(false);
    expect(validation.diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'xl3/source/unknown-column', source: 'default', column: 'Region' }),
      expect.objectContaining({ code: 'xl3/source/unknown-column', source: 'default', column: 'Branch' }),
      expect.objectContaining({ code: 'xl3/source/unknown-column', source: 'default', column: 'SortKey' }),
      expect.objectContaining({ code: 'xl3/source/unknown-column', source: 'default', column: 'GroupKey' }),
    ]));
  });

  it('does not treat Object prototype keys as schemas for missing named sources', async () => {
    const workbook = new ExcelJS.Workbook();
    writeConfigSheet(workbook, {
      name: 'Validator',
      description: '',
      source_sheet: 'Raw',
      source_table: '1',
      output_file_pattern: 'out.xlsx',
      match_pattern: '*',
    });
    const sources = workbook.addWorksheet('__sources__', { state: 'hidden' });
    sources.addRow(['name', 'sheet', 'table']);
    sources.addRow(['toString', 'Missing', '1']);
    const report = workbook.addWorksheet('Report');
    report.getCell('A1').value = '{{ @source toString }}';
    report.getCell('A2').value = '{{ [Needed] }}';

    const validation = await validateSource(
      await toBuffer(workbook),
      await sourceWorkbook(['Other']),
    );

    expect(validation.diagnostics).toEqual([
      expect.objectContaining({
        code: 'xl3/source/sheet-missing',
        source: 'toString',
      }),
    ]);
  });
});

describe('validateSourceJson', () => {
  async function multiSourceTemplate(cellValues: string | string[]): Promise<ArrayBuffer> {
    const workbook = new ExcelJS.Workbook();
    writeConfigSheet(workbook, {
      name: 'Validator',
      description: '',
      source_sheet: 'Raw',
      source_table: '1',
      output_file_pattern: 'out.xlsx',
      match_pattern: '*',
    });
    const sources = workbook.addWorksheet('__sources__', { state: 'hidden' });
    sources.getCell('A1').value = 'name';
    sources.getCell('B1').value = 'sheet';
    sources.getCell('C1').value = 'table';
    sources.getCell('A2').value = 'Prices';
    sources.getCell('B2').value = 'Prices';
    sources.getCell('C2').value = '1';
    const report = workbook.addWorksheet('Report');
    const values = Array.isArray(cellValues) ? cellValues : [cellValues];
    values.forEach((value, idx) => {
      report.getCell(idx + 1, 1).value = value;
    });
    return toBuffer(workbook);
  }

  it('checks source-prefixed columns such as XLOOKUP arguments', async () => {
    const sourceJson: Xl3SourceJson = {
      version: 'xl3-source-json/0.1',
      sources: {
        default: { headers: ['Sku'], rows: [['A-1']] },
        Prices: { headers: ['Sku'], rows: [['A-1']] },
      },
    };

    const validation = await validateSourceJson(
      await multiSourceTemplate('{{ XLOOKUP([Sku], Prices[Sku], Prices[Price]) }}'),
      sourceJson,
    );

    expect(validation.ok).toBe(false);
    expect(validation.diagnostics).toEqual([
      expect.objectContaining({
        code: 'xl3/source/unknown-column',
        source: 'Prices',
        column: 'Price',
      }),
    ]);
  });

  it('includes @join primary and joined keys in the contract', async () => {
    const validation = await validateSourceJson(
      await multiSourceTemplate([
        '{{ @join Prices on Prices[Sku] = default[Sku] }}',
        '{{ Prices[Price] }}',
      ]),
      {
        version: 'xl3-source-json/0.1',
        sources: {
          default: { headers: ['Customer'], rows: [['Acme']] },
          Prices: { headers: ['Price'], rows: [[100]] },
        },
      },
    );

    expect(validation.ok).toBe(false);
    expect(validation.diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'xl3/source/unknown-column', source: 'default', column: 'Sku' }),
      expect.objectContaining({ code: 'xl3/source/unknown-column', source: 'Prices', column: 'Sku' }),
    ]));
  });

  it('reports source-prefixed row references outside the active source or join as row-cross-block', async () => {
    const validation = await validateSourceJson(
      await multiSourceTemplate('{{ Prices[Price] }}'),
      {
        version: 'xl3-source-json/0.1',
        sources: {
          default: { headers: ['Customer'], rows: [['Acme']] },
          Prices: { headers: ['Price'], rows: [[100]] },
        },
      },
    );

    expect(validation.ok).toBe(false);
    expect(validation.diagnostics).toEqual([
      expect.objectContaining({
        code: 'xl3/source/row-cross-block',
        source: 'Prices',
        column: 'Price',
        location: 'cell:Report!A1',
      }),
    ]);
  });

  it('collects malformed JSON headers and rows instead of throwing', async () => {
    const template = await basicTemplate();
    const invalid = await validateSourceJson(template, {
      version: 'xl3-source-json/0.1',
      sources: {
        default: { headers: [42, '', 'Customer'], rows: {} },
      },
    });

    expect(invalid.ok).toBe(false);
    expect(invalid.diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'xl3/source-json/invalid', source: 'default' }),
      expect.objectContaining({ code: 'xl3/source/missing-header', source: 'default' }),
      expect.objectContaining({ code: 'xl3/source/unknown-column', column: 'Status' }),
      expect.objectContaining({ code: 'xl3/source/unknown-column', column: 'Amount' }),
    ]));
  });

  it('does not scan JSON row values or row lengths at schema depth', async () => {
    const template = await basicTemplate();

    const validation = await validateSourceJson(template, {
      version: 'xl3-source-json/0.1',
      sources: {
        default: { headers: ['Customer', 'Status', 'Amount'], rows: [['only one value']] },
      },
    });
    expect(validation.ok).toBe(true);
    expect(validation.diagnostics).toEqual([]);
  });

  it('returns malformed envelopes as diagnostics', async () => {
    const validation = await validateSourceJson(await basicTemplate(), '{not-json');

    expect(validation.ok).toBe(false);
    expect(validation.diagnostics).toEqual([
      expect.objectContaining({ code: 'xl3/source-json/invalid' }),
    ]);
  });

  it('ignores xlsx sheet/table selectors in JSON mode', async () => {
    const template = await basicTemplate('not-a-table');
    const sourceJson: Xl3SourceJson = {
      version: 'xl3-source-json/0.1',
      sources: {
        default: {
          headers: ['Customer', 'Status', 'Amount'],
          rows: [['Acme', 'Open', 100]],
        },
      },
    };

    await expect(convertJson(template, sourceJson)).resolves.toHaveLength(1);
    const validation = await validateSourceJson(template, sourceJson);

    expect(validation.ok).toBe(true);
    expect(validation.contract.sources[0]).toEqual(expect.objectContaining({
      name: 'default',
      sheet: 'default',
      headerRow: 1,
    }));
  });
});
