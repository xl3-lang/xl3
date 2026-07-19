import { describe, it, expect } from 'vitest';
import ExcelJS from 'exceljs';
import { convert } from '../index.js';

/**
 * ADR-0066 — style-only ghost of outside-block cells.
 *
 * When a column-scoped data block expands, rows below the block's last
 * template row are shifted down by the splice. The restore pass moves
 * outside-block cells back to their original row positions, but it used
 * to clear only the VALUE at the shifted position — the style (borders,
 * fills) stayed behind. The result: an empty, fully-bordered ghost copy
 * of the side summary block rendered below the expanded data.
 *
 * Found in production: 링키지랩 월 정산 template (P3:S14 side summary
 * next to an A4:N4 data block; 348 data rows left a 10-row ghost at
 * rows 352-361).
 *
 * The fix clears `style` alongside `value` at the shifted position, in
 * both renderDataRows and renderGroupedDataRows.
 */

const BORDER: Partial<ExcelJS.Borders> = {
  top: { style: 'thin' },
  left: { style: 'thin' },
  bottom: { style: 'thin' },
  right: { style: 'thin' },
};
const FILL: ExcelJS.Fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FFDDEBF7' },
};

/** True when the cell carries any visible border or pattern fill. */
function hasInk(cell: ExcelJS.Cell): boolean {
  const b = cell.border;
  const hasBorder = !!b && !!(b.top?.style || b.left?.style || b.bottom?.style || b.right?.style);
  const f = cell.fill as ExcelJS.FillPattern | undefined;
  const hasFill = !!f && f.type === 'pattern' && f.pattern !== 'none' && !!f.fgColor;
  return hasBorder || hasFill;
}

function isEmptyValue(v: ExcelJS.CellValue): boolean {
  return v === null || v === undefined || v === '';
}

/** Collect cells in the given columns that have ink but no value. */
function styledEmptyCells(sheet: ExcelJS.Worksheet, cols: number[]): string[] {
  const ghosts: string[] = [];
  sheet.eachRow({ includeEmpty: true }, (row) => {
    for (const c of cols) {
      const cell = row.getCell(c);
      if (hasInk(cell) && isEmptyValue(cell.value)) ghosts.push(cell.address);
    }
  });
  return ghosts;
}

function addConfig(wb: ExcelJS.Workbook) {
  const cfg = wb.addWorksheet('__config__');
  cfg.getCell('A1').value = 'key';
  cfg.getCell('B1').value = 'value';
  cfg.getCell('A2').value = 'source_sheet';
  cfg.getCell('B2').value = 'Raw';
  cfg.getCell('A3').value = 'source_table';
  cfg.getCell('B3').value = '1';
}

async function makeData(n: number) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Raw');
  ws.getCell('A1').value = 'a';
  ws.getCell('B1').value = 'b';
  for (let i = 0; i < n; i++) {
    ws.getCell(`A${i + 2}`).value = i % 2 === 0 ? 'group-1' : 'group-2';
    ws.getCell(`B${i + 2}`).value = 100 * (i + 1);
  }
  return Buffer.from(await wb.xlsx.writeBuffer());
}

async function load(outputs: { data: ArrayBuffer }[]) {
  const result = new ExcelJS.Workbook();
  await result.xlsx.load(new Uint8Array(outputs[0]!.data).buffer);
  return result;
}

describe('ADR-0066 — shifted outside-block cells leave no style-only ghost', () => {
  it('renderDataRows: side summary below the block keeps value+style at the original rows only', async () => {
    const wb = new ExcelJS.Workbook();
    addConfig(wb);
    const main = wb.addWorksheet('Main');
    main.getCell('A3').value = 'a';
    main.getCell('B3').value = 'b';
    // Data block (col-scoped to A:B)
    main.getCell('A4').value = '{{ [a] }}';
    main.getCell('B4').value = '{{ [b] }}';
    // Side summary block BELOW the block's template row — these rows get
    // shifted by the expansion splice and must be restored in place.
    for (const [addr, value] of [
      ['P5', 'TOTAL'],
      ['Q5', 5500],
      ['P6', 'TAX'],
      ['Q6', 550],
    ] as const) {
      const cell = main.getCell(addr);
      cell.value = value;
      cell.border = BORDER;
      cell.fill = FILL;
    }
    const tpl = Buffer.from(await wb.xlsx.writeBuffer());

    const outputs = await convert(
      tpl as unknown as ArrayBuffer,
      (await makeData(10)) as unknown as ArrayBuffer,
      { engine: 'js' },
    );
    const sheet = (await load(outputs)).getWorksheet('Main')!;

    // Restored at original positions, with values and ink intact.
    expect(sheet.getCell('P5').value).toBe('TOTAL');
    expect(sheet.getCell('Q5').value).toBe(5500);
    expect(sheet.getCell('P6').value).toBe('TAX');
    expect(sheet.getCell('Q6').value).toBe(550);
    expect(hasInk(sheet.getCell('P5'))).toBe(true);
    expect(hasInk(sheet.getCell('Q6'))).toBe(true);

    // The bug: shifted positions (row + insertCount = +9 → P14/Q14/P15/Q15)
    // kept borders/fills after their values were cleared. No cell in the
    // side columns may carry ink without a value.
    expect(styledEmptyCells(sheet, [16, 17])).toEqual([]);
  });

  it('renderGroupedDataRows: side cells below a @group/@subtotal block leave no ghost either', async () => {
    const wb = new ExcelJS.Workbook();
    addConfig(wb);
    const main = wb.addWorksheet('Main');
    main.getCell('A1').value = 'a';
    main.getCell('B1').value = 'b';
    main.getCell('A2').value = '{{ @sort [a] }}';
    main.getCell('A3').value = '{{ @group [a] }}';
    main.getCell('A4').value = '{{ [a] }}';
    main.getCell('B4').value = '{{ [b] }}';
    main.getCell('A5').value = 'Subtotal';
    main.getCell('B5').value = '{{ @subtotal SUM([b]) }}';
    // Side summary below the block (template rows 4-5).
    for (const [addr, value] of [
      ['P6', 'TOTAL'],
      ['Q6', 5500],
    ] as const) {
      const cell = main.getCell(addr);
      cell.value = value;
      cell.border = BORDER;
      cell.fill = FILL;
    }
    const tpl = Buffer.from(await wb.xlsx.writeBuffer());

    const outputs = await convert(
      tpl as unknown as ArrayBuffer,
      (await makeData(10)) as unknown as ArrayBuffer,
      { engine: 'js' },
    );
    const sheet = (await load(outputs)).getWorksheet('Main')!;

    // The side cell survives somewhere with value AND ink together…
    let totals = 0;
    sheet.eachRow({ includeEmpty: false }, (row) => {
      const p = row.getCell(16);
      if (p.value === 'TOTAL') {
        totals += 1;
        expect(hasInk(p)).toBe(true);
        expect(row.getCell(17).value).toBe(5500);
      }
    });
    expect(totals).toBe(1);

    // …and never as a style-only ghost.
    expect(styledEmptyCells(sheet, [16, 17])).toEqual([]);
  });
});
