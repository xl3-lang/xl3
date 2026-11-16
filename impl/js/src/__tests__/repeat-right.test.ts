import { describe, it, expect } from 'vitest';
import ExcelJS from 'exceljs';
import { convertJson } from '../index.js';
import { isXtlError } from '../error-codes.js';

/**
 * Issues #122 / #134 — `@repeat right` blocks.
 *
 * #122: a cell without a `{{ }}` marker inside a right-repeat block was
 * written back as `String(value)`, so numbers and Booleans became text and
 * a formula became the text `[object Object]`. The down-repeat path keeps
 * the original CellValue (ADR-0046); the right-repeat path now does too.
 *
 * #134: `ROW()` inside a right-repeat block raised
 * `xl3/cell/row-outside-repeat` because the record context carried no
 * repeat index.
 */

type Cells = Record<string, ExcelJS.CellValue>;

const NAMES = {
  headers: ['Name', 'Rank'],
  rows: [
    ['Alpha', 2],
    ['Beta', 1],
    ['Gamma', 3],
  ],
};

async function render(
  cells: Cells,
  source: { headers: string[]; rows: unknown[][] } = NAMES,
): Promise<ExcelJS.Worksheet> {
  const template = new ExcelJS.Workbook();
  const sheet = template.addWorksheet('Report');
  for (const [address, value] of Object.entries(cells)) sheet.getCell(address).value = value;

  const files = await convertJson((await template.xlsx.writeBuffer()) as ArrayBuffer, {
    version: 'xl3-source-json/0.1',
    sources: { default: source },
  });
  const output = new ExcelJS.Workbook();
  const data = files[0]!.data;
  await output.xlsx.load(
    data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer,
  );
  return output.getWorksheet('Report')!;
}

const values = (sheet: ExcelJS.Worksheet, ...addresses: string[]) =>
  addresses.map((a) => sheet.getCell(a).value);

describe('#122 @repeat right keeps the original cell values', () => {
  const day = new Date(Date.UTC(2026, 0, 15));

  it('keeps number, Boolean, and formula cells in every record', async () => {
    const sheet = await render({
      A1: '{{ @repeat right 4 }}',
      A2: '{{ [Name] }}',
      B2: 42,
      C2: { formula: '1+1', result: 2 },
      D2: true,
    });
    // Records land in A:D, E:H, I:L on the row the directive row vacated.
    expect(values(sheet, 'A1', 'E1', 'I1')).toEqual(['Alpha', 'Beta', 'Gamma']);
    for (const col of ['B', 'F', 'J']) expect(sheet.getCell(`${col}1`).value).toBe(42);
    for (const col of ['D', 'H', 'L']) expect(sheet.getCell(`${col}1`).value).toBe(true);
    for (const col of ['C', 'G', 'K']) {
      expect(sheet.getCell(`${col}1`).value).toMatchObject({ formula: '1+1' });
    }
  });

  it('keeps date, rich-text, and hyperlink cells in every record', async () => {
    const sheet = await render({
      A1: '{{ @repeat right 4 }}',
      A2: '{{ [Name] }}',
      B2: day,
      C2: { richText: [{ text: 'bold', font: { bold: true } }, { text: ' plain' }] },
      D2: { text: 'site', hyperlink: 'https://example.com/' },
    });
    for (const col of ['B', 'F', 'J']) {
      const v = sheet.getCell(`${col}1`).value;
      expect(v).toBeInstanceOf(Date);
      expect((v as Date).getTime()).toBe(day.getTime());
    }
    for (const col of ['C', 'G', 'K']) {
      const v = sheet.getCell(`${col}1`).value as ExcelJS.CellRichTextValue;
      expect(v.richText.map((r) => r.text).join('')).toBe('bold plain');
      expect(v.richText[0]!.font?.bold).toBe(true);
    }
    for (const col of ['D', 'H', 'L']) {
      expect(sheet.getCell(`${col}1`).value).toMatchObject({
        text: 'site',
        hyperlink: 'https://example.com/',
      });
    }
  });

  it('keeps plain text cells as text', async () => {
    const sheet = await render({
      A1: '{{ @repeat right 2 }}',
      A2: '{{ [Name] }}',
      B2: 'label',
    });
    expect(values(sheet, 'B1', 'D1', 'F1')).toEqual(['label', 'label', 'label']);
  });

  it('keeps the same values in a down-repeat block', async () => {
    const sheet = await render({
      A1: '{{ [Name] }}',
      B1: 42,
      C1: { formula: '1+1', result: 2 },
      D1: true,
    });
    expect(values(sheet, 'A1', 'A2', 'A3')).toEqual(['Alpha', 'Beta', 'Gamma']);
    for (const row of [1, 2, 3]) {
      expect(sheet.getCell(`B${row}`).value).toBe(42);
      expect(sheet.getCell(`C${row}`).value).toMatchObject({ formula: '1+1' });
      expect(sheet.getCell(`D${row}`).value).toBe(true);
    }
  });
});

describe('#134 ROW() in a @repeat right block', () => {
  it('numbers the records from 1', async () => {
    const sheet = await render({
      A1: '{{ @repeat right 2 }}',
      A2: '{{ [Name] }}',
      B2: '{{ ROW() }}',
    });
    expect(values(sheet, 'A1', 'B1', 'C1', 'D1', 'E1', 'F1')).toEqual([
      'Alpha',
      1,
      'Beta',
      2,
      'Gamma',
      3,
    ]);
  });

  it('numbers the records after filter, sort, and top', async () => {
    const sheet = await render({
      A1: '{{ @repeat right 2 }}',
      A2: '{{ @filter [Name] != "Gamma" }}',
      A3: '{{ @sort [Rank] }}',
      A4: '{{ [Name] }}',
      B4: '{{ ROW() }}',
    });
    const row = sheet.getRow(1).values as unknown[];
    expect(row.slice(1)).toEqual(['Beta', 1, 'Alpha', 2]);
  });

  it('matches a down-repeat block', async () => {
    const sheet = await render({ A1: '{{ [Name] }}', B1: '{{ ROW() }}' });
    expect(values(sheet, 'B1', 'B2', 'B3')).toEqual([1, 2, 3]);
  });

  it('is the record index, not the worksheet row', async () => {
    const sheet = await render({
      A1: 'title',
      A3: '{{ @repeat right 2 }}',
      A4: '{{ [Name] }}',
      B4: '{{ ROW() }}',
    });
    const row = (sheet.getRow(3).values as unknown[]).slice(1);
    expect(row).toEqual(['Alpha', 1, 'Beta', 2, 'Gamma', 3]);
  });

  it('still raises outside a repeat block', async () => {
    let code: string | undefined;
    try {
      await render({ A1: '{{ ROW() }}', A3: '{{ @repeat right 1 }}', A4: '{{ [Name] }}' });
    } catch (e) {
      code = isXtlError(e) ? e.code : String(e);
    }
    expect(code).toBe('xl3/cell/row-outside-repeat');
  });
});
