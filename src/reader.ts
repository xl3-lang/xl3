import ExcelJS from 'exceljs';
import type { Row, SourceSpec } from './types.js';
import { isEmpty } from './functions.js';
import { xtlError } from './error-codes.js';

export interface SourceData {
  sheetName: string;
  headers: string[];
  rows: Row[];
}

export interface SourceReadOptions {
  sourceTable?: string;
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
  const headers = readHeaders(sheet, table);

  const rows: Row[] = [];
  const totalRows = table.bottomRow ?? sheet.rowCount;
  for (let r = table.headerRow + 1; r <= totalRows; r++) {
    const row = sheet.getRow(r);
    const record: Row = {};
    let allEmpty = true;

    for (let c = 0; c < headers.length; c++) {
      const header = headers[c];
      const cell = row.getCell(table.leftCol + c);
      const val = parseCellValue(cell);
      if (!isEmpty(val)) allEmpty = false;
      record[header] = val;
    }

    if (allEmpty) continue;
    rows.push(record);
  }

  return { sheetName: sheet.name, headers, rows };
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

function parseSourceTable(
  sheet: ExcelJS.Worksheet,
  value: string,
  keyName: string,
): SourceTable {
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
    throw xtlError('xl3/config/invalid-source-table', `${keyName} has an invalid column range: ${value}`);
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
  row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
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

// ADR-0027: source column names that collide with xl3-internal
// context keys silently shadowed (and were silently shadowed by) the
// internal value at row-eval time. Reject at parse so authors see
// the conflict immediately instead of debugging a `[object Object]`
// cell value later.
const RESERVED_COLUMN_NAMES = new Set([
  'Rows',
  '__rownum',
  '__activeSource__',
  '__joinedRow__',
]);
const DUNDER_NAME_RE = /^__[a-z]+__$/;

function readHeaders(sheet: ExcelJS.Worksheet, table: SourceTable): string[] {
  const row = sheet.getRow(table.headerRow);
  const headers: string[] = [];
  const seen = new Set<string>();

  for (let colNumber = table.leftCol; colNumber <= table.rightCol; colNumber++) {
    const cell = row.getCell(colNumber);
    const header = headerText(cell);
    if (!header) {
      throw xtlError('xl3/source/missing-header', `source_table header cell ${cell.address} is empty`);
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
    headers.push(header);
  }

  return headers;
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
      throw xtlError("xl3/cell/formula-no-cache", `Formula cell ${cell.address} has no cached result`);
    }
    return String(result ?? '').trim();
  }
  if (typeof value === 'object' && isFormulaValue(value)) {
    throw xtlError("xl3/cell/formula-no-cache", `Formula cell ${cell.address} has no cached result`);
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

function resolveSheet(
  workbook: ExcelJS.Workbook,
  pattern: string,
): ExcelJS.Worksheet | undefined {
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
    return (v as { richText: { text: string }[] }).richText
      .map((r) => r.text)
      .join('');
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
      throw xtlError("xl3/cell/formula-no-cache", `Formula cell ${cell.address} has no cached result`);
    }
    // ADR-0017: a formula cached result that is itself an error
    // sentinel reads as empty.
    if (result && typeof result === 'object' && 'error' in result) {
      return '';
    }
    return result;
  }

  if (typeof v === 'object' && isFormulaValue(v)) {
    throw xtlError("xl3/cell/formula-no-cache", `Formula cell ${cell.address} has no cached result`);
  }

  return v;
}

function isFormulaValue(v: object): boolean {
  return 'formula' in v || 'sharedFormula' in v;
}

export function columnSet(headers: string[]): Set<string> {
  return new Set(headers.filter(Boolean));
}
