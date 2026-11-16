// ADR-0040 § "Extension rule for CF and DV `sqref` ranges" — the range
// arithmetic, isolated from the renderer.
//
// Pure on purpose. The rule has more edge cases than it looks (whole-column
// forms, Excel's max-row idiom, absolute markers, multi-range sqref, partial
// overlap, whole-row refs), and every one of them is cheaper to pin here as a
// unit test than through a rendered workbook.
//
// ROADMAP gate G5. Only the CF/DV half of ADR-0040 was outstanding; the
// outline-level half shipped in 0.6.0.

/** Excel's hard sheet limit. An end row at or past this already covers everything. */
const EXCEL_MAX_ROW = 1_048_576;

export interface SubRange {
  /** 1-based first row, or `undefined` for a whole-column reference. */
  startRow?: number;
  /** 1-based last row, or `undefined` for a whole-column reference. */
  endRow?: number;
  /**
   * True when the reference names no rows at all (`C:C`, `$A:$A`) or already
   * runs to Excel's last row. ADR-0040 rule 3: these are never modified —
   * they cover the expanded region as authored.
   */
  coversAllRows: boolean;
  /** The sub-range exactly as it appeared, so an untouched one round-trips verbatim. */
  raw: string;
}

const CELL = /^\$?([A-Z]{1,3})?\$?(\d+)?$/;

function parseEndpoint(s: string): { col?: string; row?: number } | null {
  const m = CELL.exec(s.trim().toUpperCase());
  if (!m) return null;
  const [, col, row] = m;
  if (!col && !row) return null;
  return { col: col ?? undefined, row: row ? Number(row) : undefined };
}

/**
 * Split one `sqref` value into its sub-ranges and read each one's row span.
 *
 * Excel separates multi-range sqref with spaces (`"A2:A5 C2:C5"`); ADR-0040
 * rule 4 requires processing them independently.
 *
 * A sub-range that cannot be parsed comes back with `coversAllRows: true` so
 * callers leave it alone — ADR-0040 § "Error catalog" makes an unapplied
 * extension a silent no-op, never an error.
 */
export function parseSqref(sqref: string): SubRange[] {
  return sqref
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((raw): SubRange => {
      const [a, b] = raw.split(':');
      const start = parseEndpoint(a ?? '');
      const end = b === undefined ? start : parseEndpoint(b);
      if (!start || !end) return { coversAllRows: true, raw };

      // `C:C` / `$A:$A` — columns with no row component.
      if (start.row === undefined || end.row === undefined) {
        return { coversAllRows: true, raw };
      }
      const startRow = Math.min(start.row, end.row);
      const endRow = Math.max(start.row, end.row);
      return {
        startRow,
        endRow,
        coversAllRows: endRow >= EXCEL_MAX_ROW,
        raw,
      };
    });
}

/** Rewrite a sub-range's end row, preserving the authored `$` markers and column letters. */
function withEndRow(raw: string, endRow: number): string {
  const [a, b] = raw.split(':');
  if (b === undefined) {
    // Single cell grew into a range: `A2` + delta -> `A2:A4`.
    const m = /^(\$?[A-Z]{1,3}\$?)(\d+)$/i.exec(a!.trim());
    if (!m) return raw;
    return `${a!.trim()}:${m[1]}${endRow}`;
  }
  const m = /^(\$?[A-Z]{1,3}\$?)?(\$?)(\d+)$/i.exec(b.trim());
  if (!m) return raw;
  return `${a!.trim()}:${m[1] ?? ''}${m[2] ?? ''}${endRow}`;
}

export interface ExtendResult {
  /** The rewritten `sqref`, or the input unchanged when no sub-range qualified. */
  ref: string;
  /** True when at least one sub-range was extended. */
  changed: boolean;
  /**
   * True when a sub-range overlaps the block only partially. ADR-0040 rule 1.2
   * leaves those as authored because the author's intent is unknowable; the
   * flag lets the caller warn rather than silently doing nothing.
   */
  partialOverlap: boolean;
}

/**
 * Apply ADR-0040's extension rule to one `sqref` value.
 *
 * A sub-range is extended if and only if it is **fully contained** in the
 * block's template row span — start at or below the block's first row, end at
 * or above nothing beyond its last. Everything else is left exactly as
 * authored, including partial overlaps: the rule deliberately refuses to guess
 * whether a partial overlap was intentional.
 *
 * `blockStartRow` / `blockEndRow` are the block's rows **in template
 * coordinates**, since that is what the author's ranges were written against.
 */
