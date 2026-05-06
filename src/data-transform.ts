import type { Row, Directive, FilterDirective, SortDirective } from './types.js';
import { isEmpty } from './functions.js';

export function applyDirectives(
  rows: Row[],
  directives: Directive[],
  listSheets: Record<string, string[]>,
): Row[] {
  if (directives.length === 0) return rows;

  let result = rows;

  // 1. Filter (AND: all filter directives must pass)
  const filters = directives.filter((d): d is FilterDirective => d.kind === 'filter');
  if (filters.length > 0) {
    result = result.filter((row) => filters.every((f) => evalFilter(row, f, listSheets)));
  }

  // 2. Sort (multi-field, order = directive order)
  const sorts = directives.filter((d): d is SortDirective => d.kind === 'sort');
  if (sorts.length > 0) {
    result = [...result].sort((a, b) => {
      for (const s of sorts) {
        const cmp = compareValues(a[s.field], b[s.field]);
        if (cmp !== 0) return s.order === 'desc' ? -cmp : cmp;
      }
      return 0;
    });
  }

  // 3. Top
  const top = directives.find((d) => d.kind === 'top');
  if (top && top.kind === 'top') {
    result = result.slice(0, top.count);
  }

  return result;
}

function evalFilter(
  row: Row,
  filter: FilterDirective,
  listSheets: Record<string, string[]>,
): boolean {
  const rawValue = row[filter.field];

  if (filter.op === 'in' || filter.op === '!in') {
    // ADR-0007: an empty source-row value never matches `in` and always
    // matches `!in`, regardless of list contents.
    if (isEmpty(rawValue)) return filter.op === '!in';
    const list = filter.listRef ? listSheets[filter.listRef] ?? [] : [];
    const strValue = String(rawValue);
    const found = list.includes(strValue);
    return filter.op === 'in' ? found : !found;
  }

  const rowVal = toComparable(rawValue);
  const filterVal = toComparable(filter.value);

  // If both are numbers, compare numerically
  const rowNum = typeof rowVal === 'number' ? rowVal : Number(rowVal);
  const filterNum = typeof filterVal === 'number' ? filterVal : Number(filterVal);
  const bothNumeric = !isNaN(rowNum) && !isNaN(filterNum);

  switch (filter.op) {
    case '=': return bothNumeric ? rowNum === filterNum : String(rowVal) === String(filterVal);
    case '!=': return bothNumeric ? rowNum !== filterNum : String(rowVal) !== String(filterVal);
    case '>': return bothNumeric ? rowNum > filterNum : String(rowVal) > String(filterVal);
    case '<': return bothNumeric ? rowNum < filterNum : String(rowVal) < String(filterVal);
    case '>=': return bothNumeric ? rowNum >= filterNum : String(rowVal) >= String(filterVal);
    case '<=': return bothNumeric ? rowNum <= filterNum : String(rowVal) <= String(filterVal);
    default: return true;
  }
}

function compareValues(a: unknown, b: unknown): number {
  const na = Number(a);
  const nb = Number(b);

  if (!isNaN(na) && !isNaN(nb)) return na - nb;

  const sa = String(a ?? '');
  const sb = String(b ?? '');
  return sa.localeCompare(sb, 'ko');
}

function toComparable(v: unknown): string | number {
  if (typeof v === 'number') return v;
  if (v === null || v === undefined) return '';
  return String(v);
}
