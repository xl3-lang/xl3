import type { Row, GroupKey, SheetGroup, FileGroup, SheetTemplate } from './types.js';
import { canonicalString } from './functions.js';
export type { FileGroup };

export interface GroupedData {
  fileGroups: FileGroup[];
}

export function groupRows(
  rows: Row[],
  fileKeys: string[],
  sheetTemplates: SheetTemplate[],
): GroupedData {
  // Group by file keys
  const fileGroupMap = new Map<string, { key: GroupKey; rows: Row[] }>();
  const fileGroupOrder: string[] = [];

  for (const row of rows) {
    const fk = extractKey(row, fileKeys);
    const fkStr = groupKeyStr(fk);

    if (!fileGroupMap.has(fkStr)) {
      fileGroupMap.set(fkStr, { key: fk, rows: [] });
      fileGroupOrder.push(fkStr);
    }
    fileGroupMap.get(fkStr)!.rows.push(row);
  }

  // Build file groups with sheet sub-groups
  const result: FileGroup[] = [];

  for (const fkStr of fileGroupOrder) {
    const { key, rows: fileRows } = fileGroupMap.get(fkStr)!;
    const sheetGroups: SheetGroup[] = [];

    for (const st of sheetTemplates) {
      if (st.groupKeys.length === 0) {
        sheetGroups.push({ key: { values: {} }, rows: fileRows });
      } else {
        const subGroups = groupByKeysOrdered(fileRows, st.groupKeys);
        sheetGroups.push(...subGroups);
      }
    }

    result.push({ key, sheetGroups });
  }

  return { fileGroups: result };
}

function groupByKeysOrdered(rows: Row[], keys: string[]): SheetGroup[] {
  const map = new Map<string, SheetGroup>();
  const order: string[] = [];

  for (const row of rows) {
    const gk = extractKey(row, keys);
    const gkStr = groupKeyStr(gk);

    if (!map.has(gkStr)) {
      map.set(gkStr, { key: gk, rows: [] });
      order.push(gkStr);
    }
    map.get(gkStr)!.rows.push(row);
  }

  // ADR-0016: sheet groups within a file emit in first-seen order, the
  // same rule that file groups already follow.
  return order.map((k) => map.get(k)!);
}

function extractKey(row: Row, keys: string[]): GroupKey {
  if (keys.length === 0) return { values: {} };
  const values: Record<string, string> = {};
  for (const k of keys) {
    // ADR-0009: group keys use canonical string form so Boolean and
    // numeric columns produce stable, cross-impl group identifiers
    // (Booleans uppercase, integers without decimal point).
    values[k] = canonicalString(row[k]);
  }
  return { values };
}

function groupKeyStr(key: GroupKey): string {
  if (Object.keys(key.values).length === 0) return '__default__';
  return Object.keys(key.values)
    .sort()
    .map((k) => `${k}=${key.values[k]}`)
    .join('|');
}
