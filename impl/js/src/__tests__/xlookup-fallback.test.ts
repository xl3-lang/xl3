import { describe, it, expect } from 'vitest';
import ExcelJS from 'exceljs';
import { convertJson } from '../index.js';
import { isXtlError } from '../error-codes.js';

/**
 * Issue #133 — XLOOKUP fallback.
 *
 * XLOOKUP evaluated its fallback before searching, so an error in the
 * fallback failed a lookup that had matched. ADR-0060 evaluates the
 * fallback only when no row matches.
 */

type Sheets = Record<string, unknown[][]>;

async function render(
  expr: string,
  sheets: Sheets = {},
  extra: {
    sources?: Record<string, { headers: string[]; rows: unknown[][] }>;
    inputs?: Record<string, unknown>;
  } = {},
): Promise<unknown> {
  const template = new ExcelJS.Workbook();
  for (const [name, rows] of Object.entries(sheets)) template.addWorksheet(name).addRows(rows);
  template.addWorksheet('Report').getCell('A1').value = `{{ ${expr} }}`;

  const files = await convertJson(
    (await template.xlsx.writeBuffer()) as ArrayBuffer,
    {
      version: 'xl3-source-json/0.1',
      sources: { default: { headers: ['Name'], rows: [['Alpha']] }, ...extra.sources },
    },
    extra.inputs ? { inputs: extra.inputs } : undefined,
  );
  const output = new ExcelJS.Workbook();
  const data = files[0]!.data;
  await output.xlsx.load(
    data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer,
  );
  return output.getWorksheet('Report')!.getCell('A1').value;
}

async function errorCode(run: Promise<unknown>): Promise<string | undefined> {
  try {
    await run;
  } catch (e) {
    return isXtlError(e) ? e.code : `not an xl3 error: ${String(e)}`;
  }
  return undefined;
}

describe('#133 XLOOKUP fallback is lazy', () => {
  const sheets: Sheets = {
    __sources__: [
      ['name', 'sheet'],
      ['Lookup', 'Lookup'],
    ],
  };
  const sources = {
    Lookup: {
      headers: ['Key', 'Value'],
      rows: [
        ['found', 'FOUND'],
        ['', 'EMPTY'],
      ],
    },
  };
  const lookup = (key: string, fallback?: string) =>
    render(
      `XLOOKUP(${key}, Lookup[Key], Lookup[Value]${fallback ? `, ${fallback}` : ''})`,
      sheets,
      { sources },
    );
  const MISS = 'XLOOKUP("missing", Lookup[Key], Lookup[Value])';

  it('does not evaluate the fallback when the lookup matches', async () => {
    expect(await lookup('"found"', '"fallback"')).toBe('FOUND');
    expect(await lookup('"found"', MISS)).toBe('FOUND');
    expect(await lookup('""', MISS)).toBe('EMPTY');
  });

  it('evaluates the fallback when no row matches', async () => {
    expect(await lookup('"nope"', '"fallback"')).toBe('fallback');
    expect(await lookup('"nope"', 'XLOOKUP("found", Lookup[Key], Lookup[Value])')).toBe('FOUND');
    expect(await lookup('"nope"', '1 + 2')).toBe(3);
  });

  it('raises the fallback error when no row matches and the fallback fails', async () => {
    expect(await errorCode(lookup('"nope"', MISS))).toBe('xl3/xlookup/no-match');
    expect(await errorCode(lookup('"nope"', '"a" * 2'))).toBe('xl3/eval/operand-coercion');
  });

  it('raises no-match without a fallback', async () => {
    expect(await errorCode(lookup('"nope"'))).toBe('xl3/xlookup/no-match');
  });

  it('still raises an error from the lookup value itself', async () => {
    expect(await errorCode(lookup(MISS, '"fallback"'))).toBe('xl3/xlookup/no-match');
    expect(await errorCode(lookup('"a" * 2', '"fallback"'))).toBe('xl3/eval/operand-coercion');
  });

  it('still checks arity before evaluation', async () => {
    expect(await errorCode(render('XLOOKUP("found", Lookup[Key])', sheets, { sources }))).toBe(
      'xl3/eval/arity-mismatch',
    );
  });
});
