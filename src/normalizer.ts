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

export function isDataExpression(expr: string): boolean {
  // Bare `[Field]` not preceded by a word char (excludes `__sheet__[key]`).
  if (HAS_BRACKET_FIELD_RE.test(expr)) return true;
  // ADR-0012: `Source[Field]` where Source starts with a letter and
  // is not preceded by a word char. The boundary check excludes
  // matches inside `__sheet__[key]` like `inputs__[` within
  // `__inputs__[month]`.
  if (/(?<!\w)[A-Za-z]\w*\[[^\]\r\n]+\]/.test(expr)) return true;
  return false;
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
    if (isGoKeyword(trimmed)) return `{{ ${trimmed} }}`;

    return `{{ ${normalizeInner(trimmed, columns)} }}`;
  });
}

function normalizeInner(expr: string, columns: Set<string>): string {
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
      const rowsExpr = ref?.source ? `(sourceRows "${ref.source}")` : '.Rows';
      return `${rowsFn[name]} ${rowsExpr} "${ref?.field ?? fieldNameFromOperand(call.args[0])}"`;
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
  const ops: [string, string][] = [
    ['!=', 'ne'], ['>=', 'ge'], ['<=', 'le'],
    ['==', 'eq'], ['>', 'gt'], ['<', 'lt'],
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
  _columns: Set<string>,
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

function normalizeFunctionCall(
  name: string,
  args: string[],
  columns: Set<string>,
): string {
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
