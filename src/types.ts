import type ExcelJS from 'exceljs';

export interface TemplateMeta {
  name: string;
  description: string;
  source_sheet: string;
  source_table?: string;
  output_file_pattern: string;
  match_pattern: string;
}

// ADR-0010: a runtime input declaration parsed from the `_inputs`
// sheet. Hosts surface these to operators and pass collected values
// back through ConvertOptions.inputs.
export type InputType = 'text' | 'number' | 'date' | 'select';

export interface InputSpec {
  name: string;
  type: InputType;
  required: boolean;
  default?: string;
  label?: string;
  description?: string;
  options?: string[]; // populated when type === 'select'
}

export interface ConvertOptions {
  /** Host-provided values for inputs declared in the template's `_inputs` sheet. */
  inputs?: Record<string, unknown>;
}

// ADR-0012: an external data source declaration parsed from
// `__sources__`. The implicit default source uses the special name
// "default" and is configured via `__config__.source_sheet` and
// `source_table`; it is not represented here.
export interface SourceSpec {
  name: string;
  sheet: string;
  table: string;
  description?: string;
}

/**
 * A parsed template-expression reference inside a single cell.
 * Returned indirectly via {@link analyze} (`ParsedTemplate.variables`).
 *
 * The concrete shape is TypeScript-impl-specific; porters should NOT
 * copy this structure (see PORTERS_GUIDE.md "What you MUST NOT copy
 * from the TS impl"). Tooling that inspects templates can rely on it,
 * but it's not normatively part of the XTL spec.
 */
export interface TemplateVariable {
  expression: string;
  columns: string[];
  location: string;
}

// --- Directive types ---

export type FilterOp = '>' | '<' | '>=' | '<=' | '=' | '!=' | 'in' | '!in';

export interface FilterDirective {
  kind: 'filter';
  field: string;
  op: FilterOp;
  value: string | number;
  listRef?: string;
}

export interface SortDirective {
  kind: 'sort';
  field: string;
  order: 'asc' | 'desc';
}

export interface TopDirective {
  kind: 'top';
  count: number;
}

export interface RepeatDirective {
  kind: 'repeat';
  direction: 'right';
  colSpan: number;
}

// ADR-0012: scopes the surrounding data block to a named source.
export interface SourceDirective {
  kind: 'source';
  name: string;
}

// ADR-0014: pair the primary source's row with one row of the joined
// source whose `joinedKey` column equals the primary's `primaryKey`.
export interface JoinDirective {
  kind: 'join';
  joinedSource: string;
  joinedKey: string;
  primarySource: string;
  primaryKey: string;
}

export type Directive =
  | FilterDirective
  | SortDirective
  | TopDirective
  | RepeatDirective
  | SourceDirective
  | JoinDirective;

// --- Template types ---

export interface DataBlock {
  direction: 'down' | 'right';
  startRow: number;
  endRow: number;
  templateColStart: number;
  templateColEnd: number;
  directives: Directive[];
  directiveRows: number[];
  // ADR-0012: source name this block iterates over. Defaults to
  // "default" (the implicit `__config__.source_sheet`-driven source).
  source: string;
  // ADR-0014: optional single join — pairs each primary row with one
  // matching joined row.
  join?: JoinDirective;
}

/**
 * A single sheet within a parsed template — its directives, group
 * keys, and data blocks. Returned indirectly via {@link analyze}
 * (`ParsedTemplate.sheetTemplates`).
 *
 * TypeScript-impl-specific shape. Porters should NOT copy this
 * structure into their own internal model (see PORTERS_GUIDE.md "What
 * you MUST NOT copy from the TS impl"); use it only to inspect the TS
 * impl's parsed output.
 */
export interface SheetTemplate {
  originalName: string;
  groupKeys: string[];
  dataStartRow: number;
  dataEndRow: number;
  staticRows: Set<number>;
  directives: Directive[];
  directiveRows: number[];
  blocks: DataBlock[];
}

export interface TemplateModel {
  meta: TemplateMeta;
  variables: TemplateVariable[];
  fileGroupKeys: string[];
  sheetTemplates: SheetTemplate[];
  listSheets: Record<string, string[]>;
  configVars: Record<string, string>;
  inputs: InputSpec[];
  // ADR-0011: host-supplied input values resolved against `inputs`.
  // Populated by the convert/preview entry points; absent before
  // resolution.
  resolvedInputs?: Record<string, string>;
  // ADR-0012: external data source declarations from `__sources__`.
  sources: SourceSpec[];
  warnings: XtlWarning[];
}

// Stable warning shape (1.0). Hosts dispatch on `code` for
// programmatic handling and localization; the English `message` is
// the conformance-corpus contract for `expected_warnings` matching.
// `location` is a free-form string ("sheet \"Report\" cell A5",
// "__inputs__ row 3", filename) — present when known, omitted when
// the warning is global.
export type XtlWarningCode =
  | 'xl3w/parser/missing-column'
  | 'xl3w/filename/sanitized';

export interface XtlWarning {
  code: XtlWarningCode;
  message: string;
  location?: string;
}

export interface ParsedTemplate extends TemplateModel {
  workbook: ExcelJS.Workbook;
}

export type Row = Record<string, unknown>;

export interface GroupKey {
  values: Record<string, string>;
}

export interface SheetGroup {
  key: GroupKey;
  rows: Row[];
}

export interface FileGroup {
  key: GroupKey;
  sheetGroups: SheetGroup[];
}

export interface OutputFile {
  filename: string;
  data: ArrayBuffer;
  warnings: XtlWarning[];
}

export interface PreviewSheet {
  name: string;
  rowCount: number;
}

export interface PreviewFile {
  filename: string;
  sheets: PreviewSheet[];
}

// ADR-0012 (preview surfacing): a snapshot of one source's shape for
// the host UI to display.
export interface PreviewSource {
  name: string;
  sheet: string;
  table: string;
  description?: string;
  rowCount: number;
  headers: string[];
}

export interface PreviewResult {
  files: PreviewFile[];
  inputs: InputSpec[];
  sources: PreviewSource[];
  warnings: XtlWarning[];
}
