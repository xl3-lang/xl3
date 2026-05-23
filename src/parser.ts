import ExcelJS from 'exceljs';
import type {
  TemplateMeta,
  TemplateVariable,
  SheetTemplate,
  ParsedTemplate,
  TemplateModel,
  Directive,
  DataBlock,
  InputSpec,
  InputType,
  SourceSpec,
  JoinDirective,
} from './types.js';
import { isDataExpression, isAggregateExpression, extractColumnRefs, normalizeTemplate } from './normalizer.js';
import {
  isDirectiveExpression,
  parseDirective,
  isSubtotalExpression,
  parseSubtotalAggregate,
} from './directive-parser.js';
import { xtlError } from './error-codes.js';
import { evalCell } from './template-eval.js';
import { canonicalString } from './functions.js';

const CONFIG_SHEET = '__config__';
const INPUTS_SHEET = '__inputs__';
const LISTS_SHEET = '__lists__';
const SOURCES_SHEET = '__sources__';
const RESERVED_SHEETS: ReadonlySet<string> = new Set([
  CONFIG_SHEET,
  INPUTS_SHEET,
  LISTS_SHEET,
  SOURCES_SHEET,
]);
const RESERVED_SHEET_RE = /^__[a-z]+__$/;
const REMOVED_SOURCE_CONFIG_KEYS = new Set([
  'header_row',
  'source_range',
  'source_header_range',
]);
const VAR_PATTERN = /\{\{\s*(.+?)\s*\}\}/g;

/** Flatten any ExcelJS cell value to a plain string. Rich text cells (mixed
 *  font runs) come through as `{ richText: [{text}, ...] }` and stringifying
 *  them naively yields "[object Object]" — we need to concatenate their runs
 *  so directive / variable detection still sees `{{ @filter ... }}` etc. */
function cellString(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object' && 'richText' in value) {
    return (value as { richText: { text: string }[] }).richText
      .map((r) => r.text)
      .join('');
  }
  if (typeof value === 'object' && 'result' in value) {
    return String((value as { result: unknown }).result ?? '');
  }
  return String(value);
}

