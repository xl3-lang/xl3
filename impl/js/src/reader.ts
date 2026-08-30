import ExcelJS from 'exceljs';
import type { Row, SourceSpec, ValidationDiagnostic } from './types.js';
import { isEmpty } from './functions.js';
import { isXtlError, xtlError } from './error-codes.js';

export interface SourceData {
  sheetName: string;
  headers: string[];
  rows: Row[];
}

export interface SourceReadOptions {
  sourceTable?: string;
}

export interface SourceSchema {
  sheetName: string;
  headerRow: number;
  headers: string[];
}

export interface SourceSchemaReadResult {
  schemas: Map<string, SourceSchema>;
  diagnostics: ValidationDiagnostic[];
}

export interface SourceSchemaReadOptions {
  /** Parse every selected data cell and collect row-level source errors. */
  scanRows?: boolean;
}

export async function readSource(
  buffer: ArrayBuffer,
  sheetPattern: string,
  options: SourceReadOptions = {},
): Promise<SourceData> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  return readSourceFromWorkbook(workbook, sheetPattern, options);
}

// ADR-0012: read all named sources declared in `__sources__`, plus the
// default source from `__config__`. Returns a record keyed by source
// name; the default source uses the special name "default".
export async function readAllSources(
  buffer: ArrayBuffer,
  defaultSheetPattern: string,
  defaultOptions: SourceReadOptions,
  sources: SourceSpec[],
): Promise<Record<string, SourceData>> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);

  const out: Record<string, SourceData> = {};
  out['default'] = readSourceFromWorkbook(workbook, defaultSheetPattern, defaultOptions);
  for (const spec of sources) {
    out[spec.name] = readSourceFromWorkbook(workbook, spec.sheet, { sourceTable: spec.table });
  }
  return out;
}

// Validation needs only source schemas, not the full row payload. This mirrors
// `readAllSources` but stops after resolving the source sheet/table headers and
// accumulates source diagnostics instead of throwing on the first header issue.
export async function readAllSourceSchemas(
  buffer: ArrayBuffer,
  defaultSheetPattern: string,
  defaultOptions: SourceReadOptions,
  sources: SourceSpec[],
  validationOptions: SourceSchemaReadOptions = {},
): Promise<SourceSchemaReadResult> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);

  const diagnostics: ValidationDiagnostic[] = [];
  const schemas = new Map<string, SourceSchema>();
  const defaultSchema = readSourceSchemaFromWorkbook(
    workbook,
    'default',
    defaultSheetPattern,
    defaultOptions,
    diagnostics,
    validationOptions.scanRows ?? false,
  );
  if (defaultSchema) schemas.set('default', defaultSchema);

  for (const spec of sources) {
    const schema = readSourceSchemaFromWorkbook(
      workbook,
      spec.name,
      spec.sheet,
      { sourceTable: spec.table },
      diagnostics,
      validationOptions.scanRows ?? false,
    );
    if (schema) schemas.set(spec.name, schema);
  }
  return { schemas, diagnostics };
}

export function sourceTableHeaderRow(sourceTable?: string): number {
  if (!sourceTable) return 1;
  const raw = sourceTable.trim();
  const rowOnly = raw.match(/^\d+$/);
  if (rowOnly) {
    const headerRow = Number(rowOnly[0]);
    assertPositiveRow(headerRow, 'source_table', sourceTable);
    return headerRow;
  }
  const range = raw.match(/^([A-Z]+)(\d+):([A-Z]+)(\d+)?$/i);
  if (!range) {
    throw xtlError(
      'xl3/config/invalid-source-table',
      `source_table must be a row number or a table range such as "1", "A1:D", or "A1:D200": ${sourceTable}`,
    );
  }
  const headerRow = Number(range[2]);
  assertPositiveRow(headerRow, 'source_table', sourceTable);
  return headerRow;
}

