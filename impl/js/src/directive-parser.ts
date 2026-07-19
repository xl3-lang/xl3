import type { Directive, FilterOp } from './types.js';
import { xtlError } from './error-codes.js';

const DIRECTIVE_RE = /^@(filter|sort|top|repeat|source|join|group|block)\b/i;
const SOURCE_NAME_RE = /^[A-Za-z0-9_]+$/;
// ADR-0038: @subtotal is a CELL expression marker, not a directive
// row. It must travel through the directive-aware parser path (so
// rows containing only @subtotal do NOT become regular per-row data
// rows) but the parsed result is the inner aggregate, marked as
// group-scoped.
const SUBTOTAL_PREFIX_RE = /^@subtotal\b/i;
const SUBTOTAL_BODY_RE = /^@subtotal\s+(SUM|COUNT|AVERAGE|AVG|MIN|MAX)\s*\(\s*([^)]*)\s*\)\s*$/i;

export function isDirectiveExpression(expr: string): boolean {
  return DIRECTIVE_RE.test(expr.trim());
}

/** ADR-0038: the `@subtotal …` cell expression form. */
export function isSubtotalExpression(expr: string): boolean {
  return SUBTOTAL_PREFIX_RE.test(expr.trim());
}

export interface SubtotalAggregate {
  fn: 'SUM' | 'COUNT' | 'AVERAGE' | 'MIN' | 'MAX';
  arg: string; // raw inside-parens content (e.g., "[Amount]", "Source[Amount]", "")
}

/**
 * ADR-0038: parse the `@subtotal <aggregate>` cell expression. Returns
 * the inner aggregate descriptor, normalizes `AVG` to `AVERAGE`, and
 * throws `xl3/subtotal/bad-aggregate` on any unsupported function or
 * argument shape.
 */
export function parseSubtotalAggregate(expr: string): SubtotalAggregate {
  const trimmed = expr.trim();
  const m = trimmed.match(SUBTOTAL_BODY_RE);
  if (!m) {
    throw xtlError(
      'xl3/subtotal/bad-aggregate',
      `@subtotal accepts SUM, COUNT, AVERAGE, MIN, MAX only; got: ${trimmed}`,
    );
  }
  const rawFn = m[1]!.toUpperCase();
  const fn = (rawFn === 'AVG' ? 'AVERAGE' : rawFn) as SubtotalAggregate['fn'];
  const arg = (m[2] ?? '').trim();
  // COUNT() with no arg is allowed; other aggregates need a column ref.
  if (fn !== 'COUNT' && arg === '') {
    throw xtlError(
      'xl3/subtotal/bad-aggregate',
      `@subtotal ${fn}() requires a column reference argument`,
    );
  }
  // Reject arbitrary expressions — only column-ref-style args are accepted.
  if (arg !== '' && !/^([A-Za-z][A-Za-z0-9_]*)?\[[^\]\r\n]+\]$/.test(arg)) {
    throw xtlError(
      'xl3/subtotal/bad-aggregate',
      `@subtotal ${fn}(${arg}) — only column references are accepted; arbitrary expressions are deferred`,
    );
  }
  return { fn, arg };
}

export function parseDirective(expr: string): Directive | null {
  const trimmed = expr.trim();

  const lower = trimmed.toLowerCase();
  if (lower.startsWith('@filter ')) return parseFilter(trimmed.slice(8).trim());
  if (lower.startsWith('@sort ')) return parseSort(trimmed.slice(6).trim());
  if (lower.startsWith('@top ')) return parseTop(trimmed.slice(5).trim());
  if (lower.startsWith('@repeat ')) return parseRepeat(trimmed.slice(8).trim());
  if (lower.startsWith('@source ')) return parseSource(trimmed.slice(8).trim());
  if (lower.startsWith('@join ')) return parseJoin(trimmed.slice(6).trim());
  if (lower === '@group' || lower.startsWith('@group ')) return parseGroup(trimmed.slice(6).trim());
  if (lower === '@block' || lower.startsWith('@block ')) return parseBlock(trimmed.slice(6).trim());

  return null;
}

