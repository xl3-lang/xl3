import ExcelJS from 'exceljs';
import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';
import { ExcelJsWorkbookDocument, extendRangesForExpansion, sanitizeFilename, ZIP_ENTRY_DATE } from '../excel-document.js';

async function documentWithMergedSheet(mergeRef: string) {
  const wb = new ExcelJS.Workbook();
  const sheet = wb.addWorksheet('R');
  sheet.getCell('A1').value = 'Header';
  sheet.getCell('A2').value = 'Data';
  sheet.getCell('A3').value = 'Footer';
  sheet.mergeCells(mergeRef);
  const doc = await ExcelJsWorkbookDocument.fromTemplate(wb);
  const rendered = doc.getWorksheet('R');
  if (!rendered) throw new Error('missing test worksheet');
  return { doc, sheet: rendered };
}

function merges(sheet: ExcelJS.Worksheet): string[] {
  return [...(sheet.model.merges ?? [])].sort();
}

describe('ExcelJsWorkbookDocument.spliceRowsPreservingMerges', () => {
  it('shifts merges below inserted rows', async () => {
    const { doc, sheet } = await documentWithMergedSheet('A3:B3');

    doc.spliceRowsPreservingMerges(sheet, 3, 0, [[]]);

    expect(merges(sheet)).toEqual(['A4:B4']);
  });

  it('shifts merges below deleted rows', async () => {
    const { doc, sheet } = await documentWithMergedSheet('A3:B3');

    doc.spliceRowsPreservingMerges(sheet, 2, 1);

    expect(merges(sheet)).toEqual(['A2:B2']);
  });

  it('inserts blocks past the engine spread limit without overflowing', async () => {
    // Regression: 80k+ row blocks used to crash with "Maximum call stack
    // size exceeded" — `spliceRows(start, del, ...rows)` spreads the whole
    // block as call arguments. Now inserted in bounded chunks.
    const { doc, sheet } = await documentWithMergedSheet('A3:B3');
    const count = 150_000;

    doc.spliceRowsPreservingMerges(sheet, 3, 0, Array(count).fill([]));

    expect(sheet.rowCount).toBeGreaterThanOrEqual(count + 3);
    expect(merges(sheet)).toEqual([`A${3 + count}:B${3 + count}`]);
  });
});

describe('sanitizeFilename', () => {
  it('returns a warning when sanitization changes the rendered name', () => {
    expect(sanitizeFilename('Acme:North.xlsx')).toEqual({
      filename: 'Acme_North.xlsx',
      changed: true,
      warnings: [{
        code: 'xl3w/filename/sanitized',
        message: 'Output filename "Acme:North.xlsx" sanitized to "Acme_North.xlsx"',
        location: 'Acme_North.xlsx',
      }],
    });
  });
});

describe('output determinism', () => {
  // Two renders of identical inputs used to differ in raw bytes: ExcelJS
  // appends zip entries without a date, so the zip layer stamped
  // `new Date()` per entry and the output moved whenever a render crossed
  // a DOS-timestamp tick. `writeBuffer` pins every entry instead.
  //
  // Asserted on the entry dates rather than by rendering twice and
  // comparing: two renders inside one test finish in the same millisecond,
  // so a byte comparison would pass even with the pin removed. This
  // assertion fails the moment it is.
  it('stamps every zip entry with the fixed date, not the clock', async () => {
    const wb = new ExcelJS.Workbook();
    wb.addWorksheet('R').getCell('A1').value = 'x';
    const doc = await ExcelJsWorkbookDocument.fromTemplate(wb);

    const zip = await JSZip.loadAsync(await doc.writeBuffer());
    const names = Object.keys(zip.files);
    expect(names.length).toBeGreaterThan(0);

    for (const name of names) {
      expect(zip.files[name]!.date.getTime(), `entry ${name}`).toBe(ZIP_ENTRY_DATE.getTime());
    }
  });

  it('renders the same bytes for the same input', async () => {
    async function render(): Promise<ArrayBuffer> {
      const wb = new ExcelJS.Workbook();
      wb.addWorksheet('R').getCell('A1').value = 'x';
      const doc = await ExcelJsWorkbookDocument.fromTemplate(wb);
      return doc.writeBuffer();
    }

    expect(new Uint8Array(await render())).toEqual(new Uint8Array(await render()));
  });
});

