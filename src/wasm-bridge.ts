/**
 * Optional `xl3-wasm` acceleration bridge.
 *
 * Phase 2 Task 2.4 (PLAN.md in xl3-rs §5): when the runtime can load
 * `xl3-wasm` and the template stays inside the supported feature
 * matrix, the WASM engine renders the file 3–4× faster than the
 * ExcelJS path. When it can't, this module returns `null` and the
 * caller falls back to the JS implementation.
 *
 * Design goals:
 * - Zero hard dependency. `xl3-wasm` is **not** in `package.json`;
 *   we resolve it via `import()` at runtime so consumers without it
 *   installed still get the ExcelJS path.
 * - One-shot init. The first caller pays the wasm instantiation cost;
 *   subsequent calls reuse the cached module.
 * - Conservative match shape. The bridge exposes the same surface as
 *   xl3 (TS) ─ `convert(template, source, inputs)` returning the same
 *   `OutputFile[]` shape ─ so the caller decides on/off, not "how".
 */

import type { InputSpec, OutputFile, PreviewResult, XtlWarning } from './types.js';
import type { StyleManifest } from './manifest.js';

/** xl3-wasm's JS surface, as emitted by wasm-bindgen + the bytes API
 *  we land in `xl3-rs/crates/xl3-wasm/src/lib.rs`. */
interface WasmExports {
  default?: (init?: unknown) => Promise<unknown>;
  convert(
    template: Uint8Array,
    data: Uint8Array,
    inputs: Record<string, unknown>,
    manifest?: StyleManifest,
  ): WasmOutputFile[];
  readTemplateInputs(template: Uint8Array): WasmInputSpec[];
  preview(template: Uint8Array, data: Uint8Array): WasmPreviewResult;
}

interface WasmOutputFile {
  filename: string;
  data: Uint8Array;
  warnings: { message: string }[];
}

interface WasmInputSpec {
  name: string;
  kind: string;
  required: boolean;
  default: string | null;
  label: string | null;
  description: string | null;
  options: string[];
}

interface WasmPreviewResult {
  files: { filename: string; sheets: { name: string }[] }[];
  sources: { name: string; headers: string[]; rowCount: number }[];
}

let cached: WasmExports | null | undefined; // undefined = untried; null = unavailable
let initPromise: Promise<WasmExports | null> | null = null;

/**
 * Resolve `xl3-wasm` if installed and instantiable in this runtime;
 * otherwise return `null` (no throw). Idempotent / cached.
 */
export async function tryLoadWasmEngine(): Promise<WasmExports | null> {
  if (cached !== undefined) return cached;
  if (initPromise) return initPromise;
  initPromise = (async () => {
    try {
      // `xl3-wasm` is optional. Tools that statically resolve imports
      // (Vite, esbuild, webpack) try to bundle anything they can see;
      // wrap the specifier so they leave it as a runtime import and
      // fall through to the catch when the package isn't installed.
      const specifier = 'xl3-wasm';
      const mod = (await import(/* @vite-ignore */ specifier)) as WasmExports;
      if (typeof mod.default === 'function') {
        // wasm-pack web target needs an init() call before any export
        // becomes usable. In Node, the default import auto-resolves
        // from the package directory; in browsers, it auto-fetches.
        await mod.default();
      }
      cached = mod;
    } catch {
      cached = null;
    }
    return cached;
  })();
  return initPromise;
}

/** Reset the cache so the next call re-attempts the load. Used by tests. */
export function _resetWasmEngineCache(): void {
  cached = undefined;
  initPromise = null;
}

/**
 * Run the WASM `convert` and map its output into xl3 (TS)'s
 * `OutputFile[]` shape. Throws if the engine is missing — callers
 * should only enter this path after `tryLoadWasmEngine()` succeeded.
 */
export function wasmConvert(
  engine: WasmExports,
  templateBuffer: ArrayBuffer,
  sourceBuffer: ArrayBuffer,
  inputs: Record<string, unknown> | undefined,
  manifest: StyleManifest | undefined,
): OutputFile[] {
  const template = new Uint8Array(templateBuffer);
  const source = new Uint8Array(sourceBuffer);
  const raw = engine.convert(template, source, inputs ?? {}, manifest);
  return raw.map((f) => ({
    filename: f.filename,
    // Copy out of the wasm linear-memory slice so the buffer survives
    // the next wasm allocation.
    data: f.data.slice().buffer,
    warnings: f.warnings.map(mapWasmWarning),
  }));
}

export function wasmReadTemplateInputs(
  engine: WasmExports,
  templateBuffer: ArrayBuffer,
): InputSpec[] {
  const template = new Uint8Array(templateBuffer);
  const raw = engine.readTemplateInputs(template);
  return raw.map((spec) => ({
    name: spec.name,
    // xl3-wasm uses `kind: 'other'` for unspecified inputs; xl3 (TS)
    // doesn't model that — fall back to 'text', which is the same
    // behavioural default the TS parser applies.
    type: ((['text', 'number', 'date', 'select'] as const).includes(
      spec.kind as InputSpec['type'],
    )
      ? spec.kind
      : 'text') as InputSpec['type'],
    required: spec.required,
    default: spec.default ?? undefined,
    label: spec.label ?? undefined,
    description: spec.description ?? undefined,
    options: spec.options,
  }));
}

export function wasmPreview(
  engine: WasmExports,
  templateBuffer: ArrayBuffer,
  sourceBuffer: ArrayBuffer,
): Pick<PreviewResult, 'files' | 'sources'> {
  const template = new Uint8Array(templateBuffer);
  const source = new Uint8Array(sourceBuffer);
  const raw = engine.preview(template, source);
  return {
    files: raw.files.map((f) => ({
      filename: f.filename,
      sheets: f.sheets.map((s) => ({ name: s.name, rowCount: 0 })),
    })),
    sources: raw.sources.map((s) => ({
      name: s.name,
      // xl3-wasm's preview omits sheet/table identity (it speaks
      // post-resolution rows). The JS type contract requires them; we
      // surface empty strings as a documented placeholder, and hosts
      // that need them should call the JS-engine preview.
      sheet: '',
      table: '',
      headers: s.headers,
      rowCount: s.rowCount,
    })),
  };
}

/**
 * xl3-wasm encodes warnings as `{ message }` only. Recover the
 * structured `XtlWarningCode` from the message prefix when the
 * Rust side wrote one (see `xl3_core::errors`), else stamp the
 * generic filename-sanitisation code that matches its current
 * surface (ADR-0002).
 */
function mapWasmWarning(w: { message: string }): XtlWarning {
  const m = /^\[(xl3w\/[a-z0-9/_-]+)\]\s*(.*)$/i.exec(w.message);
  if (m) {
    return { code: m[1] as XtlWarning['code'], message: m[2] };
  }
  // The wasm side emits filename-sanitisation warnings without a
  // bracketed code prefix today. Map them to the documented code
  // so JS callers don't have to special-case the bare message form.
  if (/sanitized to/.test(w.message)) {
    return { code: 'xl3w/filename/sanitized', message: w.message };
  }
  return { code: 'xl3w/filename/sanitized', message: w.message };
}
