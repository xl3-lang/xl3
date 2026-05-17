import { functions, canonicalString } from './functions.js';
import { xtlError } from './error-codes.js';

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
// ADR-0011: structured-ref to a reserved sheet, e.g. __config__[title].
const RESERVED_REF_RE = /^__([a-z]+)__\[([^\]\r\n]+)\]$/;
// ADR-0012: tagged forms emitted by the normalizer for source refs.
const SOURCE_CELL_RE = /^sourceCell\s+"([^"]+)"\s+"([^"]+)"$/;
const SOURCE_ROWS_RE = /^sourceRows\s+"([^"]+)"$/;

function lookupReservedRef(
  trimmed: string,
  ctx: Record<string, unknown>,
): unknown {
  const m = trimmed.match(RESERVED_REF_RE);
  if (!m) return undefined;
  const ns = `__${m[1]}__`;
  // ADR-0012: `__sources__` is a declaration sheet, not a value
  // dictionary. Source data is reached via `Source[Column]` (which the
  // normalizer rewrites to a tagged sourceCell/sourceRows form), never
  // via `__sources__[Name]`. Reject this form so authors get a clean
  // error instead of leaking the internal source descriptor.
  if (ns === '__sources__') {
    throw xtlError(
      'xl3/sources/not-a-dictionary',
      `__sources__ is a declaration sheet, not a value dictionary; use the source name directly (e.g., ${m[2]!.trim()}[Column])`,
    );
  }
  const key = m[2]!.trim();
  const obj = ctx[ns];
  if (obj && typeof obj === 'object') {
    const value = (obj as Record<string, unknown>)[key];
    return value ?? '';
  }
  return '';
}

// ADR-0012/0014: resolve `sourceCell "Name" "Column"` → current row's
// column from the named source. The named source must be either the
// active source for the surrounding block OR a joined source (per
// ADR-0014). Otherwise this is an error.
function lookupSourceCell(
  trimmed: string,
  ctx: Record<string, unknown>,
): unknown | undefined {
  const m = trimmed.match(SOURCE_CELL_RE);
  if (!m) return undefined;
  const source = m[1]!;
  const column = m[2]!;
  const active = ctx['__activeSource__'];
  if (active === source) {
    assertSourceColumn(ctx, source, column);
    return ctx[column] ?? '';
  }
  const joined = ctx['__joinedRow__'];
  if (joined && typeof joined === 'object') {
    const joinedRow = (joined as Record<string, unknown>)[source];
    if (joinedRow && typeof joinedRow === 'object') {
      assertSourceColumn(ctx, source, column);
      return (joinedRow as Record<string, unknown>)[column] ?? '';
    }
  }
  throw xtlError(
    'xl3/source/row-cross-block',
    `Cannot reference ${source}[${column}] outside an active @source ${source} or @join ${source} block`,
  );
}

// Validate that `column` is a declared header of the named source.
// Falls through silently if source metadata isn't on ctx (e.g., unit
// tests that bypass renderer wiring) — runtime aggregators provide a
// second line of defense via `assertField`.
function assertSourceColumn(
  ctx: Record<string, unknown>,
  source: string,
  column: string,
): void {
  const sources = ctx['__sources__'];
  if (!sources || typeof sources !== 'object') return;
  const src = (sources as Record<string, { headers?: string[] }>)[source];
  if (!src || !Array.isArray(src.headers)) return;
  if (src.headers.includes(column)) return;
  throw xtlError(
    'xl3/source/unknown-column',
    `Column "${column}" of source "${source}" does not exist`,
  );
}

// ADR-0012: resolve `sourceRows "Name"` → array of all rows for that source.
function lookupSourceRows(
  trimmed: string,
  ctx: Record<string, unknown>,
): unknown[] | undefined {
  const m = trimmed.match(SOURCE_ROWS_RE);
  if (!m) return undefined;
  const name = m[1]!;
  const ns = ctx['__sources__'];
  if (ns && typeof ns === 'object') {
    const src = (ns as Record<string, { rows?: unknown[] }>)[name];
    if (src && Array.isArray(src.rows)) return src.rows;
  }
  throw xtlError('xl3/source/undeclared', `Source "${name}" is not declared in __sources__`);
}

