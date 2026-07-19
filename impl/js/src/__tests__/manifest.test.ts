import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import { extractManifest } from '../manifest.js';

describe('extractManifest', () => {
  it('returns an empty manifest for a blank workbook', () => {
    const wb = new ExcelJS.Workbook();
    wb.addWorksheet('Out');
    const m = extractManifest(wb);
    expect(m.styles).toEqual([]);
    expect(m.cells).toEqual({});
    expect(m.merges).toEqual({});
    expect(m.columns).toEqual({});
  });

  it('extracts font / numFmt / alignment / fill', () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Out');
    const a1 = ws.getCell('A1');
    a1.value = 'Header';
    a1.font = { bold: true, name: 'Arial', size: 14 };
    a1.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    a1.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFFFF00' },
    };
    const b1 = ws.getCell('B1');
    b1.value = 1234.5;
    b1.numFmt = '0.00';

    const m = extractManifest(wb);
    expect(m.styles.length).toBeGreaterThanOrEqual(2);
    const a1Style = m.styles[m.cells['Out']!['0,0']!];
    expect(a1Style.font).toMatchObject({ bold: true, name: 'Arial', size: 14 });
    expect(a1Style.alignment).toMatchObject({
      horizontal: 'center',
      vertical: 'middle',
      wrapText: true,
    });
    expect(a1Style.fill).toEqual({ pattern: 'solid', color: 'FFFFFF00' });
    const b1Style = m.styles[m.cells['Out']!['0,1']!];
    expect(b1Style.numFmt).toBe('0.00');
  });

  it('dedupes identical style specs', () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Out');
    for (const ref of ['A1', 'A2', 'B5']) {
      const c = ws.getCell(ref);
      c.value = 'x';
      c.font = { bold: true };
    }
    const m = extractManifest(wb);
    // All three cells share the same bold style → one entry.
    expect(m.styles).toHaveLength(1);
    const styleIdx = m.cells['Out']!['0,0']!;
    expect(m.cells['Out']!['1,0']).toBe(styleIdx);
    expect(m.cells['Out']!['4,1']).toBe(styleIdx);
  });

  it('captures merge ranges and column widths', () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Out');
    ws.getCell('A1').value = 'span';
    ws.mergeCells('A1:B1');
    ws.columns = [{ width: 30 }, { width: 12 }];
    const m = extractManifest(wb);
    expect(m.merges['Out']).toEqual(['A1:B1']);
    expect(m.columns['Out']).toEqual([
      { col: 0, width: 30 },
      { col: 1, width: 12 },
    ]);
  });

  it('skips reserved sheets', () => {
    const wb = new ExcelJS.Workbook();
    const cfg = wb.addWorksheet('__config__');
    cfg.getCell('A1').value = 'name';
    cfg.getCell('A1').font = { bold: true };
    const out = wb.addWorksheet('Out');
    out.getCell('A1').value = 'x';
    out.getCell('A1').font = { italic: true };
    const m = extractManifest(wb);
    expect(Object.keys(m.cells)).toEqual(['Out']);
  });
});
