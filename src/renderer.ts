import ExcelJS from 'exceljs';
import type {
  ParsedTemplate,
  Row,
  GroupKey,
  SheetGroup,
  SheetTemplate,
  DataBlock,
  OutputFile,
} from './types.js';
import { normalizeTemplate } from './normalizer.js';
import { evalCell } from './template-eval.js';
import { applyDirectives } from './data-transform.js';
import { canonicalString } from './functions.js';
import type { FileGroup } from './grouper.js';
import type { SourceData } from './reader.js';
import { ExcelJsWorkbookDocument, sanitizeFilename, sanitizeSheetName, type WorkbookDocument } from './excel-document.js';

const VAR_PATTERN = /\{\{.*?\}\}/;

/** Extract string from any ExcelJS cell value (handles richText objects). */
function cellString(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object' && 'richText' in value) {
    return (value as { richText: { text: string }[] }).richText
      .map((r) => r.text)
      .join('');
  }
  return String(value);
}

export class Renderer {
  private parsed: ParsedTemplate;
  private columns: Set<string>;
  private listSheets: Record<string, string[]>;
  private sources: Record<string, SourceData>;

  constructor(parsed: ParsedTemplate, columns: Set<string>, sources: Record<string, SourceData> = {}) {
    this.parsed = parsed;
    this.columns = columns;
    this.listSheets = parsed.listSheets;
    this.sources = sources;
  }

  /** Generate a preview-safe filename for a file group (no full render). */
  previewFilename(fileGroup: FileGroup): string {
    return this.renderFilenameDetail(fileGroup.key, fileGroup).filename;
  }

  /** Generate preview warnings for a file group. */
  previewFilenameWarnings(fileGroup: FileGroup): string[] {
    return this.renderFilenameDetail(fileGroup.key, fileGroup).warnings;
  }

  /** Generate a preview-safe sheet name from sheet templates and a group key. */
  previewSheetName(sheetTemplates: SheetTemplate[], sheetKey: GroupKey): string {
    let sheetName = 'Sheet';
    for (const st of sheetTemplates) {
      if (st.groupKeys.length > 0) {
        sheetName = st.originalName.replace(
          /\{\{\s*(.+?)\s*\}\}/g,
          (_, expr) => sheetKey.values[expr.trim()] || expr,
        );
      } else {
        sheetName = st.originalName;
      }
    }
    return sheetName;
  }

  async renderFile(fileGroup: FileGroup): Promise<OutputFile> {
    const document = await ExcelJsWorkbookDocument.fromTemplate(this.parsed.workbook);
    document.removeAuxiliarySheets();

    const sheetsToDelete: string[] = [];

    for (const st of this.parsed.sheetTemplates) {
      if (st.groupKeys.length === 0) {
        const matchingGroups = findSheetGroups(fileGroup.sheetGroups, st);
        if (matchingGroups.length >= 1) {
          // Skip sheet if filtered data count is 0
          const filteredRows = applyDirectives(matchingGroups[0].rows, st.directives, this.listSheets);
          if (filteredRows.length === 0) {
            document.removeWorksheet(st.originalName);
            continue;
          }
          const sheet = document.getWorksheet(st.originalName);
          if (sheet) {
            this.renderSheet(document, sheet, st, matchingGroups[0], fileGroup.key);
          }
        }
      } else {
        const matchingGroups = findSheetGroups(fileGroup.sheetGroups, st);
        sheetsToDelete.push(st.originalName);

        for (const sg of matchingGroups) {
          // Skip sheet if filtered data count is 0
          const filteredRows = applyDirectives(sg.rows, st.directives, this.listSheets);
          if (filteredRows.length === 0) continue;

          const sheetName = this.renderString(
            st.originalName,
            mergeContexts(fileGroup.key, sg.key),
          );
          const sanitized = sanitizeSheetName(sheetName);

          // Skip if this exact sheet name was already created
          // (can happen when multiple templates share the same group key)
          if (document.hasWorksheet(sanitized)) continue;

          const newSheet = document.cloneWorksheet(st.originalName, sanitized);
          if (!newSheet) continue;

          this.renderSheet(document, newSheet, st, sg, fileGroup.key);
        }
      }
    }

    // Delete template sheets used for dynamic generation
    for (const name of sheetsToDelete) {
      document.removeWorksheet(name);
    }

    const filenameInfo = this.renderFilenameDetail(fileGroup.key, fileGroup);
    const outBuf = await document.writeBuffer();

    return {
      filename: filenameInfo.filename,
      data: outBuf as ArrayBuffer,
      warnings: filenameInfo.warnings,
    };
  }

