import type ExcelJS from 'exceljs';
import { isDirectiveExpression } from './directive-parser.js';
import { validateJsonSourceRows } from './json-source.js';
import { normalizeTemplate } from './normalizer.js';
import { parseTemplate } from './parser.js';
import { readAllSourceSchemas, sourceTableHeaderRow, type SourceSchema } from './reader.js';
import type {
  DataBlock,
  InputContract,
  ParsedTemplate,
  SheetTemplate,
  SourceSpec,
  ValidateOptions,
  ValidationDiagnostic,
  ValidationReport,
  Xl3SourceJsonInput,
} from './types.js';

const VAR_PATTERN = /\{\{\s*(.+?)\s*\}\}/g;
const BARE_FIELD_RE = /(?<!\w)\[([^\]\r\n]+)\]/g;
const SOURCE_FIELD_RE = /\b([A-Za-z][A-Za-z0-9_]*)\[([^\]\r\n]+)\]/g;
const SOURCE_CELL_RE = /sourceCell\s+"([^"]+)"\s+"([^"]+)"/g;

const JSON_WIRE_VERSION = 'xl3-source-json/0.1';
const RESERVED_COLUMN_NAMES = new Set(['Rows', '__rownum', '__activeSource__', '__joinedRow__']);
const DUNDER_NAME_RE = /^__[a-z]+__$/;

interface SourceContract {
  name: string;
  sheet: string;
  headerRow: number;
  requiredColumns: string[];
  optionalColumns: string[];
}

interface ContractBuildResult {
  contract: InputContract;
  diagnostics: ValidationDiagnostic[];
}

interface ExpressionContext {
  activeSource: string;
  joinedSource?: string;
  sheetName?: string;
  location?: string;
}

interface JsonSchemaReadResult {
  schemas: Map<string, SourceSchema>;
  diagnostics: ValidationDiagnostic[];
}

interface JsonDecodeResult {
  value?: unknown;
  error?: string;
}

/**
 * Validate that an `.xlsx` source workbook supplies the headers required by a
 * template. This is read-only and does not render output workbooks.
 *
 * @experimental Added by ADR-0078 as an additive validation gate.
 */
export async function validateSource(
  templateBuffer: ArrayBuffer,
  sourceBuffer: ArrayBuffer,
  options?: ValidateOptions,
): Promise<ValidationReport> {
  assertValidateDepth(options);
  const parsed = await parseTemplate(templateBuffer);
  const built = buildInputContract(parsed, 'xlsx');
  const sourceRead = await readAllSourceSchemas(
    sourceBuffer,
    parsed.meta.source_sheet,
    { sourceTable: parsed.meta.source_table },
    parsed.sources,
    { scanRows: options?.depth === 'full' },
  );
  return buildReport(built, sourceRead.schemas, sourceRead.diagnostics);
}

/**
 * Validate that an `xl3-source-json/0.1` payload supplies the headers required
 * by a template. Row values are not scanned for schema-depth validation.
 *
 * @experimental Added by ADR-0078 as an additive validation gate.
 */
export async function validateSourceJson(
  templateBuffer: ArrayBuffer,
  sourceJson: Xl3SourceJsonInput,
  options?: ValidateOptions,
): Promise<ValidationReport> {
  assertValidateDepth(options);
  const parsed = await parseTemplate(templateBuffer);
  const built = buildInputContract(parsed, 'json');
  const sourceRead = readJsonSourceSchemas(sourceJson, parsed.sources, options?.depth === 'full');
  return buildReport(built, sourceRead.schemas, sourceRead.diagnostics);
}

function assertValidateDepth(options?: ValidateOptions): void {
  const depth = options?.depth ?? 'schema';
  if (depth !== 'schema' && depth !== 'full') {
    throw new Error(`validate depth must be "schema" or "full"; got ${String(depth)}`);
  }
}

function buildReport(
  built: ContractBuildResult,
  schemas: Map<string, SourceSchema>,
  schemaDiagnostics: ValidationDiagnostic[],
): ValidationReport {
  const diagnostics = dedupeDiagnostics([
    ...built.diagnostics,
    ...schemaDiagnostics,
    ...compareContractToSchemas(built.contract, schemas),
  ]);
  return {
    ok: diagnostics.every((d) => d.severity !== 'error'),
    contract: built.contract,
    diagnostics,
  };
}

function buildInputContract(
  parsed: ParsedTemplate,
  sourceKind: 'xlsx' | 'json',
): ContractBuildResult {
  const contracts = new Map<string, SourceContract>();
  const requirements = new Map<string, Set<string>>();
  const diagnostics: ValidationDiagnostic[] = [];

  const addSource = (name: string, sheet: string, sourceTable?: string) => {
    contracts.set(name, {
      name,
      sheet: sourceKind === 'json' ? name : sheet,
      headerRow: sourceKind === 'json' ? 1 : sourceTableHeaderRow(sourceTable),
      requiredColumns: [],
      optionalColumns: [],
    });
    requirements.set(name, new Set());
  };

  addSource('default', parsed.meta.source_sheet, parsed.meta.source_table);
  for (const spec of parsed.sources) addSource(spec.name, spec.sheet, spec.table);

  const requireColumn = (source: string, column: string, location?: string) => {
    const trimmed = column.trim();
    if (!trimmed) return;
    if (!contracts.has(source)) {
      diagnostics.push({
        code: 'xl3/source/undeclared',
        severity: 'error',
        source,
        column: trimmed,
        detail: `Source "${source}" is not declared in __sources__`,
        ...(location ? { location } : {}),
      });
      return;
    }
    requirements.get(source)!.add(trimmed);
  };

  const requireMany = (source: string, columns: string[], location?: string) => {
    for (const column of columns) requireColumn(source, column, location);
  };

  requireMany('default', parsed.fileGroupKeys);
  for (const expr of extractVarExpressions(parsed.meta.output_file_pattern)) {
    collectExpressionRequirements(
      expr,
      {
        activeSource: 'default',
        location: 'filename',
      },
      requireColumn,
      diagnostics,
    );
  }

  for (const st of parsed.sheetTemplates) {
    requireMany('default', st.groupKeys, `sheet:${st.originalName}`);
    for (const block of st.blocks) collectBlockDirectiveRequirements(block, requireColumn);
    collectWorksheetExpressionRequirements(parsed, st, requireColumn, diagnostics);
  }

  const sources = [...contracts.values()].map((contract) => ({
    ...contract,
    requiredColumns: [...(requirements.get(contract.name) ?? [])],
  }));

  return { contract: { sources }, diagnostics };
}

function collectBlockDirectiveRequirements(
  block: DataBlock,
  requireColumn: (source: string, column: string, location?: string) => void,
): void {
  for (const directive of block.directives) {
    switch (directive.kind) {
      case 'filter':
        requireColumn(block.source, directive.field);
        break;
      case 'sort':
        requireColumn(block.source, directive.field);
        break;
      case 'group':
        for (const key of directive.keys) requireColumn(block.source, key);
        break;
      case 'join':
        requireColumn(directive.primarySource, directive.primaryKey);
        requireColumn(directive.joinedSource, directive.joinedKey);
        break;
      case 'top':
      case 'repeat':
      case 'source':
      case 'block':
        break;
    }
  }
}

function collectWorksheetExpressionRequirements(
  parsed: ParsedTemplate,
  st: SheetTemplate,
  requireColumn: (source: string, column: string, location?: string) => void,
  diagnostics: ValidationDiagnostic[],
): void {
  const worksheet = parsed.workbook.getWorksheet(st.originalName);
  if (!worksheet) return;
  const staticCtx = staticExpressionContext(st);

  worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
      const exprs = extractVarExpressions(templateCellText(cell.value));
      if (exprs.length === 0) return;

      const block = containingBlock(st, rowNumber, colNumber);
      const ctx = block
        ? {
            activeSource: block.source,
            joinedSource: block.join?.joinedSource,
            sheetName: st.originalName,
            location: `cell:${st.originalName}!${cell.address}`,
          }
        : {
            ...staticCtx,
            sheetName: st.originalName,
            location: `cell:${st.originalName}!${cell.address}`,
          };

      for (const expr of exprs) {
        if (isDirectiveExpression(expr)) continue;
        collectExpressionRequirements(expr, ctx, requireColumn, diagnostics);
      }
    });
  });
}

