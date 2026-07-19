import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ExcelJS from 'exceljs';
import { analyze, convert, convertJson, previewJson } from '../index.js';
import { readAllSources } from '../reader.js';
import type { SourceData } from '../reader.js';
import { readJsonSources } from '../json-source.js';
import type { Xl3SourceJson } from '../types.js';

// ADR-0075: JSON source input (`xl3-source-json/0.1`). Two things are
// pinned here: (1) `convertJson(t, json)` renders the same workbook as
// `convert(t, equivalent data.xlsx)` — the core acceptance criterion —
// and (2) the reader's value model, validation, and declared-source
// rules.

// This file lives at impl/js/src/__tests__/; the repo root (conformance/)
// is four levels up.
const REPO_ROOT = resolve(fileURLToPath(new URL('../../../..', import.meta.url)));
const FIXTURES = join(REPO_ROOT, 'conformance', 'fixtures');

function toAB(buf: Buffer): ArrayBuffer {
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
}

// Invert the internal SourceData value model into the wire format:
// '' -> null, Date -> {type:'date'}, everything else as-is. Round-trips
// back to the identical SourceData through readJsonSources.
function toWire(v: unknown): unknown {
  if (v === '' || v === null || v === undefined) return null;
  if (v instanceof Date) {
    const iso = v.toISOString(); // YYYY-MM-DDTHH:mm:ss.sssZ (absolute/UTC)
    return iso.endsWith('T00:00:00.000Z')
      ? { type: 'date', value: iso.slice(0, 10) }
      : { type: 'date', value: iso.slice(0, 19) };
  }
  return v;
}

function sourceDataToJson(sources: Record<string, SourceData>): Xl3SourceJson {
  const out: Xl3SourceJson = { version: 'xl3-source-json/0.1', sources: {} };
  for (const [name, data] of Object.entries(sources)) {
    out.sources[name] = {
      headers: data.headers,
      rows: data.rows.map((row) => data.headers.map((h) => toWire(row[h]))) as never,
    };
  }
  return out;
}

// Structural snapshot of a workbook (sheet names + cell values), immune
// to zip byte / timestamp nondeterminism.
async function snapshot(buf: ArrayBuffer): Promise<string> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf);
  const sheets = wb.worksheets.map((ws) => {
    const rows: unknown[][] = [];
    ws.eachRow({ includeEmpty: true }, (row) => {
      rows.push((row.values as unknown[]).slice());
    });
    return { name: ws.name, rows };
  });
  return JSON.stringify(sheets, (_k, v) => (v instanceof Date ? v.toISOString() : v));
}

async function jsonFromFixtureData(templateBuf: ArrayBuffer, dataBuf: ArrayBuffer): Promise<Xl3SourceJson> {
  const parsed = await analyze(templateBuf);
  const sources = await readAllSources(
    dataBuf,
    parsed.meta.source_sheet,
    { sourceTable: parsed.meta.source_table },
    parsed.sources,
  );
  return sourceDataToJson(sources);
}

describe('convertJson == convert(equivalent data.xlsx) [ADR-0075]', () => {
  // A simple single-source fixture and a multi-source aggregate one so
  // @source / SUM(Source[Col]) are exercised over JSON sources.
  for (const fixture of ['001-bracket-substitution', '070-source-aggregate-cross-source']) {
    it(`${fixture} renders identically from JSON`, async () => {
      const templateBuf = toAB(readFileSync(join(FIXTURES, fixture, 'template.xlsx')));
      const dataBuf = toAB(readFileSync(join(FIXTURES, fixture, 'data.xlsx')));

      const json = await jsonFromFixtureData(templateBuf, dataBuf);
      const fromXlsx = await convert(templateBuf, dataBuf, { engine: 'js' });
      const fromJson = await convertJson(templateBuf, json);

      expect(fromJson.map((f) => f.filename)).toEqual(fromXlsx.map((f) => f.filename));
      for (let i = 0; i < fromXlsx.length; i++) {
        expect(await snapshot(fromJson[i]!.data)).toBe(await snapshot(fromXlsx[i]!.data));
      }
    });
  }
});

// ---- value model (unit-level, TZ-safe) ----

function readDefault(rows: unknown[][], headers = ['A']): Record<string, unknown>[] {
  const json: Xl3SourceJson = { version: 'xl3-source-json/0.1', sources: { default: { headers, rows: rows as never } } };
  return readJsonSources(json, []).default!.rows;
}

