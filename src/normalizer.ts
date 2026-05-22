import { xtlError } from './error-codes.js';

const TEMPLATE_BLOCK_RE = /\{\{(.*?)\}\}/g;
// ADR-0011: bracket field detection must not match the structured-ref
// form `__sheet__[key]` or `Source[Column]`. The bracket is a
// source-column reference only when not preceded by a word char.
const BRACKET_FIELD_RE = /(?<!\w)\[([^\]\r\n]+)\]/g;
const HAS_BRACKET_FIELD_RE = /(?<!\w)\[([^\]\r\n]+)\]/;
const BRACKET_OPERAND_RE = /^\[([^\]\r\n]+)\]$/;
// ADR-0012: structured-ref form `Source[Column]`. Captures source
// name and column. Source names start with a letter (so reserved
// `__sheet__[key]` is excluded).
const SOURCE_BRACKET_RE = /^([A-Za-z][A-Za-z0-9_]*)\[([^\]\r\n]+)\]$/;

const GO_KEYWORDS = ['else', 'end', 'define ', 'template ', 'block '];
const EXCEL_AGGREGATE_NAMES = new Set(['SUM', 'AVERAGE', 'AVG', 'MIN', 'MAX']);

// Function names whose top-level call shape always operates over a
// source's full row set, never over the current iterating row. Cells
// whose expression is exactly such a call are static (they do not
// start a data block) even when their args contain `Source[Column]`
// references.
const STATIC_CONTEXT_CALLS = new Set([
  'SUM', 'AVERAGE', 'AVG', 'MIN', 'MAX', 'COUNT', 'XLOOKUP',
]);

export function isDataExpression(expr: string): boolean {
  // ADR-0038: a `@subtotal <agg>` cell is row-set scoped at render
  // time, not per-row. Reject it from the "data expression" classifier
  // so its host row does not become a regular per-row data row.
  if (/^@subtotal\b/i.test(expr.trim())) return false;
  // A "data expression" is one whose value depends on the current
  // iterating row of a data block. Two shapes qualify:
  //
  // 1. A bare `[Field]` reference — always iterates the active source.
  //    The leading non-word boundary excludes `__sheet__[key]` and
  //    `Source[key]` matches.
  if (HAS_BRACKET_FIELD_RE.test(expr)) return true;
  //
  // 2. A `Source[Field]` reference NOT wrapped in a static-context
  //    call (aggregate or XLOOKUP). Inside an `@source Source` block,
  //    `{{ Source[Column] }}` resolves to the current row — that's a
  //    data expression. Inside a header / footer cell that just calls
  //    `SUM(Source[Column])` or `XLOOKUP("k", Source[a], Source[b])`,
  //    the brackets feed a full-row-set call and the cell is static.
  if (!/(?<!\w)[A-Za-z]\w*\[[^\]\r\n]+\]/.test(expr)) return false;
  const call = parseFunctionCall(expr.trim());
  if (call && STATIC_CONTEXT_CALLS.has(call.name.toUpperCase())) return false;
  return true;
}

export function isAggregateExpression(expr: string): boolean {
  const e = expr.trim();
  const fn = parseFunctionCall(e);
  if (fn && (EXCEL_AGGREGATE_NAMES.has(fn.name.toUpperCase()) || fn.name.toUpperCase() === 'COUNT')) {
    return true;
  }
  return false;
}

function isGoKeyword(s: string): boolean {
  const t = s.trim();
  return GO_KEYWORDS.some((kw) => t === kw.trim() || t.startsWith(kw));
}

