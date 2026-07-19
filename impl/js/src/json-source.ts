// ADR-0075: read the `xl3-source-json/0.1` wire format into the same
// `SourceData` model the `.xlsx` reader produces (`reader.ts`), so the
// entire downstream pipeline (grouping, directives, rendering) is
// reused unchanged and `convertJson` renders byte-identical output to
// the equivalent `data.xlsx`.
//
// The value mapping mirrors `parseCellValue` in `reader.ts`:
//   null / error cell -> '' (empty string, ADR-0062/0017)
//   date              -> JS Date (UTC, ADR-0017)
//   number/string/boolean -> as-is
// and headers are trimmed and all-empty rows skipped, matching the
// `.xlsx` source path (`headerText` trims; `allEmpty` skips).

import type { Row, SourceSpec, Xl3SourceJsonInput, Xl3SourceJsonValue } from './types.js';
import type { SourceData } from './reader.js';
import { isEmpty } from './functions.js';
import { xtlError } from './error-codes.js';

const WIRE_VERSION = 'xl3-source-json/0.1';

// Same reserved set as reader.ts (ADR-0027): source column names that
// collide with xl3-internal context keys.
const RESERVED_COLUMN_NAMES = new Set(['Rows', '__rownum', '__activeSource__', '__joinedRow__']);
const DUNDER_NAME_RE = /^__[a-z]+__$/;

const DATE_ONLY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const DATE_TIME_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})$/;
const ERROR_VALUES = new Set(['#N/A', '#VALUE!', '#DIV/0!', '#REF!', '#NAME?', '#NUM!', '#NULL!']);

function fail(message: string): never {
  throw xtlError('xl3/source-json/invalid', message);
}

// Own-property read: never trust the prototype chain. Object input may
// carry a manipulated prototype, and `JSON.parse` places a literal
// `"__proto__"` key as an own property — either way, schema fields must
// come from the object itself, not something inherited.
function own(obj: object, key: string): unknown {
  return Object.prototype.hasOwnProperty.call(obj, key)
    ? (obj as Record<string, unknown>)[key]
    : undefined;
}

// Safe description for error messages: `JSON.stringify` throws on
// BigInt and cyclic values (both reachable through object input), which
// would surface as a native TypeError instead of `xl3/source-json/invalid`.
function describe(v: unknown): string {
  try {
    const s = JSON.stringify(v);
    return s === undefined ? String(v) : s;
  } catch {
    return typeof v;
  }
}

function decodeInput(input: Xl3SourceJsonInput): unknown {
  if (typeof input === 'string') {
    try {
      return JSON.parse(input);
    } catch (e) {
      return fail(`source JSON is not valid JSON: ${(e as Error).message}`);
    }
  }
  if (input instanceof ArrayBuffer) return decodeInput(new TextDecoder().decode(new Uint8Array(input)));
  if (input instanceof Uint8Array) return decodeInput(new TextDecoder().decode(input));
  if (input !== null && typeof input === 'object') return input; // already-parsed object
  return fail('source JSON must be a string, ArrayBuffer, Uint8Array, or object');
}

function toUtcDate(value: string, ctx: string): Date {
  const only = DATE_ONLY_RE.exec(value);
  if (only) {
    const [, y, mo, d] = only.map(Number);
    const dt = new Date(Date.UTC(y, mo - 1, d));
    if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) {
      return fail(`${ctx}: "${value}" is not a real calendar date`);
    }
    return dt;
  }
  const dtm = DATE_TIME_RE.exec(value);
  if (dtm) {
    const [, y, mo, d, h, mi, s] = dtm.map(Number);
    const dt = new Date(Date.UTC(y, mo - 1, d, h, mi, s));
    if (
      dt.getUTCFullYear() !== y ||
      dt.getUTCMonth() !== mo - 1 ||
      dt.getUTCDate() !== d ||
      dt.getUTCHours() !== h ||
      dt.getUTCMinutes() !== mi ||
      dt.getUTCSeconds() !== s
    ) {
      return fail(`${ctx}: "${value}" is not a real date-time`);
    }
    return dt;
  }
  return fail(`${ctx}: date value must be "YYYY-MM-DD" or "YYYY-MM-DDTHH:mm:ss", got ${describe(value)}`);
}

function mapValue(v: Xl3SourceJsonValue, ctx: string): unknown {
  if (v === null) return ''; // ADR-0062: empty
  const t = typeof v;
  if (t === 'string' || t === 'boolean') return v;
  if (t === 'number') {
    if (!Number.isFinite(v)) return fail(`${ctx}: number must be finite (got ${describe(v)})`);
    return v;
  }
  if (t === 'object') {
    const tag = own(v as object, 'type');
    if (tag === 'date') {
      const dv = own(v as object, 'value');
      if (typeof dv !== 'string') return fail(`${ctx}: date value must be a string`);
      return toUtcDate(dv, ctx);
    }
    if (tag === 'error') {
      const ev = own(v as object, 'value');
      if (typeof ev !== 'string' || !ERROR_VALUES.has(ev)) {
        return fail(`${ctx}: invalid error value ${describe(ev)}`);
      }
      return ''; // ADR-0017: source error cell reads as empty
    }
    return fail(`${ctx}: unknown tagged value type ${describe(tag)} (expected "date" or "error")`);
  }
  return fail(`${ctx}: unsupported value ${describe(v)}`);
}