function staticExpressionContext(st: SheetTemplate): ExpressionContext {
  const usesBlockRenderer = st.blocks.length > 1 || st.blocks.some((b) => b.direction === 'right');
  if (usesBlockRenderer) return { activeSource: 'default' };
  const downBlock = st.blocks.find((b) => b.direction === 'down');
  return {
    activeSource: downBlock?.source ?? 'default',
    joinedSource: downBlock?.join?.joinedSource,
  };
}

function containingBlock(st: SheetTemplate, row: number, col: number): DataBlock | undefined {
  return st.blocks.find(
    (block) =>
      row >= block.startRow &&
      row <= block.endRow &&
      col >= block.templateColStart &&
      col <= block.templateColEnd,
  );
}

function collectExpressionRequirements(
  expr: string,
  ctx: ExpressionContext,
  requireColumn: (source: string, column: string, location?: string) => void,
  diagnostics: ValidationDiagnostic[],
): void {
  const masked = maskStringLiterals(expr);

  for (const match of masked.matchAll(SOURCE_FIELD_RE)) {
    requireColumn(match[1]!, match[2]!.trim(), ctx.location);
  }
  for (const match of masked.matchAll(BARE_FIELD_RE)) {
    requireColumn(ctx.activeSource, match[1]!.trim(), ctx.location);
  }

  const normalized = normalizeTemplate(`{{ ${expr} }}`, new Set());
  for (const match of normalized.matchAll(SOURCE_CELL_RE)) {
    const source = match[1]!;
    const column = match[2]!.trim();
    if (source === ctx.activeSource || source === ctx.joinedSource) continue;
    diagnostics.push({
      code: 'xl3/source/row-cross-block',
      severity: 'error',
      source,
      ...(ctx.sheetName ? { sheet: ctx.sheetName } : {}),
      column,
      detail: `Cannot reference ${source}[${column}] outside an active @source ${source} or @join ${source} block`,
      ...(ctx.location ? { location: ctx.location } : {}),
    });
  }
}

