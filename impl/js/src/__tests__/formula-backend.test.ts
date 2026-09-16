import ExcelJS from 'exceljs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { convert, preview, writeConfigSheet } from '../index.js';
import { tryLoadWasmEngine, wasmConvert, wasmPreview } from '../wasm-bridge.js';

vi.mock('../wasm-bridge.js', () => ({
  tryLoadWasmEngine: vi.fn(),
  wasmConvert: vi.fn(),
  wasmPreview: vi.fn(),
  wasmReadTemplateInputs: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
  // Deliberately simulate an installed old engine. It must never get the
  // chance to silently ignore a template's formula_mode setting.
  vi.mocked(tryLoadWasmEngine).mockResolvedValue(
    {} as Awaited<ReturnType<typeof tryLoadWasmEngine>>,
  );
});

async function buffers() {
  const template = new ExcelJS.Workbook();
  writeConfigSheet(template, {
    name: '',
    description: '',
    source_sheet: 'Raw',
    output_file_pattern: 'out.xlsx',
    match_pattern: '*',
    formula_mode: 'adjust',
  });
  template.addWorksheet('Report').addRows([
    ['Amount', 'Double'],
    ['{{ [Amount] }}', { formula: 'A2*2' }],
  ]);
  const source = new ExcelJS.Workbook();
  source.addWorksheet('Raw').addRows([['Amount'], [10], [20]]);
  return [await template.xlsx.writeBuffer(), await source.xlsx.writeBuffer()] as [
    ArrayBuffer,
    ArrayBuffer,
  ];
}

describe('formula adjustment backend capability', () => {
  it('auto uses JS even when an older WASM engine is installed', async () => {
    const [template, source] = await buffers();
    const output = await convert(template, source);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(output[0]!.data as unknown as ExcelJS.Buffer);
    expect(workbook.getWorksheet('Report')!.getCell('B3').formula).toBe('A3*2');
    expect(wasmConvert).not.toHaveBeenCalled();
  });

  it('explicit WASM fails for conversion and preview', async () => {
    const [template, source] = await buffers();
    await expect(convert(template, source, { engine: 'wasm' })).rejects.toThrow(
      'requires the JavaScript engine',
    );
    await expect(preview(template, source, { engine: 'wasm' })).rejects.toThrow(
      'requires the JavaScript engine',
    );
    expect(wasmConvert).not.toHaveBeenCalled();
    expect(wasmPreview).not.toHaveBeenCalled();
  });
});
