import type { Row } from './types.js';
import { xtlError } from './error-codes.js';

// ADR-0025: marker for an Excel-style error cell value produced by
// xl3 (currently only `#DIV/0!` from division by zero). The renderer
// detects this shape and writes a real ExcelJS error cell so the
// output workbook displays #DIV/0! the way Excel would. In string
// contexts (canonicalString, & concatenation), the marker stringifies
// to its `code` so authors get a readable value back.
export interface XtlErrorCell {
  __xl3_error__: '#DIV/0!';
}

export const DIV_ZERO_ERROR: XtlErrorCell = { __xl3_error__: '#DIV/0!' };

export function isErrorCellMarker(v: unknown): v is XtlErrorCell {
  return typeof v === 'object' && v !== null && '__xl3_error__' in v;
}

// ADR-0039: HYPERLINK() returns a marker the renderer unwraps to
// ExcelJS's `{ text, hyperlink }` cell shape. Stringification (canonical
// form, & concatenation) yields the label text so authors who pass a
// HYPERLINK through TEXT() or & still get a readable string.
export interface XtlHyperlinkCell {
  __xl3_hyperlink__: string; // url
  text: string;              // visible label
}

export function isHyperlinkMarker(v: unknown): v is XtlHyperlinkCell {
  return typeof v === 'object' && v !== null && '__xl3_hyperlink__' in v;
}

// ADR-0007: a value is empty if it is missing (null/undefined) or a string
// whose contents are entirely Unicode whitespace. Numbers (including 0),
// booleans (including false), and dates are never empty.
//
// ADR-0007 amendment: zero-width characters (U+200B zero-width
// space, U+FEFF zero-width no-break space / BOM) are explicitly NOT
// whitespace and count as content. ECMAScript's native
// String.prototype.trim strips U+FEFF, so a host-naive
// .trim() === '' would diverge from the ADR on a single-FEFF string.
// Pre-replace zero-width characters with a non-whitespace sentinel so
// they survive trim().
const ZERO_WIDTH_RE = /[\u200B\uFEFF]/g;

export function isEmpty(v: unknown): boolean {
  if (v === null || v === undefined) return true;
  if (typeof v === 'string') {
    if (v === '') return true;
    return v.replace(ZERO_WIDTH_RE, '\x01').trim() === '';
  }
  return false;
}

// ADR-0008: a value is truthy unless it is `false`, the number 0, or
// empty per ADR-0007. Strings with non-whitespace content (including
// "0" and "false") are truthy.
export function isTruthy(v: unknown): boolean {
  if (v === false) return false;
  if (typeof v === 'number') return v !== 0;
  if (isEmpty(v)) return false;
  return true;
}

// ADR-0009 / ADR-0017: canonical string form. Empty → "". Boolean →
// "TRUE"/"FALSE". Number → ECMAScript shortest round-trippable form
// (Number.prototype.toString matches the spec's range guarantee for
// 1e-4..1e21). String → itself. Date → YYYY-MM-DD when midnight,
// otherwise YYYY-MM-DDTHH:mm:ss (ADR-0017).
export function canonicalString(v: unknown): string {
  if (isEmpty(v)) return '';
  if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
  if (typeof v === 'number') {
    if (!Number.isFinite(v)) return '';
    return String(v);
  }
  if (typeof v === 'string') return v;
  if (v instanceof Date) return canonicalDateString(v);
  // ADR-0025: error cell marker stringifies to its Excel error code.
  if (isErrorCellMarker(v)) return v.__xl3_error__;
  // ADR-0039: HYPERLINK marker stringifies to its visible label so that
  // mixed-text cells (`Result: {{ HYPERLINK(...) }}`) and `&`
  // concatenation produce readable text. The clickable form is only
  // surfaced for single-expression cells (per renderer).
  if (isHyperlinkMarker(v)) return v.text;
  return String(v);
}