export async function parseTemplate(buffer: ArrayBuffer): Promise<ParsedTemplate> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);

  const { meta, configVars } = readConfigSheet(workbook);
  // ADR-0050: __inputs__ default/label/description/options cells are
  // XTL templates evaluated against a constrained context that exposes
  // only __config__ + pure functions (no source data, no forward refs).
  const inputs = readInputsSheet(workbook, configVars);
  const listSheets = readListsSheet(workbook);
  const sources = readSourcesSheet(workbook);

  // ADR-0011: input names MUST NOT collide with __config__ author-defined values.
  for (const input of inputs) {
    if (Object.prototype.hasOwnProperty.call(configVars, input.name)) {
      throw xtlError(
        'xl3/inputs/conflict-config',
        `__inputs__ name "${input.name}" conflicts with the __config__ author-defined value "${input.name}"`,
      );
    }
  }

  // ADR-0011: reject any sheet whose name matches the reserved
  // dunder-wrapped pattern but is not one of the four known reserved
  // sheets. Authors must not invent new __<name>__ sheets.
  for (const worksheet of workbook.worksheets) {
    if (RESERVED_SHEETS.has(worksheet.name)) continue;
    if (RESERVED_SHEET_RE.test(worksheet.name)) {
      throw xtlError(
        'xl3/sheet/reserved-name',
        `Sheet "${worksheet.name}" matches the reserved __<name>__ pattern but is not a known reserved sheet`,
      );
    }
  }

  const allVars: TemplateVariable[] = [];
  const sheetTemplates: SheetTemplate[] = [];

  const fileGroupKeys = extractGroupKeys(meta.output_file_pattern);

  for (const worksheet of workbook.worksheets) {
    if (RESERVED_SHEETS.has(worksheet.name)) continue;

    if (worksheet.state === 'hidden' || worksheet.state === 'veryHidden') continue;

    // Sheet name variables
    const sheetNameVars = extractVarExpressions(worksheet.name);
    for (const expr of sheetNameVars) {
      allVars.push({ expression: expr, columns: [], location: `sheet:${worksheet.name}` });
    }

    const sheetGroupKeys = extractGroupKeys(worksheet.name);

    const blocks: DataBlock[] = [];
    const allDirectives: Directive[] = [];
    const allDirectiveRows: number[] = [];
    // ADR-0069: track the column of each directive cell so multi-
    // directive rows (e.g., `@source Customers` at B1, `@source
    // Vendors` at E1) can disambiguate proximity-based block
    // attachment. Without per-cell column tracking, the proximity
    // pass would attach both directives to the same column.
    const allDirectiveCols: number[] = [];
    let currentBlock: DataBlock | null = null;
    let pendingDirectives: Directive[] = [];
    let pendingDirectiveRows: number[] = [];

    // Legacy fields (for backward compat — populated from blocks at the end)
    let legacyDataStartRow = 0;
    let legacyDataEndRow = 0;

    worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      // 1. Check for directive rows. ADR-0067: a single row may carry
      // multiple directive cells (e.g., two `@block` declarations
      // side-by-side, or `@block` + `@source` + `@filter` together);
      // collect ALL of them, not just the first.
      const rowDirectives: Directive[] = [];
      const rowDirectiveCols: number[] = [];
      row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
        const cellValue = cellString(cell.value);
        const cellVars = extractVarExpressions(cellValue);
        for (const expr of cellVars) {
          if (isDirectiveExpression(expr)) {
            const d = parseDirective(expr);
            if (d) {
              rowDirectives.push(d);
              rowDirectiveCols.push(colNumber);
              continue;
            }
            // ADR-0027: a recognized directive prefix (`@source`,
            // `@filter`, `@sort`, `@top`, `@repeat`, `@join`) that
            // fails to fully parse is an error, not a silent no-op.
            throw xtlError(
              'xl3/directive/invalid-syntax',
              `Invalid directive: ${expr.trim()}`,
            );
          }
        }
      });
      const isDirectiveRow = rowDirectives.length > 0;
      // Legacy single-directive shape consumed by the down/right
      // dispatch below — preserves existing behavior for the
      // first-directive-on-the-row when there are several.
      const parsedDirective: Directive | null = rowDirectives[0] ?? null;

      if (isDirectiveRow && parsedDirective) {
        for (let k = 0; k < rowDirectives.length; k++) {
          allDirectives.push(rowDirectives[k]!);
          allDirectiveRows.push(rowNumber);
          allDirectiveCols.push(rowDirectiveCols[k]!);
        }
        const directive = parsedDirective as Directive;
        // NOTE: implicit-mode legacy attachment processes only the
        // first directive on the row. Phase 2 (explicit mode) is the
        // path that handles multi-directive rows fully — it reads
        // from `allDirectives` and re-attaches by proximity to
        // `@block` rectangles after the main loop completes.

        if (directive.kind === 'repeat') {
          // Close previous block
          if (currentBlock) { blocks.push(currentBlock); currentBlock = null; }
          // Start new horizontal block
          const repeatDirectives = [...pendingDirectives, directive];
          currentBlock = {
            direction: 'right',
            startRow: 0,
            endRow: 0,
            templateColStart: 0,
            templateColEnd: 0,
            directives: repeatDirectives,
            directiveRows: [...pendingDirectiveRows, rowNumber],
            source: extractSourceFromDirectives(repeatDirectives, 'default'),
            join: extractJoinFromDirectives(repeatDirectives),
          };
          pendingDirectives = [];
          pendingDirectiveRows = [];
        } else {
          // Attach to current block or pending
          if (currentBlock) {
            // ADR-0029: at most one `@source` and one `@join` per
            // data block. Repeats indicate either a typo or a request
            // for a feature that is intentionally out of scope (per
            // ADR-0014 multi-join is deferred to 1.x).
            if (directive.kind === 'source' && currentBlock.directives.some((d) => d.kind === 'source')) {
              throw xtlError(
                'xl3/directive/invalid-syntax',
                `Duplicate @source directive in the same data block. Each block may declare at most one active source.`,
              );
            }
            if (directive.kind === 'join' && currentBlock.join) {
              throw xtlError(
                'xl3/directive/invalid-syntax',
                `Duplicate @join directive in the same data block. Multi-join is intentionally out of scope for XTL 0.x (ADR-0014).`,
              );
            }
            currentBlock.directives.push(directive);
            currentBlock.directiveRows.push(rowNumber);
            if (directive.kind === 'source') currentBlock.source = directive.name;
            if (directive.kind === 'join') currentBlock.join = directive;
          } else {
            // ADR-0029: same duplicate check applied to pending
            // directives — a block hasn't started yet, but two
            // `@source` lines back-to-back are still a duplicate.
            if (directive.kind === 'source' && pendingDirectives.some((d) => d.kind === 'source')) {
              throw xtlError(
                'xl3/directive/invalid-syntax',
                `Duplicate @source directive in the same data block. Each block may declare at most one active source.`,
              );
            }
            if (directive.kind === 'join' && pendingDirectives.some((d) => d.kind === 'join')) {
              throw xtlError(
                'xl3/directive/invalid-syntax',
                `Duplicate @join directive in the same data block. Multi-join is intentionally out of scope for XTL 0.x (ADR-0014).`,
              );
            }
            pendingDirectives.push(directive);
            pendingDirectiveRows.push(rowNumber);
          }
        }
        return;
      }

      // 2. Check for [field] expressions
      let hasDataVar = false;
      let hasSubtotalCell = false;
      const dataColNumbers: number[] = [];
      // ADR-0066: track marker cells ({{...}} expressions) AND any
      // non-empty cells in this row. The block's column range is the
      // bounding box of markers extended outward through contiguous
      // non-empty cells — so a native Excel formula or static value
      // immediately adjacent to a `{{...}}` cell is INSIDE the block
      // (per-row clone, ADR-0046), but a non-empty cell separated by
      // a gap is OUTSIDE (preserved at original row).
      const markerColNumbers: number[] = [];
      const nonEmptyColNumbers = new Set<number>();

      row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
        nonEmptyColNumbers.add(colNumber);
        const cellValue = cellString(cell.value);
        const cellVars = extractVarExpressions(cellValue);
        if (cellVars.length > 0) markerColNumbers.push(colNumber);
        for (const expr of cellVars) {
          const colLetter = columnToLetter(colNumber);
          allVars.push({
            expression: expr,
            columns: [],
            location: `cell:${worksheet.name}!${colLetter}${rowNumber}`,
          });

          if (isSubtotalExpression(expr)) {
            // ADR-0038: validate the aggregate shape eagerly so authors
            // get xl3/subtotal/bad-aggregate at parse time rather than
            // a render-time eval error.
            parseSubtotalAggregate(expr);
            hasSubtotalCell = true;
            continue;
          }

          if (isDataExpression(expr) && !isAggregateExpression(expr)) {
            hasDataVar = true;
            dataColNumbers.push(colNumber);
          }
        }
      });

      // ADR-0038: a subtotal row is a row whose only relevant template
      // cells are @subtotal expressions (no per-row [Col] refs). It
      // extends the current block but does NOT clone per data row.
      if (hasSubtotalCell && !hasDataVar) {
        if (!currentBlock) {
          // Start a 'down' block on the subtotal row so subsequent
          // detection in the renderer can find it; this matches the
          // case where a template starts with a header row using
          // @subtotal (unusual but legal).
          const downDirectives = [...pendingDirectives];
          currentBlock = {
            direction: 'down',
            startRow: 0,
            endRow: 0,
            templateColStart: 0,
            templateColEnd: 0,
            directives: downDirectives,
            directiveRows: [...pendingDirectiveRows],
            source: extractSourceFromDirectives(downDirectives, 'default'),
            join: extractJoinFromDirectives(downDirectives),
          };
          pendingDirectives = [];
          pendingDirectiveRows = [];
        }
        if (currentBlock.startRow === 0) currentBlock.startRow = rowNumber;
        currentBlock.endRow = rowNumber;
        const subOffset = rowNumber - currentBlock.startRow;
        if (!currentBlock.subtotalRowOffsets) currentBlock.subtotalRowOffsets = [];
        currentBlock.subtotalRowOffsets.push(subOffset);
        if (legacyDataStartRow === 0) legacyDataStartRow = rowNumber;
        legacyDataEndRow = rowNumber;
        return;
      }

      if (hasDataVar) {
        // Detect row gap: if current block exists and there's a gap, close it
        if (currentBlock && currentBlock.endRow > 0 && rowNumber > currentBlock.endRow + 1) {
          blocks.push(currentBlock);
          currentBlock = null;
        }

        // If no current block, start a 'down' block with any pending directives
        if (!currentBlock) {
          const downDirectives = [...pendingDirectives];
          currentBlock = {
            direction: 'down',
            startRow: 0,
            endRow: 0,
            templateColStart: 0,
            templateColEnd: 0,
            directives: downDirectives,
            directiveRows: [...pendingDirectiveRows],
            source: extractSourceFromDirectives(downDirectives, 'default'),
            join: extractJoinFromDirectives(downDirectives),
          };
          pendingDirectives = [];
          pendingDirectiveRows = [];
        }

        if (currentBlock.startRow === 0) currentBlock.startRow = rowNumber;
        currentBlock.endRow = rowNumber;

        // ADR-0066: template column range = bounding box of `{{...}}`
        // markers, extended outward through contiguous non-empty cells.
        // Adjacent formulas / static cells / inline-code values are
        // INSIDE the block (cloned per record, per ADR-0046). Cells
        // separated by a gap (empty column) are OUTSIDE and preserved
        // at their original row positions.
        if (markerColNumbers.length > 0) {
          let leftEdge = Math.min(...markerColNumbers);
          let rightEdge = Math.max(...markerColNumbers);
          while (leftEdge > 1 && nonEmptyColNumbers.has(leftEdge - 1)) leftEdge--;
          while (nonEmptyColNumbers.has(rightEdge + 1)) rightEdge++;
          if (currentBlock.templateColStart === 0 || leftEdge < currentBlock.templateColStart) {
            currentBlock.templateColStart = leftEdge;
          }
          if (rightEdge > currentBlock.templateColEnd) {
            currentBlock.templateColEnd = rightEdge;
          }
        }

        // Legacy fields
        if (legacyDataStartRow === 0) legacyDataStartRow = rowNumber;
        legacyDataEndRow = rowNumber;
      } else {
        // Non-data row: close current block
        if (currentBlock) { blocks.push(currentBlock); currentBlock = null; }
      }
    });

    // Close final block
    if (currentBlock) { blocks.push(currentBlock); currentBlock = null; }

    // (ADR-0067: removed the legacy "push pendingDirectives back into
    // allDirectives" step — every directive parsed in the row loop is
    // already pushed to `allDirectives` exactly once at line ~159. The
    // legacy push duplicated `@block` entries on explicit-mode sheets
    // where no implicit block opened.)

    // ADR-0067/0068/0069: explicit multi-block mode via `@block`
    // directives. Determine sheet mode by scanning for any
    // `BlockDirective` collected during this sheet's directive parse.
    const blockDirectives = allDirectives
      .map((d, idx) => ({ dir: d, row: allDirectiveRows[idx]! }))
      .filter((entry) => entry.dir.kind === 'block')
      .map((entry) => ({ dir: entry.dir as Extract<Directive, { kind: 'block' }>, row: entry.row }));
    const explicitMode = blockDirectives.length > 0;

    if (explicitMode) {
      // ADR-0068: explicit mode — `@block` rectangles take over from
      // implicit cluster detection. Build block list from directives.
      const explicitBlocks: DataBlock[] = blockDirectives.map(({ dir, row }) => {
        // Determine col-range
        let colStart = dir.colStart;
        let colEnd = dir.colEnd;
        let rowStart = dir.rowStart > 0 ? dir.rowStart : 0;
        let rowEnd = dir.rowEnd > 0 ? dir.rowEnd : 0;

        // For bare / col-range forms: auto-detect row range from
        // marker cells below the directive's row. `rowStart` is the
        // FIRST marker row found, not the row immediately below the
        // directive — the directive may sit one or more static rows
        // above the data row (header etc.).
        if (rowStart === 0) {
          let r = row + 1;
          while (r <= row + 1000) {
            const rowObj = worksheet.getRow(r);
            let hasMarker = false;
            rowObj.eachCell({ includeEmpty: false }, (cell, c) => {
              if (colStart > 0 && (c < colStart || c > colEnd)) return;
              const vars = extractVarExpressions(cellString(cell.value));
              for (const e of vars) {
                if (isDataExpression(e) && !isAggregateExpression(e)) hasMarker = true;
              }
            });
            if (hasMarker) {
              if (rowStart === 0) rowStart = r;
              rowEnd = r;
              r++;
            } else if (rowStart === 0) {
              // No marker yet — advance, since the data row may be a
              // few rows below the directive (header rows in between).
              r++;
              if (r > row + 100) break; // bound the search to ~100 rows
            } else {
              break;
            }
          }
        }

        if (rowEnd === 0) {
          throw xtlError(
            'xl3/block/empty-table',
            `@block at row ${row} on sheet "${worksheet.name}" has no marker cells inside its declared rectangle`,
          );
        }

        // For bare form: auto-detect col-range from markers within row range
        if (colStart === 0) {
          let minC = Infinity;
          let maxC = -Infinity;
          for (let r = rowStart; r <= rowEnd; r++) {
            worksheet.getRow(r).eachCell({ includeEmpty: false }, (cell, c) => {
              const vars = extractVarExpressions(cellString(cell.value));
              for (const e of vars) {
                if (isDataExpression(e) && !isAggregateExpression(e)) {
                  if (c < minC) minC = c;
                  if (c > maxC) maxC = c;
                }
              }
            });
          }
          if (minC === Infinity) {
            throw xtlError(
              'xl3/block/empty-table',
              `@block at row ${row} on sheet "${worksheet.name}" has no marker cells`,
            );
          }
          colStart = minC;
          colEnd = maxC;
        }

        // Full-rect form: verify the declared rectangle contains at
        // least one marker cell (the bare/col-range path already
        // checks this implicitly via the row-detection loop).
        if (dir.rowStart > 0 && dir.rowEnd > 0) {
          let hasMarker = false;
          for (let r = rowStart; r <= rowEnd && !hasMarker; r++) {
            worksheet.getRow(r).eachCell({ includeEmpty: false }, (cell, c) => {
              if (hasMarker) return;
              if (c < colStart || c > colEnd) return;
              const vars = extractVarExpressions(cellString(cell.value));
              for (const e of vars) {
                if (isDataExpression(e) && !isAggregateExpression(e)) {
                  hasMarker = true;
                  return;
                }
              }
            });
          }
          if (!hasMarker) {
            throw xtlError(
              'xl3/block/empty-table',
              `@block at row ${row} declares rectangle (rows ${rowStart}-${rowEnd}, cols ${colStart}-${colEnd}) on sheet "${worksheet.name}" but contains no [Column] marker cells`,
            );
          }
        }

        return {
          direction: 'down' as const,
          startRow: rowStart,
          endRow: rowEnd,
          templateColStart: colStart,
          templateColEnd: colEnd,
          directives: [],
          directiveRows: [],
          source: 'default',
        };
      });

      // Overlap check (ADR-0068)
      for (let i = 0; i < explicitBlocks.length; i++) {
        for (let j = i + 1; j < explicitBlocks.length; j++) {
          const a = explicitBlocks[i]!;
          const b = explicitBlocks[j]!;
          const rowOverlap = !(a.endRow < b.startRow || b.endRow < a.startRow);
          const colOverlap = !(a.templateColEnd < b.templateColStart || b.templateColEnd < a.templateColStart);
          if (rowOverlap && colOverlap) {
            throw xtlError(
              'xl3/block/overlap',
              `@block #${i + 1} (${a.startRow}-${a.endRow}, cols ${a.templateColStart}-${a.templateColEnd}) and #${j + 1} (${b.startRow}-${b.endRow}, cols ${b.templateColStart}-${b.templateColEnd}) overlap on sheet "${worksheet.name}"`,
            );
          }
        }
      }

      // Orphan-marker check: every [col] cell must be inside some block.
      const isInsideAnyBlock = (r: number, c: number) =>
        explicitBlocks.some((b) =>
          r >= b.startRow && r <= b.endRow &&
          c >= b.templateColStart && c <= b.templateColEnd,
        );
      type OrphanInfo = { addr: string; row: number; col: number };
      let orphanFound: OrphanInfo | null = null;
      worksheet.eachRow({ includeEmpty: false }, (row, r) => {
        if (orphanFound) return;
        row.eachCell({ includeEmpty: false }, (cell, c) => {
          if (orphanFound) return;
          const vars = extractVarExpressions(cellString(cell.value));
          for (const e of vars) {
            // Skip directive expressions (e.g., `@filter [Status]=...`)
            // — their inner `[Column]` refs are scoped to the directive,
            // not orphan markers.
            if (isDirectiveExpression(e) || isAggregateExpression(e)) continue;
            if (isDataExpression(e) && !isInsideAnyBlock(r, c)) {
              orphanFound = { addr: cell.address, row: r, col: c } as OrphanInfo;
              return;
            }
          }
        });
      });
      if (orphanFound) {
        const orphan = orphanFound as OrphanInfo;
        throw xtlError(
          'xl3/expression/bracket-outside-block',
          `[Column] reference at ${orphan.addr} on sheet "${worksheet.name}" is not inside any @block rectangle (ADR-0068 explicit mode)`,
        );
      }

      // Per-block directive scoping (ADR-0069) — proximity attach.
      // Each directive is matched to the closest @block whose
      // col-range overlaps the directive's own column. Directives
      // that have no matching block raise xl3/directive/orphan.
      const nonBlockDirectives = allDirectives
        .map((d, idx) => ({
          dir: d,
          row: allDirectiveRows[idx]!,
          col: allDirectiveCols[idx]!,
        }))
        .filter((entry) => entry.dir.kind !== 'block');

      for (const { dir, row: dirRow, col: dirCol } of nonBlockDirectives) {
        const candidates = explicitBlocks.filter((b) =>
          dirRow < b.startRow && dirCol >= b.templateColStart && dirCol <= b.templateColEnd,
        );
        if (candidates.length === 0) {
          throw xtlError(
            'xl3/directive/orphan',
            `Directive @${dir.kind} at row ${dirRow}, col ${dirCol} on sheet "${worksheet.name}" is not above any @block whose col-range overlaps col ${dirCol}`,
          );
        }
        candidates.sort((a, b) => (a.startRow - dirRow) - (b.startRow - dirRow));
        const target = candidates[0]!;
        target.directives.push(dir);
        target.directiveRows.push(dirRow);
        if (dir.kind === 'source') target.source = dir.name;
        if (dir.kind === 'join') target.join = dir;
      }

      // Replace implicit-detected blocks with explicit ones.
      blocks.length = 0;
      blocks.push(...explicitBlocks);
    } else {
      // ADR-0066 Phase 1 implicit mode unchanged: if multiple
      // disconnected down-clusters were detected, raise.
      const downBlocks = blocks.filter((b) => b.direction === 'down');
      if (downBlocks.length > 1) {
        const second = downBlocks[1]!;
        throw xtlError(
          'xl3/expression/bracket-outside-block',
          `[Column] references on sheet "${worksheet.name}" form ${downBlocks.length} disconnected clusters. Use @block directives to declare each (ADR-0067), or merge into one contiguous block. Second cluster starts at row ${second.startRow}.`,
        );
      }
    }

    const st: SheetTemplate = {
      originalName: worksheet.name,
      groupKeys: sheetGroupKeys,
      dataStartRow: legacyDataStartRow,
      dataEndRow: legacyDataEndRow,
      directives: allDirectives,
      directiveRows: allDirectiveRows,
      blocks,
    };

    sheetTemplates.push(st);
  }

  // File-level variables
  for (const expr of extractVarExpressions(meta.output_file_pattern)) {
    allVars.push({ expression: expr, columns: [], location: 'filename' });
  }

  // Validate list references in directives
  for (const st of sheetTemplates) {
    for (const d of st.directives) {
      if (d.kind === 'filter' && d.listRef && !listSheets[d.listRef]) {
        throw xtlError(
          'xl3/lists/missing-reference',
          `Sheet "${st.originalName}" references missing list sheet "${d.listRef}" in a filter`,
        );
      }
    }
  }

  // ADR-0012: validate every @source directive references a declared source.
  const sourceNames = new Set<string>(['default', ...sources.map((s) => s.name)]);
  for (const st of sheetTemplates) {
    for (const block of st.blocks) {
      if (block.source !== 'default' && !sourceNames.has(block.source)) {
        throw xtlError(
          'xl3/source/undeclared',
          `Source "${block.source}" is not declared in __sources__`,
        );
      }
      // ADR-0014: validate @join references declared sources and that the
      // primary side of the on-clause matches the block's active source.
      if (block.join) {
        const j = block.join;
        if (!sourceNames.has(j.joinedSource)) {
          throw xtlError(
            'xl3/join/undeclared-source',
            `@join source "${j.joinedSource}" must be declared in __sources__`,
          );
        }
        if (j.primarySource !== block.source) {
          throw xtlError(
            'xl3/join/bad-on-clause',
            `@join key columns must reference the joined and primary sources (block source is "${block.source}", on-clause primary is "${j.primarySource}")`,
          );
        }
        // ADR-0029: self-join (joined source same as primary) is
        // intentionally out of scope for XTL 0.x. Tree / hierarchy
        // joins need different semantics (recursive resolution,
        // multiple matches per row) that ADR-0014 does not specify.
        if (j.joinedSource === j.primarySource) {
          throw xtlError(
            'xl3/join/bad-on-clause',
            `@join cannot reference the same source on both sides ("${j.joinedSource}"). Self-joins are intentionally out of scope for XTL 0.x.`,
          );
        }
      }
    }
  }

  return {
    meta,
    variables: deduplicateVars(allVars),
    fileGroupKeys,
    sheetTemplates,
    listSheets,
    configVars,
    inputs,
    sources,
    workbook,
    warnings: [],
  };
}

