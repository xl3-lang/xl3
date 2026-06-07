import ExcelJS from 'exceljs';
import { afterEach, describe, expect, it } from 'vitest';
import { convert, preview, readTemplateInputs } from '../index.js';
import { _resetWasmEngineCache, tryLoadWasmEngine } from '../wasm-bridge.js';

// `xl3-wasm` is an OPTIONAL dependency (not in package.json), so this
// suite cannot assume either way — it detects availability at load
// time and runs the matching contract:
//   - package missing (CI default): `engine: 'auto'`/`'js'` always
//     work — the bridge silently returns null; `engine: 'wasm'` fails
//     fast with a recognisable message so hosts can surface the
//     missing acceleration to the operator.
//   - package installed (local dev with the xl3-rs artifact): the
//     bridge loads it and the wasm positive path produces the same
//     output shape as the JS path.
// Before this split the missing-package suite ran unconditionally and
// failed on any machine that had `xl3-wasm` installed for benching.

const wasmAvailable = (await tryLoadWasmEngine()) !== null;
_resetWasmEngineCache();

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

async function loadFirstSheet(out: { data: ArrayBuffer }[]) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(new Uint8Array(out[0]!.data).buffer);
  return wb.worksheets[0]!;
}

describe('wasm bridge (engine-agnostic contract)', () => {
  afterEach(() => {
    _resetWasmEngineCache();
  });

  it('convert with engine: "auto" produces output regardless of wasm availability', async () => {
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
});

describe.skipIf(wasmAvailable)('wasm bridge (without xl3-wasm installed)', () => {
  afterEach(() => {
    _resetWasmEngineCache();
  });

  it('tryLoadWasmEngine returns null when the package is missing', async () => {
    const engine = await tryLoadWasmEngine();
    expect(engine).toBeNull();
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

describe.runIf(wasmAvailable)('wasm bridge (with xl3-wasm installed)', () => {
  afterEach(() => {
    _resetWasmEngineCache();
  });

  it('tryLoadWasmEngine returns the engine surface', async () => {
    const engine = await tryLoadWasmEngine();
    expect(engine).not.toBeNull();
    expect(typeof engine!.convert).toBe('function');
    expect(typeof engine!.preview).toBe('function');
    expect(typeof engine!.readTemplateInputs).toBe('function');
  });

  it('convert with engine: "wasm" matches the JS path on the smoke template', async () => {
    const template = await buildMinimalTemplate();
    const data = await buildMinimalData();
    const wasmOut = await convert(template, data, { engine: 'wasm' });
    const jsOut = await convert(template, data, { engine: 'js' });
    expect(wasmOut).toHaveLength(1);
    expect(wasmOut[0].filename).toBe(jsOut[0].filename);

    const wasmSheet = await loadFirstSheet(wasmOut);
    const jsSheet = await loadFirstSheet(jsOut);
    for (const addr of ['A1', 'A2', 'A3']) {
      expect(wasmSheet.getCell(addr).value).toEqual(jsSheet.getCell(addr).value);
    }
  });

  it('readTemplateInputs with engine: "wasm" succeeds', async () => {
    const template = await buildMinimalTemplate();
    const inputs = await readTemplateInputs(template, { engine: 'wasm' });
    expect(Array.isArray(inputs)).toBe(true);
  });

  it('preview with engine: "wasm" reports the output shape', async () => {
    const template = await buildMinimalTemplate();
    const data = await buildMinimalData();
    const shape = await preview(template, data, { engine: 'wasm' });
    expect(shape.files.length).toBeGreaterThan(0);
  });
});
