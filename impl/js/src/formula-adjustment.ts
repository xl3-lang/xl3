import type ExcelJS from 'exceljs';
import { xtlError } from './error-codes.js';
import type { SheetTemplate } from './types.js';

// ADR-0080: a deliberately bounded A1 reference translator. Strings and
// function names are tokens, never candidates for regex substitution.
interface Ref {
  col: string;
  row?: number;
  fixedCol: boolean;
  fixedRow: boolean;
}
type Token = string | { first: Ref; last?: Ref; readsValue?: boolean };
interface FormulaCell {
  row: number;
  col: number;
  address: string;
  tokens: Token[];
}

function colNumber(col: string): number {
  return [...col.toUpperCase()].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0);
}

function readRef(text: string): Ref | undefined {
  const match = /^(\$?)([A-Za-z]{1,3})(\$?)([1-9]\d*)?$/.exec(text);
  if (!match || colNumber(match[2]!) > 16384) return undefined;
  const row = match[4] ? Number(match[4]) : undefined;
  if (row !== undefined && row > 1048576) return undefined;
  return { col: match[2]!, row, fixedCol: !!match[1], fixedRow: !!match[3] };
}

function formatRef(ref: Ref): string {
  return `${ref.fixedCol ? '$' : ''}${ref.col}${ref.fixedRow ? '$' : ''}${ref.row ?? ''}`;
}

function unsupported(location: string, detail: string): never {
  throw xtlError(
    'xl3/formula/unsupported-reference',
    `${location}: ${detail} (formula_mode=adjust)`,
  );
}

