import ExcelJS from 'exceljs';
import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';
import {
  analyze,
  convert,
  convertJson,
  previewJson,
  validateSourceJson,
  writeConfigSheet,
} from '../index.js';
import type { TemplateMeta, Xl3SourceJson } from '../types.js';

const data: Xl3SourceJson = {
  version: 'xl3-source-json/0.1',
  sources: {
    default: {
      headers: ['Item', 'Amount'],
      rows: [
        ['A', 10],
        ['B', 20],
        ['C', 30],
      ],
    },
  },
};

function template(mode: TemplateMeta['formula_mode'] = 'adjust'): ExcelJS.Workbook {
  const workbook = new ExcelJS.Workbook();
  writeConfigSheet(workbook, {
    name: 'Formula references',
    description: '',
    source_sheet: 'Raw',
    source_table: '1',
    output_file_pattern: 'out.xlsx',
    match_pattern: '*',
    formula_mode: mode,
  });
  const sheet = workbook.addWorksheet('Report');
  sheet.addRow(['Item', 'Amount', 'Double']);
  sheet.addRow(['{{ [Item] }}', '{{ [Amount] }}', { formula: 'B2*2', result: 999 }]);
  sheet.addRow(['Total', { formula: 'SUM(B2:B2)', result: 999 }]);
  return workbook;
}

async function bytes(workbook: ExcelJS.Workbook): Promise<ArrayBuffer> {
  return (await workbook.xlsx.writeBuffer()) as ArrayBuffer;
}

async function render(workbook: ExcelJS.Workbook, input = data) {
  const outputs = await convertJson(await bytes(workbook), input);
  const output = new ExcelJS.Workbook();
  if (outputs[0]) await output.xlsx.load(outputs[0].data as unknown as ExcelJS.Buffer);
  return { output, outputs, sheet: output.getWorksheet('Report')! };
}