// ADR-0067: parse one of three forms — bare / col-range / full-rect.
function parseBlock(body: string): Directive {
  const trimmed = body.trim();
  if (trimmed === '') {
    // Bare form — col-range and row-range both auto-detect.
    return { kind: 'block', colStart: 0, colEnd: 0, rowStart: 0, rowEnd: 0 };
  }
  // col-range  e.g. "A:D"
  const colRangeMatch = trimmed.match(/^([A-Z]+):([A-Z]+)$/);
  if (colRangeMatch) {
    const cs = colLettersToNumber(colRangeMatch[1]!);
    const ce = colLettersToNumber(colRangeMatch[2]!);
    if (cs > ce) {
      throw xtlError('xl3/directive/invalid-syntax', `@block col-range "${trimmed}" — start column ${colRangeMatch[1]} must be ≤ end column ${colRangeMatch[2]}`);
    }
    return { kind: 'block', colStart: cs, colEnd: ce, rowStart: 0, rowEnd: 0 };
  }
  // full-rect  e.g. "A2:D7"
  const fullRectMatch = trimmed.match(/^([A-Z]+)(\d+):([A-Z]+)(\d+)$/);
  if (fullRectMatch) {
    const cs = colLettersToNumber(fullRectMatch[1]!);
    const rs = Number(fullRectMatch[2]);
    const ce = colLettersToNumber(fullRectMatch[3]!);
    const re = Number(fullRectMatch[4]);
    if (cs > ce) {
      throw xtlError('xl3/directive/invalid-syntax', `@block range "${trimmed}" — start column must be ≤ end column`);
    }
    if (rs > re) {
      throw xtlError('xl3/directive/invalid-syntax', `@block range "${trimmed}" — start row ${rs} must be ≤ end row ${re}`);
    }
    if (rs < 1) {
      throw xtlError('xl3/directive/invalid-syntax', `@block range "${trimmed}" — row numbers must be ≥ 1`);
    }
    return { kind: 'block', colStart: cs, colEnd: ce, rowStart: rs, rowEnd: re };
  }
  throw xtlError(
    'xl3/directive/invalid-syntax',
    `@block argument "${trimmed}" — expected bare form, col-range (A:D), or full rectangle (A2:D7) per ADR-0067`,
  );
}

function colLettersToNumber(letters: string): number {
  let n = 0;
  for (const ch of letters) {
    n = n * 26 + (ch.charCodeAt(0) - 64);
  }
  return n;
}

function parseGroup(body: string): Directive {
  if (body === '') {
    throw xtlError('xl3/group/missing-key', '@group requires at least one column key');
  }
  // Split on `,` while respecting bracket pairs (keys are always
  // [Col] forms, no nesting). Lightweight split is safe here.
  const parts = body.split(',').map((s) => s.trim()).filter((s) => s.length > 0);
  if (parts.length === 0) {
    throw xtlError('xl3/group/missing-key', '@group requires at least one column key');
  }
  const keys: string[] = [];
  for (const part of parts) {
    const m = part.match(/^\[([^\]\r\n]+)\]$/);
    if (!m) {
      throw xtlError(
        'xl3/directive/invalid-syntax',
        `@group key must be a [Column] reference; got: ${part}`,
      );
    }
    keys.push(m[1]!.trim());
  }
  return { kind: 'group', keys };
}

function parseSource(body: string): Directive | null {
  const name = body.trim();
  if (!SOURCE_NAME_RE.test(name)) return null;
  if (name.startsWith('__')) return null;
  return { kind: 'source', name };
}

const JOIN_RE = /^([A-Za-z0-9_]+)\s+on\s+([A-Za-z0-9_]+)\[([^\]]+)\]\s*=\s*([A-Za-z0-9_]+)\[([^\]]+)\]$/i;

