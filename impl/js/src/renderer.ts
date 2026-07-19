import ExcelJS from 'exceljs';
import type {
  ParsedTemplate,
  Row,
  GroupKey,
  SheetGroup,
  SheetTemplate,
  DataBlock,
  OutputFile,
  XtlWarning,
} from './types.js';
import { normalizeTemplate } from './normalizer.js';
import { evalCell, evalCellAt } from './template-eval.js';
import { applyDirectives } from './data-transform.js';
import { canonicalString, isErrorCellMarker, isHyperlinkMarker } from './functions.js';
import { xtlError } from './error-codes.js';
import type { FileGroup } from './grouper.js';
import { partitionByGroupKeys, planEmissionEvents } from './grouper.js';
import type { SourceData } from './reader.js';
import { ExcelJsWorkbookDocument, sanitizeFilename, sanitizeSheetName, type WorkbookDocument } from './excel-document.js';

const VAR_PATTERN = /\{\{.*?\}\}/;

/** Convert Excel column letters (A, B, …, Z, AA, …) to 1-based column number. */
function letterToCol(letters: string): number {
  let n = 0;
  for (const ch of letters) {
    n = n * 26 + (ch.charCodeAt(0) - 64);
  }
  return n;
}

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

/**
 * Normalize ExcelJS shared-formula cell values to standalone form before
 * cloning across `@repeat` expansion.
 *
 * OOXML shared formulas have ONE owner cell that declares
 * `<f t="shared" ref="A1:B5" si="0">...</f>` and other cells in the range
 * carry only `<f t="shared" si="0"/>` slaves. ExcelJS exposes these as
 * `{ formula, ref, shareType: 'shared' }` (owner) and
 * `{ sharedFormula: '<ownerAddr>' }` (slave).
 *
 * If `renderDataRows` clones a shared-formula OWNER cell to N expanded
 * rows verbatim, the output ends up with N "owners" all claiming the same
 * `ref` — Excel sees this as corrupt OOXML and either drops the cells or
 * surfaces a repair dialog (issue #46 — silent data loss in real templates).
 *
 * Normalization:
 *   - owner `{ formula, ref, shareType: 'shared' }`  →  `{ formula }`
 *   - slave `{ sharedFormula: 'Q4' }`               →  `{ formula: <Q4's formula text> }`
 *   - everything else passes through unchanged.
 *
 * The dropped `ref`/`shareType`/slave-pointer metadata is benign: Excel
 * accepts standalone `<f>` cells just fine. Authors who want one shared-
 * formula spanning the whole expanded range should put the formula in a
 * footer cell below the data block, not inside it.
 */
