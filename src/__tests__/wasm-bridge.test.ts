import ExcelJS from 'exceljs';
import { afterEach, describe, expect, it } from 'vitest';
import { convert, preview, readTemplateInputs } from '../index.js';
import { _resetWasmEngineCache, tryLoadWasmEngine } from '../wasm-bridge.js';

// These tests run without the optional `xl3-wasm` package installed.
// They lock in the contract that:
//   - `engine: 'auto'` and `engine: 'js'` always work — the wasm
//     bridge silently returns null when the package is missing.
//   - `engine: 'wasm'` fails fast with a recognisable message so
//     hosts can surface the missing acceleration to the operator.
//
// A future PR can flip these into positive-path tests once we publish
// (or `npm link`) the local `xl3-wasm` pkg into this repo.

async function buildMinimalTemplate(): Promise<ArrayBuffer> {
  const wb = new ExcelJS.Workbook();
  const cfg = wb.addWorksheet('__config__');
  cfg.getCell('A1').value = 'key';
  cfg.getCell('B1').value = 'value';
  cfg.getCell('A2').value = 'name';
  cfg.getCell('B2').value = 'wasm-bridge-smoke';
  cfg.getCell('A3').value = 'source_sheet';
  cfg.getCell('B3').value = 'Data';
  cfg.getCell('A4').value = 'output_file_pattern';
  cfg.getCell('B4').value = 'out.xlsx';
  const out = wb.addWorksheet('Out');
  out.getCell('A1').value = 'Customer';
  out.getCell('A2').value = '{{ [Customer] }}';
  const buf = await wb.xlsx.writeBuffer();
  return new Uint8Array(buf).buffer;
}

async function buildMinimalData(): Promise<ArrayBuffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Data');
  ws.getCell('A1').value = 'Customer';
  ws.getCell('A2').value = 'Acme';
  ws.getCell('A3').value = 'Globex';
  const buf = await wb.xlsx.writeBuffer();
  return new Uint8Array(buf).buffer;
}

describe('wasm bridge (without xl3-wasm installed)', () => {
  afterEach(() => {
    _resetWasmEngineCache();
  });

  it('tryLoadWasmEngine returns null when the package is missing', async () => {
    const engine = await tryLoadWasmEngine();
    expect(engine).toBeNull();
  });

  it('convert with engine: "auto" falls back to the JS path', async () => {
    const template = await buildMinimalTemplate();
    const data = await buildMinimalData();
    const out = await convert(template, data, { engine: 'auto' });
    expect(out).toHaveLength(1);
    expect(out[0].filename).toBe('out.xlsx');
    expect(out[0].data.byteLength).toBeGreaterThan(0);
  });

  it('convert with engine: "js" never tries wasm', async () => {
    const template = await buildMinimalTemplate();
    const data = await buildMinimalData();
    const out = await convert(template, data, { engine: 'js' });
    expect(out).toHaveLength(1);
  });

  it('convert with engine: "wasm" throws when the package is missing', async () => {
    const template = await buildMinimalTemplate();
    const data = await buildMinimalData();
    await expect(convert(template, data, { engine: 'wasm' })).rejects.toThrow(
      /xl3-wasm/,
    );
  });

  it('readTemplateInputs with engine: "wasm" throws when missing', async () => {
    const template = await buildMinimalTemplate();
    await expect(readTemplateInputs(template, { engine: 'wasm' })).rejects.toThrow(
      /xl3-wasm/,
    );
  });

  it('preview with engine: "wasm" throws when missing', async () => {
    const template = await buildMinimalTemplate();
    const data = await buildMinimalData();
    await expect(preview(template, data, { engine: 'wasm' })).rejects.toThrow(
      /xl3-wasm/,
    );
  });
});