function parseJoin(body: string): Directive | null {
  const m = body.match(JOIN_RE);
  if (!m) return null;
  const joinedSource = m[1]!;
  const lhsSource = m[2]!;
  const lhsKey = m[3]!.trim();
  const rhsSource = m[4]!;
  const rhsKey = m[5]!.trim();
  if (joinedSource.startsWith('__') || lhsSource.startsWith('__') || rhsSource.startsWith('__')) {
    return null;
  }
  // The on-clause must reference both the joined source and the primary.
  // We accept either ordering (`Customers[k] = Renewals[k]` or vice versa).
  // The directive normalizes so `joinedSource` matches the named one in
  // the leading `@join <Name>`.
  let joinedKey: string;
  let primarySource: string;
  let primaryKey: string;
  if (lhsSource === joinedSource) {
    joinedKey = lhsKey;
    primarySource = rhsSource;
    primaryKey = rhsKey;
  } else if (rhsSource === joinedSource) {
    joinedKey = rhsKey;
    primarySource = lhsSource;
    primaryKey = lhsKey;
  } else {
    return null;
  }
  return {
    kind: 'join',
    joinedSource,
    joinedKey,
    primarySource,
    primaryKey,
  };
}

function parseFilter(body: string): Directive | null {
  // Regex to match: [field] [op] [value]
  const filterMatch = body.match(/^\[([^\]\r\n]+)\]\s*(in|!in|[!><=]{1,2})\s*(.+)$/i);
  if (!filterMatch) return null;

  const field = filterMatch[1].trim();
  const op = filterMatch[2].toLowerCase() as FilterOp;
  const rest = filterMatch[3].trim();

  // ADR-0011: `in` / `!in` references the consolidated `__lists__`
  // sheet via structured-ref form: `__lists__[fruits]`.
  if (op === 'in' || op === '!in') {
    const listMatch = rest.match(/^__lists__\[([^\]\r\n]+)\]$/);
    if (!listMatch) return null;
    return { kind: 'filter', field, op, value: '', listRef: listMatch[1]!.trim() };
  }

  // Handle value (quoted or bare)
  const value = parseValue(rest);
  if (value === null) return null;

  return { kind: 'filter', field, op, value };
}

function parseSort(body: string): Directive | null {
  // [field] desc | [field] asc | [field] (default asc)
  const match = body.match(/^\[([^\]\r\n]+)\](?:\s+(asc|desc))?$/i);
  if (!match) return null;

  return {
    kind: 'sort',
    field: match[1].trim(),
    order: (match[2]?.toLowerCase() as 'asc' | 'desc') || 'asc',
  };
}

function parseTop(body: string): Directive | null {
  // ADR-0055: positive_integer grammar — no leading zeros, no
  // negative, no zero. parseInt alone accepts "05", "0", etc.
  if (!/^[1-9][0-9]*$/.test(body.trim())) return null;
  const n = parseInt(body, 10);
  if (isNaN(n) || n <= 0) return null;
  return { kind: 'top', count: n };
}

function parseRepeat(body: string): Directive | null {
  // "right" or "right N" — N MUST be a positive_integer per ADR-0055
  // (no leading zeros).
  const match = body.match(/^right(?:\s+([1-9][0-9]*))?$/i);
  if (!match) return null;
  const colSpan = match[1] ? parseInt(match[1], 10) : 1;
  if (colSpan <= 0) return null;
  return { kind: 'repeat', direction: 'right', colSpan };
}

function parseValue(raw: string): string | number | null {
  if (raw === '') return null;

  // Quoted string
  if (raw.startsWith('"') && raw.endsWith('"')) {
    return raw.slice(1, -1);
  }

  // Number
  const n = Number(raw);
  if (!isNaN(n)) return n;

  // Bare string
  return raw;
}