  private renderSheet(
    document: WorkbookDocument,
    sheet: ExcelJS.Worksheet,
    st: SheetTemplate,
    sg: SheetGroup,
    fileKey: GroupKey,
  ) {
    // 0. Remove directive rows (iterate in reverse to keep indices stable)
    const sortedDirectiveRows = [...st.directiveRows].sort((a, b) => b - a);
    for (const rowNum of sortedDirectiveRows) {
      document.spliceRowsPreservingMerges(sheet, rowNum, 1);
    }

    // Adjust row positions after directive row removal
    const adjustRow = (row: number) => {
      if (row === 0) return 0;
      const removed = st.directiveRows.filter((r) => r < row).length;
      return row - removed;
    };

    // Check for horizontal blocks
    const hasRightBlocks = st.blocks.some((b) => b.direction === 'right');

    if (hasRightBlocks) {
      // Block-based rendering
      const adjustedBlocks = st.blocks.map((b) => ({
        ...b,
        startRow: adjustRow(b.startRow),
        endRow: adjustRow(b.endRow),
        directiveRows: [],
      }));

      // Apply directives per block and render
      let rowShift = 0; // accumulated row shift from 'down' blocks inserting rows

      for (const block of adjustedBlocks) {
        const blockDirectives = block.directives.filter(
          (d) => d.kind !== 'repeat' && d.kind !== 'source' && d.kind !== 'join',
        );
        // ADR-0012: a block scoped to a non-default source iterates that
        // source's full row set rather than the file/sheet group rows.
        const blockRows = block.source === 'default'
          ? sg.rows
          : (this.sources[block.source]?.rows ?? []);
        const directiveFiltered = applyDirectives(blockRows, blockDirectives, this.listSheets);
        // ADR-0014: apply inner join — keep only primary rows with a
        // matching joined row, and stash the paired row for ctx assembly.
        const filteredRows = this.applyJoin(directiveFiltered, block);
        const staticCtx = this.buildStaticContext(fileKey, { ...sg, rows: filteredRows }, block.source);

        if (block.direction === 'right') {
          this.renderDataCols(sheet, block, filteredRows, staticCtx, rowShift);
        } else {
          const shiftedBlock = { ...block, startRow: block.startRow + rowShift, endRow: block.endRow + rowShift };
          if (filteredRows.length === 0) {
            if (shiftedBlock.startRow > 0) {
              document.spliceRowsPreservingMerges(sheet, shiftedBlock.startRow, 1);
              rowShift -= 1;
            }
          } else {
            const asSt: SheetTemplate = {
              ...st,
              dataStartRow: shiftedBlock.startRow,
              dataEndRow: shiftedBlock.endRow,
              directiveRows: [],
            };
            this.renderDataRows(document, sheet, asSt, filteredRows, block.source);
            const templateRowCount = shiftedBlock.endRow - shiftedBlock.startRow + 1;
            rowShift += filteredRows.length - templateRowCount;
          }
        }
      }

      // Render static rows (those not in any block)
      const blockRowSet = new Set<number>();
      for (const b of adjustedBlocks) {
        for (let r = b.startRow; r <= b.endRow; r++) blockRowSet.add(r + (/* no shift for static pass */ 0));
      }
      // Static rendering needs final context
      const allFilteredRows = applyDirectives(sg.rows, st.directives.filter((d) => d.kind !== 'repeat'), this.listSheets);
      const finalStaticCtx = this.buildStaticContext(fileKey, { ...sg, rows: allFilteredRows });
      sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
        // Skip rows that belong to data blocks (approximate — blocks may have shifted)
        let inBlock = false;
        for (const b of adjustedBlocks) {
          if (rowNumber >= b.startRow && rowNumber <= b.endRow) { inBlock = true; break; }
        }
        if (inBlock) return;
        row.eachCell({ includeEmpty: false }, (cell) => {
          const val = cellString(cell.value);
          if (VAR_PATTERN.test(val)) {
            const normalized = normalizeTemplate(val, this.columns);
            cell.value = renderCellValue(normalized, evalCell(normalized, finalStaticCtx), cell.style);
          }
        });
      });
    } else {
      // Legacy: single down-block rendering
      const adjustedStartRow = adjustRow(st.dataStartRow);
      const adjustedEndRow = adjustRow(st.dataEndRow);

      const adjustedSt: SheetTemplate = {
        ...st,
        dataStartRow: adjustedStartRow,
        dataEndRow: adjustedEndRow,
        directiveRows: [],
      };

      // ADR-0012: pick the active source from the (single) down block;
      // legacy templates default to `default`.
      const downBlock = st.blocks.find((b) => b.direction === 'down');
      const activeSource = downBlock?.source ?? 'default';
      const blockRows = activeSource === 'default' ? sg.rows : (this.sources[activeSource]?.rows ?? []);
      const directiveFiltered = applyDirectives(blockRows, st.directives, this.listSheets);
      // ADR-0014: apply inner join when the block has one.
      const filteredRows = this.applyJoin(directiveFiltered, downBlock);
      const staticCtx = this.buildStaticContext(fileKey, { ...sg, rows: filteredRows }, activeSource);

      // Render static rows
      sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
        if (adjustedSt.dataStartRow > 0 && rowNumber >= adjustedSt.dataStartRow && rowNumber <= adjustedSt.dataEndRow) {
          return;
        }
        row.eachCell({ includeEmpty: false }, (cell) => {
          const val = cellString(cell.value);
          if (VAR_PATTERN.test(val)) {
            const normalized = normalizeTemplate(val, this.columns);
            cell.value = renderCellValue(normalized, evalCell(normalized, staticCtx), cell.style);
          }
        });
      });

      // Render data rows
      if (adjustedSt.dataStartRow === 0 || filteredRows.length === 0) {
        if (adjustedSt.dataStartRow > 0) {
          document.spliceRowsPreservingMerges(sheet, adjustedSt.dataStartRow, 1);
        }
        return;
      }

      this.renderDataRows(document, sheet, adjustedSt, filteredRows, activeSource);
    }
  }

  private renderDataRows(
    document: WorkbookDocument,
    sheet: ExcelJS.Worksheet,
    st: SheetTemplate,
    dataRows: Row[],
    activeSource = 'default',
  ) {
    const templateRowCount = st.dataEndRow - st.dataStartRow + 1;

    // 1. Read all template rows in the block (including empty styled cells and heights)
    const templateRows: {
      height: number;
      cells: Map<number, { template: string; style: Partial<ExcelJS.Style> }>
    }[] = [];

    for (let i = 0; i < templateRowCount; i++) {
      const row = sheet.getRow(st.dataStartRow + i);
      const cells = new Map<number, { template: string; style: Partial<ExcelJS.Style> }>();

      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        const val = cellString(cell.value);
        const style = cell.style;
        // Only track if it has a value or a non-empty style
        if (val || (style && Object.keys(style).length > 0)) {
          cells.set(colNumber, { template: val, style: style || {} });
        }
      });
      templateRows.push({ height: row.height, cells });
    }

    // 2. Insert rows for data
    const totalTargetRows = dataRows.length * templateRowCount;
    if (totalTargetRows > templateRowCount) {
      const insertCount = totalTargetRows - templateRowCount;
      const insertPoint = st.dataStartRow + templateRowCount;

      document.spliceRowsPreservingMerges(sheet, insertPoint, 0, ...Array(insertCount).fill([]));
    }

    // 3. Render each data record
    const reservedCtx = { ...this.reservedSheetCtx(), __activeSource__: activeSource };
    for (let i = 0; i < dataRows.length; i++) {
      const rowData = { ...reservedCtx, ...dataRows[i], __rownum: i + 1, Rows: dataRows };

      // A data record might span multiple template rows
      for (let j = 0; j < templateRowCount; j++) {
        const targetRowNum = st.dataStartRow + (i * templateRowCount) + j;
        const targetRow = sheet.getRow(targetRowNum);
        const templateRowInfo = templateRows[j];

        // Copy row height
        if (templateRowInfo.height) {
          targetRow.height = templateRowInfo.height;
        }

        for (const [colNumber, { template, style }] of templateRowInfo.cells) {
          const cell = targetRow.getCell(colNumber);

          // Copy style before writing the value so the template's intended
          // number/date/text format can guide type coercion.
          if (style && Object.keys(style).length > 0) {
            cell.style = { ...style };
          }

          if (VAR_PATTERN.test(template)) {
            const normalized = normalizeTemplate(template, this.columns);
            cell.value = renderCellValue(normalized, evalCell(normalized, rowData), style);
          } else if (template) {
            cell.value = template as ExcelJS.CellValue;
          }
        }

        targetRow.commit();
      }
    }
  }

  private renderDataCols(
    sheet: ExcelJS.Worksheet,
    block: DataBlock,
    dataRows: Row[],
    staticCtx: Record<string, unknown>,
    rowShift: number,
  ) {
    const colSpan = block.directives.find((d) => d.kind === 'repeat')?.kind === 'repeat'
      ? (block.directives.find((d) => d.kind === 'repeat') as { colSpan: number }).colSpan
      : 1;
    const startRow = block.startRow + rowShift;
    const endRow = block.endRow + rowShift;
    const tColStart = block.templateColStart;
    const tColEnd = block.templateColEnd;

    if (tColStart === 0 || dataRows.length === 0) return;

    // Read template cells: for each row in block, read the template column range
    const templateData: Map<number, Map<number, { template: string; style: Partial<ExcelJS.Style> }>> = new Map();
    const colWidths: Map<number, number | undefined> = new Map();

    for (let r = startRow; r <= endRow; r++) {
      const row = sheet.getRow(r);
      const rowCells = new Map<number, { template: string; style: Partial<ExcelJS.Style> }>();
      for (let c = tColStart; c <= tColEnd; c++) {
        const cell = row.getCell(c);
        const val = cellString(cell.value);
        rowCells.set(c, { template: val, style: cell.style ? { ...cell.style } : {} });
      }
      templateData.set(r, rowCells);
    }

    // Save template column widths
    for (let c = tColStart; c <= tColEnd; c++) {
      colWidths.set(c, sheet.getColumn(c).width);
    }

    // Render: first data record goes into the template column, rest go to the right
    for (let i = 0; i < dataRows.length; i++) {
      const rowData = dataRows[i];
      const colOffset = i * colSpan;

      for (let r = startRow; r <= endRow; r++) {
        const rowCells = templateData.get(r);
        if (!rowCells) continue;

        for (let c = tColStart; c <= tColEnd; c++) {
          const targetCol = c + colOffset;
          const cell = sheet.getRow(r).getCell(targetCol);
          const tmpl = rowCells.get(c);
          if (!tmpl) continue;

          if (VAR_PATTERN.test(tmpl.template)) {
            const normalized = normalizeTemplate(tmpl.template, this.columns);
            // Use row data for [field], static context for aggregates.
            const ctx = { ...staticCtx, ...rowData };
            cell.value = renderCellValue(normalized, evalCell(normalized, ctx), tmpl.style);
          } else if (tmpl.template) {
            cell.value = tmpl.template as ExcelJS.CellValue;
          }

          if (Object.keys(tmpl.style).length > 0) {
            cell.style = { ...tmpl.style };
          }
        }

        // Copy column widths
        for (let c = tColStart; c <= tColEnd; c++) {
          const w = colWidths.get(c);
          if (w) {
            sheet.getColumn(c + colOffset).width = w;
          }
        }
      }
    }
  }

  // ADR-0011: reserved-sheet contents live under namespaced keys in
  // ctx so cell expressions can resolve `{{ __config__[key] }}` etc.
  // ADR-0012: __sources__ exposes named source row sets so cross-source
  // aggregates like `SUM(Customers[Amount])` can resolve at eval time.
  private reservedSheetCtx(): Record<string, unknown> {
    return {
      __config__: this.parsed.configVars,
      __inputs__: this.parsed.resolvedInputs ?? {},
      __lists__: this.parsed.listSheets,
      __sources__: this.sources,
    };
  }

  // ADR-0014: filter primary rows to only those with a matching joined
  // row (inner semantics). Each surviving primary row carries its
  // matched joined row in `__joinedRow__` for the renderer to expose
  // through ctx at row eval time.
  private applyJoin(rows: Row[], block: DataBlock | undefined): Row[] {
    const join = block?.join;
    if (!join) return rows;
    const joinedRows = this.sources[join.joinedSource]?.rows ?? [];
    // Build an index by the joined-source key for O(1) match lookup.
    const index = new Map<string, Row>();
    for (const r of joinedRows) {
      const v = r[join.joinedKey];
      if (v === null || v === undefined) continue;
      const key = canonicalString(v);
      if (!index.has(key)) index.set(key, r);
    }
    const matched: Row[] = [];
    for (const primary of rows) {
      const v = primary[join.primaryKey];
      if (v === null || v === undefined) continue;
      const key = canonicalString(v);
      const joined = index.get(key);
      if (!joined) continue; // inner: drop unmatched
      matched.push({
        ...primary,
        __joinedRow__: { [join.joinedSource]: joined },
      });
    }
    return matched;
  }

  private buildStaticContext(
    fileKey: GroupKey,
    sg: SheetGroup,
    activeSource = 'default',
  ): Record<string, unknown> {
    const ctx: Record<string, unknown> = this.reservedSheetCtx();
    // Group keys (overlay)
    for (const [k, v] of Object.entries(fileKey.values)) ctx[k] = v;
    for (const [k, v] of Object.entries(sg.key.values)) ctx[k] = v;
    ctx['Rows'] = sg.rows;
    // ADR-0012: active source for the surrounding data block.
    ctx['__activeSource__'] = activeSource;
    return ctx;
  }

  private renderString(tmpl: string, data: Record<string, string>): string {
    const normalized = normalizeTemplate(tmpl, this.columns);
    const ctx: Record<string, unknown> = { ...this.reservedSheetCtx(), ...data };
    // ADR-0009: stringify with canonical form so Booleans, numbers, and
    // empty values render consistently across call sites.
    return canonicalString(evalCell(normalized, ctx));
  }

  private renderFilenameDetail(key: GroupKey, fileGroup: FileGroup): { filename: string; warnings: string[] } {
    const pattern = this.parsed.meta.output_file_pattern;
    const rendered = this.renderRawFilename(pattern, key, fileGroup);
    // ADR-0002: Output filenames MUST be sanitized.
    return sanitizeFilename(rendered);
  }

  private renderRawFilename(pattern: string, key: GroupKey, fileGroup: FileGroup): string {
    if (!pattern) return 'output.xlsx';
    if (!VAR_PATTERN.test(pattern)) return pattern;

    // If no file group keys exist, use the first source row as filename context.
    const data: Record<string, string> = { ...key.values };
    if (Object.keys(data).length === 0) {
      const firstRow = fileGroup.sheetGroups[0]?.rows[0];
      if (firstRow) {
        for (const [k, v] of Object.entries(firstRow)) {
          // ADR-0009: filename-pattern context uses canonical string form.
          data[k] = canonicalString(v);
        }
      }
    }

    return this.renderString(pattern, data);
  }
}

