import { describe, it, expect } from 'vitest';
import ExcelJS from 'exceljs';
import { convert } from '../index.js';
import { isXtlError } from '../error-codes.js';

/**
 * Issue #66 — spec/impl gap on `@subtotal` rows.
 *
 * The spec (language.md § "Group + Subtotal", ADR-0038 / ADR-0058) says a
 * `@subtotal` row binds to a group boundary where there is no "current
 * row"; a current-row `[Column]` reference outside an aggregate on such a
 * row is an error. The previous impl silently reclassified the row as a
 * SECOND data-row template — the subtotal band was emitted after every
 * data row with its `@subtotal` cells evaluating as block-level (grand-
 * total) aggregates. The render succeeded with plausible-but-wrong output.
 *
 * Two guarantees are pinned here:
 *   1. A plain-string current-row `[Column]` ref on a `@subtotal` row now
 *      raises `xl3/subtotal/mixed-row` (naming the offending cell).
 *   2. A native label FORMULA whose cached result happens to contain
 *      `{{ … }}` (the Excel round-trip self-corruption path) is NOT read
 *      as a marker, so the row stays a correct subtotal row and renders
 *      per-group totals. Formula cells are preserved verbatim (ADR-0046).
 */

async function toBuf(wb: ExcelJS.Workbook): Promise<ArrayBuffer> {
  return (await wb.xlsx.writeBuffer()) as ArrayBuffer;
}

// Source: Customer | Amount — Acme={100,50}=150, Beta={200}=200, grand=350.
async function makeSource(): Promise<ArrayBuffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Data');
  ws.addRow(['Region', 'Customer', 'Amount']);
  ws.addRow(['East', 'Acme', 100]);
  ws.addRow(['East', 'Acme', 50]);
  ws.addRow(['West', 'Beta', 200]);
  return toBuf(wb);
}

function baseTemplate(): ExcelJS.Workbook {
  const wb = new ExcelJS.Workbook();
  const cfg = wb.addWorksheet('__config__');
  cfg.getCell('A1').value = 'source_sheet';
  cfg.getCell('B1').value = 'Data';
  cfg.getCell('A2').value = 'source_table';
  cfg.getCell('B2').value = '1';
  const ws = wb.addWorksheet('Report');
  ws.getCell('A1').value = '{{ @group [Customer] }}';
  ws.getCell('A2').value = '{{ [Region] }}';
  ws.getCell('B2').value = '{{ [Customer] }}';
  ws.getCell('C2').value = '{{ [Amount] }}';
  return wb;
}

async function readReport(data: ArrayBuffer): Promise<string[][]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(data);
  const ws = wb.getWorksheet('Report')!;
  const rows: string[][] = [];
  ws.eachRow((row) => {
    const vals: string[] = [];
    row.eachCell({ includeEmpty: true }, (c) => {
      const v = c.value as { result?: unknown } | null;
      vals.push(String((v && typeof v === 'object' && 'result' in v ? v.result : c.value) ?? ''));
    });
    rows.push(vals);
  });
  return rows;
}

