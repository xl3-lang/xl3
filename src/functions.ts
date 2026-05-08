import type { Row } from './types.js';
import { xtlError } from './error-codes.js';

// ADR-0007: a value is empty if it is missing (null/undefined) or a string
// whose contents are entirely Unicode whitespace. Numbers (including 0),
// booleans (including false), and dates are never empty.
export function isEmpty(v: unknown): boolean {
  if (v === null || v === undefined) return true;
  if (typeof v === 'string') return v.trim() === '';
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

export const functions: Record<string, (...args: unknown[]) => unknown> = {
  add: (a, b) => toNumber(a) + toNumber(b),
  sub: (a, b) => toNumber(a) - toNumber(b),
  mul: (a, b) => toNumber(a) * toNumber(b),
  div: (a, b) => {
    const d = toNumber(b);
    return d === 0 ? 0 : toNumber(a) / d;
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