function mergeContexts(a: GroupKey, b: GroupKey): Record<string, string> {
  return { ...a.values, ...b.values };
}

function findSheetGroups(groups: SheetGroup[], st: SheetTemplate): SheetGroup[] {
  if (st.groupKeys.length === 0) {
    return groups.filter((g) => Object.keys(g.key.values).length === 0);
  }
  return groups.filter((g) => {
    if (Object.keys(g.key.values).length === 0) return false;
    return st.groupKeys.every((k) => k in g.key.values);
  });
}

function renderCellValue(
  normalizedTemplate: string,
  value: unknown,
  style: Partial<ExcelJS.Style> | undefined,
): ExcelJS.CellValue {
  const numFmt = typeof style?.numFmt === 'string' ? style.numFmt : undefined;
  const singleExpression = isSingleExpression(normalizedTemplate);

  // ADR-0009: mixed-text cells and `@` text-format single-expression
  // cells stringify via canonical form (Booleans uppercase, etc.).
  if (!singleExpression) return canonicalString(value) as ExcelJS.CellValue;
  if (numFmt === '@') return canonicalString(value) as ExcelJS.CellValue;
  if (numFmt && isDateNumFmt(numFmt)) return coerceDateValue(value, numFmt);
  if (numFmt && isNumericNumFmt(numFmt)) return coerceNumberValue(value, numFmt);
  return preserveValue(value);
}

