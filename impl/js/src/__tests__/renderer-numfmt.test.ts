import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import { convertJson } from '../index.js';
import type { OutputFile, Xl3SourceJson } from '../types.js';

function source(headers: string[], rows: Xl3SourceJson['sources'][string]['rows']): Xl3SourceJson {
  return { version: 'xl3-source-json/0.1', sources: { default: { headers, rows } } };
}

async function load(file: OutputFile): Promise<ExcelJS.Workbook> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(
    file.data.buffer.slice(file.data.byteOffset, file.data.byteOffset + file.data.byteLength),
  );
  return workbook;
}

describe('numFmt warned fallback (ADR-0072 / #56)', () => {
  it('preserves placeholders and formatting while continuing to coerce valid rows', async () => {
    const template = new ExcelJS.Workbook();
    const sheet = template.addWorksheet('Report');
    sheet.addRow(['{{ [취소일] }}', '{{ [Amount] }}']);
    sheet.getCell('A1').numFmt = 'mm-dd-yy';
    sheet.getCell('B1').numFmt = '0.00';
    const [file] = await convertJson(
      await template.xlsx.writeBuffer(),
      source(
        ['취소일', 'Amount', 'ID'],
        [
          ['-', 'N/A', 1],
          ['  -  ', '  not-a-number  ', 2],
          ['', null, 3],
          ['2026-11-13', '1,234.50', 4],
          [46000, true, 5],
        ],
      ),
    );
    const output = (await load(file!)).getWorksheet('Report')!;
    expect(output.getCell('A1').value).toBe('-');
    expect(output.getCell('B1').value).toBe('N/A');
    expect(output.getCell('A2').value).toBe('  -  ');
    expect(output.getCell('B2').value).toBe('  not-a-number  ');
    expect(output.getCell('A3').value).toBe('');
    expect(output.getCell('B3').value).toBe('');
    expect(output.getCell('A4').value).toEqual(new Date('2026-11-13T00:00:00Z'));
    expect(output.getCell('B4').value).toBe(1234.5);
    expect(output.getCell('A5').value).toBeInstanceOf(Date);
    expect(output.getCell('B5').value).toBe(1);
    for (let row = 1; row <= 5; row++) {
      expect(output.getCell(`A${row}`).numFmt).toBe('mm-dd-yy');
      expect(output.getCell(`B${row}`).numFmt).toBe('0.00');
    }
    expect(file!.warnings).toEqual([
      {
        code: 'xl3w/cell/numfmt-coercion',
        message: 'Value cannot be coerced to a date for cell format "mm-dd-yy": -',
        location: 'sheet "Report" cell A1 column "취소일"',
      },
      {
        code: 'xl3w/cell/numfmt-coercion',
        message: 'Value cannot be coerced to a number for cell format "0.00": N/A',
        location: 'sheet "Report" cell B1 column "Amount"',
      },
      {
        code: 'xl3w/cell/numfmt-coercion',
        message: 'Value cannot be coerced to a date for cell format "mm-dd-yy": -',
        location: 'sheet "Report" cell A2 column "취소일"',
      },
      {
        code: 'xl3w/cell/numfmt-coercion',
        message: 'Value cannot be coerced to a number for cell format "0.00": not-a-number',
        location: 'sheet "Report" cell B2 column "Amount"',
      },
    ]);
  });

  it('reports final cell addresses in row order after expanding a block beside static cells', async () => {
    const template = new ExcelJS.Workbook();
    const sheet = template.addWorksheet('Report');
    for (const address of ['A1', 'B3', 'G3']) {
      sheet.getCell(address).value = '{{ "-" }}';
      sheet.getCell(address).numFmt = '0.00';
    }
    sheet.getCell('B2').value = '{{ [Value] }}';
    sheet.getCell('B2').numFmt = 'yyyy-mm-dd';
    const [file] = await convertJson(
      await template.xlsx.writeBuffer(),
      source(['Value'], [['-'], ['N/A']]),
    );
    const output = (await load(file!)).getWorksheet('Report')!;
    expect(output.getCell('B4').value).toBe('-');
    expect(output.getCell('G3').value).toBe('-');
    expect(file!.warnings?.map((w) => w.location)).toEqual([
      'sheet "Report" cell A1',
      'sheet "Report" cell B2 column "Value"',
      'sheet "Report" cell B3 column "Value"',
      'sheet "Report" cell G3',
      'sheet "Report" cell B4',
    ]);
  });

  it('orders warnings across rows of a horizontal repeat', async () => {
    const template = new ExcelJS.Workbook();
    const sheet = template.addWorksheet('Report');
    sheet.addRows([['{{ @repeat right }}'], ['{{ [Date] }}'], ['{{ [Amount] }}']]);
    sheet.getCell('A2').numFmt = 'yyyy-mm-dd';
    sheet.getCell('A3').numFmt = '0.00';
    const [file] = await convertJson(
      await template.xlsx.writeBuffer(),
      source(
        ['Date', 'Amount'],
        [
          ['-', 'N/A'],
          ['unknown', '-'],
        ],
      ),
    );
    const output = (await load(file!)).getWorksheet('Report')!;
    expect(output.getCell('A1').value).toBe('-');
    expect(output.getCell('B1').value).toBe('unknown');
    expect(output.getCell('A2').value).toBe('N/A');
    expect(output.getCell('B2').value).toBe('-');
    expect(output.getCell('B1').numFmt).toBe('yyyy-mm-dd');
    expect(file!.warnings?.map((w) => w.location)).toEqual([
      'sheet "Report" cell A1 column "Date"',
      'sheet "Report" cell B1 column "Date"',
      'sheet "Report" cell A2 column "Amount"',
      'sheet "Report" cell B2 column "Amount"',
    ]);
  });

  it('warns for grouped data and subtotal cells without interrupting group emission', async () => {
    const template = new ExcelJS.Workbook();
    const sheet = template.addWorksheet('Report');
    sheet.addRows([
      ['{{ @group [Category] }}'],
      ['{{ [Category] }}', '{{ [Amount] }}'],
      ['{{ "Subtotal" }}', '{{ @subtotal SUM([Amount]) }}'],
      ['{{ "Footer" }}'],
    ]);
    for (const address of ['A2', 'A3', 'A4']) sheet.getCell(address).numFmt = '0.00';
    const [file] = await convertJson(
      await template.xlsx.writeBuffer(),
      source(
        ['Category', 'Amount'],
        [
          ['A', 10],
          ['A', 20],
          ['B', 30],
        ],
      ),
    );
    const output = (await load(file!)).getWorksheet('Report')!;
    expect(output.getCell('B3').value).toBe(30);
    expect(output.getCell('B5').value).toBe(30);
    expect(output.getCell('A6').value).toBe('Footer');
    expect(file!.warnings?.map((w) => w.location)).toEqual([
      'sheet "Report" cell A1 column "Category"',
      'sheet "Report" cell A2 column "Category"',
      'sheet "Report" cell A3',
      'sheet "Report" cell A4 column "Category"',
      'sheet "Report" cell A5',
      'sheet "Report" cell A6',
    ]);
  });

  it.each([true, false])(
    'keeps warning addresses correct when the first of two blocks is empty: %s',
    async (empty) => {
      const template = new ExcelJS.Workbook();
      const sheet = template.addWorksheet('Report');
      sheet.addRow([
        '{{ @block A2:B2 }}',
        empty ? '{{ @filter [Amount] > 100 }}' : '',
        null,
        '{{ @block D2:E2 }}',
      ]);
      sheet.getCell('A2').value = '{{ [Value] }}';
      sheet.getCell('D2').value = '{{ default[Value] }}';
      sheet.getCell('A3').value = '{{ "Footer" }}';
      sheet.getCell('G3').value = '{{ "Side" }}';
      for (const address of ['A2', 'D2', 'A3', 'G3']) sheet.getCell(address).numFmt = '0.00';
      const [file] = await convertJson(
        await template.xlsx.writeBuffer(),
        source(
          ['Value', 'Amount'],
          [
            ['-', 10],
            ['N/A', 20],
          ],
        ),
      );
      const output = (await load(file!)).getWorksheet('Report')!;
      expect(output.getCell(empty ? 'A1' : 'A3').value).toBe('Footer');
      expect(output.getCell('G2').value).toBe('Side');
      expect(file!.warnings?.map((w) => w.location)).toEqual(
        empty
          ? [
              'sheet "Report" cell A1',
              'sheet "Report" cell D1 column "Value"',
              'sheet "Report" cell D2 column "Value"',
              'sheet "Report" cell G2',
            ]
          : [
              'sheet "Report" cell A1 column "Value"',
              'sheet "Report" cell D1 column "Value"',
              'sheet "Report" cell A2 column "Value"',
              'sheet "Report" cell D2 column "Value"',
              'sheet "Report" cell G2',
              'sheet "Report" cell A3',
            ],
      );
    },
  );

  it('merges filename warnings and isolates diagnostics between output files and sheets', async () => {
    const template = new ExcelJS.Workbook();
    template.addWorksheet('__config__').addRow(['output_file_pattern', '{{ Region }}.xlsx']);
    const sheet = template.addWorksheet('{{Region}}');
    sheet.getCell('A1').value = '{{ [Date] }}';
    sheet.getCell('A1').numFmt = 'yyyy-mm-dd';
    const files = await convertJson(
      await template.xlsx.writeBuffer(),
      source(
        ['Region', 'Date'],
        [
          ['bad/name', '-'],
          ['Good', '2026-11-13'],
        ],
      ),
    );
    expect(files.map((file) => file.filename)).toEqual(['bad_name.xlsx', 'Good.xlsx']);
    expect(files[0]!.warnings?.map((w) => w.code)).toEqual([
      'xl3w/filename/sanitized',
      'xl3w/cell/numfmt-coercion',
    ]);
    expect(files[0]!.warnings?.[1]!.location).toBe('sheet "bad_name" cell A1 column "Date"');
    expect(files[1]!.warnings).toEqual([]);
  });

  it('keeps General, text, mixed text, empty values, and formula errors on their existing paths', async () => {
    const template = new ExcelJS.Workbook();
    const sheet = template.addWorksheet('Report');
    sheet.addRow([
      '{{ [Value] }}',
      '{{ [Value] }}',
      'Value: {{ [Value] }}',
      '{{ 1 / 0 }}',
      '{{ [Empty] }}',
      '{{ [Empty] }}',
      '{{ HYPERLINK("https://example.com", "Link") }}',
    ]);
    sheet.getCell('B1').numFmt = '@';
    for (const address of ['C1', 'D1', 'E1', 'G1']) sheet.getCell(address).numFmt = '0.00';
    sheet.getCell('F1').numFmt = 'yyyy-mm-dd';
    const [file] = await convertJson(
      await template.xlsx.writeBuffer(),
      source(['Value', 'Empty'], [['-', null]]),
    );
    const output = (await load(file!)).getWorksheet('Report')!;
    expect(output.getCell('A1').value).toBe('-');
    expect(output.getCell('B1').value).toBe('-');
    expect(output.getCell('C1').value).toBe('Value: -');
    expect(output.getCell('D1').value).toEqual({ error: '#DIV/0!' });
    expect(output.getCell('E1').value).toBe('');
    expect(output.getCell('F1').value).toBe('');
    expect(output.getCell('G1').value).toEqual({ text: 'Link', hyperlink: 'https://example.com' });
    expect(file!.warnings).toEqual([]);
  });

  it('renders source error sentinels as empty without coercion warnings', async () => {
    const template = new ExcelJS.Workbook();
    const sheet = template.addWorksheet('Report');
    sheet.addRow(['{{ [Error] }}', '{{ [Error] }}']);
    sheet.getCell('A1').numFmt = 'yyyy-mm-dd';
    sheet.getCell('B1').numFmt = '0.00';
    const errors = ['#N/A', '#VALUE!', '#REF!', '#NAME?', '#NUM!', '#NULL!', '#DIV/0!'];
    const [file] = await convertJson(
      await template.xlsx.writeBuffer(),
      source(
        ['Error', 'ID'],
        errors.map((value, i) => [{ type: 'error', value }, i + 1]),
      ),
    );
    const output = (await load(file!)).getWorksheet('Report')!;
    for (let row = 1; row <= errors.length; row++) {
      expect(output.getCell(`A${row}`).value).toBe('');
      expect(output.getCell(`B${row}`).value).toBe('');
    }
    expect(file!.warnings).toEqual([]);
  });

  it('reports only the anchor of a merged cell', async () => {
    const template = new ExcelJS.Workbook();
    const sheet = template.addWorksheet('Report');
    sheet.mergeCells('A1:B1');
    sheet.getCell('A1').value = '{{ [Value] }}';
    sheet.getCell('A1').numFmt = 'yyyy-mm-dd';
    const [file] = await convertJson(await template.xlsx.writeBuffer(), source(['Value'], [['-']]));
    const output = (await load(file!)).getWorksheet('Report')!;
    expect(output.model.merges).toEqual(['A1:B1']);
    expect(output.getCell('A1').value).toBe('-');
    expect(file!.warnings?.map((w) => w.location)).toEqual([
      'sheet "Report" cell A1 column "Value"',
    ]);
  });
});