// ADR-0017: Date canonical form uses UTC accessors so the output is
// independent of the host machine's timezone. ExcelJS represents
// timezone-naive Excel dates at UTC midnight, so UTC matches the
// authored wall-clock value.
function canonicalDateString(d: Date): string {
  const y = String(d.getUTCFullYear()).padStart(4, '0');
  const mo = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const h = d.getUTCHours();
  const mi = d.getUTCMinutes();
  const s = d.getUTCSeconds();
  const date = `${y}-${mo}-${dd}`;
  if (h === 0 && mi === 0 && s === 0) return date;
  return `${date}T${String(h).padStart(2, '0')}:${String(mi).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// ADR-0009: shared comparison algorithm used by IF, @filter, and @sort.
// Returns -1, 0, or +1.
export function compareValues(a: unknown, b: unknown): -1 | 0 | 1 {
  const aEmpty = isEmpty(a);
  const bEmpty = isEmpty(b);
  if (aEmpty && bEmpty) return 0;
  if (aEmpty) return -1;
  if (bEmpty) return 1;

  if (isNumberLike(a) && isNumberLike(b)) {
    const na = toComparableNumber(a);
    const nb = toComparableNumber(b);
    return na < nb ? -1 : na > nb ? 1 : 0;
  }

  if (typeof a === 'boolean' && typeof b === 'boolean') {
    if (a === b) return 0;
    return a ? 1 : -1;
  }

  // ADR-0017: two dates compare by their underlying timestamp.
  if (a instanceof Date && b instanceof Date) {
    const ta = a.getTime();
    const tb = b.getTime();
    return ta < tb ? -1 : ta > tb ? 1 : 0;
  }

  const sa = canonicalString(a);
  const sb = canonicalString(b);
  return sa < sb ? -1 : sa > sb ? 1 : 0;
}

// ADR-0013 (impl-only): cache lookup indexes per (rows-array, column).
// The cache lives only for the duration the rows array is reachable
// and is reused across repeat XLOOKUP calls within the same conversion.
const xlookupIndexCache = new WeakMap<Row[], Map<string, Map<string, Row>>>();

function getOrBuildLookupIndex(rows: Row[], col: string): Map<string, Row> {
  let perCol = xlookupIndexCache.get(rows);
  if (!perCol) {
    perCol = new Map();
    xlookupIndexCache.set(rows, perCol);
  }
  let idx = perCol.get(col);
  if (idx) return idx;
  idx = new Map();
  for (const row of rows) {
    const v = row[col];
    if (isEmpty(v)) continue;
    const key = canonicalString(v);
    if (!idx.has(key)) idx.set(key, row);
  }
  perCol.set(col, idx);
  return idx;
}

// Validate that `field` is a real column in `rows` so a typo like
// `Renewals[Amout]` errors instead of silently aggregating to 0. Uses
// the first row's keys (the reader writes every declared header to
// every row, so this matches the source's full header set).
function assertField(rows: Row[], field: string, sourceHint?: string): void {
  if (rows.length === 0) return;
  if (field in rows[0]!) return;
  const where = sourceHint ? ` of source "${sourceHint}"` : '';
  throw xtlError(
    'xl3/source/unknown-column',
    `Column "${field}"${where} does not exist`,
  );
}

function isNumberLike(v: unknown): boolean {
  if (typeof v === 'number') return Number.isFinite(v);
  if (typeof v === 'string') {
    const trimmed = v.trim();
    if (trimmed === '') return false;
    const n = Number(trimmed);
    return Number.isFinite(n);
  }
  return false;
}

function toComparableNumber(v: unknown): number {
  if (typeof v === 'number') return v;
  return Number(String(v).trim());
}

function toDate(v: unknown): Date | null {
  if (v instanceof Date) return v;
  if (typeof v === 'number') {
    // Excel serial number (days since 1900-01-01, with the 1900 leap year bug).
    // ADR-0017: store at UTC midnight so formatting via UTC accessors
    // is timezone-independent.
    if (v > 25569 && v < 100000) {
      const ms = (v - 25569) * 86400000;
      return new Date(ms);
    }
    return null;
  }
  if (typeof v === 'string' && v.trim()) {
    // ADR-0017: append `Z` to anchor at UTC. Bare ISO strings without
    // an offset would otherwise be parsed in local time.
    const d = new Date(v + (v.includes('T') ? 'Z' : 'T00:00:00Z'));
    if (!isNaN(d.getTime())) return d;
  }
  return null;
}

function toNumber(v: unknown): number {
  if (typeof v === 'number') return v;
  if (typeof v === 'string') {
    const cleaned = v.replace(/,/g, '');
    const n = parseFloat(cleaned);
    if (!isNaN(n)) return n;
  }
  return 0;
}

// ADR-0023: strict numeric coercion for arithmetic operators. Unlike
// `toNumber` (which silently returns 0 for non-numeric input — used
// by aggregates), this helper throws when an operand cannot be
// coerced to a finite number. Empty values coerce to 0 per Excel.
function toNumberOrThrow(v: unknown, op: string): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (isEmpty(v)) return 0;
  if (typeof v === 'string') {
    const cleaned = v.trim().replace(/,/g, '');
    if (cleaned !== '') {
      const n = Number(cleaned);
      if (Number.isFinite(n)) return n;
    }
  }
  if (v instanceof Date) {
    // Excel treats Date as serial number in arithmetic. xl3 does not
    // expose Excel serial conversions; treat as a coercion error
    // rather than guess.
    throw xtlError(
      'xl3/eval/operand-coercion',
      `Operator "${op}" cannot coerce a Date to a number; use TEXT() or arithmetic upstream`,
    );
  }
  throw xtlError(
    'xl3/eval/operand-coercion',
    `Operator "${op}" cannot coerce ${describeOperand(v)} to a number`,
  );
}

function describeOperand(v: unknown): string {
  if (v === null) return 'null';
  if (v === undefined) return 'undefined';
  if (typeof v === 'string') return `string "${v}"`;
  if (typeof v === 'boolean') return `boolean ${v ? 'TRUE' : 'FALSE'}`;
  return `value of type ${typeof v}`;
}

export const functions: Record<string, (...args: unknown[]) => unknown> = {
  // ADR-0023: arithmetic operators require both operands to coerce
  // to a finite number. Failure is `xl3/eval/operand-coercion`.
  // Empty values coerce to 0 (Excel-compatible).
  add: (a, b) => toNumberOrThrow(a, '+') + toNumberOrThrow(b, '+'),
  sub: (a, b) => toNumberOrThrow(a, '-') - toNumberOrThrow(b, '-'),
  mul: (a, b) => toNumberOrThrow(a, '*') * toNumberOrThrow(b, '*'),
  div: (a, b) => {
    const d = toNumberOrThrow(b, '/');
    // ADR-0025: division by zero produces an Excel-style #DIV/0!
    // error cell in the output (matches Excel's behavior; aligns
    // with ADR-0023 Excel-default principle). The renderer
    // recognizes this marker shape and writes a real ExcelJS error
    // cell value. canonicalString returns "#DIV/0!" so the marker
    // also flows through `&` and other contexts as a readable string.
    if (d === 0) return DIV_ZERO_ERROR;
    return toNumberOrThrow(a, '/') / d;
  },
  concat: (...parts) => parts.map((p) => canonicalString(p)).join(''),

  IF: (condition, trueValue, falseValue) =>
    isTruthy(condition) ? trueValue : falseValue,

  IFEMPTY: (v, def) => (isEmpty(v) ? def : v),

  index: (obj, key) => {
    if (obj && typeof obj === 'object' && typeof key === 'string') {
      return (obj as Record<string, unknown>)[key] ?? '';
    }
    return '';
  },

  // Aggregates
  sumRows: (rows, field) => {
    const arr = rows as Row[];
    if (!Array.isArray(arr)) return 0;
    const f = field as string;
    assertField(arr, f);
    return arr.reduce((sum, row) => sum + toNumber(row[f]), 0);
  },

  avgRows: (rows, field) => {
    const arr = rows as Row[];
    if (!Array.isArray(arr)) return 0;
    const f = field as string;
    assertField(arr, f);
    if (arr.length === 0) return 0;
    return arr.reduce((sum, row) => sum + toNumber(row[f]), 0) / arr.length;
  },

  minRows: (rows, field) => {
    const arr = rows as Row[];
    if (!Array.isArray(arr) || arr.length === 0) return 0;
    const f = field as string;
    assertField(arr, f);
    return arr.reduce(
      (min, row) => Math.min(min, toNumber(row[f])),
      Infinity,
    );
  },

  maxRows: (rows, field) => {
    const arr = rows as Row[];
    if (!Array.isArray(arr) || arr.length === 0) return 0;
    const f = field as string;
    assertField(arr, f);
    return arr.reduce(
      (max, row) => Math.max(max, toNumber(row[f])),
      -Infinity,
    );
  },

  countRows: (rows, field) => {
    const arr = rows as Row[];
    if (!Array.isArray(arr)) return 0;
    const f = field as string;
    assertField(arr, f);
    return arr.reduce((count, row) => (isEmpty(row[f]) ? count : count + 1), 0);
  },

  // ADR-0013: XLOOKUP — find the first row in `rows` where the
  // `lookupCol` column equals `lookupValue` (per ADR-0009), and return
  // that row's `returnCol`. With 5 args, the 5th is the fallback when
  // no row matches; with 4 args, no-match is an error.
  //
  // Performance: indexes the row set by `lookupCol` on first use and
  // caches the index per `rows` array via WeakMap. Repeat XLOOKUP
  // calls over the same source/column become O(1) instead of O(N).
  xlookupRows: (...args) => {
    const rows = args[0] as Row[];
    const lookupValue = args[1];
    const lookupCol = args[2] as string;
    const returnCol = args[3] as string;
    const hasFallback = args.length >= 5;
    const fallback = args[4];
    const arr = Array.isArray(rows) ? rows : [];
    assertField(arr, lookupCol);
    assertField(arr, returnCol);
    // Empty lookup keys aren't indexed (the index drops empty rows);
    // fall back to a linear scan so the spec's "empty equals empty"
    // semantic still works for the rare templates that need it.
    if (isEmpty(lookupValue)) {
      for (const row of arr) {
        if (compareValues(row[lookupCol], lookupValue) === 0) {
          return row[returnCol] ?? '';
        }
      }
      if (hasFallback) return fallback;
      throw xtlError(
        'xl3/xlookup/no-match',
        `XLOOKUP found no row where [${lookupCol}] equals "${canonicalString(lookupValue)}"`,
      );
    }
    const idx = getOrBuildLookupIndex(arr, lookupCol);
    const matched = idx.get(canonicalString(lookupValue));
    if (matched) return matched[returnCol] ?? '';
    if (hasFallback) return fallback;
    throw xtlError(
      'xl3/xlookup/no-match',
      `XLOOKUP found no row where [${lookupCol}] equals "${canonicalString(lookupValue)}"`,
    );
  },

  len: (v) => {
    if (Array.isArray(v)) return v.length;
    return 0;
  },

  ROUND: (v, places) => {
    // Half-away-from-zero, matching Excel ROUND(): ROUND(2.5, 0)=3, ROUND(-2.5, 0)=-3.
    // JS Math.round is half-to-+Infinity, so it cannot be used for negative .5 cases.
    const n = toNumber(v);
    const p = Math.pow(10, toNumber(places));
    const scaled = n * p;
    const rounded = scaled >= 0
      ? Math.floor(scaled + 0.5)
      : -Math.floor(-scaled + 0.5);
    return rounded / p;
  },

  ABS: (v) => Math.abs(toNumber(v)),

  TEXT: (v, fmt) => {
    const f = String(fmt);
    if (isTextDateFormat(f)) {
      const d = toDate(v);
      if (d) return formatDate(d, f);
    }
    const formatted = formatNumber(v, f);
    if (formatted !== null) return formatted;
    return String(v ?? '');
  },

  // ADR-0019 amendment (2026-05-18): date arithmetic functions.
  // All UTC per ADR-0017. Non-date inputs → xl3/eval/type-mismatch.
  YEAR: (v) => {
    const d = toDate(v);
    if (!d) throw xtlError('xl3/eval/type-mismatch', `YEAR() expected a date, got: ${describeOperand(v)}`);
    return d.getUTCFullYear();
  },
  MONTH: (v) => {
    const d = toDate(v);
    if (!d) throw xtlError('xl3/eval/type-mismatch', `MONTH() expected a date, got: ${describeOperand(v)}`);
    return d.getUTCMonth() + 1;
  },
  DAY: (v) => {
    const d = toDate(v);
    if (!d) throw xtlError('xl3/eval/type-mismatch', `DAY() expected a date, got: ${describeOperand(v)}`);
    return d.getUTCDate();
  },
  EOMONTH: (date, months) => {
    const d = toDate(date);
    if (!d) throw xtlError('xl3/eval/type-mismatch', `EOMONTH() expected a date as the 1st argument, got: ${describeOperand(date)}`);
    const m = toNumber(months);
    if (!Number.isInteger(m)) throw xtlError('xl3/eval/type-mismatch', `EOMONTH() expected an integer month offset, got: ${describeOperand(months)}`);
    // Day 0 of (target month + 1) = last day of target month.
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + m + 1, 0));
  },
  EDATE: (date, months) => {
    const d = toDate(date);
    if (!d) throw xtlError('xl3/eval/type-mismatch', `EDATE() expected a date as the 1st argument, got: ${describeOperand(date)}`);
    const m = toNumber(months);
    if (!Number.isInteger(m)) throw xtlError('xl3/eval/type-mismatch', `EDATE() expected an integer month offset, got: ${describeOperand(months)}`);
    const y = d.getUTCFullYear();
    const mm = d.getUTCMonth() + m;
    const dd = d.getUTCDate();
    // Clamp to last day of target month if dd exceeds the month length.
    const lastDay = new Date(Date.UTC(y, mm + 1, 0)).getUTCDate();
    return new Date(Date.UTC(y, mm, Math.min(dd, lastDay)));
  },
  DATEDIF: (start, end, unit) => {
    const s = toDate(start);
    const e = toDate(end);
    if (!s) throw xtlError('xl3/eval/type-mismatch', `DATEDIF() expected a date as the 1st argument, got: ${describeOperand(start)}`);
    if (!e) throw xtlError('xl3/eval/type-mismatch', `DATEDIF() expected a date as the 2nd argument, got: ${describeOperand(end)}`);
    const u = String(unit ?? '').toUpperCase();
    if (u !== 'Y' && u !== 'M' && u !== 'D') {
      throw xtlError('xl3/eval/type-mismatch', `DATEDIF() unit must be "Y", "M", or "D"; got: ${describeOperand(unit)}`);
    }
    const sign = e.getTime() >= s.getTime() ? 1 : -1;
    const [a, b] = sign === 1 ? [s, e] : [e, s];
    if (u === 'D') return sign * Math.floor((b.getTime() - a.getTime()) / 86400000);
    let years = b.getUTCFullYear() - a.getUTCFullYear();
    let months = b.getUTCMonth() - a.getUTCMonth();
    let days = b.getUTCDate() - a.getUTCDate();
    if (days < 0) months -= 1;
    if (months < 0) { years -= 1; months += 12; }
    return sign * (u === 'Y' ? years : years * 12 + months);
  },

  // ADR-0039: dynamic hyperlink — returns a marker the renderer unwraps
  // to ExcelJS's `{ text, hyperlink }` cell shape so the rendered cell
  // is clickable.
  // ADR-0044: string functions justified by render-time use in
  // @filter / @sort predicates (per ADR-0043 gate). For cell-output
  // case conversion the author should prefer the cell formula
  // `=UPPER(B2)` so Excel evaluates at open.
  UPPER: (s) => canonicalString(s).toUpperCase(),
  LOWER: (s) => canonicalString(s).toLowerCase(),
  TRIM: (s) => canonicalString(s).trim(),

  // ADR-0044: IFERROR / IFS. IFERROR catches xtlError or error-cell
  // markers; IFS picks the first truthy branch and raises
  // xl3/eval/no-match if nothing matches (the `TRUE, default` idiom
  // provides a default).
  IFERROR: (...args) => {
    if (args.length !== 2) {
      throw xtlError('xl3/eval/arity-mismatch', `IFERROR() takes exactly 2 arguments, got ${args.length}`);
    }
    const [value, fallback] = args;
    if (isErrorCellMarker(value)) return fallback;
    return value;
  },
  IFS: (...args) => {
    if (args.length === 0 || args.length % 2 !== 0) {
      throw xtlError('xl3/eval/arity-mismatch', `IFS() requires an even number of arguments (condition, value pairs); got ${args.length}`);
    }
    for (let i = 0; i < args.length; i += 2) {
      if (isTruthy(args[i])) return args[i + 1];
    }
    throw xtlError('xl3/eval/no-match', `IFS() no condition matched; pass a trailing "TRUE, default" pair for a fallback`);
  },

  // ADR-0044: DATE(year, month, day) composes a UTC-midnight date
  // from `__inputs__` integer components. Out-of-range month/day
  // roll over (JS Date semantics, matching Excel's DATE).
  DATE: (y, m, d) => {
    const parse = (v: unknown, name: string): number => {
      if (typeof v === 'number' && Number.isFinite(v)) return v;
      if (typeof v === 'string') {
        const trimmed = v.trim();
        if (trimmed === '') {
          throw xtlError('xl3/eval/type-mismatch', `DATE() ${name} must be a finite number; got empty string`);
        }
        const n = Number(trimmed);
        if (Number.isFinite(n)) return n;
      }
      throw xtlError('xl3/eval/type-mismatch', `DATE() ${name} must be a finite number; got ${describeOperand(v)}`);
    };
    const yi = parse(y, 'year');
    const mi = parse(m, 'month');
    const di = parse(d, 'day');
    if (yi < 0) {
      throw xtlError('xl3/eval/type-mismatch', `DATE() year must be non-negative; got ${yi}`);
    }
    return new Date(Date.UTC(Math.trunc(yi), Math.trunc(mi) - 1, Math.trunc(di)));
  },

  HYPERLINK: (url, label) => {
    const u = String(url ?? '').trim();
    if (u === '') throw xtlError('xl3/eval/type-mismatch', `HYPERLINK() url argument must be a non-empty string`);
    const text = label == null || label === '' ? u : String(label);
    const marker: XtlHyperlinkCell = { __xl3_hyperlink__: u, text };
    return marker;
  },

  TODAY: () => {
    // ADR-0001: TODAY() returns the UTC date at render time, never host local TZ.
    // Construct the Date so its local Y/M/D match the UTC date — this lets
    // existing date formatters (which read local accessors, consistent with
    // how source Excel dates flow through toDate) produce the UTC calendar
    // date in any host timezone.
    // ADR-0017: build the Date from UTC components so the canonical
    // string form (which uses UTC accessors) reads back the same day.
    // Using `new Date(y, m, d)` would produce a local-midnight Date
    // that shifts a day in any non-UTC timezone.
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  },

  // ADR-0009: shared comparison algorithm.
  eq: (a, b) => compareValues(a, b) === 0,
  ne: (a, b) => compareValues(a, b) !== 0,
  gt: (a, b) => compareValues(a, b) > 0,
  ge: (a, b) => compareValues(a, b) >= 0,
  lt: (a, b) => compareValues(a, b) < 0,
  le: (a, b) => compareValues(a, b) <= 0,
};

function formatDate(d: Date, fmt: string): string {
  // ADR-0017: read date components in UTC to match canonicalDateString
  // and the timezone-naive Excel cell value.
  const y = d.getUTCFullYear();
  const M = d.getUTCMonth() + 1;
  const D = d.getUTCDate();
  const H = d.getUTCHours();
  const m = d.getUTCMinutes();
  const s = d.getUTCSeconds();
  return fmt
    .replace('YYYY', String(y))
    .replace('YY', String(y).slice(-2))
    .replace('MM', String(M).padStart(2, '0'))
    .replace('DD', String(D).padStart(2, '0'))
    .replace('dd', String(D).padStart(2, '0'))
    .replace('HH', String(H).padStart(2, '0'))
    .replace('hh', String(H).padStart(2, '0'))
    .replace('mm', String(m).padStart(2, '0'))
    .replace('ss', String(s).padStart(2, '0'));
}

function isTextDateFormat(fmt: string): boolean {
  return /(Y{2,4}|M{2}|D{2}|d{2}|H{2}|h{2}|m{2}|s{2})/.test(fmt);
}

function formatNumber(v: unknown, fmt: string): string | null {
  if (!['0', '#,##0', '0.00', '#,##0.00'].includes(fmt)) return null;

  const n = toNumber(v);
  const isNeg = n < 0;
  const abs = Math.abs(n);
  const decimals = fmt.endsWith('.00') ? 2 : 0;
  const factor = Math.pow(10, decimals);
  const rounded = Math.floor(abs * factor + 0.5) / factor;

  let s = decimals > 0 ? rounded.toFixed(decimals) : String(Math.floor(rounded));
  if (fmt.startsWith('#,##0')) {
    const [intPart, fracPart] = s.split('.');
    s = intPart!.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (fracPart ? `.${fracPart}` : '');
  }
  return isNeg ? '-' + s : s;
}
