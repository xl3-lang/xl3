/**
 * Style manifest extracted from an exceljs `Workbook`.
 *
 * Phase 2 Task 2.2 (xl3-rs PLAN.md §5): the JS side knows the full
 * OOXML style table because exceljs already parsed it for us; the
 * wasm side rebuilds those styles on the output cells. The two
 * implementations exchange this normalised JSON shape (no exceljs
 * types crossing the boundary).
 *
 * Scope: the bits of OOXML that show up in real reports without
 * pulling in conditional formatting, drawings, defined names, or
 * pivot tables (all explicit non-goals per CLAUDE.md). Hosts that
 * need richer preservation will extend the StyleSpec union, not the
 * top-level shape.
 */

import type ExcelJS from 'exceljs';

export interface StyleManifest {
  /**
   * Deduplicated style table. Cells reference entries by index —
   * matches OOXML cellXfs semantics so the wasm side can move them
   * straight into rust_xlsxwriter's Format cache.
   */
  styles: StyleSpec[];
  /**
   * Per-sheet, per-cell style index. Keyed by sheet name; inner
   * keys are zero-based `"row,col"` (matches xl3-core's planner /
   * renderer position math).
   */
  cells: Record<string, Record<string, number>>;
  /**
   * Merge ranges per sheet, A1 form (`"A1:B2"`). The wasm side
   * forwards these to `rust_xlsxwriter::Worksheet::merge_range`
   * before the cell values land.
   */
  merges: Record<string, string[]>;
  /**
   * Per-sheet column widths in characters (OOXML cw units). One
   * entry per *non-default* column; the others inherit
   * rust_xlsxwriter's defaults.
   */
  columns: Record<string, { col: number; width: number }[]>;
}

export interface StyleSpec {
  font?: FontSpec;
  numFmt?: string;
  alignment?: AlignmentSpec;
  fill?: FillSpec;
}

export interface FontSpec {
  name?: string;
  size?: number;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  /** ARGB hex string (e.g. `"FF000000"`), `undefined` for the theme default. */
  color?: string;
}

export interface AlignmentSpec {
  horizontal?: 'left' | 'center' | 'right' | 'justify';
  vertical?: 'top' | 'middle' | 'bottom';
  wrapText?: boolean;
  indent?: number;
}

export interface FillSpec {
  pattern: 'solid';
  /** ARGB hex (e.g. `"FFFFFF00"` for yellow). */
  color: string;
}

/**
 * Walk an exceljs workbook and emit the manifest. Output is
 * stable / order-independent within a sheet so a downstream
 * canonicaliser (Stage 2 conformance) can compare JSON blobs.
 */
export function extractManifest(workbook: ExcelJS.Workbook): StyleManifest {
  const styleTable = new StyleInterner();
  const cells: Record<string, Record<string, number>> = {};
  const merges: Record<string, string[]> = {};
  const columns: Record<string, { col: number; width: number }[]> = {};

  for (const ws of workbook.worksheets) {
    // Reserved sheets (`__config__`, `__inputs__`, `__sources__`,
    // `__lists__`) are stripped at convert time — no point shipping
    // their styles.
    if (ws.name.startsWith('__') && ws.name.endsWith('__')) continue;

    const sheetCells: Record<string, number> = {};
    ws.eachRow({ includeEmpty: false }, (row, rowNum) => {
      row.eachCell({ includeEmpty: false }, (cell, colNum) => {
        const spec = cellStyleSpec(cell);
        if (!spec) return;
        const idx = styleTable.intern(spec);
        // Zero-based to match xl3-core's render position math.
        sheetCells[`${rowNum - 1},${colNum - 1}`] = idx;
      });
    });
    if (Object.keys(sheetCells).length > 0) {
      cells[ws.name] = sheetCells;
    }

    // exceljs surfaces merges as either an A1 range or via
    // `ws.model.merges`; the former is the public contract.
    const sheetMerges: string[] = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const modelMerges = (ws.model as any)?.merges as string[] | undefined;
    if (Array.isArray(modelMerges) && modelMerges.length > 0) {
      sheetMerges.push(...modelMerges);
    }
    if (sheetMerges.length > 0) merges[ws.name] = sheetMerges;

    const sheetColumns: { col: number; width: number }[] = [];
    if (Array.isArray(ws.columns)) {
      ws.columns.forEach((col, i) => {
        if (col?.width !== undefined && col.width !== null) {
          sheetColumns.push({ col: i, width: col.width });
        }
      });
    }
    if (sheetColumns.length > 0) columns[ws.name] = sheetColumns;
  }

  return {
    styles: styleTable.list(),
    cells,
    merges,
    columns,
  };
}

class StyleInterner {
  private byKey = new Map<string, number>();
  private order: StyleSpec[] = [];
  intern(spec: StyleSpec): number {
    const key = canonicalKey(spec);
    const hit = this.byKey.get(key);
    if (hit !== undefined) return hit;
    const idx = this.order.length;
    this.byKey.set(key, idx);
    this.order.push(spec);
    return idx;
  }
  list(): StyleSpec[] {
    return this.order;
  }
}

function canonicalKey(spec: StyleSpec): string {
  return JSON.stringify(spec, sortKeys);
}

function sortKeys(_key: string, value: unknown): unknown {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const sorted: Record<string, unknown> = {};
    for (const k of Object.keys(value as Record<string, unknown>).sort()) {
      sorted[k] = (value as Record<string, unknown>)[k];
    }
    return sorted;
  }
  return value;
}

function cellStyleSpec(cell: ExcelJS.Cell): StyleSpec | null {
  const spec: StyleSpec = {};
  // exceljs `.font` is the resolved style — defaults stripped when
  // it matches the workbook's master font, present otherwise.
  if (cell.font) {
    const font: FontSpec = {};
    if (cell.font.name !== undefined) font.name = cell.font.name;
    if (cell.font.size !== undefined) font.size = cell.font.size;
    if (cell.font.bold) font.bold = true;
    if (cell.font.italic) font.italic = true;
    if (cell.font.underline) font.underline = true;
    const color = argbColor(cell.font.color);
    if (color) font.color = color;
    if (Object.keys(font).length > 0) spec.font = font;
  }
  if (cell.numFmt) {
    spec.numFmt = cell.numFmt;
  }
  if (cell.alignment) {
    const a: AlignmentSpec = {};
    const h = cell.alignment.horizontal;
    if (h === 'left' || h === 'center' || h === 'right' || h === 'justify') {
      a.horizontal = h;
    }
    const v = cell.alignment.vertical;
    if (v === 'top' || v === 'middle' || v === 'bottom') a.vertical = v;
    if (cell.alignment.wrapText) a.wrapText = true;
    if (typeof cell.alignment.indent === 'number' && cell.alignment.indent > 0) {
      a.indent = cell.alignment.indent;
    }
    if (Object.keys(a).length > 0) spec.alignment = a;
  }
  if (cell.fill && cell.fill.type === 'pattern' && cell.fill.pattern === 'solid') {
    const color = argbColor(cell.fill.fgColor);
    if (color) spec.fill = { pattern: 'solid', color };
  }
  return Object.keys(spec).length > 0 ? spec : null;
}

function argbColor(color: Partial<ExcelJS.Color> | undefined): string | undefined {
  if (!color) return undefined;
  if (typeof color.argb === 'string' && /^[0-9A-Fa-f]{8}$/.test(color.argb)) {
    return color.argb.toUpperCase();
  }
  return undefined;
}
