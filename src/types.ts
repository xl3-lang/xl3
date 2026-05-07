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

export type Directive =
  | FilterDirective
  | SortDirective
  | TopDirective
  | RepeatDirective
  | SourceDirective;

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
}

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
  warnings: string[];
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
  warnings: string[];
}

export interface PreviewSheet {
  name: string;
  rowCount: number;
}

export interface PreviewFile {
  filename: string;
  sheets: PreviewSheet[];
}

export interface PreviewResult {
  files: PreviewFile[];
  inputs: InputSpec[];
  warnings: string[];
}