function compareContractToSchemas(
  contract: InputContract,
  schemas: Map<string, SourceSchema>,
): ValidationDiagnostic[] {
  const diagnostics: ValidationDiagnostic[] = [];
  for (const source of contract.sources) {
    const schema = schemas.get(source.name);
    if (!schema) continue;
    const headers = new Set(schema.headers);
    for (const column of source.requiredColumns) {
      if (headers.has(column)) continue;
      diagnostics.push({
        code: 'xl3/source/unknown-column',
        severity: 'error',
        source: source.name,
        sheet: schema.sheetName,
        column,
        detail: `Column "${column}" of source "${source.name}" does not exist`,
      });
    }
  }
  return diagnostics;
}

function readJsonSourceSchemas(
  input: Xl3SourceJsonInput,
  declaredSources: SourceSpec[],
  scanRows: boolean,
): JsonSchemaReadResult {
  const decoded = decodeJsonInput(input);
  if (decoded.error) return invalidJsonResult(decoded.error);
  const parsed = decoded.value;
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return invalidJsonResult('source JSON must be an object with "version" and "sources"');
  }

  const version = own(parsed, 'version');
  const sources = own(parsed, 'sources');
  if (version !== JSON_WIRE_VERSION) {
    return invalidJsonResult(
      `unsupported source JSON version ${describeJsonValue(version)} (expected "${JSON_WIRE_VERSION}")`,
    );
  }
  if (sources === null || typeof sources !== 'object' || Array.isArray(sources)) {
    return invalidJsonResult('source JSON "sources" must be an object keyed by source name');
  }

  const schemas = new Map<string, SourceSchema>();
  const diagnostics: ValidationDiagnostic[] = [];
  const jsonSources = sources as object;
  const declaredNames = new Set(declaredSources.map((s) => s.name));
  const jsonNames = Object.keys(jsonSources);

  if (!Object.prototype.hasOwnProperty.call(jsonSources, 'default')) {
    diagnostics.push({
      code: 'xl3/source/sheet-missing',
      severity: 'error',
      source: 'default',
      detail: 'source JSON must include a "default" source',
    });
  } else {
    const schema = buildJsonSourceSchema(
      'default',
      own(jsonSources, 'default'),
      diagnostics,
      scanRows,
    );
    if (schema) schemas.set('default', schema);
  }

  for (const name of jsonNames) {
    if (name === 'default' || declaredNames.has(name)) continue;
    diagnostics.push({
      code: 'xl3/source/undeclared',
      severity: 'error',
      source: name,
      detail: `source JSON has an undeclared source "${name}"; declare it in the template's __sources__ sheet or remove it`,
    });
  }

  for (const spec of declaredSources) {
    if (!Object.prototype.hasOwnProperty.call(jsonSources, spec.name)) {
      diagnostics.push({
        code: 'xl3/source/sheet-missing',
        severity: 'error',
        source: spec.name,
        detail: `template declares source "${spec.name}" but the source JSON does not provide it`,
      });
      continue;
    }
    const schema = buildJsonSourceSchema(
      spec.name,
      own(jsonSources, spec.name),
      diagnostics,
      scanRows,
    );
    if (schema) schemas.set(spec.name, schema);
  }

  return { schemas, diagnostics };
}