describe('#66 — @subtotal row with a plain current-row [Column] ref', () => {
  it('raises xl3/subtotal/mixed-row naming the offending cell', async () => {
    const wb = baseTemplate();
    const ws = wb.getWorksheet('Report')!;
    // subtotal row MIXES a current-row [Customer] ref with @subtotal
    ws.getCell('A3').value = '{{ [Customer] }} subtotal';
    ws.getCell('C3').value = '{{ @subtotal SUM([Amount]) }}';

    let err: unknown;
    try {
      await convert(await toBuf(wb), await makeSource(), { engine: 'js' });
    } catch (e) {
      err = e;
    }
    expect(err).toBeDefined();
    expect(isXtlError(err)).toBe(true);
    expect((err as { code?: string }).code).toBe('xl3/subtotal/mixed-row');
    // message names the offending cell and the column
    expect((err as Error).message).toContain('Report!A3');
    expect((err as Error).message).toContain('[Customer]');
  });

  it('still renders a legal subtotal row (label text + aggregate) unchanged', async () => {
    // Guard against false positives: literal text + @subtotal is legal.
    const wb = baseTemplate();
    const ws = wb.getWorksheet('Report')!;
    ws.getCell('A3').value = 'Subtotal';
    ws.getCell('C3').value = '{{ @subtotal SUM([Amount]) }}';

    const out = await convert(await toBuf(wb), await makeSource(), { engine: 'js' });
    const rows = await readReport(out[0]!.data as ArrayBuffer);
    // one subtotal per group boundary, with per-group sums (not grand total)
    const subtotals = rows.filter((r) => r[0] === 'Subtotal').map((r) => r[2]);
    expect(subtotals).toEqual(['150', '200']);
  });

  it('does NOT flag a string-literal label that merely contains bracket text', async () => {
    // Regression: `[Customer]` inside a "..." literal is not a current-row
    // reference (it renders as literal text, never substituted). The
    // mixed-row guard must not fire, and the row must render as a proper
    // subtotal row with the literal label intact.
    const wb = baseTemplate();
    const ws = wb.getWorksheet('Report')!;
    ws.getCell('A3').value = '{{ "Subtotal [Customer]" }}';
    ws.getCell('C3').value = '{{ @subtotal SUM([Amount]) }}';

    const out = await convert(await toBuf(wb), await makeSource(), { engine: 'js' });
    const rows = await readReport(out[0]!.data as ArrayBuffer);
    const labelled = rows.filter((r) => r[0] === 'Subtotal [Customer]');
    // literal text preserved verbatim; per-group sums, not grand total
    expect(labelled.map((r) => r[2])).toEqual(['150', '200']);
  });
});

describe('#66 — formula-cached-result self-corruption path', () => {
  it('a native label formula whose cache contains {{ }} is NOT a marker; row renders correctly', async () => {
    const wb = baseTemplate();
    const ws = wb.getWorksheet('Report')!;
    // A3 is a NATIVE FORMULA. Its cached <v> result contains marker-looking
    // text (simulating an Excel round-trip). The parser must ignore the
    // cache and treat A3 as a preserved formula, so the row is a proper
    // subtotal row (only C3 carries @subtotal).
    ws.getCell('A3').value = {
      formula: 'INDIRECT("B"&(ROW()-1))&" / Subtotal"',
      result: '{{ [Customer] }} / Subtotal',
    } as ExcelJS.CellValue;
    ws.getCell('C3').value = '{{ @subtotal SUM([Amount]) }}';

    // Must NOT throw (no phantom marker → no mixed-row) and must NOT demote.
    const out = await convert(await toBuf(wb), await makeSource(), { engine: 'js' });
    const outWb = new ExcelJS.Workbook();
    await outWb.xlsx.load(out[0]!.data as ArrayBuffer);
    const rep = outWb.getWorksheet('Report')!;

    // Collect the C column (SUM cell) and note which rows kept a formula in A.
    const cValues: unknown[] = [];
    const aIsFormula: boolean[] = [];
    rep.eachRow((row) => {
      const a = row.getCell(1).value;
      aIsFormula.push(!!(a && typeof a === 'object' && 'formula' in a));
      const c = row.getCell(3).value;
      cValues.push(c && typeof c === 'object' && 'result' in c ? (c as { result: unknown }).result : c);
    });

    // Correct render: data, data, Acme-subtotal(150), data, Beta-subtotal(200).
    // Demotion would instead emit the band after EVERY data row (6 rows) with
    // C = 350 (grand total) each time.
    expect(cValues).toEqual([100, 50, 150, 200, 200]);
    // The label formula is preserved verbatim on both subtotal rows (ADR-0046).
    expect(aIsFormula).toEqual([false, false, true, false, true]);
    // The grand-total demotion symptom (350) must be absent.
    expect(cValues).not.toContain(350);
  });
});
