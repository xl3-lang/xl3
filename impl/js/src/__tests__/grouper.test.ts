import { describe, it, expect } from 'vitest';
import { groupRows, partitionByGroupKeys, planEmissionEvents } from '../grouper.js';
import type { Row, SheetTemplate } from '../types.js';

/**
 * Issue #136 — a nested `@group` collected a child group's rows into its
 * parent with `push(...rows)`. One call takes every row as an argument, so
 * a large child group exceeded the engine's argument limit and the plan
 * failed with a bare RangeError. The limit depends on the runtime, so these
 * cases use a row count well above the one that failed (150,000).
 */
const LARGE = 300_000;

function subtotals(rows: Row[], keys: string[]): { level: number; count: number }[] {
  return planEmissionEvents(partitionByGroupKeys(rows, keys), keys.length).flatMap((ev) =>
    ev.kind === 'subtotal' ? [{ level: ev.level, count: ev.groupRows.length }] : [],
  );
}

describe('planEmissionEvents', () => {
  it('collects one large child group into its parent', () => {
    const rows: Row[] = Array.from({ length: LARGE }, (_, i) => ({
      Region: 'Seoul',
      Customer: 'Acme',
      Amount: i,
    }));
    const events = planEmissionEvents(partitionByGroupKeys(rows, ['Region', 'Customer']), 2);

    expect(events).toHaveLength(LARGE + 2);
    const inner = events[LARGE]!;
    const outer = events[LARGE + 1]!;
    expect(inner).toMatchObject({ kind: 'subtotal', level: 1 });
    expect(outer).toMatchObject({ kind: 'subtotal', level: 2 });
    if (inner.kind !== 'subtotal' || outer.kind !== 'subtotal') throw new Error('unreachable');
    expect(inner.groupRows).toHaveLength(LARGE);
    expect(outer.groupRows).toHaveLength(LARGE);
    // Source order is preserved through the parent collection.
    expect(outer.groupRows[0]).toBe(rows[0]);
    expect(outer.groupRows[LARGE - 1]).toBe(rows[LARGE - 1]);
  });

  it('collects several large child groups in source order', () => {
    const half = LARGE / 2;
    const rows: Row[] = Array.from({ length: LARGE }, (_, i) => ({
      Region: 'Seoul',
      Customer: i < half ? 'Acme' : 'Beta',
      Amount: i,
    }));
    const events = planEmissionEvents(partitionByGroupKeys(rows, ['Region', 'Customer']), 2);
    const outer = events[events.length - 1]!;
    if (outer.kind !== 'subtotal') throw new Error('unreachable');
    expect(outer.groupRows).toHaveLength(LARGE);
    expect(outer.groupRows[half - 1]).toBe(rows[half - 1]);
    expect(outer.groupRows[half]).toBe(rows[half]);
    expect(subtotals(rows, ['Region', 'Customer'])).toEqual([
      { level: 1, count: half },
      { level: 1, count: half },
      { level: 2, count: LARGE },
    ]);
  });

  it('emits innermost subtotals first, then outward', () => {
    const rows: Row[] = [
      { Region: 'East', Customer: 'Acme', Amount: 1 },
      { Region: 'East', Customer: 'Beta', Amount: 2 },
      { Region: 'West', Customer: 'Acme', Amount: 3 },
    ];
    expect(subtotals(rows, ['Region', 'Customer'])).toEqual([
      { level: 1, count: 1 },
      { level: 1, count: 1 },
      { level: 2, count: 2 },
      { level: 1, count: 1 },
      { level: 2, count: 1 },
    ]);
  });
});

describe('groupRows', () => {
  it('collects a large number of sheet groups', () => {
    const rows: Row[] = Array.from({ length: LARGE }, (_, i) => ({ Customer: `C${i}` }));
    const template: SheetTemplate = {
      originalName: '{{ Customer }}',
      groupKeys: ['Customer'],
      dataStartRow: 1,
      dataEndRow: 1,
      directives: [],
      directiveRows: [],
      blocks: [],
    };
    const { fileGroups } = groupRows(rows, [], [template]);
    expect(fileGroups).toHaveLength(1);
    const groups = fileGroups[0]!.sheetGroups;
    expect(groups).toHaveLength(LARGE);
    expect(groups[0]!.rows).toEqual([rows[0]]);
    expect(groups[LARGE - 1]!.rows).toEqual([rows[LARGE - 1]]);
  });
});