function extractSourceFromDirectives(directives: Directive[], fallback: string): string {
  for (const d of directives) {
    if (d.kind === 'source') return d.name;
  }
  return fallback;
}

function extractJoinFromDirectives(directives: Directive[]): JoinDirective | undefined {
  for (const d of directives) {
    if (d.kind === 'join') return d;
  }
  return undefined;
}

const VALID_INPUT_TYPES: ReadonlySet<InputType> = new Set([
  'text',
  'number',
  'date',
  'select',
]);

const NAME_RE = /^[A-Za-z0-9_]+$/;

// ADR-0050: detect uses of `__inputs__` cells that depend on render-time
// state (source data, repeat blocks, other inputs). These MUST throw
// because the inputs sheet is read before any of that exists. The check
// runs against the RAW {{ ... }} block content before normalization so
// the diagnostic points at the form the author actually wrote.
// ADR-0050 input-read-time forbidden patterns. Two error-code buckets:
//   - `xl3/inputs/forward-reference` for data refs (sources, other
//     inputs) that have not been read yet.
//   - `xl3/inputs/runtime-only-fn` for functions whose semantics only
//     make sense during render (ROW() inside a repeat block; aggregates
//     and lookups that operate on source rows).
const INPUT_FORBIDDEN_PATTERNS: Array<[RegExp, 'xl3/inputs/forward-reference' | 'xl3/inputs/runtime-only-fn', string]> = [
  [/(?<!\w)\[[^\]\r\n]+\]/, 'xl3/inputs/forward-reference', 'bare [Column] references (no source row context at input-read time)'],
  [/(?<!\w)[A-Za-z]\w*\[[^\]\r\n]+\]/, 'xl3/inputs/forward-reference', 'Source[Column] references (sources are not loaded yet)'],
  [/__sources__\[/, 'xl3/inputs/forward-reference', '__sources__ lookups'],
  [/__inputs__\[/, 'xl3/inputs/forward-reference', '__inputs__ forward references (input rows are independent)'],
  [/\bROW\s*\(/, 'xl3/inputs/runtime-only-fn', 'ROW() (no repeat block at input-read time)'],
  [/\b(?:SUM|COUNT|AVERAGE|AVG|MIN|MAX|XLOOKUP)\s*\(/, 'xl3/inputs/runtime-only-fn', 'aggregate / lookup functions over source data'],
];

function assertInputExpressionAllowed(
  raw: string,
  rowNum: number,
  name: string,
  column: string,
): void {
  for (const block of raw.matchAll(/\{\{\s*([\s\S]+?)\s*\}\}/g)) {
    const inner = block[1] ?? '';
    for (const [re, code, why] of INPUT_FORBIDDEN_PATTERNS) {
      const hit = inner.match(re);
      if (hit) {
        throw xtlError(
          code,
          `__inputs__ row ${rowNum} (name "${name}") ${column} references "${hit[0]}" which is not available at input-read time — ${why}`,
        );
      }
    }
  }
}

function evalInputCellTemplate(
  raw: string,
  configVars: Record<string, string>,
  rowNum: number,
  name: string,
  column: string,
): string {
  if (raw === '' || !raw.includes('{{')) return raw;
  assertInputExpressionAllowed(raw, rowNum, name, column);
  // Normalize with empty column set; __inputs__ has no source columns to
  // resolve. Bracket forms have already been rejected above.
  const normalized = normalizeTemplate(raw, new Set<string>());
  try {
    const result = evalCell(normalized, { __config__: configVars });
    return canonicalString(result);
  } catch (e) {
    if (e instanceof Error) {
      e.message = `${e.message} (at __inputs__ row ${rowNum} ${column})`;
    }
    throw e;
  }
}

/**
 * Parse the optional `__inputs__` sheet (ADR-0010 / ADR-0011). The
 * first row is the header; each subsequent row declares one input.
 * Columns are identified by header text, case-insensitive.
 *
 * Per ADR-0050, cells in the `default`, `label`, `description`, and
 * `options` columns are XTL templates evaluated against a constrained
 * context (only `__config__` + pure scalar functions; no source data,
 * no forward refs to other inputs).
 *
 * @stable Frozen at 1.0 per `spec/STABILITY.md` "Public API surface".
 */
export function readInputsSheet(
  workbook: ExcelJS.Workbook,
  configVars: Record<string, string> = {},
): InputSpec[] {
  const sheet = workbook.getWorksheet(INPUTS_SHEET);
  if (!sheet) return [];

  const header = sheet.getRow(1);
  const headerMap: Record<string, number> = {};
  header.eachCell({ includeEmpty: false }, (cell, colNumber) => {
    const key = String(cell.value ?? '').trim().toLowerCase();
    if (key) headerMap[key] = colNumber;
  });

  const nameCol = headerMap['name'];
  const typeCol = headerMap['type'];
  if (!nameCol || !typeCol) {
    throw xtlError(
      'xl3/inputs/missing-header',
      '__inputs__ sheet must have at least `name` and `type` columns in row 1',
    );
  }
  const defaultCol = headerMap['default'];
  const labelCol = headerMap['label'];
  const descCol = headerMap['description'];
  const optionsCol = headerMap['options'];

  const inputs: InputSpec[] = [];
  const seen = new Set<string>();

  const totalRows = sheet.rowCount;
  for (let r = 2; r <= totalRows; r++) {
    const row = sheet.getRow(r);
    const name = String(row.getCell(nameCol).value ?? '').trim();
    if (!name) continue; // skip empty rows
    if (!NAME_RE.test(name)) {
      throw xtlError(
        'xl3/inputs/invalid-name',
        `__inputs__ row ${r} has invalid name "${name}"; use letters, digits, and underscore only`,
      );
    }
    if (seen.has(name)) {
      throw xtlError('xl3/inputs/duplicate-name', `__inputs__ has duplicate name "${name}"`);
    }
    seen.add(name);

    const typeRaw = String(row.getCell(typeCol).value ?? '').trim().toLowerCase();
    if (!VALID_INPUT_TYPES.has(typeRaw as InputType)) {
      throw xtlError(
        'xl3/inputs/invalid-type',
        `__inputs__ row ${r} has invalid type "${typeRaw}"; expected one of text, number, date, select`,
      );
    }
    const type = typeRaw as InputType;

    const defaultLiteral = defaultCol ? String(row.getCell(defaultCol).value ?? '').trim() : '';
    const labelLiteral = labelCol ? String(row.getCell(labelCol).value ?? '').trim() : '';
    const descLiteral = descCol ? String(row.getCell(descCol).value ?? '').trim() : '';
    const optionsLiteral = optionsCol ? String(row.getCell(optionsCol).value ?? '').trim() : '';

    // ADR-0050: evaluate `{{ ... }}` blocks in each column against the
    // constrained input-read context (configVars only, no sources / no
    // forward refs).
    const defaultRaw = evalInputCellTemplate(defaultLiteral, configVars, r, name, 'default');
    const label = evalInputCellTemplate(labelLiteral, configVars, r, name, 'label');
    const description = evalInputCellTemplate(descLiteral, configVars, r, name, 'description');
    const optionsRaw = evalInputCellTemplate(optionsLiteral, configVars, r, name, 'options');

    let options: string[] | undefined;
    if (type === 'select') {
      if (!optionsRaw) {
        throw xtlError(
          'xl3/inputs/missing-options',
          `__inputs__ row ${r} (name "${name}", type select) requires an options column with pipe-separated values`,
        );
      }
      options = optionsRaw.split('|').map((s) => s.trim()).filter((s) => s.length > 0);
      if (options.length === 0) {
        throw xtlError(
          'xl3/inputs/missing-options',
          `__inputs__ row ${r} (name "${name}") has empty options`,
        );
      }
      if (defaultRaw && !options.includes(defaultRaw)) {
        throw xtlError(
          'xl3/inputs/select-option',
          `__inputs__ row ${r} (name "${name}") default "${defaultRaw}" is not in options`,
        );
      }
    }

    inputs.push({
      name,
      type,
      required: defaultRaw === '',
      default: defaultRaw === '' ? undefined : defaultRaw,
      label: label || undefined,
      description: description || undefined,
      options,
    });
  }

  return inputs;
}

export interface ConfigResult {
  meta: TemplateMeta;
  configVars: Record<string, string>;
}

/**
 * Read the `__config__` sheet and return parsed template metadata
 * plus any author-defined config variables.
 *
 * @stable Frozen at 1.0 per `spec/STABILITY.md` "Public API surface".
 */
export function readConfigSheet(workbook: ExcelJS.Workbook): ConfigResult {
  const meta: TemplateMeta = {
    name: '', description: '', source_sheet: '',
    output_file_pattern: '', match_pattern: '',
  };
  const configVars: Record<string, string> = {};

  const sheet = workbook.getWorksheet(CONFIG_SHEET);
  if (!sheet) return { meta, configVars };

  sheet.eachRow((row) => {
    const key = String(row.getCell(1).value ?? '').trim();
    const val = String(row.getCell(2).value ?? '').trim();
    if (!key) return;
    switch (key) {
      case 'name': meta.name = val; break;
      case 'description': meta.description = val; break;
      case 'source_sheet': meta.source_sheet = val; break;
      case 'source_table': meta.source_table = val; break;
      case 'output_file_pattern': meta.output_file_pattern = val; break;
      case 'match_pattern': meta.match_pattern = val; break;
      default:
        if (REMOVED_SOURCE_CONFIG_KEYS.has(key)) {
          throw xtlError(
            'xl3/config/source-table-removed',
            `Config key "${key}" was removed. Use "source_table" instead.`,
          );
        }
        // ADR-0011: any non-system key is an author-defined value
        // accessed via {{ __config__[key] }}. The leading-`_` prefix
        // convention is retired.
        configVars[key] = val;
    }
  });

  return { meta, configVars };
}

// ADR-0012: read the __sources__ sheet. Row 1 holds the header; each
// subsequent row declares one external data source.
export function readSourcesSheet(workbook: ExcelJS.Workbook): SourceSpec[] {
  const sheet = workbook.getWorksheet('__sources__');
  if (!sheet) return [];

  const header = sheet.getRow(1);
  const headerMap: Record<string, number> = {};
  header.eachCell({ includeEmpty: false }, (cell, colNumber) => {
    const key = String(cell.value ?? '').trim().toLowerCase();
    if (key) headerMap[key] = colNumber;
  });
  const nameCol = headerMap['name'];
  const sheetCol = headerMap['sheet'];
  if (!nameCol || !sheetCol) {
    throw xtlError(
      'xl3/source/missing-header',
      '__sources__ sheet must have at least `name` and `sheet` columns in row 1',
    );
  }
  const tableCol = headerMap['table'];
  const descCol = headerMap['description'];

  const sources: SourceSpec[] = [];
  const seen = new Set<string>();
  const totalRows = sheet.rowCount;
  for (let r = 2; r <= totalRows; r++) {
    const row = sheet.getRow(r);
    const name = String(row.getCell(nameCol).value ?? '').trim();
    const sheetName = String(row.getCell(sheetCol).value ?? '').trim();
    if (!name && !sheetName) continue; // skip blank rows
    if (!name || !sheetName) {
      throw xtlError(
        'xl3/source/missing-required',
        `__sources__ row ${r} missing required name/sheet`,
      );
    }
    if (!/^[A-Za-z0-9_]+$/.test(name)) {
      throw xtlError(
        'xl3/source/invalid-name',
        `__sources__ row ${r} has invalid name "${name}"; use letters, digits, and underscore only`,
      );
    }
    if (name.startsWith('__') || name === 'default') {
      throw xtlError(
        'xl3/source/invalid-name',
        `__sources__ row ${r} has invalid name "${name}"; reserved`,
      );
    }
    if (seen.has(name)) {
      throw xtlError(
        'xl3/source/duplicate-name',
        `__sources__ has duplicate source name "${name}"`,
      );
    }
    seen.add(name);

    const table = tableCol ? String(row.getCell(tableCol).value ?? '').trim() : '';
    const description = descCol ? String(row.getCell(descCol).value ?? '').trim() : '';
    sources.push({
      name,
      sheet: sheetName,
      table: table || '1',
      description: description || undefined,
    });
  }

  return sources;
}

// ADR-0011: read the __lists__ sheet. Row 1 holds list names (one per
// column); each column below is the values of that list. Empty cells
// are skipped per ADR-0007.
export function readListsSheet(workbook: ExcelJS.Workbook): Record<string, string[]> {
  const sheet = workbook.getWorksheet(LISTS_SHEET);
  if (!sheet) return {};

  const lists: Record<string, string[]> = {};
  const header = sheet.getRow(1);
  const colNames: { col: number; name: string }[] = [];
  header.eachCell({ includeEmpty: false }, (cell, colNumber) => {
    const name = String(cell.value ?? '').trim();
    if (!name) return;
    if (lists[name] !== undefined) {
      throw xtlError(
        'xl3/sheet/duplicate-list-name',
        `__lists__ has duplicate list name "${name}"`,
      );
    }
    lists[name] = [];
    colNames.push({ col: colNumber, name });
  });

  const totalRows = sheet.rowCount;
  for (let r = 2; r <= totalRows; r++) {
    const row = sheet.getRow(r);
    for (const { col, name } of colNames) {
      const raw = row.getCell(col).value;
      if (raw === null || raw === undefined) continue;
      const text = String(raw).trim();
      if (text === '') continue;
      lists[name]!.push(text);
    }
  }

  return lists;
}

/**
 * Write template metadata to the workbook's hidden `__config__`
 * sheet, replacing any existing config sheet.
 *
 * @stable Frozen at 1.0 per `spec/STABILITY.md` "Public API surface".
 */
export function writeConfigSheet(workbook: ExcelJS.Workbook, meta: TemplateMeta) {
  // Remove existing
  const existing = workbook.getWorksheet(CONFIG_SHEET);
  if (existing) workbook.removeWorksheet(existing.id);

  const sheet = workbook.addWorksheet(CONFIG_SHEET, { state: 'hidden' });
  const entries: [string, string][] = [
    ['name', meta.name],
    ['description', meta.description],
    ['source_sheet', meta.source_sheet],
    ['source_table', meta.source_table ?? ''],
    ['output_file_pattern', meta.output_file_pattern],
    ['match_pattern', meta.match_pattern],
  ];
  entries.forEach(([k, v], i) => {
    sheet.getCell(i + 1, 1).value = k;
    sheet.getCell(i + 1, 2).value = v;
  });
}

export function populateColumnRefs(parsed: TemplateModel) {
  for (const v of parsed.variables) {
    v.columns = extractColumnRefs(v.expression);
  }
}

function extractVarExpressions(s: string): string[] {
  const exprs: string[] = [];
  let m: RegExpExecArray | null;
  const re = new RegExp(VAR_PATTERN.source, 'g');
  while ((m = re.exec(s)) !== null) {
    exprs.push(m[1].trim());
  }
  return exprs;
}

function extractGroupKeys(pattern: string): string[] {
  return extractVarExpressions(pattern)
    .map((expr) => {
      const bracket = expr.match(/^\[([^\]\r\n]+)\]$/);
      return bracket ? bracket[1].trim() : expr;
    })
    .filter(
      (expr) => !expr.startsWith('.') && !expr.startsWith('_') && !/[ |+*/\-><=!&()[\],]/.test(expr),
    );
}

function deduplicateVars(vars: TemplateVariable[]): TemplateVariable[] {
  const seen = new Set<string>();
  return vars.filter((v) => {
    const key = `${v.expression}|${v.location}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function columnToLetter(col: number): string {
  let s = '';
  while (col > 0) {
    const mod = (col - 1) % 26;
    s = String.fromCharCode(65 + mod) + s;
    col = Math.floor((col - 1) / 26);
  }
  return s;
}