function buildSource(name: string, raw: unknown): SourceData {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    return fail(`source "${name}" must be an object with "headers" and "rows"`);
  }
  const headers = own(raw, 'headers');
  const rows = own(raw, 'rows');

  if (!Array.isArray(headers) || headers.length === 0) {
    return fail(`source "${name}" "headers" must be a non-empty array`);
  }

  // Trim headers exactly as the .xlsx reader (`headerText`) does, then
  // validate on the trimmed name — otherwise " Customer " would diverge
  // from XLSX and `["A", " A "]` / " __rownum " would slip past the
  // duplicate / reserved checks.
  const normHeaders: string[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < headers.length; i++) {
    // Own-index read: a sparse array (hole) with a polluted
    // Array.prototype would otherwise inject an inherited value.
    const h = Object.prototype.hasOwnProperty.call(headers, i) ? headers[i] : undefined;
    if (typeof h !== 'string') return fail(`source "${name}" has a non-string header (${describe(h)})`);
    const header = h.trim();
    if (header === '') return fail(`source "${name}" has an empty header`);
    if (seen.has(header)) return fail(`source "${name}" has duplicate header "${header}"`);
    if (RESERVED_COLUMN_NAMES.has(header) || DUNDER_NAME_RE.test(header)) {
      return fail(
        `source "${name}" header "${header}" uses a reserved internal name; rename it (reserved: Rows, __rownum, __activeSource__, __joinedRow__, anything matching __<lowercase>__)`,
      );
    }
    seen.add(header);
    normHeaders.push(header);
  }

  if (!Array.isArray(rows)) return fail(`source "${name}" "rows" must be an array`);

  const outRows: Row[] = [];
  for (let i = 0; i < rows.length; i++) {
    // Own-index read over `rows` itself: `forEach` would skip holes
    // (silently dropping rows) and, with a polluted Array.prototype,
    // materialize an inherited index as a row. Reject any hole instead.
    if (!Object.prototype.hasOwnProperty.call(rows, i)) {
      return fail(`source "${name}" row ${i} is missing (sparse rows array)`);
    }
    const row = rows[i];
    if (!Array.isArray(row)) return fail(`source "${name}" row ${i} must be an array`);
    if (row.length !== normHeaders.length) {
      return fail(`source "${name}" row ${i} has ${row.length} value(s) but there are ${normHeaders.length} headers`);
    }
    const record: Row = {};
    let allEmpty = true;
    for (let c = 0; c < normHeaders.length; c++) {
      const header = normHeaders[c]!;
      // Own-index read (see header loop): guards sparse rows against a
      // polluted Array.prototype supplying inherited cell values.
      const cell = Object.prototype.hasOwnProperty.call(row, c) ? row[c] : undefined;
      const val = mapValue(cell as Xl3SourceJsonValue, `source "${name}" row ${i} column "${header}"`);
      if (!isEmpty(val)) allEmpty = false;
      record[header] = val;
    }
    if (!allEmpty) outRows.push(record); // matches .xlsx all-empty-row skip
  }

  return { sheetName: name, headers: normHeaders, rows: outRows };
}

/**
 * Read the `xl3-source-json/0.1` wire format into the same
 * `Record<string, SourceData>` the `.xlsx` reader (`readAllSources`)
 * produces. Honors the ADR-0012 declared-source model: `default` is
 * required, every template-declared source must be present, and any
 * extra undeclared source is rejected.
 */
export function readJsonSources(
  input: Xl3SourceJsonInput,
  declaredSources: SourceSpec[],
): Record<string, SourceData> {
  const parsed = decodeInput(input);
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return fail('source JSON must be an object with "version" and "sources"');
  }

  const version = own(parsed, 'version');
  const sources = own(parsed, 'sources');
  if (version !== WIRE_VERSION) {
    return fail(`unsupported source JSON version ${describe(version)} (expected "${WIRE_VERSION}")`);
  }
  if (sources === null || typeof sources !== 'object' || Array.isArray(sources)) {
    return fail('source JSON "sources" must be an object keyed by source name');
  }

  const jsonSources = sources as object;
  const jsonNames = Object.keys(jsonSources); // own enumerable keys only
  if (!Object.prototype.hasOwnProperty.call(jsonSources, 'default')) {
    return fail('source JSON must include a "default" source');
  }

  // ADR-0012 declared-source model: reject extras, require declared.
  const declaredNames = new Set(declaredSources.map((s) => s.name));
  for (const name of jsonNames) {
    if (name !== 'default' && !declaredNames.has(name)) {
      return fail(
        `source JSON has an undeclared source "${name}"; declare it in the template's __sources__ sheet or remove it`,
      );
    }
  }
  for (const spec of declaredSources) {
    if (!Object.prototype.hasOwnProperty.call(jsonSources, spec.name)) {
      return fail(`template declares source "${spec.name}" but the source JSON does not provide it`);
    }
  }

  const out: Record<string, SourceData> = {};
  out['default'] = buildSource('default', own(jsonSources, 'default'));
  for (const spec of declaredSources) {
    out[spec.name] = buildSource(spec.name, own(jsonSources, spec.name));
  }
  return out;
}
