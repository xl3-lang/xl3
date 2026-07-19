import { describe, it, expect } from 'vitest';
import ExcelJS from 'exceljs';
import { convert } from '../index.js';

/**
 * Issue #46 — silent data loss from duplicate shared-formula owners.
 *
 * When a template row carries an OOXML shared-formula owner (`{ formula,
 * ref, shareType: 'shared' }`) alongside the data-block expressions,
 * cloning the row into N expanded rows verbatim produces N "owners" all
 * claiming the same `ref` range. Excel sees the result as corrupt and
 * either drops cells or surfaces a repair dialog.
 *
 * The fix in `src/renderer.ts` normalizes shared formulas to standalone
 * `{ formula }` at capture time — before the clone-to-many pass — so
 * each expanded row gets an independent formula and ExcelJS re-derives
 * the shared range during writeBuffer if all the cells happen to share
 * identical formula text.
 */

async function makeTemplate() {
  const wb = new ExcelJS.Workbook();
  const cfg = wb.addWorksheet('__config__');
  cfg.getCell('A1').value = 'key';
  cfg.getCell('B1').value = 'value';
  cfg.getCell('A2').value = 'source_sheet';
  cfg.getCell('B2').value = 'Raw';
  cfg.getCell('A3').value = 'source_table';
  cfg.getCell('B3').value = '1';

  const main = wb.addWorksheet('Main');
  // Headers
  main.getCell('A3').value = 'a';
  main.getCell('B3').value = 'b';
  main.getCell('P3').value = 'side';
  main.getCell('Q3').value = 'sum';
  // Data block row 4 with shared-formula side cells (this is the
  // exact pattern from the linked production template).
  main.getCell('A4').value = '{{ [a] }}';
  main.getCell('B4').value = '{{ [b] }}';
  main.getCell('P4').value = 'group-1';
  main.getCell('Q4').value = {
    formula: 'SUMIF($A:$A,$P4,$B:$B)',
    ref: 'Q4:Q5',
    shareType: 'shared',
  } as unknown as ExcelJS.CellValue;
  main.getCell('Q5').value = { sharedFormula: 'Q4' } as unknown as ExcelJS.CellValue;
  return Buffer.from(await wb.xlsx.writeBuffer());
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

describe('issue #46 — shared-formula owners do not duplicate across expanded rows', () => {
  it('preserves a single coherent shared range (or all-standalone formulas) when the data block expands to many rows', async () => {
    const tpl = await makeTemplate();
    const data = await makeData(50);
    // engine: 'js' — this test pins the JS renderer's capture-time
    // unshare fix. Without the pin, a locally installed `xl3-wasm`
    // would route engine:'auto' through the wasm core, whose
    // shared-formula handling is tracked separately (xl3-rs#1).
    const outputs = await convert(tpl as unknown as ArrayBuffer, data as unknown as ArrayBuffer, { engine: 'js' });
    expect(outputs).toHaveLength(1);

    const result = new ExcelJS.Workbook();
    await result.xlsx.load(new Uint8Array(outputs[0]!.data).buffer);
    const sheet = result.getWorksheet('Main')!;

    // After fix: count cells in column Q that claim to be shared-formula
    // owners (`shareType === 'shared'`). Before the fix this was N — one
    // owner per cloned row, all sharing the same template `ref`. After:
    // at most 1 (ExcelJS may re-merge into a single coherent shared
    // range during writeBuffer, but never produces N independent owners
    // with the same ref).
    let owners = 0;
    let standalone = 0;
    for (let r = 4; r <= sheet.actualRowCount; r++) {
      const v = sheet.getRow(r).getCell(17).value as Record<string, unknown> | null;
      if (!v || typeof v !== 'object') continue;
      if (v.shareType === 'shared') owners++;
      else if (typeof v.formula === 'string' && !v.shareType) standalone++;
    }
    // The pre-fix bug produced N=50 owners with overlapping ref ranges.
    // We assert ≤ 1 — either ExcelJS auto-merges into one big shared
    // range, or every cell is a standalone formula. Both are valid OOXML.
    expect(owners).toBeLessThanOrEqual(1);
    expect(owners + standalone).toBeGreaterThan(0);
  });

  it('resolves a sharedFormula slave to its owner formula when cloned', async () => {
    const tpl = await makeTemplate();
    const data = await makeData(5);
    const outputs = await convert(tpl as unknown as ArrayBuffer, data as unknown as ArrayBuffer, { engine: 'js' });
    const result = new ExcelJS.Workbook();
    await result.xlsx.load(new Uint8Array(outputs[0]!.data).buffer);
    const sheet = result.getWorksheet('Main')!;

    // Original Q5 was `{sharedFormula:'Q4'}` (slave). After cloning into
    // each expanded row, every Q cell should have a real formula text
    // (resolved from Q4's owner), not a dangling sharedFormula pointer.
    const dangling = [];
    for (let r = 4; r <= sheet.actualRowCount; r++) {
      const v = sheet.getRow(r).getCell(17).value as Record<string, unknown> | null;
      if (v && typeof v === 'object' && typeof v.sharedFormula === 'string') {
        // Only valid if the owner is in the same expansion AND still has
        // a formula. We assert no dangling pointers to deleted rows.
        const ownerCell = sheet.getCell(v.sharedFormula as string);
        const ownerValue = ownerCell.value as Record<string, unknown> | null;
        if (!ownerValue || typeof ownerValue !== 'object' || typeof ownerValue.formula !== 'string') {
          dangling.push(`Q${r} → ${v.sharedFormula}`);
        }
      }
    }
    expect(dangling).toEqual([]);
  });
});
