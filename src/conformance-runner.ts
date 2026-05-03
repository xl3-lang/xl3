// XTL conformance runner — Stage 1.
//
// Iterates fixtures under a directory, runs the reference impl on each,
// and compares output to expected via cell-value equality. This is *not*
// the canonical OOXML comparison runner-protocol.md ultimately requires
// (that's Stage 2, deferred to a future ADR). It is the minimum that
// makes the corpus actionable for both this impl and other-language
// ports targeting cell-equivalent conformance.

import ExcelJS from 'exceljs';
import { readFile, readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { convert } from './index.js';

export interface FixtureMeta {
  description: string;
  spec_section: string;
  spec_version: string;
  tags: string[];
  verified_by: string[];
  expected_warnings: string[];
  skip_reason?: string;
}

export type FixtureStatus = 'pass' | 'fail' | 'skip' | 'error';

export interface FixtureResult {
  fixture: string;
  status: FixtureStatus;
  duration_ms: number;
  diff?: string;
  error?: string;
  skip_reason?: string;
}

export interface ConformanceReport {
  implementation: string;
  version: string;
  spec_version: string;
  results: FixtureResult[];
  summary: {
    total: number;
    passed: number;
    failed: number;
    errored: number;
    skipped: number;
  };
}

export interface RunOptions {
  fixtureDir: string;
  /** Restrict to fixtures whose `tags` include this string. */
  filter?: string;
  /** Restrict to fixtures whose declared spec_version matches. */
  specVersion?: string;
}

export async function runConformance(opts: RunOptions): Promise<ConformanceReport> {
  const entries = await readdir(opts.fixtureDir, { withFileTypes: true });
  const fixtures = entries
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();

  const results: FixtureResult[] = [];
  for (const name of fixtures) {
    const dir = join(opts.fixtureDir, name);
    results.push(await runOne(name, dir, opts));
  }

  const summary = {
    total: results.length,
    passed: results.filter((r) => r.status === 'pass').length,
    failed: results.filter((r) => r.status === 'fail').length,
    errored: results.filter((r) => r.status === 'error').length,
    skipped: results.filter((r) => r.status === 'skip').length,
  };

  return {
    implementation: 'xl3-js',
    version: pkgVersion(),
    spec_version: opts.specVersion ?? '0.1',
    results,
    summary,
  };
}

async function runOne(name: string, dir: string, opts: RunOptions): Promise<FixtureResult> {
  const start = Date.now();
  let meta: FixtureMeta;
  try {
    meta = await loadMeta(dir);
  } catch (e) {
    return {
      fixture: name,
      status: 'error',
      duration_ms: Date.now() - start,
      error: `meta.yaml: ${(e as Error).message}`,
    };
  }

  if (meta.skip_reason) {
    return {
      fixture: name,
      status: 'skip',
      duration_ms: Date.now() - start,
      skip_reason: meta.skip_reason,
    };
  }

  if (opts.filter && !meta.tags.includes(opts.filter)) {
    return {
      fixture: name,
      status: 'skip',
      duration_ms: Date.now() - start,
      skip_reason: `filtered out by tag "${opts.filter}"`,
    };
  }

  if (opts.specVersion && meta.spec_version !== opts.specVersion) {
    return {
      fixture: name,
      status: 'skip',
      duration_ms: Date.now() - start,
      skip_reason: `spec_version ${meta.spec_version} != requested ${opts.specVersion}`,
    };
  }

  try {
    const tmpl = await readFile(join(dir, 'template.xlsx'));
    const data = await readFile(join(dir, 'data.xlsx'));
    const expected = await loadExpected(dir);
    if (!expected) {
      return {
        fixture: name,
        status: 'error',
        duration_ms: Date.now() - start,
        error: 'no expected.xlsx or expected/ directory',
      };
    }

    const out = await convert(toArrayBuffer(tmpl), toArrayBuffer(data));
    const diffs = await diffOutput(out, expected);

    if (diffs.length === 0) {
      return { fixture: name, status: 'pass', duration_ms: Date.now() - start };
    }
    return {
      fixture: name,
      status: 'fail',
      duration_ms: Date.now() - start,
      diff: diffs.join('\n'),
    };
  } catch (e) {
    return {
      fixture: name,
      status: 'error',
      duration_ms: Date.now() - start,
      error: (e as Error).message,
    };
  }
}

interface ExpectedFile {
  filename: string;
  buf: Buffer;
}

async function loadExpected(dir: string): Promise<ExpectedFile[] | null> {
  // Single-output: expected.xlsx
  try {
    const buf = await readFile(join(dir, 'expected.xlsx'));
    return [{ filename: 'expected.xlsx', buf }];
  } catch { /* fallthrough */ }

  // Multi-output: expected/ directory
  const expDir = join(dir, 'expected');
  let isDir = false;
  try {
    isDir = (await stat(expDir)).isDirectory();
  } catch { /* not present */ }
  if (!isDir) return null;

  const files = (await readdir(expDir))
    .filter((f) => f.endsWith('.xlsx'))
    .sort();
  return Promise.all(files.map(async (f) => ({
    filename: f,
    buf: await readFile(join(expDir, f)),
  })));
}

async function diffOutput(
  out: { filename: string; data: ArrayBuffer }[],
  expected: ExpectedFile[],
): Promise<string[]> {
  const diffs: string[] = [];
  const isMultiFile = !(expected.length === 1 && expected[0]!.filename === 'expected.xlsx');

  if (isMultiFile) {
    const actualByName = new Map(out.map((f) => [f.filename, f.data] as const));
    const expectedByName = new Map(expected.map((f) => [f.filename, f.buf] as const));
    const allFilenames = new Set([
      ...actualByName.keys(),
      ...expectedByName.keys(),
    ]);
    for (const fn of allFilenames) {
      const a = actualByName.get(fn);
      const e = expectedByName.get(fn);
      if (!a) { diffs.push(`missing output file: ${fn}`); continue; }
      if (!e) { diffs.push(`unexpected output file: ${fn}`); continue; }
      const aCells = await loadCells(a);
      const eCells = await loadCells(toArrayBuffer(e));
      diffCellMaps(aCells, eCells, diffs, fn);
    }
  } else {
    if (out.length !== 1) {
      diffs.push(`expected single output file, got ${out.length}`);
      return diffs;
    }
    const aCells = await loadCells(out[0]!.data);
    const eCells = await loadCells(toArrayBuffer(expected[0]!.buf));
    diffCellMaps(aCells, eCells, diffs);
  }

  return diffs;
}

type CellMap = Record<string, Record<string, unknown>>;

async function loadCells(buf: ArrayBuffer): Promise<CellMap> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf);
  const sheets: CellMap = {};
  for (const ws of wb.worksheets) {
    if (ws.name === '_config') continue;
    if (ws.name.startsWith('_')) continue;
    const cells: Record<string, unknown> = {};
    ws.eachRow({ includeEmpty: false }, (row, r) => {
      row.eachCell({ includeEmpty: false }, (cell, c) => {
        cells[`${r},${c}`] = comparable(cell.value);
      });
    });
    sheets[ws.name] = cells;
  }
  return sheets;
}