function unshareFormula(
  value: ExcelJS.CellValue,
  sheet: ExcelJS.Worksheet,
): ExcelJS.CellValue {
  if (value === null || value === undefined || typeof value !== 'object') return value;
  const v = value as unknown as Record<string, unknown>;
  if (v.shareType === 'shared' && typeof v.formula === 'string') {
    return { formula: v.formula } as ExcelJS.CellValue;
  }
  if (typeof v.sharedFormula === 'string') {
    // Resolve to the owner's formula text.
    try {
      const ownerCell = sheet.getCell(v.sharedFormula);
      const ownerValue = ownerCell.value as unknown as Record<string, unknown> | null | undefined;
      if (ownerValue && typeof ownerValue === 'object' && typeof ownerValue.formula === 'string') {
        return { formula: ownerValue.formula } as ExcelJS.CellValue;
      }
    } catch {
      // Fall through — owner lookup failed (corrupt template). Drop the
      // shared pointer; cell becomes empty rather than corrupting output.
    }
    return null;
  }
  return value;
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
  previewFilenameWarnings(fileGroup: FileGroup): XtlWarning[] {
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
      // ADR-0068: multi-block sheets can't be sheet-pruned by applying
      // ALL directives at sheet level — each @block has its own
      // per-block @filter via proximity scoping (ADR-0069), so the
      // sheet-level pipeline is meaningless (would AND every block's
      // filter together, producing 0 rows even when each block has
      // matches). Multi-block sheets always render.
      const isMultiBlockSheet = st.blocks.length > 1;
      if (st.groupKeys.length === 0) {
        const matchingGroups = findSheetGroups(fileGroup.sheetGroups, st);
        if (matchingGroups.length >= 1) {
          // Skip sheet if filtered data count is 0 (single-block path only)
          if (!isMultiBlockSheet) {
            const filteredRows = applyDirectives(matchingGroups[0].rows, st.directives, this.listSheets);
            if (filteredRows.length === 0) {
              document.removeWorksheet(st.originalName);
              continue;
            }
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
          // Skip sheet if filtered data count is 0 (single-block path only)
          if (!isMultiBlockSheet) {
            const filteredRows = applyDirectives(sg.rows, st.directives, this.listSheets);
            if (filteredRows.length === 0) continue;
          }

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
    // 0. Remove directive rows (iterate in reverse to keep indices
    // stable). ADR-0067: with multi-directive rows now possible (e.g.,
    // two `@block` directives side-by-side at row 1), the same row
    // number may appear multiple times in `st.directiveRows`. Dedupe
    // before splicing so each row is removed exactly once.
    const uniqueDirectiveRows = Array.from(new Set(st.directiveRows));
    const sortedDirectiveRows = [...uniqueDirectiveRows].sort((a, b) => b - a);
    for (const rowNum of sortedDirectiveRows) {
      document.spliceRowsPreservingMerges(sheet, rowNum, 1);
    }

    // Adjust row positions after directive row removal
    const adjustRow = (row: number) => {
      if (row === 0) return 0;
      const removed = uniqueDirectiveRows.filter((r) => r < row).length;
      return row - removed;
    };

    // ADR-0067/0068: multi-block path. Route to the per-block renderer
    // when either (a) any block is `@repeat right` horizontal, or
    // (b) the sheet has 2+ blocks (Phase 2 explicit multi-block mode).
    // The legacy single-down-block fast path applies only when there's
    // exactly one block and it's vertical.
    const hasRightBlocks = st.blocks.some((b) => b.direction === 'right');
    const multiBlock = st.blocks.length > 1;

    if (hasRightBlocks || multiBlock) {
      // Block-based rendering
      const adjustedBlocks = st.blocks.map((b) => ({
        ...b,
        startRow: adjustRow(b.startRow),
        endRow: adjustRow(b.endRow),
        directiveRows: [],
      }));

      // Apply directives per block and render.
      // ADR-0066 (column-scoped splice) + ADR-0068 (multi-block):
      // when blocks have disjoint column ranges, expanding block A
      // doesn't shift block B (outside-cell preservation kicks in).
      // We accumulate row-shift only across blocks whose col-range
      // OVERLAPS a previously expanded block — disjoint blocks
      // render at their original adjusted positions.
      type ColRange = { start: number; end: number };
      const expansionShifts: { range: ColRange; delta: number }[] = [];
      const shiftForBlock = (b: typeof adjustedBlocks[number]) => {
        let acc = 0;
        for (const s of expansionShifts) {
          // Overlap: rangeA.end >= rangeB.start AND rangeB.end >= rangeA.start
          if (b.templateColEnd >= s.range.start && s.range.end >= b.templateColStart) {
            acc += s.delta;
          }
        }
        return acc;
      };

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

        const blockShift = shiftForBlock(block);

        if (block.direction === 'right') {
          this.renderDataCols(sheet, block, filteredRows, staticCtx, blockShift);
        } else {
          const shiftedBlock = { ...block, startRow: block.startRow + blockShift, endRow: block.endRow + blockShift };
          if (filteredRows.length === 0) {
            if (shiftedBlock.startRow > 0) {
              document.spliceRowsPreservingMerges(sheet, shiftedBlock.startRow, 1);
              expansionShifts.push({
                range: { start: block.templateColStart, end: block.templateColEnd },
                delta: -1,
              });
            }
          } else {
            const asSt: SheetTemplate = {
              ...st,
              dataStartRow: shiftedBlock.startRow,
              dataEndRow: shiftedBlock.endRow,
              directiveRows: [],
            };
            const before = sheet.actualRowCount;
            this.renderDataRows(document, sheet, asSt, filteredRows, block.source, block);
            const after = sheet.actualRowCount;
            const templateRowCount = shiftedBlock.endRow - shiftedBlock.startRow + 1;
            const groupDir = block.directives.find((d) => d.kind === 'group');
            const delta = groupDir
              ? (after - before) - templateRowCount
              : filteredRows.length - templateRowCount;
            expansionShifts.push({
              range: { start: block.templateColStart, end: block.templateColEnd },
              delta,
            });
          }
        }
      }

      // Render static rows (those not in any block)
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
            cell.value = renderCellValue(normalized, evalCellAt(sheet.name, cell.address, normalized, finalStaticCtx), cell.style);
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
            cell.value = renderCellValue(normalized, evalCellAt(sheet.name, cell.address, normalized, staticCtx), cell.style);
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

      this.renderDataRows(document, sheet, adjustedSt, filteredRows, activeSource, downBlock);
    }
  }

  private renderDataRows(
    document: WorkbookDocument,
    sheet: ExcelJS.Worksheet,
    st: SheetTemplate,
    dataRows: Row[],
    activeSource = 'default',
    block?: DataBlock,
  ) {
    // ADR-0038 dispatch: a block carrying a `@group` directive or
    // any @subtotal rows takes the grouped emission path.
    const groupDir = block?.directives.find((d) => d.kind === 'group');
    const subtotalOffsets = block?.subtotalRowOffsets ?? [];
    if (groupDir && groupDir.kind === 'group') {
      this.renderGroupedDataRows(
        document, sheet, st, dataRows, activeSource,
        groupDir.keys, subtotalOffsets, block,
      );
      return;
    }
    if (subtotalOffsets.length > 0) {
      throw xtlError(
        'xl3/subtotal/outside-group',
        '@subtotal requires an active @group directive',
      );
    }
    const templateRowCount = st.dataEndRow - st.dataStartRow + 1;

    // ADR-0066: column-scoped data block. The block's col-range is
    // [colStart..colEnd] (computed by the parser from `[col]` cell
    // positions). Cells outside this range are *outside cells* and
    // MUST stay at their original row positions across expansion —
    // they are not cloned per record, and they do not shift with the
    // splice's row insertion.
    const colStart = block?.templateColStart ?? 0;
    const colEnd = block?.templateColEnd ?? 0;
    const hasColScope = colStart > 0 && colEnd > 0;
    const isInsideCol = (c: number) =>
      !hasColScope || (c >= colStart && c <= colEnd);

    // 1. Read all template rows in the block (including empty styled cells and heights)
    // ADR-0046: keep `rawValue` alongside the stringified `template` so non-{{
    // template cells (formulas, rich text, dates) can be re-emitted as the
    // original CellValue object rather than the stringified form (which would
    // turn `{ formula: 'B2*2' }` into the literal `"[object Object]"`).
    const templateRows: {
      height: number;
      cells: Map<number, { template: string; rawValue: ExcelJS.CellValue; style: Partial<ExcelJS.Style> }>
    }[] = [];

    for (let i = 0; i < templateRowCount; i++) {
      const row = sheet.getRow(st.dataStartRow + i);
      const cells = new Map<number, { template: string; rawValue: ExcelJS.CellValue; style: Partial<ExcelJS.Style> }>();

      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        // ADR-0066: only capture cells inside the block's col-range.
        // Outside cells are preserved naturally (we don't touch them).
        if (!isInsideCol(colNumber)) return;
        const val = cellString(cell.value);
        const style = cell.style;
        // Only track if it has a value or a non-empty style
        if (val || (style && Object.keys(style).length > 0)) {
          // Issue #46: normalize shared formulas before cloning so each
          // expanded row gets a standalone `{formula}` instead of N
          // duplicate "owners" of the same OOXML shared range.
          const rawValue = unshareFormula(cell.value, sheet);
          cells.set(colNumber, { template: val, rawValue, style: style || {} });
        }
      });
      templateRows.push({ height: row.height, cells });
    }

    // 2. Snapshot outside-block cells from rows AT OR BELOW the block's
    // last template row — these would be shifted by the splice and must
    // be restored at their original row positions afterwards (ADR-0066).
    const totalTargetRows = dataRows.length * templateRowCount;
    const insertCount = Math.max(0, totalTargetRows - templateRowCount);
    const insertPoint = st.dataStartRow + templateRowCount;

    type OutsideCellSnap = {
      row: number;
      col: number;
      value: ExcelJS.CellValue;
      style: Partial<ExcelJS.Style>;
      height?: number;
    };
    const outsideSnapshots: OutsideCellSnap[] = [];

    if (hasColScope && insertCount > 0) {
      // ADR-0066: snapshot outside-block cells so they can be restored
      // to their original row positions after the splice shifts them.
      //
      // Merge-slave handling: if a cell is part of a merged region
      // whose master sits inside the block's col-range, the merge
      // (and the slave's identity) follows the master via
      // `spliceRowsPreservingMerges`. Snapshotting and restoring such
      // slaves would corrupt the merge by putting a stray value at
      // the original row while the merge structure moved with the
      // master. Skip merge-slaves whose master is inside the block.
      const mergeMasterCol = new Map<string, number>(); // 'r,c' → master col
      const merges = (sheet.model.merges ?? []) as string[];
      for (const ref of merges) {
        const m = String(ref).match(/^([A-Z]+)(\d+):([A-Z]+)(\d+)$/);
        if (!m) continue;
        const masterCol = letterToCol(m[1]!);
        const top = Number(m[2]);
        const right = letterToCol(m[3]!);
        const bottom = Number(m[4]);
        for (let r = top; r <= bottom; r++) {
          for (let c = masterCol; c <= right; c++) {
            mergeMasterCol.set(`${r},${c}`, masterCol);
          }
        }
      }
      sheet.eachRow({ includeEmpty: false }, (row, r) => {
        if (r < insertPoint) return;
        row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
          if (isInsideCol(colNumber)) return;
          // Skip merge-slaves whose master is inside the block's
          // col-range — they follow the master via the merge
          // preservation pass.
          const mc = mergeMasterCol.get(`${r},${colNumber}`);
          if (mc !== undefined && mc >= colStart && mc <= colEnd) return;
          outsideSnapshots.push({
            row: r,
            col: colNumber,
            value: cell.value,
            style: cell.style ? { ...cell.style } : {},
            height: row.height,
          });
        });
      });
    }

    // 3. Insert rows for data
    if (insertCount > 0) {
      document.spliceRowsPreservingMerges(sheet, insertPoint, 0, Array(insertCount).fill([]));
    }

    // 4. Render each data record (inside-col cells only; outside cols
    // are intentionally untouched per ADR-0066)
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

        for (const [colNumber, { template, rawValue, style }] of templateRowInfo.cells) {
          const cell = targetRow.getCell(colNumber);

          // Copy style before writing the value so the template's intended
          // number/date/text format can guide type coercion.
          if (style && Object.keys(style).length > 0) {
            cell.style = { ...style };
          }

          if (VAR_PATTERN.test(template)) {
            const normalized = normalizeTemplate(template, this.columns);
            cell.value = renderCellValue(normalized, evalCellAt(sheet.name, cell.address, normalized, rowData), style);
          } else if (template) {
            // ADR-0046: re-emit the ORIGINAL CellValue (preserves
            // `{ formula, result }` shape, rich-text, Date objects) so
            // formula cells inside a `@repeat` block survive cloning.
            cell.value = rawValue;
          }
        }

        targetRow.commit();
      }
    }

    // 5. ADR-0066: restore outside-block cells to their ORIGINAL row
    // positions. The splice shifted them down by `insertCount`; clear
    // the shifted cells and rewrite them at the snapshot's original row.
    if (outsideSnapshots.length > 0) {
      for (const snap of outsideSnapshots) {
        // Clear the shifted position so the cell doesn't appear twice.
        // Style must be wiped along with the value — leaving the moved
        // borders/fills behind renders a style-only ghost copy of the
        // outside block below the expanded data.
        const shifted = sheet.getRow(snap.row + insertCount).getCell(snap.col);
        shifted.value = null;
        shifted.style = {};
        // Restore at the original position
        const orig = sheet.getRow(snap.row).getCell(snap.col);
        orig.value = snap.value;
        if (snap.style && Object.keys(snap.style).length > 0) {
          orig.style = { ...snap.style };
        }
      }
    }
  }

  /**
   * ADR-0038: render a data block with `@group` keys and interleaved
   * `@subtotal` rows. Group order is post-filter / post-sort encounter
   * order (`partitionByGroupKeys`); subtotal rows emit at each group
   * boundary at the level inferred from their source-row order
   * (topmost @subtotal → innermost level → first at every boundary).
   */
  private renderGroupedDataRows(
    document: WorkbookDocument,
    sheet: ExcelJS.Worksheet,
    st: SheetTemplate,
    dataRows: Row[],
    activeSource: string,
    groupKeys: string[],
    subtotalOffsets: number[],
    block?: DataBlock,
  ) {
    const templateRowCount = st.dataEndRow - st.dataStartRow + 1;

    if (subtotalOffsets.length > groupKeys.length) {
      throw xtlError(
        'xl3/subtotal/outside-group',
        `@subtotal at row ${st.dataStartRow + subtotalOffsets[subtotalOffsets.length - 1]!} has no matching @group level`,
      );
    }

    // ADR-0066: column-scoped capture, same rule as renderDataRows.
    const colStart = block?.templateColStart ?? 0;
    const colEnd = block?.templateColEnd ?? 0;
    const hasColScope = colStart > 0 && colEnd > 0;
    const isInsideCol = (c: number) =>
      !hasColScope || (c >= colStart && c <= colEnd);

    // 1. Read template rows (same shape as renderDataRows so subtotal
    //    rows retain their formatting / merges / static text).
    const templateRows: {
      height: number;
      cells: Map<number, { template: string; rawValue: ExcelJS.CellValue; style: Partial<ExcelJS.Style> }>
    }[] = [];
    for (let i = 0; i < templateRowCount; i++) {
      const row = sheet.getRow(st.dataStartRow + i);
      const cells = new Map<number, { template: string; rawValue: ExcelJS.CellValue; style: Partial<ExcelJS.Style> }>();
      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        if (!isInsideCol(colNumber)) return;
        const val = cellString(cell.value);
        const style = cell.style;
        if (val || (style && Object.keys(style).length > 0)) {
          // Issue #46: see unshareFormula docstring above. Same normalization
          // applies to the grouped path so subtotal rows don't duplicate
          // shared-formula owners either.
          const rawValue = unshareFormula(cell.value, sheet);
          cells.set(colNumber, { template: val, rawValue, style: style || {} });
        }
      });
      templateRows.push({ height: row.height, cells });
    }

    // 2. Split template-row indices into data rows vs subtotal rows.
    const subtotalSet = new Set(subtotalOffsets);
    const dataRowOffsets: number[] = [];
    for (let i = 0; i < templateRowCount; i++) {
      if (!subtotalSet.has(i)) dataRowOffsets.push(i);
    }
    if (dataRowOffsets.length === 0) {
      // Degenerate: only subtotal rows in the block. Remove the
      // template rows and stop — there is no per-row content to clone.
      document.spliceRowsPreservingMerges(sheet, st.dataStartRow, templateRowCount);
      return;
    }

    // 3. Partition + plan emission.
    const groupTree = partitionByGroupKeys(dataRows, groupKeys);
    const events = planEmissionEvents(groupTree, groupKeys.length);

    // 4. Compute total output rows so we can size the splice.
    let totalOutputRows = 0;
    for (const ev of events) {
      if (ev.kind === 'data') totalOutputRows += dataRowOffsets.length;
      else if (ev.level - 1 < subtotalOffsets.length) totalOutputRows += 1;
    }

    // Empty source after filter/sort: drop the block entirely.
    if (totalOutputRows === 0) {
      document.spliceRowsPreservingMerges(sheet, st.dataStartRow, templateRowCount);
      return;
    }

    // ADR-0066: snapshot outside-block cells before splice (same as
    // renderDataRows). Outside cells in rows ≥ first-shift-point will be
    // shifted by the splice; we restore them to their original rows.
    type OutsideCellSnap = {
      row: number;
      col: number;
      value: ExcelJS.CellValue;
      style: Partial<ExcelJS.Style>;
    };
    const outsideSnapshots: OutsideCellSnap[] = [];
    const insertDelta = totalOutputRows - templateRowCount; // can be ±

    if (hasColScope && insertDelta !== 0) {
      const firstShiftRow = totalOutputRows > templateRowCount
        ? st.dataStartRow + templateRowCount     // splice insert
        : st.dataStartRow + totalOutputRows;     // splice delete
      // See renderDataRows for why eachRow + row-number gate is used
      // instead of `actualRowCount` (sparse-row coverage).
      sheet.eachRow({ includeEmpty: false }, (row, r) => {
        if (r < firstShiftRow) return;
        row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
          if (isInsideCol(colNumber)) return;
          outsideSnapshots.push({
            row: r,
            col: colNumber,
            value: cell.value,
            style: cell.style ? { ...cell.style } : {},
          });
        });
      });
    }

    // 5. Resize the block.
    if (totalOutputRows > templateRowCount) {
      const insertCount = totalOutputRows - templateRowCount;
      document.spliceRowsPreservingMerges(
        sheet, st.dataStartRow + templateRowCount, 0,
        Array(insertCount).fill([]),
      );
    } else if (totalOutputRows < templateRowCount) {
      const deleteCount = templateRowCount - totalOutputRows;
      document.spliceRowsPreservingMerges(
        sheet, st.dataStartRow + totalOutputRows, deleteCount,
      );
    }

    // 6. Walk events, writing one output Excel row per event.
    const reservedCtx = { ...this.reservedSheetCtx(), __activeSource__: activeSource };
    let outputRowIdx = 0;
    let dataRowIter = 0;

    const writeRow = (
      targetRowNum: number,
      tmpl: typeof templateRows[number],
      ctx: Record<string, unknown>,
    ) => {
      const targetRow = sheet.getRow(targetRowNum);
      if (tmpl.height) targetRow.height = tmpl.height;
      for (const [colNumber, { template, rawValue, style }] of tmpl.cells) {
        const cell = targetRow.getCell(colNumber);
        if (style && Object.keys(style).length > 0) cell.style = { ...style };
        if (VAR_PATTERN.test(template)) {
          const normalized = normalizeTemplate(template, this.columns);
          cell.value = renderCellValue(
            normalized,
            evalCellAt(sheet.name, cell.address, normalized, ctx),
            style,
          );
        } else if (template) {
          cell.value = rawValue;
        }
      }
      targetRow.commit();
    };

    for (const ev of events) {
      if (ev.kind === 'data') {
        for (const tmplOffset of dataRowOffsets) {
          const ctx = {
            ...reservedCtx,
            ...ev.row,
            __rownum: dataRowIter + 1,
            Rows: dataRows,
          };
          writeRow(st.dataStartRow + outputRowIdx, templateRows[tmplOffset]!, ctx);
          outputRowIdx++;
        }
        dataRowIter++;
      } else {
        if (ev.level - 1 >= subtotalOffsets.length) continue;
        const tmplOffset = subtotalOffsets[ev.level - 1]!;
        // ADR-0038: subtotal aggregates scope to the current group's
        // rows — bind `Rows` and `Source[Col]` resolution to that
        // subset while keeping `__activeSource__` / reserved sheets.
        const ctx = {
          ...reservedCtx,
          Rows: ev.groupRows,
        };
        writeRow(st.dataStartRow + outputRowIdx, templateRows[tmplOffset]!, ctx);
        outputRowIdx++;
      }
    }

    // ADR-0066: restore outside-block cells to ORIGINAL row positions.
    if (outsideSnapshots.length > 0) {
      for (const snap of outsideSnapshots) {
        // Clear value AND style at the shifted position — see
        // renderDataRows step 5 (style-only ghost otherwise).
        const shifted = sheet.getRow(snap.row + insertDelta).getCell(snap.col);
        shifted.value = null;
        shifted.style = {};
        const orig = sheet.getRow(snap.row).getCell(snap.col);
        orig.value = snap.value;
        if (snap.style && Object.keys(snap.style).length > 0) {
          orig.style = { ...snap.style };
        }
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
            cell.value = renderCellValue(normalized, evalCellAt(sheet.name, cell.address, normalized, ctx), tmpl.style);
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

  private renderFilenameDetail(key: GroupKey, fileGroup: FileGroup): { filename: string; warnings: XtlWarning[] } {
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
  // ADR-0025: an XtlErrorCell marker (e.g., from division by zero)
  // becomes a real ExcelJS error cell value regardless of cell
  // numFmt. Single-expression text-format and mixed-text cells
  // still stringify via canonicalString → "#DIV/0!" so authors
  // see the readable form when they explicitly request text.
  if (isErrorCellMarker(value)) {
    const numFmt = typeof style?.numFmt === 'string' ? style.numFmt : undefined;
    if (numFmt === '@' || !isSingleExpression(normalizedTemplate)) {
      return value.__xl3_error__ as ExcelJS.CellValue;
    }
    return { error: value.__xl3_error__ } as unknown as ExcelJS.CellValue;
  }
  // ADR-0039: HYPERLINK() marker → ExcelJS `{ text, hyperlink }` shape.
  // Only when the whole cell is a single HYPERLINK expression; mixed-text
  // cells fall through to canonicalString and the link is lost (authors
  // should use a single-expression cell for clickable links).
  if (isHyperlinkMarker(value) && isSingleExpression(normalizedTemplate)) {
    return { text: value.text, hyperlink: value.__xl3_hyperlink__ } as ExcelJS.CellValue;
  }
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
  throw xtlError(
    'xl3/cell/numfmt-coercion',
    `Value cannot be coerced to a number for cell format "${numFmt}": ${raw}`,
  );
}

function coerceDateValue(v: unknown, numFmt: string): ExcelJS.CellValue {
  if (v === null || v === undefined || v === '') return '' as ExcelJS.CellValue;
  if (v instanceof Date) return v as ExcelJS.CellValue;
  if (typeof v === 'number') return excelSerialToDate(v) as ExcelJS.CellValue;

  const raw = String(v).trim();
  const parsed = parseStrictDate(raw);
  if (parsed) return parsed as ExcelJS.CellValue;
  throw xtlError(
    'xl3/cell/numfmt-coercion',
    `Value cannot be coerced to a date for cell format "${numFmt}": ${raw}`,
  );
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
  // ADR-0017: build the Date in UTC so the canonical-string form
  // (which uses UTC accessors) reads back the same wall-clock value
  // regardless of host timezone.
  const out = new Date(Date.UTC(y, m - 1, d, h, min, sec));
  if (
    out.getUTCFullYear() !== y ||
    out.getUTCMonth() !== m - 1 ||
    out.getUTCDate() !== d ||
    out.getUTCHours() !== h ||
    out.getUTCMinutes() !== min ||
    out.getUTCSeconds() !== sec
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
  // ADR-0017: build in UTC so the day/time round-trips identically
  // regardless of host timezone.
  return new Date(Date.UTC(
    dateInfo.getUTCFullYear(),
    dateInfo.getUTCMonth(),
    dateInfo.getUTCDate(),
    hours,
    minutes,
    seconds,
  ));
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