function buildJsonSourceSchema(
  name: string,
  raw: unknown,
  diagnostics: ValidationDiagnostic[],
  scanRows: boolean,
): SourceSchema | undefined {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    pushInvalidJson(
      diagnostics,
      `source "${name}" must be an object with "headers" and "rows"`,
      name,
    );
    return undefined;
  }

  const headers = own(raw, 'headers');
  const rows = own(raw, 'rows');
  if (!Array.isArray(headers)) {
    pushInvalidJson(diagnostics, `source "${name}" "headers" must be a non-empty array`, name);
  }
  if (!Array.isArray(rows)) {
    pushInvalidJson(diagnostics, `source "${name}" "rows" must be an array`, name);
  }
  if (!Array.isArray(headers)) return undefined;

  const normHeaders: string[] = [];
  const seen = new Set<string>();
  if (headers.length === 0) {
    diagnostics.push({
      code: 'xl3/source/missing-header',
      severity: 'error',
      source: name,
      sheet: name,
      detail: `source "${name}" "headers" must be a non-empty array`,
    });
  }

  for (let i = 0; i < headers.length; i++) {
    const h = Object.prototype.hasOwnProperty.call(headers, i) ? headers[i] : undefined;
    if (typeof h !== 'string') {
      pushInvalidJson(
        diagnostics,
        `source "${name}" has a non-string header (${describeJsonValue(h)})`,
        name,
      );
      continue;
    }
    const header = h.trim();
    if (header === '') {
      diagnostics.push({
        code: 'xl3/source/missing-header',
        severity: 'error',
        source: name,
        sheet: name,
        detail: `source "${name}" has an empty header`,
      });
      continue;
    }
    if (seen.has(header)) {
      diagnostics.push({
        code: 'xl3/source/duplicate-name',
        severity: 'error',
        source: name,
        sheet: name,
        column: header,
        detail: `source "${name}" has duplicate header "${header}"`,
      });
      continue;
    }
    if (RESERVED_COLUMN_NAMES.has(header) || DUNDER_NAME_RE.test(header)) {
      diagnostics.push({
        code: 'xl3/source/reserved-column-name',
        severity: 'error',
        source: name,
        sheet: name,
        column: header,
        detail: `source "${name}" header "${header}" uses a reserved internal name; rename it (reserved: Rows, __rownum, __activeSource__, __joinedRow__, anything matching __<lowercase>__)`,
      });
    }
    seen.add(header);
    normHeaders.push(header);
  }

  if (scanRows) diagnostics.push(...validateJsonSourceRows(name, raw, normHeaders));
  return { sheetName: name, headerRow: 1, headers: normHeaders };
}

function decodeJsonInput(input: Xl3SourceJsonInput): JsonDecodeResult {
  if (typeof input === 'string') {
    try {
      return { value: JSON.parse(input) };
    } catch (e) {
      return { error: `source JSON is not valid JSON: ${(e as Error).message}` };
    }
  }
  if (input instanceof ArrayBuffer)
    return decodeJsonInput(new TextDecoder().decode(new Uint8Array(input)));
  if (input instanceof Uint8Array) return decodeJsonInput(new TextDecoder().decode(input));
  if (input !== null && typeof input === 'object') return { value: input };
  return { error: 'source JSON must be a string, ArrayBuffer, Uint8Array, or object' };
}

function invalidJsonResult(detail: string): JsonSchemaReadResult {
  return {
    schemas: new Map(),
    diagnostics: [
      {
        code: 'xl3/source-json/invalid',
        severity: 'error',
        detail,
      },
    ],
  };
}

function pushInvalidJson(
  diagnostics: ValidationDiagnostic[],
  detail: string,
  source?: string,
): void {
  diagnostics.push({
    code: 'xl3/source-json/invalid',
    severity: 'error',
    ...(source ? { source } : {}),
    detail,
  });
}

function own(obj: object, key: string): unknown {
  return Object.prototype.hasOwnProperty.call(obj, key)
    ? (obj as Record<string, unknown>)[key]
    : undefined;
}

function describeJsonValue(v: unknown): string {
  try {
    const s = JSON.stringify(v);
    return s === undefined ? String(v) : s;
  } catch {
    return typeof v;
  }
}

function extractVarExpressions(s: string): string[] {
  const exprs: string[] = [];
  let m: RegExpExecArray | null;
  const re = new RegExp(VAR_PATTERN.source, 'g');
  while ((m = re.exec(s)) !== null) exprs.push(m[1]!.trim());
  return exprs;
}

function templateCellText(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object' && 'richText' in value) {
    return (value as { richText: { text: string }[] }).richText.map((r) => r.text).join('');
  }
  if (typeof value === 'object' && ('formula' in value || 'sharedFormula' in value)) return '';
  return String(value);
}

function maskStringLiterals(expr: string): string {
  return expr.replace(/"[^"]*"/g, '""');
}

function dedupeDiagnostics(diagnostics: ValidationDiagnostic[]): ValidationDiagnostic[] {
  const seen = new Set<string>();
  const out: ValidationDiagnostic[] = [];
  for (const diagnostic of diagnostics) {
    const key = [
      diagnostic.code,
      diagnostic.severity,
      diagnostic.source ?? '',
      diagnostic.sheet ?? '',
      diagnostic.column ?? '',
      diagnostic.location ?? '',
      diagnostic.detail,
    ].join('\0');
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(diagnostic);
  }
  return out;
}