/** Normalize a full template string (may contain multiple {{ }} blocks). */
export function normalizeTemplate(
  tmpl: string,
  columns: Set<string>,
): string {
  return tmpl.replace(TEMPLATE_BLOCK_RE, (_, inner: string) => {
    const trimmed = inner.trim();
    // ADR-0021: an empty template block (`{{ }}` or whitespace-only
    // between the delimiters) is a parse error. Without this guard
    // downstream eval would crash on splitFunctionArgs("") + getFunction(undefined).
    if (trimmed === '') {
      throw xtlError('xl3/parser/empty-block', 'Empty template block: {{ ... }} must contain an expression');
    }
    // ADR-0051: an expression body whose `"` count is odd usually
    // means the author embedded `}}` inside a string literal — the
    // outer scanner closed at the inner `}}` and orphaned the
    // trailing `"`. Raise loudly instead of silently miscompiling.
    if ((trimmed.match(/"/g) ?? []).length % 2 === 1) {
      throw xtlError(
        'xl3/parser/unbalanced-literal',
        `Template block contains an unbalanced string literal; \`}}\` inside \`"..."\` does not close the block. Got: {{ ${trimmed} }}`,
      );
    }
    // ADR-0057: __lists__[name] is a list array and only valid as
    // the RHS of `@filter ... in` / `@filter ... !in`. Any other
    // shape (cell expression, function arg, non-filter directive)
    // is rejected.
    if (/__lists__\[/.test(trimmed) && !/^@filter\b[\s\S]*\b!?in\b[\s\S]*__lists__\[/i.test(trimmed)) {
      throw xtlError(
        'xl3/lists/invalid-use',
        `__lists__[...] is a list array and may only be used as the RHS of \`@filter ... in\` or \`@filter ... !in\`. Got: {{ ${trimmed} }}`,
      );
    }
    if (isGoKeyword(trimmed)) return `{{ ${trimmed} }}`;

    return `{{ ${normalizeInner(trimmed, columns)} }}`;
  });
}

function normalizeInner(expr: string, columns: Set<string>): string {
  // ADR-0038: `@subtotal <aggregate>` is the same aggregate normalization
  // applied to its inner body. The renderer sets `ctx.Rows` to the
  // current group's row set before evaluating, so the same `sumRows
  // .Rows "Col"` form yields the group-scoped result.
  if (/^@subtotal\s+/i.test(expr)) {
    const inner = expr.replace(/^@subtotal\s+/i, '').trim();
    if (isAggregateExpression(inner)) return normalizeAggregate(inner);
    // The directive-parser layer validates aggregate shape and throws
    // xl3/subtotal/bad-aggregate; reaching here means a shape we
    // can't normalize.
    return inner;
  }
  // Aggregates
  if (isAggregateExpression(expr)) return normalizeAggregate(expr);

  const call = parseFunctionCall(expr);
  if (call) return normalizeFunctionCall(call.name, call.args, columns);

  // String concatenation with &
  if (expr.includes('&')) return normalizeConcatenation(expr, columns);

  // Arithmetic
  const arith = findArithmeticOp(expr);
  if (arith) {
    const fn = OP_FUNCS[arith.op];
    return `${fn} ${normalizeValueArg(arith.left, columns)} ${normalizeValueArg(arith.right, columns)}`;
  }

  // ADR-0012: top-level Source[Column] cell expression.
  const sourced = expr.match(SOURCE_BRACKET_RE);
  if (sourced) return `sourceCell "${sourced[1]}" "${sourced[2].trim()}"`;

  const bracket = expr.match(BRACKET_OPERAND_RE);
  if (bracket) return `index . "${bracket[1].trim()}"`;

  return expr;
}

function normalizeAggregate(expr: string): string {
  const e = expr.trim();
  const call = parseFunctionCall(e);
  if (call) {
    // ADR-0024: arity check before specific dispatch.
    checkArity(call.name, call.args);
    const name = call.name.toUpperCase();
    if (name === 'COUNT' && call.args.length === 0) return 'len .Rows';
    if (name === 'COUNT' && call.args.length === 1) {
      const ref = parseFieldRef(call.args[0]);
      const rowsExpr = ref?.source ? `(sourceRows "${ref.source}")` : '.Rows';
      return `countRows ${rowsExpr} "${ref?.field ?? fieldNameFromOperand(call.args[0])}"`;
    }
    const rowsFn: Record<string, string> = {
      SUM: 'sumRows',
      AVERAGE: 'avgRows',
      AVG: 'avgRows',
      MIN: 'minRows',
      MAX: 'maxRows',
    };
    if (rowsFn[name] && call.args.length === 1) {
      const ref = parseFieldRef(call.args[0]);
      // ADR-0059: SUM/AVERAGE/MIN/MAX (and 1-arg COUNT) arguments
      // MUST be column references — `[Column]` or `Source[Column]`.
      // Literals, expressions, and function calls are rejected.
      if (!ref) {
        throw xtlError(
          'xl3/eval/bad-aggregate-arg',
          `${name} requires a column reference as its argument (\`[Column]\` or \`Source[Column]\`); got \`${call.args[0]}\``,
        );
      }
      const rowsExpr = ref.source ? `(sourceRows "${ref.source}")` : '.Rows';
      return `${rowsFn[name]} ${rowsExpr} "${ref.field}"`;
    }
  }
  return e;
}

// ADR-0012: extract (source?, field) from `[Field]` or `Source[Field]`.
function parseFieldRef(arg: string): { source?: string; field: string } | null {
  const a = arg.trim();
  const sourced = a.match(SOURCE_BRACKET_RE);
  if (sourced) return { source: sourced[1], field: sourced[2].trim() };
  const bare = a.match(BRACKET_OPERAND_RE);
  if (bare) return { field: bare[1].trim() };
  return null;
}

// ADR-0013: XLOOKUP(value, Source[lookupCol], Source[returnCol], [fallback])
// is rewritten so the runtime function can do the search.
function normalizeXlookup(args: string[], columns: Set<string>): string {
  const refLookup = parseFieldRef(args[1]);
  const refReturn = parseFieldRef(args[2]);
  if (!refLookup?.source) {
    throw xtlError(
      'xl3/xlookup/bare-bracket',
      `XLOOKUP arg 2 must be a source-prefixed bracket reference like Customers[Account]`,
    );
  }
  if (!refReturn?.source) {
    throw xtlError(
      'xl3/xlookup/bare-bracket',
      `XLOOKUP arg 3 must be a source-prefixed bracket reference like Customers[Name]`,
    );
  }
  if (refLookup.source !== refReturn.source) {
    throw xtlError(
      'xl3/xlookup/source-mismatch',
      `XLOOKUP arg 2 source "${refLookup.source}" and arg 3 source "${refReturn.source}" must match`,
    );
  }
  const lookupValue = normalizeValueArg(args[0], columns);
  const rowsExpr = `(sourceRows "${refLookup.source}")`;
  const head = `xlookupRows ${rowsExpr} ${lookupValue} "${refLookup.field}" "${refReturn.field}"`;
  if (args.length === 4) {
    return `${head} ${normalizeValueArg(args[3], columns)}`;
  }
  return head;
}

function normalizeConcatenation(
  expr: string,
  columns: Set<string>,
): string {
  const parts = expr.split('&').map((p) => p.trim()).filter(Boolean);
  const args = parts.map((p) => {
    const bracket = p.match(BRACKET_OPERAND_RE);
    if (bracket) return `(index . "${bracket[1].trim()}")`;
    if ((p.startsWith('"') && p.endsWith('"')) || (p.startsWith("'") && p.endsWith("'")))
      return p;
    if (columns.has(p)) return `(index . "${p}")`;
    return `"${p}"`;
  });
  return 'concat ' + args.join(' ');
}

const OP_FUNCS: Record<string, string> = {
  '*': 'mul', '/': 'div', '+': 'add', '-': 'sub',
};

function findArithmeticOp(
  expr: string,
): { left: string; op: string; right: string } | null {
  const m = expr.match(/ ([*/+-]) ([([]|[0-9])/);
  if (m && m.index !== undefined) {
    return {
      left: expr.slice(0, m.index).trim(),
      op: m[1],
      right: expr.slice(m.index + m[1].length + 2).trim(),
    };
  }
  return null;
}

function normalizeOperand(op: string, columns: Set<string>): string {
  void columns;
  // ADR-0012: Source[Column] in row context — emits a tagged form so
  // template-eval can verify it matches the active source at runtime.
  const sourced = op.match(SOURCE_BRACKET_RE);
  if (sourced) return `(sourceCell "${sourced[1]}" "${sourced[2].trim()}")`;
  const bracket = op.match(BRACKET_OPERAND_RE);
  if (bracket) return `(index . "${bracket[1].trim()}")`;
  return op;
}

function normalizeCondition(cond: string, columns: Set<string>): string {
  // H1 (review followup): a condition can itself be a function call
  // (e.g., IFS(ISBLANK([X]), ...)) — route through the function-call
  // path first so nested calls get recursively normalized. Without
  // this, the raw token would fall through as a literal and the
  // runtime would treat the non-empty string as truthy.
  const call = parseFunctionCall(cond.trim());
  if (call) return normalizeFunctionCall(call.name, call.args, columns);

  // Order is significant: indexOf picks the first matching op. Compound
  // operators (`!=`, `>=`, `<=`, `==`) MUST appear before any single
  // character that overlaps (`=`, `>`, `<`), so a string like `[a] >= 0`
  // matches `>=` rather than `>` or `=`. The single-char `=` is the
  // spec equality operator (per language.md "Operators"); `==` is kept
  // as an impl-only tolerance so existing TS-impl-flavored templates
  // continue working, but ports MAY accept `=` only.
  const ops: [string, string][] = [
    ['!=', 'ne'], ['>=', 'ge'], ['<=', 'le'],
    ['==', 'eq'], ['>', 'gt'], ['<', 'lt'],
    ['=', 'eq'],
  ];
  for (const [infix, fn] of ops) {
    const idx = cond.indexOf(infix);
    if (idx >= 0) {
      const left = normalizeOperand(cond.slice(0, idx).trim(), columns);
      const right = normalizeOperand(cond.slice(idx + infix.length).trim(), columns);
      return `${fn} ${left} ${right}`;
    }
  }
  return normalizeOperand(cond, columns);
}

/** Extract column names referenced in an expression. */
export function extractColumnRefs(
  expr: string,
): string[] {
  const refs: string[] = [];
  const seen = new Set<string>();

  let m: RegExpExecArray | null;
  const reB = new RegExp(BRACKET_FIELD_RE.source, 'g');
  while ((m = reB.exec(expr)) !== null) {
    const field = m[1].trim();
    if (!seen.has(field)) {
      refs.push(field);
      seen.add(field);
    }
  }

  return refs;
}

// ADR-0024: arity table for user-facing functions. The normalizer
// validates against this table — any known name with wrong arity
// raises `xl3/eval/arity-mismatch` early. Unknown function names
// pass through unchanged so impl-specific extensions still work.
export const FUNCTION_ARITY: Record<string, { min: number; max: number }> = {
  IF: { min: 3, max: 3 },
  IFEMPTY: { min: 2, max: 2 },
  IFBLANK: { min: 2, max: 2 },
  IFERROR: { min: 2, max: 2 },
  IFS: { min: 2, max: Infinity },
  ROUND: { min: 2, max: 2 },
  ABS: { min: 1, max: 1 },
  TEXT: { min: 2, max: 2 },
  ROW: { min: 0, max: 0 },
  TODAY: { min: 0, max: 0 },
  XLOOKUP: { min: 3, max: 4 },
  SUM: { min: 1, max: 1 },
  AVERAGE: { min: 1, max: 1 },
  AVG: { min: 1, max: 1 },
  MIN: { min: 1, max: 1 },
  MAX: { min: 1, max: 1 },
  COUNT: { min: 0, max: 1 },
  CONCAT: { min: 1, max: Infinity },
  // ADR-0019 amendment
  YEAR: { min: 1, max: 1 },
  MONTH: { min: 1, max: 1 },
  DAY: { min: 1, max: 1 },
  EOMONTH: { min: 2, max: 2 },
  EDATE: { min: 2, max: 2 },
  DATEDIF: { min: 3, max: 3 },
  // ADR-0039
  HYPERLINK: { min: 2, max: 2 },
  // ADR-0044
  UPPER: { min: 1, max: 1 },
  LOWER: { min: 1, max: 1 },
  TRIM: { min: 1, max: 1 },
  DATE: { min: 3, max: 3 },
  // ADR-0047
  ISBLANK: { min: 1, max: 1 },
};

function checkArity(name: string, args: string[]): void {
  const upper = name.toUpperCase();
  const arity = FUNCTION_ARITY[upper];
  if (!arity) return; // unknown function — passes through
  if (args.length < arity.min || args.length > arity.max) {
    const expected = arity.min === arity.max
      ? `${arity.min}`
      : arity.max === Infinity
        ? `${arity.min} or more`
        : `${arity.min} or ${arity.max}`;
    throw xtlError(
      'xl3/eval/arity-mismatch',
      `${upper}: expected ${expected} argument${arity.max === 1 ? '' : 's'}, got ${args.length}`,
    );
  }
}

function normalizeFunctionCall(
  name: string,
  args: string[],
  columns: Set<string>,
): string {
  checkArity(name, args);
  const upper = name.toUpperCase();
  if (upper === 'ROW' && args.length === 0) {
    return '__ROW__';
  }
  if (upper === 'TODAY' && args.length === 0) {
    return 'TODAY';
  }
  if (upper === 'IF' && args.length === 3) {
    return `IF (${normalizeCondition(args[0], columns)}) ${normalizeValueArg(args[1], columns)} ${normalizeValueArg(args[2], columns)}`;
  }
  if (upper === 'XLOOKUP' && (args.length === 3 || args.length === 4)) {
    return normalizeXlookup(args, columns);
  }
  if ((upper === 'IFEMPTY' || upper === 'IFBLANK') && args.length === 2) {
    return `IFEMPTY ${normalizeValueArg(args[0], columns)} ${normalizeValueArg(args[1], columns)}`;
  }
  if (upper === 'ROUND' && args.length === 2) {
    return `ROUND ${normalizeValueArg(args[0], columns)} ${normalizeValueArg(args[1], columns)}`;
  }
  if (upper === 'ABS' && args.length === 1) {
    return `ABS ${normalizeValueArg(args[0], columns)}`;
  }
  if (upper === 'TEXT' && args.length === 2) {
    return `TEXT ${normalizeValueArg(args[0], columns)} ${normalizeValueArg(args[1], columns)}`;
  }
  if (upper === 'CONCAT' && args.length > 0) {
    return `concat ${args.map((a) => normalizeValueArg(a, columns)).join(' ')}`;
  }
  // ADR-0044: IFS odd-indexed args are conditions (need comparison-op
  // normalization); even-indexed are values.
  if (upper === 'IFS' && args.length >= 2 && args.length % 2 === 0) {
    const pairs: string[] = [];
    for (let i = 0; i < args.length; i += 2) {
      pairs.push(`(${normalizeCondition(args[i]!, columns)})`);
      pairs.push(normalizeValueArg(args[i + 1]!, columns));
    }
    return `IFS ${pairs.join(' ')}`;
  }
  return `${name} ${args.map((a) => normalizeValueArg(a, columns)).join(' ')}`;
}

function normalizeValueArg(arg: string, columns: Set<string>): string {
  const a = arg.trim();
  const call = parseFunctionCall(a);
  if (call) return `(${normalizeFunctionCall(call.name, call.args, columns)})`;
  if (a.includes('&')) return `(${normalizeConcatenation(a, columns)})`;
  const arith = findArithmeticOp(a);
  if (arith) {
    const fn = OP_FUNCS[arith.op];
    return `(${fn} ${normalizeOperand(arith.left, columns)} ${normalizeOperand(arith.right, columns)})`;
  }
  return normalizeOperand(a, columns);
}

function fieldNameFromOperand(arg: string): string {
  const a = arg.trim();
  const bracket = a.match(BRACKET_OPERAND_RE);
  if (bracket) return bracket[1].trim();
  return a.replace(/^"|"$/g, '');
}

function parseFunctionCall(expr: string): { name: string; args: string[] } | null {
  const m = expr.match(/^([A-Za-z_][A-Za-z0-9_]*)\((.*)\)$/s);
  if (!m) return null;
  return { name: m[1], args: splitCommaArgs(m[2]) };
}

function splitCommaArgs(s: string): string[] {
  const args: string[] = [];
  let current = '';
  let quote: string | null = null;
  let parenDepth = 0;
  let bracketDepth = 0;

  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if ((ch === '"' || ch === "'") && s[i - 1] !== '\\') {
      quote = quote === ch ? null : quote ?? ch;
      current += ch;
    } else if (!quote && ch === '(') {
      parenDepth++;
      current += ch;
    } else if (!quote && ch === ')') {
      parenDepth--;
      current += ch;
    } else if (!quote && ch === '[') {
      bracketDepth++;
      current += ch;
    } else if (!quote && ch === ']') {
      bracketDepth--;
      current += ch;
    } else if (!quote && ch === ',' && parenDepth === 0 && bracketDepth === 0) {
      args.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  if (current.trim() || s.trim()) args.push(current.trim());
  return args;
}