function isSingleExpression(tmpl: string): boolean {
  return /^\{\{\s*((?:(?!\}\}).)+)\s*\}\}$/.test(tmpl);
}

function preserveValue(v: unknown): ExcelJS.CellValue {
  if (v === null || v === undefined) return '' as ExcelJS.CellValue;
  if (v instanceof Date) return v as ExcelJS.CellValue;
  if (typeof v === 'number') return v as ExcelJS.CellValue;
  if (typeof v === 'boolean') return v as ExcelJS.CellValue;
  return String(v) as ExcelJS.CellValue;
}

function coerceNumberValue(v: unknown, numFmt: string): ExcelJS.CellValue {
  if (v === null || v === undefined || v === '') return '' as ExcelJS.CellValue;
  if (typeof v === 'number') return v as ExcelJS.CellValue;
  if (v instanceof Date) return v as ExcelJS.CellValue;
  if (typeof v === 'boolean') return Number(v) as ExcelJS.CellValue;

  const raw = String(v).trim();
  const parsed = parseNumber(raw);
  if (parsed !== null) return parsed as ExcelJS.CellValue;
  throw new Error(`Value cannot be coerced to a number for cell format "${numFmt}": ${raw}`);
}

function coerceDateValue(v: unknown, numFmt: string): ExcelJS.CellValue {
  if (v === null || v === undefined || v === '') return '' as ExcelJS.CellValue;
  if (v instanceof Date) return v as ExcelJS.CellValue;
  if (typeof v === 'number') return excelSerialToDate(v) as ExcelJS.CellValue;

  const raw = String(v).trim();
  const parsed = parseStrictDate(raw);
  if (parsed) return parsed as ExcelJS.CellValue;
  throw new Error(`Value cannot be coerced to a date for cell format "${numFmt}": ${raw}`);
}

