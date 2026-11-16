import { describe, it, expect } from 'vitest';
import ExcelJS from 'exceljs';
import { convertJson } from '../index.js';
import { buildEqualityIndex, compareValues } from '../functions.js';
import type { Row } from '../types.js';

/**
 * Issue #129 — XLOOKUP and @join matched rows by canonical string, not by
 * the ADR-0009 comparison. `"01"` and `"1"` compare equal (`IF("01" = "1")`
 * is true) but had different index keys, so a lookup for `"1"` skipped the
 * first matching row `"01"` and returned a later one.
 */

type Source = { headers: string[]; rows: unknown[][] };

async function render(
  mode: 'lookup' | 'join',
  lookupRows: unknown[][],
  keys: unknown[],
): Promise<unknown[][]> {
  const template = new ExcelJS.Workbook();
  template.addWorksheet('__sources__').addRows([
    ['name', 'sheet'],
    ['Lookup', 'Lookup'],
  ]);
  const sheet = template.addWorksheet('Report');
  if (mode === 'lookup') {
    sheet.addRows([['{{ [Id] }}', '{{ XLOOKUP([Key], Lookup[Key], Lookup[Value], "none") }}']]);
  } else {
    sheet.addRows([
      ['{{ @join Lookup on Lookup[Key] = default[Key] }}'],
      ['{{ [Id] }}', '{{ Lookup[Value] }}'],
    ]);
  }
  const sources: Record<string, Source> = {
    default: { headers: ['Id', 'Key'], rows: keys.map((k, i) => [i + 1, k]) },
    Lookup: { headers: ['Key', 'Value'], rows: lookupRows },
  };
  const files = await convertJson((await template.xlsx.writeBuffer()) as ArrayBuffer, {
    version: 'xl3-source-json/0.1',
    sources,
  });
  const output = new ExcelJS.Workbook();
  const data = files[0]!.data;
  await output.xlsx.load(
    data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer,
  );
  const out: unknown[][] = [];
  output.getWorksheet('Report')!.eachRow((row) => out.push((row.values as unknown[]).slice(1)));
  return out;
}

describe.each(['lookup', 'join'] as const)('#129 %s equality', (mode) => {
  it('returns the first row that compares equal, not the first equal string', async () => {
    const rows = [
      ['01', 'first'],
      ['1', 'second'],
    ];
    expect(await render(mode, rows, ['1'])).toEqual([[1, 'first']]);
    expect(await render(mode, rows, [1])).toEqual([[1, 'first']]);
    expect(await render(mode, rows, ['01'])).toEqual([[1, 'first']]);
  });

  it('matches numeric strings by value', async () => {
    const rows = [
      [' 7 ', 'padded'],
      ['2.50', 'decimal'],
      ['1e3', 'scientific'],
      [42, 'number'],
    ];
    expect(await render(mode, rows, [7, '2.5', 1000, '42', '42.0'])).toEqual([
      [1, 'padded'],
      [2, 'decimal'],
      [3, 'scientific'],
      [4, 'number'],
      [5, 'number'],
    ]);
  });

  it('matches text exactly and Booleans by canonical string', async () => {
    const rows = [
      ['abc', 'text'],
      [true, 'bool'],
      ['FALSE', 'false-text'],
    ];
    expect(await render(mode, rows, ['abc', 'TRUE', true, false])).toEqual([
      [1, 'text'],
      [2, 'bool'],
      [3, 'bool'],
      [4, 'false-text'],
    ]);
  });

  it('does not match text that only looks similar', async () => {
    const rows = [
      ['abc', 'text'],
      ['1', 'one'],
    ];
    const out = await render(mode, rows, ['ABC', ' abc', 'one', '1x']);
    if (mode === 'lookup') {
      expect(out.map((r) => r[1])).toEqual(['none', 'none', 'none', 'none']);
    } else {
      // Inner join: unmatched primary rows are dropped.
      expect(out).toEqual([]);
    }
  });
});

describe('#129 @join empty keys', () => {
  it('never matches an empty key (ADR-0014)', async () => {
    const rows = [
      ['', 'blank'],
      ['k', 'keyed'],
    ];
    expect(await render('join', rows, ['', '   ', null, 'k'])).toEqual([[4, 'keyed']]);
  });
});

describe('buildEqualityIndex agrees with compareValues', () => {
  const day = new Date(Date.UTC(2026, 0, 15));
  const values: unknown[] = [
    1,
    '1',
    '01',
    ' 1 ',
    '1.0',
    '1e0',
    0,
    -0,
    '0',
    '-0',
    1000,
    '1e3',
    '1,000',
    '0x10',
    16,
    2.5,
    '2.50',
    true,
    false,
    'TRUE',
    'true',
    'FALSE',
    day,
    new Date(day.getTime()),
    new Date(day.getTime() + 500),
    new Date(Date.UTC(2026, 0, 15, 9, 30)),
    '2026-01-15',
    '2026-01-15T09:30:00',
    'abc',
    ' abc',
    'ABC',
    '',
    '   ',
    null,
    undefined,
    'Infinity',
    '1x',
  ];

  // Several row orders: first-match depends on which equal row comes first.
  const orders = [0, 7, 19, 31].map((shift) => [...values.slice(shift), ...values.slice(0, shift)]);
  orders.push([...values].reverse());

  it.each(orders.map((order, i) => [i, order] as const))(
    'row order %i: finds the row a linear scan finds',
    (_i, order) => {
      const rows: Row[] = order.map((v, id) => ({ id, k: v }) as unknown as Row);
      const index = buildEqualityIndex(rows, 'k');
      for (const lookup of values) {
        const expected = rows.find((r) => compareValues(r['k'], lookup) === 0);
        expect(index.find(lookup), `lookup ${String(lookup)} (${typeof lookup})`).toBe(expected);
      }
    },
  );

  it('returns undefined when nothing compares equal', () => {
    const rows: Row[] = [{ k: 'a' }, { k: 2 }] as unknown as Row[];
    const index = buildEqualityIndex(rows, 'k');
    for (const lookup of ['b', 3, true, '', new Date(0)]) {
      expect(index.find(lookup)).toBeUndefined();
    }
  });
});
