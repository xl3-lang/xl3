import type ExcelJS from 'exceljs';

export interface TemplateMeta {
  name: string;
  description: string;
  source_sheet: string;
  source_table?: string;
  output_file_pattern: string;
  match_pattern: string;
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

export type Directive = FilterDirective | SortDirective | TopDirective | RepeatDirective;

// --- Template types ---

export interface DataBlock {
  direction: 'down' | 'right';
  startRow: number;
  endRow: number;
  templateColStart: number;
  templateColEnd: number;
  directives: Directive[];
  directiveRows: number[];
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
  warnings: string[];
}