function readSourceFromWorkbook(
  workbook: ExcelJS.Workbook,
  sheetPattern: string,
  options: SourceReadOptions,
): SourceData {
  const sheet = resolveSheet(workbook, sheetPattern);
  if (!sheet) {
    throw xtlError(
      'xl3/source/sheet-missing',
      `Source sheet "${sheetPattern}" was not found (available sheets: ${workbook.worksheets.map((s) => s.name).join(', ')})`,
    );
  }

  const table = resolveSourceTable(sheet, options);
  const columns = readHeaders(sheet, table);

  const rows: Row[] = [];
  const totalRows = table.bottomRow ?? sheet.rowCount;
  for (let r = table.headerRow + 1; r <= totalRows; r++) {
    const row = sheet.getRow(r);
    const record: Row = {};
    let allEmpty = true;

    for (const { header, col } of columns) {
      const cell = row.getCell(col);
      const val = parseCellValue(cell);
      if (!isEmpty(val)) allEmpty = false;
      record[header] = val;
    }

    if (allEmpty) continue;
    rows.push(record);
  }

  return { sheetName: sheet.name, headers: columns.map((c) => c.header), rows };
}

function readSourceSchemaFromWorkbook(
  workbook: ExcelJS.Workbook,
  sourceName: string,
  sheetPattern: string,
  options: SourceReadOptions,
  diagnostics: ValidationDiagnostic[],
  scanRows: boolean,
): SourceSchema | undefined {
  const sheet = resolveSheet(workbook, sheetPattern);
  if (!sheet) {
    diagnostics.push({
      code: 'xl3/source/sheet-missing',
      severity: 'error',
      source: sourceName,
      detail: `Source sheet "${sheetPattern}" was not found (available sheets: ${workbook.worksheets.map((s) => s.name).join(', ')})`,
    });
    return undefined;
  }

  const table = resolveSourceTableForSchema(sheet, options, sourceName, diagnostics);
  const headers = table ? readHeadersCollecting(sheet, table, sourceName, diagnostics) : [];
  if (table && scanRows) scanSourceRows(sheet, sourceName, table, headers, diagnostics);
  return {
    sheetName: sheet.name,
    headerRow: table?.headerRow ?? sourceTableHeaderRow(options.sourceTable),
    headers: headers.map((c) => c.header),
  };
}

function scanSourceRows(
  sheet: ExcelJS.Worksheet,
  sourceName: string,
  table: SourceTable,
  columns: HeaderColumn[],
  diagnostics: ValidationDiagnostic[],
): void {
  const totalRows = table.bottomRow ?? sheet.rowCount;
  for (let rowNumber = table.headerRow + 1; rowNumber <= totalRows; rowNumber++) {
    const row = sheet.getRow(rowNumber);
    for (const { header, col } of columns) {
      const cell = row.getCell(col);
      try {
        parseCellValue(cell);
      } catch (error) {
        if (!isXtlError(error)) throw error;
        diagnostics.push({
          code: error.code,
          severity: 'error',
          source: sourceName,
          sheet: sheet.name,
          column: header,
          location: `cell:${sheet.name}!${cell.address}`,
          detail: error.message,
        });
      }
    }
  }
}

interface SourceTable {
  headerRow: number;
  leftCol: number;
  rightCol: number;
  bottomRow?: number;
}

function resolveSourceTable(sheet: ExcelJS.Worksheet, options: SourceReadOptions): SourceTable {
  if (options.sourceTable) return parseSourceTable(sheet, options.sourceTable, 'source_table');
  return inferTableFromHeaderRow(sheet, 1);
}

function resolveSourceTableForSchema(
  sheet: ExcelJS.Worksheet,
  options: SourceReadOptions,
  sourceName: string,
  diagnostics: ValidationDiagnostic[],
): SourceTable | undefined {
  if (!options.sourceTable)
    return inferTableFromHeaderRowCollecting(sheet, 1, sourceName, diagnostics);

  const value = options.sourceTable;
  const raw = value.trim();
  const rowOnly = raw.match(/^\d+$/);
  if (rowOnly) {
    const headerRow = Number(rowOnly[0]);
    assertPositiveRow(headerRow, 'source_table', value);
    return inferTableFromHeaderRowCollecting(sheet, headerRow, sourceName, diagnostics);
  }

  const range = raw.match(/^([A-Z]+)(\d+):([A-Z]+)(\d+)?$/i);
  if (!range) {
    throw xtlError(
      'xl3/config/invalid-source-table',
      `source_table must be a row number or a table range such as "1", "A1:D", or "A1:D200": ${value}`,
    );
  }

  const leftCol = decodeColumn(range[1]!);
  const headerRow = Number(range[2]);
  const rightCol = decodeColumn(range[3]!);
  const bottomRow = range[4] ? Number(range[4]) : undefined;
  assertPositiveRow(headerRow, 'source_table', value);
  if (bottomRow !== undefined) assertPositiveRow(bottomRow, 'source_table', value);
  if (leftCol > rightCol) {
    throw xtlError(
      'xl3/config/invalid-source-table',
      `source_table has an invalid column range: ${value}`,
    );
  }
  if (bottomRow !== undefined && bottomRow < headerRow) {
    throw xtlError(
      'xl3/config/invalid-source-table',
      `source_table bottom row cannot be above the first selected row: ${value}`,
    );
  }
  return { headerRow, leftCol, rightCol, bottomRow };
}

