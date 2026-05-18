import type { Row, GroupKey, SheetGroup, FileGroup, SheetTemplate } from './types.js';
import { canonicalString, isEmpty } from './functions.js';
export type { FileGroup };

// ADR-0038: nested partition tree for @group + @subtotal. Each leaf
// carries the actual data rows; each internal node tracks the key
// values for its level. Encounter order at every level matches the
// post-filter / post-sort order of the input rows.
export interface GroupNode {
  /** Canonical-string value of the key at this node's level. */
  keyValue: string;
  /** Children, in encounter order. Empty when this node is a leaf. */
  children: GroupNode[];
  /** Direct data rows. Populated only at the innermost level. */
  rows: Row[];
}

/**
 * Partition rows by an ordered list of group keys.
 *
 * Returns the top-level encounter-ordered list of nodes. ADR-0038
 * §"Boundary emission rules" #3: groups whose *all* data rows are
 * empty (ADR-0007) at the innermost level are skipped — applied at
 * leaf-construction time so callers do not need a second pass.
 */
export function partitionByGroupKeys(
  rows: Row[],
  keys: string[],
): GroupNode[] {
  if (keys.length === 0) return [];

  const top: GroupNode[] = [];
  const topIndex = new Map<string, GroupNode>();

  for (const row of rows) {
    let level = 0;
    let parentList: GroupNode[] = top;
    let parentIndex: Map<string, GroupNode> = topIndex;
    let node: GroupNode | undefined;
    while (level < keys.length) {
      const key = keys[level]!;
      const value = canonicalString(row[key]);
      let next: GroupNode | undefined = parentIndex.get(value);
      if (!next) {
        next = { keyValue: value, children: [], rows: [] };
        parentList.push(next);
        parentIndex.set(value, next);
      }
      node = next;
      // Descend: prepare for the next nesting level. We need a per-
      // node child index to keep `O(N)` insertions. Lazily attach one
      // via WeakMap-style closure: stash it on the node under a
      // non-enumerable property name.
      const childIndexKey = '__xl3_child_index__';
      let childIndex: Map<string, GroupNode> | undefined =
        (next as unknown as Record<string, Map<string, GroupNode>>)[childIndexKey];
      if (!childIndex) {
        childIndex = new Map<string, GroupNode>();
        Object.defineProperty(next, childIndexKey, {
          value: childIndex,
          enumerable: false,
        });
      }
      parentList = next.children;
      parentIndex = childIndex;
      level += 1;
    }
    node!.rows.push(row);
  }

  // Skip empty groups at the innermost level.
  pruneEmptyLeaves(top);
  return top;
}

function pruneEmptyLeaves(nodes: GroupNode[]): void {
  for (let i = nodes.length - 1; i >= 0; i--) {
    const n = nodes[i]!;
    if (n.children.length > 0) {
      pruneEmptyLeaves(n.children);
      if (n.children.length === 0) nodes.splice(i, 1);
    } else if (n.rows.every((row) => Object.values(row).every((v) => isEmpty(v)))) {
      nodes.splice(i, 1);
    }
  }
}

/**
 * Walk the partition tree and emit a flat ordered list of
 * "what to emit" instructions for the renderer (ADR-0038 boundary
 * emission rules).
 *
 * For each leaf: emit one "data" event per row, then one "subtotal"
 * event per nesting level that ends at this leaf (innermost first,
 * outward). The outermost subtotal fires once at the end of the
 * entire data block — that's the "grand total via outermost
 * subtotal" pattern from the ADR.
 */
export type EmitEvent =
  | { kind: 'data'; row: Row }
  | { kind: 'subtotal'; level: number; groupRows: Row[] };

export function planEmissionEvents(
  groupTree: GroupNode[],
  keyCount: number,
): EmitEvent[] {
  const events: EmitEvent[] = [];
  walkAndEmit(groupTree, /*depth*/ 0, keyCount, events);
  return events;
}

function walkAndEmit(
  nodes: GroupNode[],
  depth: number,
  keyCount: number,
  events: EmitEvent[],
): void {
  for (const node of nodes) {
    if (node.children.length > 0) {
      walkAndEmit(node.children, depth + 1, keyCount, events);
    } else {
      for (const row of node.rows) events.push({ kind: 'data', row });
    }
    // ADR-0038 §"Nesting-level inference": level 1 = innermost,
    // increasing outward. depth=keyCount-1 is the innermost group
    // node; depth=0 is the outermost. So `level = keyCount - depth`.
    const level = keyCount - depth;
    const groupRows = collectLeafRows(node);
    events.push({ kind: 'subtotal', level, groupRows });
  }
}

function collectLeafRows(node: GroupNode): Row[] {
  if (node.children.length === 0) return node.rows;
  const out: Row[] = [];
  for (const child of node.children) out.push(...collectLeafRows(child));
  return out;
}

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

// ADR-0026: Excel-style "(blank)" placeholder for empty group keys.
// Without this, an empty Region cell would render to a `.xlsx`
// filename or a "Sheet" fallback — neither is portable. Excel pivot
// tables put empty values into a "(blank)" group; xl3 follows.
const EMPTY_GROUP_KEY_PLACEHOLDER = '(blank)';

function extractKey(row: Row, keys: string[]): GroupKey {
  if (keys.length === 0) return { values: {} };
  const values: Record<string, string> = {};
  for (const k of keys) {
    // ADR-0009: group keys use canonical string form so Boolean and
    // numeric columns produce stable, cross-impl group identifiers
    // (Booleans uppercase, integers without decimal point).
    // ADR-0026: empty canonical-string values use the "(blank)"
    // placeholder so sheet/file names render as "(blank).xlsx" /
    // "(blank)" rather than producing a sanitization error or a
    // generic "Sheet" fallback.
    const canonical = canonicalString(row[k]);
    values[k] = canonical === '' ? EMPTY_GROUP_KEY_PLACEHOLDER : canonical;
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