describe('opt-in formula adjustment (ADR-0080)', () => {
  it('adjusts repeated formulas and footer ranges, clears caches and requests recalculation', async () => {
    const workbook = template();
    const ws = workbook.getWorksheet('Report')!;
    ws.getCell('B2').numFmt = '#,##0.00';
    ws.getCell('C2').font = { bold: true };
    ws.getRow(2).height = 28;
    ws.getCell('C3').value = { formula: 'B3*2', result: 1998 };
    const { sheet, outputs } = await render(workbook);
    expect([2, 3, 4].map((r) => sheet.getCell(`C${r}`).formula)).toEqual(['B2*2', 'B3*2', 'B4*2']);
    expect([2, 3, 4].map((r) => sheet.getCell(`B${r}`).value)).toEqual([10, 20, 30]);
    expect(sheet.getCell('B5').formula).toBe('SUM(B2:B4)');
    expect(sheet.getCell('C5').formula).toBe('B5*2');
    expect(sheet.getCell('A5').value).toBe('Total');
    for (const r of [2, 3, 4]) {
      expect(sheet.getCell(`B${r}`).numFmt).toBe('#,##0.00');
      expect(sheet.getCell(`C${r}`).font.bold).toBe(true);
      expect(sheet.getRow(r).height).toBe(28);
      expect(sheet.getCell(`C${r}`).result).toBeUndefined();
    }
    expect(sheet.getCell('B5').result).toBeUndefined();
    const zip = await JSZip.loadAsync(outputs[0]!.data);
    expect(await zip.file('xl/workbook.xml')!.async('string')).toContain('fullCalcOnLoad="1"');
  });

  it.each([
    ['B2+$B2+B$2+$B$2', 'B4+$B4+B$2+$B$2'],
    ['IF(B2>0,"B2 ""quoted""",B2)', 'IF(B4>0,"B2 ""quoted""",B4)'],
    ['LOG10(B2)+1E3+2.5e-2', 'LOG10(B4)+1E3+2.5e-2'],
    ['SUM(B$2:B2)', 'SUM(B$2:B4)'],
    ['SUM($B:$B)', 'SUM($B:$B)'],
    ['IF(TRUE,b2,FALSE)', 'IF(TRUE,b4,FALSE)'],
    ['SUM(B2 (B2:B2))', 'SUM(B4 (B4:B4))'],
    ['SUM(B2 (B$2:B2))', 'SUM(B4 (B$2:B4))'],
    ['LOG10 (B2)', 'LOG10 (B4)'],
    ['ROW(C2)', 'ROW(C4)'],
    ['COLUMN(C2)', 'COLUMN(C4)'],
    ['ROWS(C2:C2)', 'ROWS(C4:C4)'],
    ['COLUMNS(C2:C2)', 'COLUMNS(C4:C4)'],
    ['ROW ( ( C2 ) )', 'ROW ( ( C4 ) )'],
    ['SUM(ROW(C2))', 'SUM(ROW(C4))'],
    ['ROWS(C:C)', 'ROWS(C:C)'],
  ])(
    'translates %s without changing strings, functions or fixed rows',
    async (formula, expected) => {
      const workbook = template();
      workbook.getWorksheet('Report')!.getCell('C2').value = { formula };
      const { sheet } = await render(workbook);
      expect(sheet.getCell('C4').formula).toBe(expected);
    },
  );

  it('moves absolute references during structural insertion, without moving them during copying', async () => {
    const workbook = template();
    const ws = workbook.getWorksheet('Report')!;
    ws.getCell('C2').value = { formula: '$B$3' };
    ws.getCell('D1').value = { formula: 'SUM($B$2:$B$2)' };
    const { sheet } = await render(workbook);
    expect([2, 3, 4].map((r) => sheet.getCell(`C${r}`).formula)).toEqual(['$B$5', '$B$5', '$B$5']);
    expect(sheet.getCell('D1').formula).toBe('SUM($B$2:$B$4)');
  });

  it('adjusts original coordinates after removing directive rows', async () => {
    const workbook = template();
    const ws = workbook.getWorksheet('Report')!;
    ws.spliceRows(2, 0, ['{{ @block A3:C3 }}']);
    ws.getCell('C3').value = { formula: 'B3*2' };
    ws.getCell('B4').value = { formula: 'SUM(B3:B3)' };
    const { sheet } = await render(workbook);
    expect(sheet.getCell('C4').formula).toBe('B4*2');
    expect(sheet.getCell('B5').formula).toBe('SUM(B2:B4)');
  });

  it('keeps side cells stationary while updating their references into the block', async () => {
    const workbook = template();
    const ws = workbook.getWorksheet('Report')!;
    ws.getCell('E3').value = { formula: 'SUM(B2:B2)' };
    const { sheet } = await render(workbook);
    expect(sheet.getCell('E3').formula).toBe('SUM(B2:B4)');
    expect(sheet.getCell('E5').value).toBeNull();
  });

  it('expands complete multi-row record ranges and uses the record height for copied references', async () => {
    const workbook = template();
    const ws = workbook.getWorksheet('Report')!;
    ws.getCell('A3').value = '{{ [Item] }}';
    ws.getCell('B3').value = '{{ [Amount] }}';
    ws.getCell('C3').value = { formula: 'B3*3' };
    ws.getCell('A4').value = 'Total';
    ws.getCell('B4').value = { formula: 'SUM(B2:B3)' };
    const { sheet } = await render(workbook);
    expect(sheet.getCell('C6').formula).toBe('B6*2');
    expect(sheet.getCell('C7').formula).toBe('B7*3');
    expect(sheet.getCell('B8').formula).toBe('SUM(B2:B7)');
  });

  it('resolves shared formula slaves before copying a multi-row record', async () => {
    const workbook = template();
    const ws = workbook.getWorksheet('Report')!;
    ws.getCell('A3').value = '{{ [Item] }}';
    ws.getCell('B3').value = '{{ [Amount] }}';
    ws.getCell('C2').value = {
      formula: 'B2*2',
      shareType: 'shared',
      ref: 'C2:C3',
    } as ExcelJS.CellValue;
    ws.getCell('C3').value = { sharedFormula: 'C2' };
    const { sheet } = await render(workbook);
    expect([2, 3, 4, 5, 6, 7].map((r) => sheet.getCell(`C${r}`).formula)).toEqual(
      [2, 3, 4, 5, 6, 7].map((r) => `B${r}*2`),
    );
  });

  it('keeps legacy formula text when the mode is omitted or preserve', async () => {
    for (const mode of [undefined, 'preserve'] as const) {
      const workbook = template('preserve');
      if (!mode) workbook.getWorksheet('__config__')!.spliceRows(7, 1);
      const { sheet } = await render(workbook);
      expect(sheet.getCell('C4').formula).toBe('B2*2');
      expect(sheet.getCell('B5').formula).toBe('SUM(B2:B2)');
    }
  });

  it('handles one record and retains the existing empty-source output policy', async () => {
    const one = { ...data, sources: { default: { ...data.sources.default!, rows: [['A', 10]] } } };
    const { sheet } = await render(template(), one);
    expect(sheet.getCell('C2').formula).toBe('B2*2');
    expect(sheet.getCell('B3').formula).toBe('SUM(B2:B2)');
    const empty = { ...data, sources: { default: { ...data.sources.default!, rows: [] } } };
    const adjusted = await convertJson(await bytes(template()), empty);
    const legacy = await convertJson(await bytes(template('preserve')), empty);
    expect(adjusted.map((f) => f.filename)).toEqual(legacy.map((f) => f.filename));
    for (const out of adjusted) {
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(out.data as unknown as ExcelJS.Buffer);
      expect(wb.worksheets).toHaveLength(0);
    }
  });

  it('uses the same adjustment with an XLSX source and auto backend selection', async () => {
    const source = new ExcelJS.Workbook();
    source
      .addWorksheet('Raw')
      .addRows([data.sources.default!.headers, ...data.sources.default!.rows]);
    const out = await convert(await bytes(template()), await bytes(source));
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(out[0]!.data as unknown as ExcelJS.Buffer);
    expect(wb.getWorksheet('Report')!.getCell('C4').formula).toBe('B4*2');
  });

  it.each([
    'Other!B2',
    "'Other sheet'!B2",
    'SUM(Table1[Amount])',
    'NamedAmount*2',
    'INDIRECT("B2")',
    'OFFSET(B2,0,0)',
    'B2#',
    'SUM(2:2)',
    'SUM({1,2})',
  ])('rejects unsupported formula %s with the template cell location', async (formula) => {
    const workbook = template();
    workbook.getWorksheet('Report')!.getCell('C2').value = { formula };
    const buffer = await bytes(workbook);
    for (const operation of [
      () => analyze(buffer),
      () => previewJson(buffer, data),
      () => validateSourceJson(buffer, data),
      () => convertJson(buffer, data),
    ]) {
      await expect(operation()).rejects.toMatchObject({
        code: 'xl3/formula/unsupported-reference',
        message: expect.stringContaining('Report!C2'),
      });
    }
  });

  it.each(['SUM(B:B)', 'SUM(B1:B3)'])(
    'rejects a footer that includes itself: %s',
    async (formula) => {
      const workbook = template();
      workbook.getWorksheet('Report')!.getCell('B3').value = { formula };
      await expect(render(workbook)).rejects.toMatchObject({
        code: 'xl3/formula/invalid-reference',
      });
    },
  );

  it.each(['ROW(C2)+C2', 'ROW(C2+1)', 'SUM(C2 (C2:C2))'])(
    'still rejects actual value dependencies in %s',
    async (formula) => {
      const workbook = template();
      workbook.getWorksheet('Report')!.getCell('C2').value = { formula };
      await expect(render(workbook)).rejects.toMatchObject({
        code: 'xl3/formula/invalid-reference',
      });
    },
  );

  it('rejects a reference into a removed directive row', async () => {
    const workbook = template();
    const ws = workbook.getWorksheet('Report')!;
    ws.getCell('A1').value = '{{ @sort [Amount] asc }}';
    ws.getCell('C2').value = { formula: 'B1' };
    await expect(render(workbook)).rejects.toMatchObject({
      code: 'xl3/formula/invalid-reference',
      message: expect.stringContaining('directive row 1'),
    });
  });

  it('rejects a static range selecting a partial multi-row record', async () => {
    const workbook = template();
    const ws = workbook.getWorksheet('Report')!;
    ws.getCell('A3').value = '{{ [Item] }}';
    ws.getCell('B3').value = '{{ [Amount] }}';
    ws.getCell('B4').value = { formula: 'SUM(B2:B2)' };
    await expect(render(workbook)).rejects.toMatchObject({
      code: 'xl3/formula/unsupported-reference',
    });
  });

  it('rejects a range crossing the block and a stationary side area', async () => {
    const workbook = template();
    workbook.getWorksheet('Report')!.getCell('F1').value = { formula: 'SUM(B2:E2)' };
    await expect(render(workbook)).rejects.toMatchObject({
      code: 'xl3/formula/unsupported-reference',
    });
  });

  it('rejects references shifted beyond the worksheet bounds', async () => {
    const workbook = template();
    workbook.getWorksheet('Report')!.getCell('C2').value = { formula: 'B1048576' };
    await expect(render(workbook)).rejects.toMatchObject({ code: 'xl3/formula/invalid-reference' });
  });

  it.each(['{{ @repeat right 3 }}', '{{ @group [Item] }}'])(
    'rejects unsupported geometry %s before rendering',
    async (directive) => {
      const workbook = template();
      workbook.getWorksheet('Report')!.getCell('A1').value = directive;
      await expect(analyze(await bytes(workbook))).rejects.toMatchObject({
        code: 'xl3/formula/unsupported-layout',
      });
    },
  );

  it('rejects invalid modes instead of silently preserving formulas', async () => {
    const workbook = template();
    workbook.getWorksheet('__config__')!.getCell('B7').value = 'adjsut';
    await expect(analyze(await bytes(workbook))).rejects.toMatchObject({
      code: 'xl3/formula/invalid-mode',
    });
  });

  it('clears caches on a static formula sheet and preserves a merged header', async () => {
    const workbook = template();
    const ws = workbook.getWorksheet('Report')!;
    ws.mergeCells('E1:F1');
    ws.getCell('E1').value = 'Invoice';
    const staticSheet = workbook.addWorksheet('Info');
    staticSheet.getCell('A1').value = { formula: '2*3', result: 999 };
    const { sheet, output } = await render(workbook);
    expect(sheet.getCell('E1').value).toBe('Invoice');
    expect(sheet.getCell('F1').master.address).toBe('E1');
    expect(output.getWorksheet('Info')!.getCell('A1').value).toEqual({ formula: '2*3' });
  });

  it('rejects array formulas', async () => {
    const workbook = template();
    workbook.getWorksheet('Report')!.getCell('C2').value = {
      formula: 'B2:B3*2',
      shareType: 'array',
      ref: 'C2:C3',
    } as ExcelJS.CellValue;
    await expect(analyze(await bytes(workbook))).rejects.toMatchObject({
      code: 'xl3/formula/unsupported-reference',
    });
  });

  it('rejects multiple explicit blocks on a formula-bearing sheet', async () => {
    const workbook = template();
    const ws = workbook.getWorksheet('Report')!;
    ws.getCell('A1').value = '{{ @block A2:C2 }}';
    ws.getCell('E1').value = '{{ @block E2:E2 }}';
    ws.getCell('E2').value = '{{ [Amount] }}';
    await expect(analyze(await bytes(workbook))).rejects.toMatchObject({
      code: 'xl3/formula/unsupported-layout',
    });
  });

  it('adjusts independently inside dynamically named sheets', async () => {
    const workbook = template();
    workbook.getWorksheet('Report')!.name = '{{ Item }}';
    const { output } = await render(workbook);
    expect(output.worksheets.map((ws) => ws.name)).toEqual(['A', 'B', 'C']);
    for (const ws of output.worksheets) {
      expect(ws.getCell('C2').formula).toBe('B2*2');
      expect(ws.getCell('B3').formula).toBe('SUM(B2:B2)');
    }
  });
});