function parseSourceTable(sheet: ExcelJS.Worksheet, value: string, keyName: string): SourceTable {
  const raw = value.trim();
  const rowOnly = raw.match(/^\d+$/);
  if (rowOnly) {
    const headerRow = Number(rowOnly[0]);
    assertPositiveRow(headerRow, keyName, value);
    return inferTableFromHeaderRow(sheet, headerRow);
  }

  const range = raw.match(/^([A-Z]+)(\d+):([A-Z]+)(\d+)?$/i);
  if (!range) {
    throw xtlError(
      'xl3/config/invalid-source-table',
      `${keyName} must be a row number or a table range such as "1", "A1:D", or "A1:D200": ${value}`,
    );
  }

  const leftCol = decodeColumn(range[1]!);
  const headerRow = Number(range[2]);
  const rightCol = decodeColumn(range[3]!);
  const bottomRow = range[4] ? Number(range[4]) : undefined;
  assertPositiveRow(headerRow, keyName, value);
  if (bottomRow !== undefined) assertPositiveRow(bottomRow, keyName, value);
  if (leftCol > rightCol) {
    throw xtlError(
      'xl3/config/invalid-source-table',
      `${keyName} has an invalid column range: ${value}`,
    );
  }
  if (bottomRow !== undefined && bottomRow < headerRow) {
    throw xtlError(
      'xl3/config/invalid-source-table',
      `${keyName} bottom row cannot be above the first selected row: ${value}`,
    );
  }
  return { headerRow, leftCol, rightCol, bottomRow };
}

function assertPositiveRow(row: number, keyName: string, value: string): void {
  if (!Number.isInteger(row) || row < 1) {
    throw xtlError(
      'xl3/config/invalid-source-table',
      `${keyName} row numbers must be 1-based positive integers: ${value}`,
    );
  }
}

function inferTableFromHeaderRow(sheet: ExcelJS.Worksheet, headerRow: number): SourceTable {
  const row = sheet.getRow(headerRow);
  const headerCols: number[] = [];
  // ADR-0033: horizontal merge slaves borrow text from the master and are not
  // independent header columns. Skip them so the inferred column window matches
  // the merged-aware column count produced by `readHeaders`.
  row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
    if (isHorizontalMergeSlave(cell)) return;
    if (headerText(cell)) headerCols.push(colNumber);
  });
  if (headerCols.length === 0) {
    throw xtlError('xl3/source/missing-header', `source_table row ${headerRow} has no headers`);
  }
  return {
    headerRow,
    leftCol: Math.min(...headerCols),
    rightCol: Math.max(...headerCols),
  };
}

function inferTableFromHeaderRowCollecting(
  sheet: ExcelJS.Worksheet,
  headerRow: number,
  sourceName: string,
  diagnostics: ValidationDiagnostic[],
): SourceTable | undefined {
  const row = sheet.getRow(headerRow);
  const headerCols: number[] = [];
  let hadHeaderError = false;
  row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
    if (isHorizontalMergeSlave(cell)) return;
    const header = headerTextCollecting(cell, sourceName, sheet.name, diagnostics);
    if (header === undefined) {
      hadHeaderError = true;
      return;
    }
    if (header) {
      headerCols.push(colNumber);
    }
  });
  if (headerCols.length === 0) {
    if (!hadHeaderError) {
      diagnostics.push({
        code: 'xl3/source/missing-header',
        severity: 'error',
        source: sourceName,
        sheet: sheet.name,
        detail: `source_table row ${headerRow} has no headers`,
      });
    }
    return undefined;
  }
  return {
    headerRow,
    leftCol: Math.min(...headerCols),
    rightCol: Math.max(...headerCols),
  };
}