export function evalExpression(
  normalized: string,
  ctx: Record<string, unknown>,
): unknown {
  const trimmed = stripOuterParens(normalized.trim());

  const reserved = lookupReservedRef(trimmed, ctx);
  if (reserved !== undefined) return reserved;

  const sourceCell = lookupSourceCell(trimmed, ctx);
  if (sourceCell !== undefined) return sourceCell;

  const sourceRows = lookupSourceRows(trimmed, ctx);
  if (sourceRows !== undefined) return sourceRows;

  const bracketMatch = trimmed.match(/^\[([^\]\r\n]+)\]$/);
  if (bracketMatch) {
    return ctx[bracketMatch[1]!.trim()] ?? '';
  }

  // ROW() — error when called outside a repeat block (no __rownum in ctx).
  if (trimmed === '__ROW__') {
    const r = ctx['__rownum'];
    if (r === undefined) {
      throw xtlError('xl3/cell/row-outside-repeat', 'ROW() called outside a repeat block');
    }
    return r;
  }

  // index . "fieldName"
  const indexMatch = trimmed.match(/^index\s+\.\s+"([^"]+)"$/);
  if (indexMatch) {
    const field = indexMatch[1]!;
    const active = ctx['__activeSource__'];
    if (typeof active === 'string') {
      assertSourceColumn(ctx, active, field);
    }
    return ctx[field] ?? '';
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

  // H2 (review followup): bare `TRUE` / `FALSE` literals (case-insensitive,
  // matching Excel) evaluate as the boolean. Without this, IFS's documented
  // `(..., TRUE, default)` idiom only worked because non-empty-string is
  // truthy — meaning `FOO` would have worked just as well. Match Excel
  // semantics explicitly so the idiom is sound, not accidental.
  if (trimmed === 'TRUE' || trimmed === 'true' || trimmed === 'True') return true;
  if (trimmed === 'FALSE' || trimmed === 'false' || trimmed === 'False') return false;

  if (ctx[trimmed] !== undefined) return ctx[trimmed];

  // ADR-0028: literal-syntax constraints. Catch unary operator forms
  // and malformed literals that would otherwise fall through to bare
  // string return. Without this, `{{ -[X] }}` silently outputs the
  // literal string "-[X]" instead of negating the column value.
  // Number literals with a sign at parse position (e.g., `-5`) are
  // already handled above by parseFloat — only unsupported forms
  // reach here.
  if (/^\+/.test(trimmed) || /^--/.test(trimmed) || /^-\s*[\[(]/.test(trimmed)) {
    throw xtlError(
      'xl3/eval/unsupported-syntax',
      `Unsupported expression: "${trimmed}". Unary operators on column or sub-expressions are not supported in XTL 0.x; use (0 - [col]) for negation.`,
    );
  }

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
  // Single expression: {{ expr }} — must not contain }} inside
  const singleMatch = cellTemplate.match(/^\{\{\s*((?:(?!\}\}).)+)\s*\}\}$/);
  if (singleMatch) {
    return evalExpression(singleMatch[1], ctx);
  }

  // Mixed: text {{ expr }} text {{ expr2 }} ...
  // ADR-0009: each substituted value uses canonical string form for
  // cross-impl-stable rendering of Booleans, numbers, and empty values.
  return cellTemplate.replace(/\{\{\s*(.+?)\s*\}\}/g, (_, expr) => {
    const result = evalExpression(expr.trim(), ctx);
    return canonicalString(result);
  });
}

// Wrap an evalCell call so any xl3-coded error gets the cell location
// appended to its message. This is the diagnostic-UX bridge: runtime
// errors thrown by deep template-eval helpers (which don't know what
// cell triggered them) become "Source X is not declared in __sources__
// (at sheet "Report" cell A5)" in the host's error stream. The error
// code, instance type, and stack are preserved.
export function evalCellAt(
  sheetName: string,
  cellAddress: string,
  cellTemplate: string,
  ctx: Record<string, unknown>,
): unknown {
  try {
    return evalCell(cellTemplate, ctx);
  } catch (e) {
    if (e instanceof Error && / \(at sheet "/.test(e.message)) {
      // Already annotated upstream — don't double-stamp.
      throw e;
    }
    if (e instanceof Error) {
      e.message = `${e.message} (at sheet "${sheetName}" cell ${cellAddress})`;
    }
    throw e;
  }
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

  // ADR-0011: __config__[key] / __inputs__[key] / etc. as a function arg.
  const reserved = lookupReservedRef(arg, ctx);
  if (reserved !== undefined) return reserved;

  // ADR-0012: Source[Column] / sourceRows / sourceCell as function arg.
  const sourceCell = lookupSourceCell(arg, ctx);
  if (sourceCell !== undefined) return sourceCell;

  const sourceRows = lookupSourceRows(arg, ctx);
  if (sourceRows !== undefined) return sourceRows;

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

// Strip a redundant outer pair of parens, repeatedly. The outer pair is
// redundant only when its closing `)` matches the leading `(`, i.e. when
// paren depth returns to zero exactly at the final character. Without
// this, expressions like `(index . "Value")` that arrive paren-wrapped
// from the normalizer never reach the indexMatch branch below.
function stripOuterParens(expr: string): string {
  let s = expr.trim();
  while (s.startsWith('(') && s.endsWith(')')) {
    let depth = 0;
    let outer = true;
    for (let i = 0; i < s.length - 1; i++) {
      const ch = s[i];
      if (ch === '(') depth++;
      else if (ch === ')') {
        depth--;
        if (depth === 0) {
          outer = false;
          break;
        }
      }
    }
    if (!outer) break;
    s = s.slice(1, -1).trim();
  }
  return s;
}

function splitFunctionArgs(expr: string): string[] {
  const args: string[] = [];
  let current = '';
  let inQuote = false;
  let parenDepth = 0;
  let bracketDepth = 0;

  for (let i = 0; i < expr.length; i++) {
    const ch = expr[i];
    if (ch === '"' && parenDepth === 0 && bracketDepth === 0) {
      inQuote = !inQuote;
      current += ch;
    } else if (ch === '(' && !inQuote) {
      parenDepth++;
      current += ch;
    } else if (ch === ')' && !inQuote) {
      parenDepth--;
      current += ch;
    } else if (ch === '[' && !inQuote) {
      bracketDepth++;
      current += ch;
    } else if (ch === ']' && !inQuote) {
      bracketDepth--;
      current += ch;
    } else if (ch === ' ' && !inQuote && parenDepth === 0 && bracketDepth === 0) {
      if (current) { args.push(current); current = ''; }
    } else {
      current += ch;
    }
  }
  if (current) args.push(current);
  return args;
}
