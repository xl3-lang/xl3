import type { Directive, FilterOp } from './types.js';

const DIRECTIVE_RE = /^@(filter|sort|top|repeat)\b/i;

export function isDirectiveExpression(expr: string): boolean {
  return DIRECTIVE_RE.test(expr.trim());
}

export function parseDirective(expr: string): Directive | null {
  const trimmed = expr.trim();

  const lower = trimmed.toLowerCase();
  if (lower.startsWith('@filter ')) return parseFilter(trimmed.slice(8).trim());
  if (lower.startsWith('@sort ')) return parseSort(trimmed.slice(6).trim());
  if (lower.startsWith('@top ')) return parseTop(trimmed.slice(5).trim());
  if (lower.startsWith('@repeat ')) return parseRepeat(trimmed.slice(8).trim());

  return null;
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
  const n = parseInt(body, 10);
  if (isNaN(n) || n <= 0) return null;
  return { kind: 'top', count: n };
}

function parseRepeat(body: string): Directive | null {
  // "right" or "right N"
  const match = body.match(/^right(?:\s+(\d+))?$/i);
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