function directReferenceArgument(tail: string) {
  const match =
    /^(\s*\(\s*(?:\(\s*)*)(\$?[A-Za-z]{1,3}\$?[1-9]\d*(?:\s*:\s*\$?[A-Za-z]{1,3}\$?[1-9]\d*)?|\$?[A-Za-z]{1,3}\s*:\s*\$?[A-Za-z]{1,3})/.exec(
      tail,
    );
  if (!match) return undefined;
  let remaining = tail.slice(match[0].length);
  let closing = '';
  for (const _opening of match[1]!.match(/\(/g) ?? []) {
    const close = /^\s*\)/.exec(remaining);
    if (!close) return undefined;
    closing += close[0];
    remaining = remaining.slice(close[0].length);
  }
  return { opening: match[1]!, reference: match[2]!, closing, remaining };
}

function tokenize(formula: string, location: string): Token[] {
  const tokens: Token[] = [];
  let rest = formula;
  while (rest) {
    const string = /^"(?:[^"]|"")*"/.exec(rest);
    if (string) {
      tokens.push(string[0]);
      rest = rest.slice(string[0].length);
      continue;
    }
    const number = /^(?:\d+(?:\.\d*)?|\.\d+)(?:[Ee][+-]?\d+)?/.exec(rest);
    if (number) {
      tokens.push(number[0]);
      rest = rest.slice(number[0].length);
      continue;
    }
    const word = /^[A-Za-z_$][A-Za-z0-9_.$]*/.exec(rest);
    if (word) {
      const name = word[0];
      const tail = rest.slice(name.length);
      if (tail.startsWith('!')) {
        unsupported(location, 'Only unqualified A1 references are supported');
      }
      // A cell followed by a space and a parenthesized reference is an
      // intersection, not a function call: B2 (B2:B2). LOG10 is the Excel
      // built-in whose function name also has valid A1 cell spelling.
      if (/^\s*\(/.test(tail) && (readRef(name)?.row === undefined || /^LOG10$/i.test(name))) {
        if (/^(?:_xlfn\.)?(?:INDIRECT|OFFSET)$/i.test(name)) {
          unsupported(location, `${name} hides references that cannot be adjusted safely`);
        }
        // These functions inspect the address/shape of a direct reference;
        // ROW(C2) in C2 does not depend on C2's value. Keep translating the
        // reference, but don't report it as a value dependency. Only plain
        // (optionally parenthesized) reference arguments qualify: arithmetic
        // such as ROW(C2+1) must not suppress dependency checks.
        if (/^(ROW|COLUMN|ROWS|COLUMNS)$/i.test(name)) {
          const direct = directReferenceArgument(tail);
          if (direct) {
            const reference = tokenize(direct.reference, location);
            tokens.push(
              name + direct.opening,
              ...reference.map((token) =>
                typeof token === 'string' ? token : { ...token, readsValue: false },
              ),
              direct.closing,
            );
            rest = direct.remaining;
            continue;
          }
        }
        tokens.push(name);
        rest = tail;
        continue;
      }
      if (/^(TRUE|FALSE)$/i.test(name)) {
        tokens.push(name);
        rest = tail;
        continue;
      }
      const first = readRef(name);
      if (!first) unsupported(location, `Unsupported name or reference "${name}"`);
      const range = /^\s*:\s*([A-Za-z_$][A-Za-z0-9_.$]*)/.exec(tail);
      let last: Ref | undefined;
      if (range) {
        last = readRef(range[1]!);
        if (!last || (first.row === undefined) !== (last.row === undefined)) {
          unsupported(location, 'Only A1 cell ranges and whole-column ranges are supported');
        }
        if (colNumber(first.col) > colNumber(last.col) || (first.row ?? 0) > (last.row ?? 0)) {
          unsupported(location, 'Reversed ranges are not supported');
        }
      } else if (first.row === undefined) {
        unsupported(location, `Defined name "${name}" is not supported`);
      }
      tokens.push({ first, last });
      rest = tail.slice(range?.[0].length ?? 0);
      continue;
    }
    const operator = /^[\s+\-*/^&=<>%,();]+/.exec(rest);
    if (!operator) {
      unsupported(
        location,
        'Only unqualified A1 references are supported; sheet, table, array and spill references are not',
      );
    }
    tokens.push(operator[0]);
    rest = rest.slice(operator[0].length);
  }
  return tokens;
}

/** Snapshot formulas before any directive removal or row insertion. */
export class FormulaAdjustment {
  private readonly cells: FormulaCell[] = [];
  private readonly removed: Set<number>;

  constructor(
    sheet: ExcelJS.Worksheet,
    private readonly template: SheetTemplate,
  ) {
    this.removed = new Set(template.directiveRows);
    sheet.eachRow((row, r) => {
      if (this.removed.has(r)) return;
      row.eachCell((cell, c) => {
        if (cell.isMerged && cell.master.address !== cell.address) return;
        const value = cell.value;
        if (
          !value ||
          typeof value !== 'object' ||
          !('formula' in value || 'sharedFormula' in value)
        )
          return;
        const location = `${sheet.name}!${cell.address}`;
        if ('shareType' in value && value.shareType === 'array') {
          unsupported(location, 'Array formulas are not supported');
        }
        // ExcelJS resolves a shared slave's effective relative references.
        // Resolve before the source owner can be moved or overwritten.
        const formula = cell.formula;
        if (!formula) unsupported(location, 'Shared formula owner could not be resolved');
        this.cells.push({ row: r, col: c, address: location, tokens: tokenize(formula, location) });
      });
    });
    if (
      this.cells.length &&
      (template.blocks.length > 1 ||
        template.blocks.some(
          (block) =>
            block.direction !== 'down' ||
            block.directives.some((d) => d.kind === 'group') ||
            (block.subtotalRowOffsets?.length ?? 0) > 0,
        ))
    ) {
      throw xtlError(
        'xl3/formula/unsupported-layout',
        `${sheet.name}: formula_mode=adjust requires at most one vertical block without @group or @subtotal`,
      );
    }
  }

  private removeDirectives(row: number, location: string): number {
    if (this.removed.has(row)) {
      throw xtlError(
        'xl3/formula/invalid-reference',
        `${location}: reference points to removed directive row ${row}`,
      );
    }
    return row - [...this.removed].filter((r) => r < row).length;
  }

  get hasFormulas(): boolean {
    return this.cells.length > 0;
  }

  apply(sheet: ExcelJS.Worksheet, recordCount: number): void {
    const block = this.template.blocks[0];
    const height = block ? block.endRow - block.startRow + 1 : 0;
    const delta = height * Math.max(0, recordCount - 1);
    const insideCol = (col: number) =>
      !!block && col >= block.templateColStart && col <= block.templateColEnd;
    const inside = (row: number, col: number) =>
      insideCol(col) && row >= block!.startRow && row <= block!.endRow;

    for (const cell of this.cells) {
      const repeated = inside(cell.row, cell.col);
      const count = repeated ? recordCount : 1;
      for (let i = 0; i < count; i++) {
        const copyDelta = i * height;
        const outputRow =
          this.removeDirectives(cell.row, cell.address) +
          (repeated ? copyDelta : insideCol(cell.col) && cell.row > block!.endRow ? delta : 0);
        const shift = (ref: Ref, extendEnd = false): Ref => {
          if (ref.row === undefined) return ref;
          let row = this.removeDirectives(ref.row, cell.address);
          if (insideCol(colNumber(ref.col)) && (ref.row > block!.endRow || extendEnd)) row += delta;
          if (repeated && !ref.fixedRow) row += copyDelta;
          if (row < 1 || row > 1048576) {
            throw xtlError(
              'xl3/formula/invalid-reference',
              `${cell.address}: adjusted reference is outside Excel row limits`,
            );
          }
          return { ...ref, row };
        };
        const formula = cell.tokens
          .map((token) => {
            if (typeof token === 'string') return token;
            const { first, last } = token;
            let extendEnd = false;
            if (block && last && first.row !== undefined && last.row !== undefined) {
              const overlapsRows = first.row <= block.endRow && last.row >= block.startRow;
              const overlapsCols =
                colNumber(first.col) <= block.templateColEnd &&
                colNumber(last.col) >= block.templateColStart;
              if (
                last.row >= block.startRow &&
                overlapsCols &&
                (!insideCol(colNumber(first.col)) || !insideCol(colNumber(last.col)))
              ) {
                unsupported(
                  cell.address,
                  'Range crosses the moving block and stationary side columns',
                );
              }
              if (overlapsRows && overlapsCols) {
                if (!repeated && (first.row > block.startRow || last.row < block.endRow)) {
                  unsupported(
                    cell.address,
                    'Static range covers only part of the repeated template rows',
                  );
                }
                extendEnd = !repeated && last.row === block.endRow;
              }
            }
            const start = shift(first);
            const end = last ? shift(last, extendEnd) : start;
            if (
              token.readsValue !== false &&
              cell.col >= colNumber(start.col) &&
              cell.col <= colNumber(end.col) &&
              (start.row === undefined || (outputRow >= start.row && outputRow <= end.row!))
            ) {
              throw xtlError(
                'xl3/formula/invalid-reference',
                `${cell.address}: adjusted formula directly references its own output cell`,
              );
            }
            return `${formatRef(start)}${last ? `:${formatRef(end)}` : ''}`;
          })
          .join('');
        // Invalidate template caches, including unchanged dependent formulas.
        sheet.getCell(outputRow, cell.col).value = { formula };
      }
    }
    if (this.cells.length) sheet.workbook.calcProperties.fullCalcOnLoad = true;
  }
}