// ADR-0027: source column names that collide with xl3-internal
// context keys silently shadowed (and were silently shadowed by) the
// internal value at row-eval time. Reject at parse so authors see
// the conflict immediately instead of debugging a `[object Object]`
// cell value later.
const RESERVED_COLUMN_NAMES = new Set(['Rows', '__rownum', '__activeSource__', '__joinedRow__']);
const DUNDER_NAME_RE = /^__[a-z]+__$/;

// ADR-0033: a horizontally-merged header cell occupies one logical column at
// its master. Slaves in the same row borrow text from the master and are not
// independent columns. Vertical merges keep current behavior — the slave
// reads its master's text, intended for multi-row header bands.
function isHorizontalMergeSlave(cell: ExcelJS.Cell): boolean {
  if (!cell.isMerged) return false;
  // ExcelJS returns `cell` itself for unmerged cells (the master of a "merge"
  // of size 1 is itself). When `isMerged` is true and master !== self, this
  // cell is a slave; we further filter to *horizontal* slaves only.
  const master = cell.master;
  if (master === cell) return false;
  return master.col !== cell.col;
}

interface HeaderColumn {
  header: string;
  col: number;
}

function readHeaders(sheet: ExcelJS.Worksheet, table: SourceTable): HeaderColumn[] {
  const row = sheet.getRow(table.headerRow);
  const columns: HeaderColumn[] = [];
  const seen = new Set<string>();

  for (let colNumber = table.leftCol; colNumber <= table.rightCol; colNumber++) {
    const cell = row.getCell(colNumber);
    if (isHorizontalMergeSlave(cell)) continue;
    const header = headerText(cell);
    if (!header) {
      // We have already filtered horizontal-merge slaves above, so an empty
      // header here means either an unmerged blank cell (the common case) or
      // a merged region whose master itself is blank (a vertical-slave or
      // master with no text).
      if (cell.isMerged) {
        throw xtlError(
          'xl3/source/missing-header',
          `source_table header cell ${cell.address} is in a merged region whose master is empty`,
        );
      }
      throw xtlError(
        'xl3/source/missing-header',
        `source_table header cell ${cell.address} is empty`,
      );
    }
    if (seen.has(header)) {
      throw xtlError('xl3/source/duplicate-name', `source_table has duplicate header "${header}"`);
    }
    if (RESERVED_COLUMN_NAMES.has(header) || DUNDER_NAME_RE.test(header)) {
      throw xtlError(
        'xl3/source/reserved-column-name',
        `source_table column "${header}" uses a reserved internal name; rename it (reserved: Rows, __rownum, __activeSource__, __joinedRow__, anything matching __<lowercase>__)`,
      );
    }
    seen.add(header);
    columns.push({ header, col: colNumber });
  }

  if (columns.length === 0) {
    throw xtlError(
      'xl3/source/missing-header',
      `source_table row ${table.headerRow} resolves to no headers (range may be entirely inside a merged header band)`,
    );
  }

  return columns;
}

function readHeadersCollecting(
  sheet: ExcelJS.Worksheet,
  table: SourceTable,
  sourceName: string,
  diagnostics: ValidationDiagnostic[],
): HeaderColumn[] {
  const row = sheet.getRow(table.headerRow);
  const columns: HeaderColumn[] = [];
  const seen = new Set<string>();

  for (let colNumber = table.leftCol; colNumber <= table.rightCol; colNumber++) {
    const cell = row.getCell(colNumber);
    if (isHorizontalMergeSlave(cell)) continue;
    const header = headerTextCollecting(cell, sourceName, sheet.name, diagnostics);
    if (header === undefined) continue;
    if (!header) {
      const detail = cell.isMerged
        ? `source_table header cell ${cell.address} is in a merged region whose master is empty`
        : `source_table header cell ${cell.address} is empty`;
      diagnostics.push({
        code: 'xl3/source/missing-header',
        severity: 'error',
        source: sourceName,
        sheet: sheet.name,
        detail,
      });
      continue;
    }
    if (seen.has(header)) {
      diagnostics.push({
        code: 'xl3/source/duplicate-name',
        severity: 'error',
        source: sourceName,
        sheet: sheet.name,
        column: header,
        detail: `source_table has duplicate header "${header}"`,
      });
      continue;
    }
    if (RESERVED_COLUMN_NAMES.has(header) || DUNDER_NAME_RE.test(header)) {
      diagnostics.push({
        code: 'xl3/source/reserved-column-name',
        severity: 'error',
        source: sourceName,
        sheet: sheet.name,
        column: header,
        detail: `source_table column "${header}" uses a reserved internal name; rename it (reserved: Rows, __rownum, __activeSource__, __joinedRow__, anything matching __<lowercase>__)`,
      });
    }
    seen.add(header);
    columns.push({ header, col: colNumber });
  }

  if (columns.length === 0) {
    diagnostics.push({
      code: 'xl3/source/missing-header',
      severity: 'error',
      source: sourceName,
      sheet: sheet.name,
      detail: `source_table row ${table.headerRow} resolves to no headers (range may be entirely inside a merged header band)`,
    });
  }

  return columns;
}

