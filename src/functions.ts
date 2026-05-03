import type { Row } from './types.js';

function toDate(v: unknown): Date | null {
  if (v instanceof Date) return v;
  if (typeof v === 'number') {
    // Excel serial number (days since 1900-01-01, with the 1900 leap year bug)
    if (v > 25569 && v < 100000) {
      const ms = (v - 25569) * 86400000;
      const d = new Date(ms);
      // Compensate for local timezone offset so formatting uses UTC date
      return new Date(d.getTime() + d.getTimezoneOffset() * 60000);
    }
    return null;
  }
  if (typeof v === 'string' && v.trim()) {
    const d = new Date(v + (v.includes('T') ? '' : 'T00:00:00'));
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
  concat: (...parts) => parts.map((p) => String(p ?? '')).join(''),

  IF: (condition, trueValue, falseValue) => {
    if (condition && condition !== 'false' && condition !== '0') return trueValue;
    return falseValue;
  },

  IFEMPTY: (v, def) => {
    if (v === null || v === undefined || v === '') return def;
    return v;
  },

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
    return arr.reduce((sum, row) => sum + toNumber(row[f]), 0);
  },

  avgRows: (rows, field) => {
    const arr = rows as Row[];
    if (!Array.isArray(arr)) return 0;
    const f = field as string;
    if (arr.length === 0) return 0;
    return arr.reduce((sum, row) => sum + toNumber(row[f]), 0) / arr.length;
  },

  minRows: (rows, field) => {
    const arr = rows as Row[];
    if (!Array.isArray(arr) || arr.length === 0) return 0;
    const f = field as string;
    return arr.reduce(
      (min, row) => Math.min(min, toNumber(row[f])),
      Infinity,
    );
  },

  maxRows: (rows, field) => {
    const arr = rows as Row[];
    if (!Array.isArray(arr) || arr.length === 0) return 0;
    const f = field as string;
    return arr.reduce(
      (max, row) => Math.max(max, toNumber(row[f])),
      -Infinity,
    );
  },

  countRows: (rows, field) => {
    const arr = rows as Row[];
    if (!Array.isArray(arr)) return 0;
    const f = field as string;
    return arr.reduce((count, row) => {
      const v = row[f];
      return v === null || v === undefined || v === '' ? count : count + 1;
    }, 0);
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
    const d = toDate(v);
    if (d) return formatDate(d, f);
    if (/[#0?,.%]/.test(f)) return formatNumber(v);
    return String(v ?? '');
  },

  TODAY: () => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  },

  eq: (a, b) => String(a) === String(b),
  ne: (a, b) => String(a) !== String(b),
  gt: (a, b) => toNumber(a) > toNumber(b),
  ge: (a, b) => toNumber(a) >= toNumber(b),
  lt: (a, b) => toNumber(a) < toNumber(b),
  le: (a, b) => toNumber(a) <= toNumber(b),
};

function formatDate(d: Date, fmt: string): string {
  const y = d.getFullYear();
  const M = d.getMonth() + 1;
  const D = d.getDate();
  const H = d.getHours();
  const m = d.getMinutes();
  const s = d.getSeconds();
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

function formatNumber(v: unknown): string {
  const n = toNumber(v);
  const isNeg = n < 0;
  const abs = Math.abs(n);
  const intPart = Math.floor(abs);
  const fracPart = abs - intPart;

  let s = intPart.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  if (fracPart > 0.0001) {
    s += fracPart.toFixed(2).slice(1);
  }
  return isNeg ? '-' + s : s;
}
