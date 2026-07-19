import { describe, it, expect } from 'vitest';
import ExcelJS from 'exceljs';
import { convert } from '../index.js';
import { isXtlError } from '../error-codes.js';

/**
 * Issue #69 / ADR-0074 — group + subtotal is unsupported in explicit
 * `@block` mode.
 *
 * The group + subtotal feature (ADR-0038) is wired only into implicit
 * single-block detection; the explicit-`@block` builder never records the
 * subtotal rows. Before this guard, a sheet mixing `@block` with
 * `@group`/`@subtotal` rendered with the subtotal band silently dropped —
 * no error, no subtotal rows. It now raises
 * `xl3/subtotal/explicit-block-unsupported` at parse time. Implicit-mode
 * group + subtotal is unaffected.
 */

async function toBuf(wb: ExcelJS.Workbook): Promise<ArrayBuffer> {
  return (await wb.xlsx.writeBuffer()) as ArrayBuffer;
}

async function makeSource(): Promise<ArrayBuffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Data');
  ws.addRow(['Customer', 'Amount']);
  ws.addRow(['Acme', 100]);
  ws.addRow(['Acme', 50]);
  ws.addRow(['Beta', 200]);
  return toBuf(wb);
}

function baseTemplate(): ExcelJS.Workbook {
  const wb = new ExcelJS.Workbook();
  const cfg = wb.addWorksheet('__config__');
  cfg.getCell('A1').value = 'source_sheet';
  cfg.getCell('B1').value = 'Data';
  cfg.getCell('A2').value = 'source_table';
  cfg.getCell('B2').value = '1';
  return wb;
}

async function convertExpectingError(wb: ExcelJS.Workbook) {
  let err: unknown;
  try {
    await convert(await toBuf(wb), await makeSource(), { engine: 'js' });
  } catch (e) {
    err = e;
  }
  return err;
}

describe('#69 — explicit @block + group/subtotal is rejected', () => {
  it('raises xl3/subtotal/explicit-block-unsupported for @subtotal inside @block', async () => {
    const wb = baseTemplate();
    const ws = wb.addWorksheet('Report');
    ws.getCell('A1').value = '{{ @block A2:B3 }}';
    ws.getCell('A2').value = '{{ [Customer] }}';
    ws.getCell('B2').value = '{{ [Amount] }}';
    ws.getCell('A3').value = 'Subtotal';
    ws.getCell('B3').value = '{{ @subtotal SUM([Amount]) }}';

    const err = await convertExpectingError(wb);
    expect(isXtlError(err)).toBe(true);
    expect((err as { code?: string }).code).toBe('xl3/subtotal/explicit-block-unsupported');
    expect((err as Error).message).toContain('@subtotal');
  });

  it('raises xl3/subtotal/explicit-block-unsupported for @group on an explicit-block sheet', async () => {
    const wb = baseTemplate();
    const ws = wb.addWorksheet('Report');
    ws.getCell('A1').value = '{{ @block A3:B4 }}';
    ws.getCell('A2').value = '{{ @group [Customer] }}';
    ws.getCell('A3').value = '{{ [Customer] }}';
    ws.getCell('B3').value = '{{ [Amount] }}';

    const err = await convertExpectingError(wb);
    expect(isXtlError(err)).toBe(true);
    expect((err as { code?: string }).code).toBe('xl3/subtotal/explicit-block-unsupported');
    expect((err as Error).message).toContain('@group');
  });

  it('does NOT affect implicit-mode group + subtotal (no @block)', async () => {
    const wb = baseTemplate();
    const ws = wb.addWorksheet('Report');
    ws.getCell('A1').value = '{{ @group [Customer] }}';
    ws.getCell('A2').value = '{{ [Customer] }}';
    ws.getCell('B2').value = '{{ [Amount] }}';
    ws.getCell('A3').value = 'Subtotal';
    ws.getCell('B3').value = '{{ @subtotal SUM([Amount]) }}';

    // Renders fine; subtotal band emits per group (Acme=150, Beta=200).
    const out = await convert(await toBuf(wb), await makeSource(), { engine: 'js' });
    const outWb = new ExcelJS.Workbook();
    await outWb.xlsx.load(out[0]!.data as ArrayBuffer);
    const rep = outWb.getWorksheet('Report')!;
    const subtotals: number[] = [];
    rep.eachRow((row) => {
      if (String(row.getCell(1).value ?? '') === 'Subtotal') {
        subtotals.push(Number(row.getCell(2).value));
      }
    });
    expect(subtotals).toEqual([150, 200]);
  });

  it('leaves an explicit @block WITHOUT group/subtotal working', async () => {
    const wb = baseTemplate();
    const ws = wb.addWorksheet('Report');
    ws.getCell('A1').value = '{{ @block A2:B2 }}';
    ws.getCell('A2').value = '{{ [Customer] }}';
    ws.getCell('B2').value = '{{ [Amount] }}';

    const out = await convert(await toBuf(wb), await makeSource(), { engine: 'js' });
    expect(out.length).toBeGreaterThan(0);
  });
});