function comparable(v: ExcelJS.CellValue): unknown {
  if (v === null || v === undefined) return null;
  if (typeof v === 'object') {
    if ('richText' in v) {
      return (v as { richText: { text: string }[] }).richText
        .map((r) => r.text).join('');
    }
    if ('result' in v) return (v as { result: unknown }).result ?? null;
    if (v instanceof Date) return v.toISOString();
  }
  return v;
}

function diffCellMaps(actual: CellMap, expected: CellMap, diffs: string[], fnPrefix?: string) {
  const sheets = new Set([...Object.keys(actual), ...Object.keys(expected)]);
  for (const sheet of sheets) {
    const a = actual[sheet] ?? {};
    const e = expected[sheet] ?? {};
    const cells = new Set([...Object.keys(a), ...Object.keys(e)]);
    for (const k of cells) {
      if (a[k] !== e[k]) {
        const where = fnPrefix ? `[${fnPrefix}] ${sheet}@${k}` : `${sheet}@${k}`;
        diffs.push(`${where}: actual=${JSON.stringify(a[k])}, expected=${JSON.stringify(e[k])}`);
      }
    }
  }
}

async function loadMeta(dir: string): Promise<FixtureMeta> {
  const txt = await readFile(join(dir, 'meta.yaml'), 'utf8');
  return parseMeta(txt);
}

/**
 * Minimal YAML reader for the keys meta.yaml uses: scalar strings, scalar
 * numbers (treated as strings), and inline arrays `[a, b, c]`. Pulled from
 * the runner-protocol.md required/optional fields list. We deliberately
 * avoid a full YAML dependency for a six-key file.
 */
export function parseMeta(text: string): FixtureMeta {
  const meta: FixtureMeta = {
    description: '',
    spec_section: '',
    spec_version: '',
    tags: [],
    verified_by: [],
    expected_warnings: [],
  };
  for (const rawLine of text.split('\n')) {
    const line = rawLine.replace(/#.*$/, '').trimEnd();
    if (!line.trim() || line.startsWith('---')) continue;

    const idx = line.indexOf(':');
    if (idx < 0) continue;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();

    if (key === 'tags' || key === 'verified_by' || key === 'expected_warnings') {
      meta[key] = parseInlineList(value);
    } else if (
      key === 'description' || key === 'spec_section' ||
      key === 'spec_version' || key === 'skip_reason'
    ) {
      meta[key] = stripQuotes(value);
    }
  }
  return meta;
}

function parseInlineList(v: string): string[] {
  if (!v.startsWith('[') || !v.endsWith(']')) return [];
  const inner = v.slice(1, -1).trim();
  if (!inner) return [];
  return inner.split(',').map((s) => stripQuotes(s.trim())).filter(Boolean);
}

function stripQuotes(v: string): string {
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    return v.slice(1, -1);
  }
  return v;
}

function toArrayBuffer(buf: Buffer): ArrayBuffer {
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
}

function pkgVersion(): string {
  // Hardcoded floor; bin can override by reading package.json if needed.
  return '0.1.0-alpha.0';
}

export function formatTextReport(report: ConformanceReport): string {
  const lines: string[] = [];
  lines.push(`${report.implementation} ${report.version} — XTL ${report.spec_version}`);
  for (const r of report.results) {
    const status = r.status.toUpperCase().padEnd(5);
    let line = `  ${status} ${r.fixture}  (${r.duration_ms}ms)`;
    if (r.skip_reason) line += `  — ${r.skip_reason}`;
    if (r.error) line += `  — error: ${r.error}`;
    lines.push(line);
    if (r.diff) {
      for (const d of r.diff.split('\n')) lines.push(`         ${d}`);
    }
  }
  const s = report.summary;
  lines.push('');
  lines.push(
    `${s.passed}/${s.total} passed` +
    (s.failed ? ` · ${s.failed} failed` : '') +
    (s.errored ? ` · ${s.errored} errored` : '') +
    (s.skipped ? ` · ${s.skipped} skipped` : ''),
  );
  return lines.join('\n');
}