describe('value model [ADR-0075]', () => {
  it('null and error cells map to empty string', () => {
    const rows = readDefault([[null], [{ type: 'error', value: '#N/A' }]]);
    // both rows are all-empty -> skipped, matching .xlsx source behavior
    expect(rows).toEqual([]);
  });

  it('empty rows are skipped but partial rows kept', () => {
    const rows = readDefault([[null, 'x'], [null, null]], ['A', 'B']);
    expect(rows).toEqual([{ A: '', B: 'x' }]);
  });

  it('date maps to a UTC Date', () => {
    const rows = readDefault([[{ type: 'date', value: '2026-05-01' }]]);
    const d = rows[0]!.A as Date;
    expect(d).toBeInstanceOf(Date);
    expect(d.getTime()).toBe(Date.UTC(2026, 4, 1));
  });

  it('date-time maps to a UTC instant', () => {
    const rows = readDefault([[{ type: 'date', value: '2026-05-01T13:30:00' }]]);
    expect((rows[0]!.A as Date).getTime()).toBe(Date.UTC(2026, 4, 1, 13, 30, 0));
  });

  it('number and boolean pass through', () => {
    const rows = readDefault([[42], [true]]);
    expect(rows).toEqual([{ A: 42 }, { A: true }]);
  });
});

// ---- accepted input encodings ----

describe('input encodings [ADR-0075]', () => {
  const obj: Xl3SourceJson = {
    version: 'xl3-source-json/0.1',
    sources: { default: { headers: ['A'], rows: [['x']] } },
  };

  it('accepts object, string, Uint8Array, ArrayBuffer', () => {
    const asString = JSON.stringify(obj);
    const asBytes = new TextEncoder().encode(asString);
    const expected = [{ A: 'x' }];
    expect(readJsonSources(obj, []).default!.rows).toEqual(expected);
    expect(readJsonSources(asString, []).default!.rows).toEqual(expected);
    expect(readJsonSources(asBytes, []).default!.rows).toEqual(expected);
    expect(readJsonSources(toAB(Buffer.from(asBytes)), []).default!.rows).toEqual(expected);
  });
});

// ---- declared-source semantics (ADR-0012) ----

describe('declared-source semantics [ADR-0075]', () => {
  const decl = [{ name: 'Prices', sheet: 'Prices', table: '1' }];
  const withBoth: Xl3SourceJson = {
    version: 'xl3-source-json/0.1',
    sources: {
      default: { headers: ['A'], rows: [['x']] },
      Prices: { headers: ['P'], rows: [[1]] },
    },
  };

  it('returns default plus each declared source', () => {
    const out = readJsonSources(withBoth, decl);
    expect(Object.keys(out).sort()).toEqual(['Prices', 'default']);
  });

  it('rejects a missing declared source', () => {
    const missing = { version: 'xl3-source-json/0.1', sources: { default: { headers: ['A'], rows: [['x']] } } };
    expectInvalid(() => readJsonSources(missing, decl));
  });

  it('rejects an extra undeclared source', () => {
    expectInvalid(() => readJsonSources(withBoth, [])); // Prices not declared
  });
});

// ---- validation ----

function expectInvalid(fn: () => unknown): void {
  try {
    fn();
    expect.unreachable('expected xl3/source-json/invalid');
  } catch (e) {
    expect((e as { code?: string }).code).toBe('xl3/source-json/invalid');
  }
}

