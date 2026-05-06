import { functions } from './functions.js';

/**
 * Evaluate a normalized template expression against a data context.
 *
 * Supported patterns:
 *   [fieldName]             → ctx[fieldName]
 *   index . "fieldName"     → ctx[fieldName]
 *   funcName arg1 arg2      → functions[funcName](resolve(arg1), resolve(arg2))
 *   if condition             → conditional (handled at cell level)
 *   len .Rows               → ctx.Rows.length
 */
export function evalExpression(
  normalized: string,
  ctx: Record<string, unknown>,
): unknown {
  const trimmed = normalized.trim();

  const bracketMatch = trimmed.match(/^\[([^\]\r\n]+)\]$/);
  if (bracketMatch) {
    return ctx[bracketMatch[1]!.trim()] ?? '';
  }

  // ROW() — error when called outside a repeat block (no __rownum in ctx).
  if (trimmed === '__ROW__') {
    const r = ctx['__rownum'];
    if (r === undefined) {
      throw new Error('ROW() called outside a repeat block');
    }
    return r;
  }

  // index . "fieldName"
  const indexMatch = trimmed.match(/^index\s+\.\s+"([^"]+)"$/);
  if (indexMatch) {
    return ctx[indexMatch[1]] ?? '';
  }

  // len .Rows
  if (trimmed === 'len .Rows') {
    const rows = ctx['Rows'];
    return Array.isArray(rows) ? rows.length : 0;
  }

  // Function call: funcName arg1 arg2 ...
  const parts = splitFunctionArgs(trimmed);
  const fn = getFunction(parts[0]);
  if (parts.length >= 1 && fn) {
    const args = parts.slice(1).map((arg) => resolveArg(arg, ctx));
    return fn(...args);
  }

  // Bare string or number literal
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    return trimmed.slice(1, -1);
  }
  const num = parseFloat(trimmed);
  if (!isNaN(num) && trimmed === String(num)) return num;

  if (ctx[trimmed] !== undefined) return ctx[trimmed];

  return trimmed;
}

/**
 * Evaluate a full cell value that may contain {{ }} blocks mixed with text.
 * Returns the rendered string (or a single value if the cell is just one expression).
 */
export function evalCell(
  cellTemplate: string,
  ctx: Record<string, unknown>,
): unknown {
  // Check for {{ if ... }}...{{ end }} blocks
  const ifMatch = cellTemplate.match(
    /^\{\{\s*if\s+(.+?)\s*\}\}(.*?)\{\{\s*end\s*\}\}$/s,
  );
  if (ifMatch) {
    const condition = evalExpression(ifMatch[1], ctx);
    if (condition && condition !== 'false' && condition !== '0') {
      // Recursively eval the inner content
      return evalCell(ifMatch[2], ctx);
    }
    return '';
  }

  // Single expression: {{ expr }} — must not contain }} inside
  const singleMatch = cellTemplate.match(/^\{\{\s*((?:(?!\}\}).)+)\s*\}\}$/);
  if (singleMatch) {
    return evalExpression(singleMatch[1], ctx);
  }

  // Mixed: text {{ expr }} text {{ expr2 }} ...
  return cellTemplate.replace(/\{\{\s*(.+?)\s*\}\}/g, (_, expr) => {
    const result = evalExpression(expr.trim(), ctx);
    return String(result ?? '');
  });
}

function resolveArg(arg: string, ctx: Record<string, unknown>): unknown {
  arg = arg.trim();

  // (sub-expression) — evaluate recursively
  if (arg.startsWith('(') && arg.endsWith(')')) {
    return evalExpression(arg.slice(1, -1), ctx);
  }

  if (arg === '.Rows') {
    return ctx['Rows'] ?? [];
  }

  const bracketMatch = arg.match(/^\[([^\]\r\n]+)\]$/);
  if (bracketMatch) {
    return ctx[bracketMatch[1]!.trim()] ?? '';
  }

  // "string literal"
  if (arg.startsWith('"') && arg.endsWith('"')) {
    return arg.slice(1, -1);
  }

  // Number
  const num = parseFloat(arg);
  if (!isNaN(num) && arg === String(num)) return num;

  // ctx key without dot (for group keys passed as strings)
  if (ctx[arg] !== undefined) return ctx[arg];

  return arg;
}

function getFunction(name: string): ((...args: unknown[]) => unknown) | undefined {
  return functions[name] ?? functions[name.toUpperCase()] ?? functions[name.toLowerCase()];
}

function splitFunctionArgs(expr: string): string[] {
  const args: string[] = [];
  let current = '';
  let inQuote = false;
  let parenDepth = 0;

  for (let i = 0; i < expr.length; i++) {
    const ch = expr[i];
    if (ch === '"' && parenDepth === 0) {
      inQuote = !inQuote;
      current += ch;
    } else if (ch === '(' && !inQuote) {
      parenDepth++;
      current += ch;
    } else if (ch === ')' && !inQuote) {
      parenDepth--;
      current += ch;
    } else if (ch === ' ' && !inQuote && parenDepth === 0) {
      if (current) { args.push(current); current = ''; }
    } else {
      current += ch;
    }
  }
  if (current) args.push(current);
  return args;
}