function headerTextCollecting(
  cell: ExcelJS.Cell,
  sourceName: string,
  sheetName: string,
  diagnostics: ValidationDiagnostic[],
): string | undefined {
  try {
    return headerText(cell);
  } catch (error) {
    if (!isXtlError(error)) throw error;
    diagnostics.push({
      code: error.code,
      severity: 'error',
      source: sourceName,
      sheet: sheetName,
      detail: error.message,
    });
    return undefined;
  }
}

function headerText(cell: ExcelJS.Cell): string {
  const value = cell.value;
  if (value === null || value === undefined) return '';
  if (typeof value === 'object' && 'richText' in value) {
    return (value as { richText: { text: string }[] }).richText
      .map((r) => r.text)
      .join('')
      .trim();
  }
  if (typeof value === 'object' && 'result' in value) {
    const result = (value as { result: unknown }).result;
    if (result === undefined && isFormulaValue(value)) {
      throw xtlError(
        'xl3/cell/formula-no-cache',
        `Formula cell ${cell.address} has no cached result`,
      );
    }
    return String(result ?? '').trim();
  }
  if (typeof value === 'object' && isFormulaValue(value)) {
    throw xtlError(
      'xl3/cell/formula-no-cache',
      `Formula cell ${cell.address} has no cached result`,
    );
  }
  return String(value).trim();
}

function decodeColumn(ref: string): number {
  let col = 0;
  for (const ch of ref.trim().toUpperCase()) {
    col = col * 26 + (ch.charCodeAt(0) - 64);
  }
  return col;
}

function resolveSheet(workbook: ExcelJS.Workbook, pattern: string): ExcelJS.Worksheet | undefined {
  if (!pattern) return workbook.worksheets[0];

  // Exact match
  const exact = workbook.getWorksheet(pattern);
  if (exact) return exact;

  // Wildcard (trailing *)
  if (pattern.endsWith('*')) {
    const prefix = pattern.slice(0, -1);
    return workbook.worksheets.find((s) => s.name.startsWith(prefix));
  }

  return undefined;
}

function parseCellValue(cell: ExcelJS.Cell): unknown {
  const v = cell.value;
  if (v === null || v === undefined) return '';

  // ExcelJS returns rich text as object
  if (typeof v === 'object' && 'richText' in v) {
    return (v as { richText: { text: string }[] }).richText.map((r) => r.text).join('');
  }

  // ADR-0017: a static error cell (e.g. `=#N/A` typed by the author or
  // a formula evaluation that produced an error) is treated as empty.
  if (typeof v === 'object' && 'error' in v) {
    return '';
  }

  // Formula result
  if (typeof v === 'object' && 'result' in v) {
    const result = (v as { result: unknown }).result;
    if (result === undefined && isFormulaValue(v)) {
      throw xtlError(
        'xl3/cell/formula-no-cache',
        `Formula cell ${cell.address} has no cached result`,
      );
    }
    // ADR-0017: a formula cached result that is itself an error
    // sentinel reads as empty.
    if (result && typeof result === 'object' && 'error' in result) {
      return '';
    }
    return result;
  }

  if (typeof v === 'object' && isFormulaValue(v)) {
    throw xtlError(
      'xl3/cell/formula-no-cache',
      `Formula cell ${cell.address} has no cached result`,
    );
  }

  return v;
}

function isFormulaValue(v: object): boolean {
  return 'formula' in v || 'sharedFormula' in v;
}

export function columnSet(headers: string[]): Set<string> {
  return new Set(headers.filter(Boolean));
}
