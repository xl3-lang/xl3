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
// and all-empty rows are skipped, matching `.xlsx` source behavior.

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
  return fail(`${ctx}: date value must be "YYYY-MM-DD" or "YYYY-MM-DDTHH:mm:ss", got ${JSON.stringify(value)}`);
}

function mapValue(v: Xl3SourceJsonValue, ctx: string): unknown {
  if (v === null) return ''; // ADR-0062: empty
  const t = typeof v;
  if (t === 'string' || t === 'boolean') return v;
  if (t === 'number') {
    if (!Number.isFinite(v)) return fail(`${ctx}: number must be finite (got ${JSON.stringify(v)})`);
    return v;
  }
  if (v !== null && typeof v === 'object') {
    const tag = (v as { type?: unknown }).type;
    if (tag === 'date') {
      const dv = (v as { value?: unknown }).value;
      if (typeof dv !== 'string') return fail(`${ctx}: date value must be a string`);
      return toUtcDate(dv, ctx);
    }
    if (tag === 'error') {
      const ev = (v as { value?: unknown }).value;
      if (typeof ev !== 'string' || !ERROR_VALUES.has(ev)) {
        return fail(`${ctx}: invalid error value ${JSON.stringify(ev)}`);
      }
      return ''; // ADR-0017: source error cell reads as empty
    }
    return fail(`${ctx}: unknown tagged value type ${JSON.stringify(tag)} (expected "date" or "error")`);
  }
  return fail(`${ctx}: unsupported value ${JSON.stringify(v)}`);
}

function buildSource(name: string, raw: unknown): SourceData {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    return fail(`source "${name}" must be an object with "headers" and "rows"`);
  }
  const { headers, rows } = raw as { headers?: unknown; rows?: unknown };

  if (!Array.isArray(headers) || headers.length === 0) {
    return fail(`source "${name}" "headers" must be a non-empty array`);
  }
  const seen = new Set<string>();
  for (const h of headers) {
    if (typeof h !== 'string' || h.trim() === '') {
      return fail(`source "${name}" has an empty or non-string header`);
    }
    if (seen.has(h)) return fail(`source "${name}" has duplicate header "${h}"`);
    if (RESERVED_COLUMN_NAMES.has(h) || DUNDER_NAME_RE.test(h)) {
      return fail(
        `source "${name}" header "${h}" uses a reserved internal name; rename it (reserved: Rows, __rownum, __activeSource__, __joinedRow__, anything matching __<lowercase>__)`,
      );
    }
    seen.add(h);
  }

  if (!Array.isArray(rows)) return fail(`source "${name}" "rows" must be an array`);

  const outRows: Row[] = [];
  rows.forEach((row, i) => {
    if (!Array.isArray(row)) return fail(`source "${name}" row ${i} must be an array`);
    if (row.length !== headers.length) {
      return fail(`source "${name}" row ${i} has ${row.length} value(s) but there are ${headers.length} headers`);
    }
    const record: Row = {};
    let allEmpty = true;
    for (let c = 0; c < headers.length; c++) {
      const header = headers[c] as string;
      const val = mapValue(row[c] as Xl3SourceJsonValue, `source "${name}" row ${i} column "${header}"`);
      if (!isEmpty(val)) allEmpty = false;
      record[header] = val;
    }
    if (!allEmpty) outRows.push(record); // matches .xlsx all-empty-row skip
  });

  return { sheetName: name, headers: headers.slice() as string[], rows: outRows };
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

  const { version, sources } = parsed as { version?: unknown; sources?: unknown };
  if (version !== WIRE_VERSION) {
    return fail(`unsupported source JSON version ${JSON.stringify(version)} (expected "${WIRE_VERSION}")`);
  }
  if (sources === null || typeof sources !== 'object' || Array.isArray(sources)) {
    return fail('source JSON "sources" must be an object keyed by source name');
  }

  const jsonSources = sources as Record<string, unknown>;
  const jsonNames = Object.keys(jsonSources);
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
  out['default'] = buildSource('default', jsonSources['default']);
  for (const spec of declaredSources) {
    out[spec.name] = buildSource(spec.name, jsonSources[spec.name]);
  }
  return out;
}