// ADR-0040 / ROADMAP G5 — the CF+DV sweep applied after a block expands.
//
// The unit tests in `range-extension.test.ts` cover the rule's arithmetic.
// What is left to prove here is the wiring: that ExcelJS actually exposes
// the two collections this sweep reaches through a cast, that writing to
// them lands in the serialized XML, and that the splice does not shift
// them out from under the rule.
describe('extendRangesForExpansion (ADR-0040)', () => {
  /** One template row at row 2, a footer at row 5, CF and DV on the block. */
  function sheetWithRanges() {
    const wb = new ExcelJS.Workbook();
    const sheet = wb.addWorksheet('S');
    sheet.getCell('A1').value = 'header';
    sheet.getCell('A2').value = 1;
    sheet.getCell('B2').value = 'x';
    sheet.getCell('A5').value = 'footer';
    sheet.addConditionalFormatting({
      ref: 'A2:A2',
      rules: [{ type: 'cellIs', operator: 'greaterThan', formulae: ['0'], priority: 1, style: {} }],
    });
    sheet.addConditionalFormatting({
      ref: 'A1:A1', // above the block — must not move
      rules: [{ type: 'cellIs', operator: 'greaterThan', formulae: ['0'], priority: 2, style: {} }],
    });
    sheet.getCell('B2').dataValidation = { type: 'list', allowBlank: true, formulae: ['"a,b"'] };
    return { wb, sheet };
  }

  type Collections = {
    conditionalFormattings: { ref: string }[];
    dataValidations: { model: Record<string, unknown> };
  };

  it('exposes the runtime shape the sweep casts to', () => {
    // Guards the cast in excel-document.ts: if a dependency bump renames
    // or restructures either collection, the sweep silently stops working
    // and every other test still passes.
    const { sheet } = sheetWithRanges();
    const c = sheet as unknown as Collections;
    expect(Array.isArray(c.conditionalFormattings)).toBe(true);
    expect(typeof c.conditionalFormattings[0]!.ref).toBe('string');
    expect(c.dataValidations.model).toHaveProperty('B2');
  });

  it('extends a contained CF range and leaves one above the block alone', () => {
    const { sheet } = sheetWithRanges();
    extendRangesForExpansion(sheet, 2, 2, 2); // 1 template row -> 3 output rows
    const refs = (sheet as unknown as Collections).conditionalFormattings.map((c) => c.ref);
    expect(refs).toContain('A2:A4');
    expect(refs).toContain('A1:A1');
  });

  it('replicates a data validation onto the rows the expansion added', () => {
    const { sheet } = sheetWithRanges();
    extendRangesForExpansion(sheet, 2, 2, 2);
    const model = (sheet as unknown as Collections).dataValidations.model;
    expect(Object.keys(model).sort()).toEqual(['B2', 'B3', 'B4']);
  });

  it('is a no-op when the block did not grow', () => {
    const { sheet } = sheetWithRanges();
    extendRangesForExpansion(sheet, 2, 2, 0);
    const c = sheet as unknown as Collections;
    expect(c.conditionalFormattings.map((x) => x.ref)).toEqual(['A2:A2', 'A1:A1']);
    expect(Object.keys(c.dataValidations.model)).toEqual(['B2']);
  });

  it('survives the splice: cells move, ranges stay in template coordinates', async () => {
    // Through `fromTemplate` rather than the constructor: it is the public
    // entry point, and it round-trips the workbook through the xlsx
    // serializer the way the real pipeline does — so this also confirms both
    // collections survive a load, not just an in-memory build.
    const { wb } = sheetWithRanges();
    const doc = await ExcelJsWorkbookDocument.fromTemplate(wb);
    const sheet = doc.getWorksheet('S')!;
    doc.spliceRowsPreservingMerges(sheet, 3, 0, [[], []]);

    // The footer moved down two rows...
    expect(sheet.getCell('A7').value).toBe('footer');
    // ...but the ranges did not, which is exactly why the sweep can read
    // template coordinates and apply the delta once.
    const c = sheet as unknown as Collections;
    expect(c.conditionalFormattings[0]!.ref).toBe('A2:A2');
    expect(Object.keys(c.dataValidations.model)).toEqual(['B2']);

    extendRangesForExpansion(sheet, 2, 2, 2);
    expect(c.conditionalFormattings[0]!.ref).toBe('A2:A4');
  });

  it('lands in the serialized sheet XML', async () => {
    const { wb, sheet } = sheetWithRanges();
    extendRangesForExpansion(sheet, 2, 2, 2);
    const buf = await wb.xlsx.writeBuffer();
    const zip = await JSZip.loadAsync(buf);
    const xml = await zip.file('xl/worksheets/sheet1.xml')!.async('string');

    expect(xml).toContain('sqref="A2:A4"');
    // ExcelJS coalesces the per-cell validations back into one range.
    expect(xml).toMatch(/<dataValidation[^>]*sqref="B2:B4"/);
  });
});