describe('validation [ADR-0075]', () => {
  const base = (over: Record<string, unknown>) => ({
    version: 'xl3-source-json/0.1',
    sources: { default: { headers: ['A'], rows: [['x']] } },
    ...over,
  });

  it('rejects an unsupported version', () => {
    expectInvalid(() => readJsonSources(base({ version: 'xl3-source-json/9.9' }), []));
  });
  it('rejects malformed JSON string', () => {
    expectInvalid(() => readJsonSources('{ not json', []));
  });
  it('rejects a missing default source', () => {
    expectInvalid(() => readJsonSources({ version: 'xl3-source-json/0.1', sources: {} }, []));
  });
  it('rejects non-array rows', () => {
    expectInvalid(() => readJsonSources({ version: 'xl3-source-json/0.1', sources: { default: { headers: ['A'], rows: {} } } }, []));
  });
  it('rejects a row length mismatch', () => {
    expectInvalid(() => readJsonSources({ version: 'xl3-source-json/0.1', sources: { default: { headers: ['A', 'B'], rows: [['x']] } } }, []));
  });
  it('rejects a non-finite number', () => {
    expectInvalid(() => readJsonSources({ version: 'xl3-source-json/0.1', sources: { default: { headers: ['A'], rows: [[Infinity]] } } }, []));
  });
  it('rejects a malformed date', () => {
    expectInvalid(() => readJsonSources({ version: 'xl3-source-json/0.1', sources: { default: { headers: ['A'], rows: [[{ type: 'date', value: '2026-13-40' }]] } } }, []));
  });
  it('rejects an unknown tagged value', () => {
    expectInvalid(() => readJsonSources({ version: 'xl3-source-json/0.1', sources: { default: { headers: ['A'], rows: [[{ type: 'money', value: 1 }]] } } }, []));
  });
  it('rejects a reserved header', () => {
    expectInvalid(() => readJsonSources({ version: 'xl3-source-json/0.1', sources: { default: { headers: ['__rownum'], rows: [[1]] } } }, []));
  });
  it('rejects a duplicate header', () => {
    expectInvalid(() => readJsonSources({ version: 'xl3-source-json/0.1', sources: { default: { headers: ['A', 'A'], rows: [[1, 2]] } } }, []));
  });
  it('rejects an empty header', () => {
    expectInvalid(() => readJsonSources({ version: 'xl3-source-json/0.1', sources: { default: { headers: [''], rows: [[1]] } } }, []));
  });
});

// ---- API behavior ----

describe('convertJson / previewJson API [ADR-0075]', () => {
  const fixture = '001-bracket-substitution';
  const templateBuf = () => toAB(readFileSync(join(FIXTURES, fixture, 'template.xlsx')));

  it('previewJson surfaces JSON sources with sentinel coordinates', async () => {
    const dataBuf = toAB(readFileSync(join(FIXTURES, fixture, 'data.xlsx')));
    const json = await jsonFromFixtureData(templateBuf(), dataBuf);
    const preview = await previewJson(templateBuf(), json);
    const def = preview.sources.find((s) => s.name === 'default')!;
    expect(def.sheet).toBe('default');
    expect(def.table).toBe('(json-source)');
    expect(def.rowCount).toBeGreaterThan(0);
  });

  it('rejects engine: "wasm" for JSON input (convertJson and previewJson)', async () => {
    const json: Xl3SourceJson = { version: 'xl3-source-json/0.1', sources: { default: { headers: ['A'], rows: [['x']] } } };
    await expect(convertJson(templateBuf(), json, { engine: 'wasm' })).rejects.toThrow(/wasm/i);
    await expect(previewJson(templateBuf(), json, { engine: 'wasm' })).rejects.toThrow(/wasm/i);
  });
});

// ---- header normalization + hardening (Codex review of #80) ----

const WIRE = 'xl3-source-json/0.1';
const src = (headers: unknown, rows: unknown) => ({ version: WIRE, sources: { default: { headers, rows } } });

describe('header normalization [ADR-0075]', () => {
  it('trims headers like the .xlsx reader', () => {
    const out = readJsonSources(src([' Customer '], [['Acme']]), []);
    expect(out.default!.headers).toEqual(['Customer']);
    expect(out.default!.rows).toEqual([{ Customer: 'Acme' }]);
  });
  it('rejects duplicate headers after trim', () => {
    expectInvalid(() => readJsonSources(src(['A', ' A '], [[1, 2]]), []));
  });
  it('rejects reserved headers after trim', () => {
    expectInvalid(() => readJsonSources(src([' __rownum '], [[1]]), []));
  });
});

describe('input hardening [ADR-0075]', () => {
  it('ignores prototype-inherited schema fields (object input)', () => {
    // version/sources live only on the prototype, not as own properties.
    const polluted = Object.create({ version: WIRE, sources: { default: { headers: ['A'], rows: [['x']] } } });
    expectInvalid(() => readJsonSources(polluted, []));
  });
  it('treats an inherited-only tag as an unknown value, not a date', () => {
    const cell = Object.create({ type: 'date', value: '2026-01-01' }); // no own type
    expectInvalid(() => readJsonSources(src(['A'], [[cell]]), []));
  });
  it('rejects a BigInt cell without crashing (object input)', () => {
    expectInvalid(() => readJsonSources(src(['A'], [[1n as unknown]]), []));
  });
  it('rejects a cyclic object cell without crashing', () => {
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    expectInvalid(() => readJsonSources(src(['A'], [[cyclic]]), []));
  });
});