function parseNumber(s: string): number | null {
  const percent = s.endsWith('%');
  const cleaned = s.replace(/,/g, '').replace(/%$/, '').trim();
  if (!/^-?\d+(\.\d+)?$/.test(cleaned)) return null;
  const n = Number(cleaned);
  return percent ? n / 100 : n;
}

function parseStrictDate(s: string): Date | null {
  const compact = s.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (compact) return buildDate(compact[1]!, compact[2]!, compact[3]!);

  const dateTime = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
  if (!dateTime) return null;
  return buildDate(
    dateTime[1]!,
    dateTime[2]!,
    dateTime[3]!,
    dateTime[4] ?? '0',
    dateTime[5] ?? '0',
    dateTime[6] ?? '0',
  );
}

function buildDate(
  year: string,
  month: string,
  day: string,
  hour = '0',
  minute = '0',
  second = '0',
): Date | null {
  const y = Number(year);
  const m = Number(month);
  const d = Number(day);
  const h = Number(hour);
  const min = Number(minute);
  const sec = Number(second);
  const out = new Date(y, m - 1, d, h, min, sec);
  if (
    out.getFullYear() !== y ||
    out.getMonth() !== m - 1 ||
    out.getDate() !== d ||
    out.getHours() !== h ||
    out.getMinutes() !== min ||
    out.getSeconds() !== sec
  ) {
    return null;
  }
  return out;
}

