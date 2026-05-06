import ExcelJS from 'exceljs';
import type { Row } from './types.js';

export interface SourceData {
  sheetName: string;
  headers: string[];
  rows: Row[];
}

export async function readSource(
  buffer: ArrayBuffer,
  sheetPattern: string,
  headerRow: number,
  sourceRange?: string,
  sourceHeaderRange?: string,
): Promise<SourceData> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);

  const sheet = resolveSheet(workbook, sheetPattern);
  if (!sheet) {
    throw new Error(
      `Source sheet "${sheetPattern}" was not found (available sheets: ${workbook.worksheets.map((s) => s.name).join(', ')})`,
    );
  }

  if (sourceRange && sourceHeaderRange) {
    throw new Error('source_range and source_header_range cannot both be set');
  }

  const range = sourceRange ? parseSourceRange(sourceRange) : undefined;
  const headerRange = sourceHeaderRange ? parseSourceHeaderRange(sourceHeaderRange) : undefined;
  const effectiveHeaderRow = range?.top ?? headerRange?.top ?? headerRow;
  const startCol = range?.left ?? headerRange?.left ?? 1;
  const endCol = range?.right ?? headerRange?.right;

  // Read headers
  const headerRowData = sheet.getRow(effectiveHeaderRow);
  const headers: string[] = [];
  const lastHeaderCol = endCol ?? headerRowData.cellCount;
  for (let colNumber = startCol; colNumber <= lastHeaderCol; colNumber++) {
    headers.push(String(headerRowData.getCell(colNumber).value ?? '').trim());
  }

  // Read data rows
  const rows: Row[] = [];
  const totalRows = range?.bottom ?? sheet.rowCount;

  for (let r = effectiveHeaderRow + 1; r <= totalRows; r++) {
    const row = sheet.getRow(r);
    const record: Row = {};
    let allEmpty = true;

    for (let c = 0; c < headers.length; c++) {
      const header = headers[c];
      if (!header) continue;

      const cell = row.getCell(startCol + c);
      const val = parseCellValue(cell);
      if (val !== '' && val !== null && val !== undefined) allEmpty = false;
      record[header] = val;
    }

    if (allEmpty) continue;
    rows.push(record);
  }

  return {
    sheetName: sheet.name,
    headers: headers.filter(Boolean),
    rows,
  };
}

interface SourceRange {
  top: number;
  left: number;
  bottom: number;
  right: number;
}

function parseSourceRange(range: string): SourceRange {
  const parts = range.trim().split(':');
  if (parts.length !== 2) {
    throw new Error(`source_range must be an Excel range such as "B5:H200": ${range}`);
  }
  const start = decodeCellRef(parts[0]);
  const end = decodeCellRef(parts[1]);
  if (!start || !end || start.row > end.row || start.col > end.col) {
    throw new Error(`source_range is invalid: ${range}`);
  }
  return {
    top: start.row,
    left: start.col,
    bottom: end.row,
    right: end.col,
  };
}

function parseSourceHeaderRange(range: string): SourceRange {
  const parsed = parseSourceRange(range);
  if (parsed.top !== parsed.bottom) {
    throw new Error(`source_header_range must be a single-row Excel range such as "A1:D1": ${range}`);
  }
  return parsed;
}

function decodeCellRef(ref: string): { row: number; col: number } | null {
  const m = ref.trim().toUpperCase().match(/^([A-Z]+)(\d+)$/);
  if (!m) return null;
  let col = 0;
  for (const ch of m[1]!) {
    col = col * 26 + (ch.charCodeAt(0) - 64);
  }
  return { row: Number(m[2]), col };
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

  // Formula result
  if (typeof v === 'object' && 'result' in v) {
    const result = (v as { result: unknown }).result;
    if (result === undefined && isFormulaValue(v)) {
      throw new Error(`Formula cell ${cell.address} has no cached result`);
    }
    return result;
  }

  if (typeof v === 'object' && isFormulaValue(v)) {
    throw new Error(`Formula cell ${cell.address} has no cached result`);
  }

  return v;
}

function isFormulaValue(v: object): boolean {
  return 'formula' in v || 'sharedFormula' in v;
}

export function columnSet(headers: string[]): Set<string> {
  return new Set(headers.filter(Boolean));
}