export function extendSqref(
  sqref: string,
  blockStartRow: number,
  blockEndRow: number,
  delta: number,
): ExtendResult {
  if (delta <= 0 || !sqref.trim()) {
    return { ref: sqref, changed: false, partialOverlap: false };
  }

  let changed = false;
  let partialOverlap = false;

  const parts = parseSqref(sqref).map((sub) => {
    if (sub.coversAllRows || sub.startRow === undefined || sub.endRow === undefined) {
      return sub.raw;
    }
    const contained = sub.startRow >= blockStartRow && sub.endRow <= blockEndRow;
    if (contained) {
      changed = true;
      return withEndRow(sub.raw, sub.endRow + delta);
    }
    // Touches the block without being inside it.
    const overlaps = sub.startRow <= blockEndRow && sub.endRow >= blockStartRow;
    if (overlaps) partialOverlap = true;
    return sub.raw;
  });

  return { ref: parts.join(' '), changed, partialOverlap };
}

/**
 * Row numbers a per-cell validation should be replicated onto.
 *
 * ExcelJS models data validations per cell address rather than as an `sqref`
 * range, so "extending" a validation means copying it to the rows the
 * expansion added. Returns the new row numbers only — the caller already holds
 * the source row.
 *
 * Same containment rule as `extendSqref`: a validation outside the block's row
 * span is not replicated.
 */
export function replicatedRowsFor(
  cellRow: number,
  blockStartRow: number,
  blockEndRow: number,
  delta: number,
): number[] {
  if (delta <= 0) return [];
  if (cellRow < blockStartRow || cellRow > blockEndRow) return [];
  const templateRowCount = blockEndRow - blockStartRow + 1;
  const rows: number[] = [];
  // The template row repeats every `templateRowCount` rows in the output, so a
  // validation on template row R lands on R, R+count, R+2*count, … The block
  // grew by `delta` rows, i.e. delta/templateRowCount extra records.
  for (let r = cellRow + templateRowCount; r <= blockEndRow + delta; r += templateRowCount) {
    rows.push(r);
  }
  return rows;
}

/**
 * Rewrite the row numbers of one sub-range, keeping its columns and `$`
 * markers. `startRow` goes to the lower endpoint and `endRow` to the upper,
 * whichever order the reference wrote them in.
 */
function withRows(raw: string, startRow: number, endRow: number): string {
  const parsed = raw.split(':').map((e) => /^(\$?[A-Z]{1,3})?(\$?)(\d+)$/i.exec(e.trim()));
  if (parsed.some((m) => !m)) return raw;
  const [a, b] = parsed as RegExpExecArray[];
  const write = (m: RegExpExecArray, row: number) => `${m[1] ?? ''}${m[2] ?? ''}${row}`;
  if (!b) return write(a!, startRow);
  const aIsStart = Number(a![3]) <= Number(b[3]);
  return `${write(a!, aIsStart ? startRow : endRow)}:${write(b, aIsStart ? endRow : startRow)}`;
}

/**
 * Where `row` lands after `removedRows` are deleted from the sheet, or
 * `null` when `row` is itself one of them (#124).
 */
export function rowAfterRemoval(row: number, removedRows: readonly number[]): number | null {
  let above = 0;
  for (const removed of removedRows) {
    if (removed === row) return null;
    if (removed < row) above++;
  }
  return row - above;
}

/**
 * Rewrite an `sqref` after `removedRows` are deleted from the sheet (#124).
 * A sub-range below a removed row moves up, one that spans a removed row
 * shrinks, and one that lies entirely on removed rows is dropped. Returns
 * an empty string when no sub-range is left.
 *
 * This is for directive rows only. They are template machinery, removed
 * before anything renders, so a range written below one was written for
 * the cells that move up. It is not the ADR-0040 extension, and it does
 * not make ranges follow a block that grows (ADR-0036 row 1).
 */
export function removeRowsFromSqref(sqref: string, removedRows: readonly number[]): string {
  if (removedRows.length === 0) return sqref;
  const parts: string[] = [];
  for (const sub of parseSqref(sqref)) {
    if (sub.coversAllRows || sub.startRow === undefined || sub.endRow === undefined) {
      parts.push(sub.raw);
      continue;
    }
    const start = sub.startRow;
    const end = sub.endRow;
    // The first surviving row at or after `start`, the last at or before `end`.
    const newStart = start - removedRows.filter((r) => r < start).length;
    const newEnd = end - removedRows.filter((r) => r <= end).length;
    if (newStart > newEnd) continue;
    parts.push(
      newStart === start && newEnd === end ? sub.raw : withRows(sub.raw, newStart, newEnd),
    );
  }
  return parts.join(' ');
}