function excelSerialToDate(serial: number): Date {
  const utcDays = Math.floor(serial - 25569);
  const utcValue = utcDays * 86400000;
  const dateInfo = new Date(utcValue);
  const fractionalDay = serial - Math.floor(serial) + 0.0000001;
  const totalSeconds = Math.floor(86400 * fractionalDay);
  const seconds = totalSeconds % 60;
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor(totalSeconds / 60) % 60;
  return new Date(
    dateInfo.getUTCFullYear(),
    dateInfo.getUTCMonth(),
    dateInfo.getUTCDate(),
    hours,
    minutes,
    seconds,
  );
}

function isDateNumFmt(numFmt: string | undefined): boolean {
  if (!numFmt) return false;
  const cleaned = stripQuotedNumFmt(numFmt).toLowerCase();
  if (cleaned === 'general' || cleaned === '@') return false;
  return /(^|[^a-z])[ymdhsa]+([^a-z]|$)/.test(cleaned) || cleaned.includes('am/pm');
}

function isNumericNumFmt(numFmt: string | undefined): boolean {
  if (!numFmt) return false;
  const cleaned = stripQuotedNumFmt(numFmt).toLowerCase();
  if (cleaned === 'general' || cleaned === '@' || isDateNumFmt(numFmt)) return false;
  return /[0#?]/.test(cleaned);
}

function stripQuotedNumFmt(numFmt: string): string {
  return numFmt
    .replace(/"[^"]*"/g, '')
    .replace(/\\./g, '')
    .replace(/\[[^\]]+\]/g, '');
}
