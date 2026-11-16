import { describe, it, expect } from 'vitest';
import ExcelJS from 'exceljs';
import { convertJson } from '../index.js';
import { isXtlError } from '../error-codes.js';

/**
 * Issues #132 / #135 — `@filter` predicates that silently changed which
 * rows were rendered.
 *
 * #132: an operator outside the grammar (`==`, `=>`, `><`, `!`, `<>`) was
 * accepted by the parser and treated as always-true at render time, so a
 * template that looked filtered emitted every row.
 *
 * #135: `in` / `!in` compared `String(value)` against `String(cell)`, not
 * canonical strings, so a Boolean `true` never matched a list entry `TRUE`.
 */

type Cell = ExcelJS.CellValue;

async function render(
  rows: Cell[][],
  source: { headers: string[]; rows: unknown[][] },
  lists?: Cell[][],
): Promise<unknown[]> {
  const template = new ExcelJS.Workbook();
  if (lists) template.addWorksheet('__lists__').addRows(lists);
  template.addWorksheet('Report').addRows(rows);

  const files = await convertJson((await template.xlsx.writeBuffer()) as ArrayBuffer, {
    version: 'xl3-source-json/0.1',
    sources: { default: source },
  });
  const output = new ExcelJS.Workbook();
  const data = files[0]!.data;
  await output.xlsx.load(
    data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer,
  );
  const out: unknown[] = [];
  output.getWorksheet('Report')!.eachRow((row) => out.push(row.getCell(1).value));
  return out;
}

async function errorCode(run: Promise<unknown>): Promise<string | undefined> {
  try {
    await run;
  } catch (e) {
    return isXtlError(e) ? e.code : `not an xl3 error: ${String(e)}`;
  }
  return undefined;
}

describe('#132 @filter operators', () => {
  const amounts = { headers: ['Amount'], rows: [[1], [2], [3]] };
  const filtered = (op: string) =>
    render([[`{{ @filter [Amount] ${op} 2 }}`], ['{{ [Amount] }}']], amounts);

  it.each([
    ['=', [2]],
    ['!=', [1, 3]],
    ['>', [3]],
    ['<', [1]],
    ['>=', [2, 3]],
    ['<=', [1, 2]],
  ])('%s keeps the matching rows', async (op, expected) => {
    expect(await filtered(op)).toEqual(expected);
  });

  it.each(['==', '=>', '=<', '><', '<>', '!', '!!', '=!', '>>', '<<'])(
    '%s is rejected as invalid syntax',
    async (op) => {
      expect(await errorCode(filtered(op))).toBe('xl3/directive/invalid-syntax');
    },
  );
});

describe('#135 @filter list membership', () => {
  const flags: { headers: string[]; rows: unknown[][] } = {
    headers: ['Flag'],
    rows: [[true], [false]],
  };
  const member = (op: 'in' | '!in', listValue: Cell, source = flags) =>
    render([[`{{ @filter [Flag] ${op} __lists__[Allowed] }}`], ['{{ [Flag] }}']], source, [
      ['Allowed'],
      [listValue],
    ]);

  it.each([
    ['the string TRUE', 'TRUE'],
    ['the Boolean true', true],
  ])('a Boolean row value matches %s', async (_label, listValue) => {
    expect(await member('in', listValue)).toEqual([true]);
    expect(await member('!in', listValue)).toEqual([false]);
  });

  it('a string row value matches a Boolean list cell', async () => {
    const source = { headers: ['Flag'], rows: [['TRUE'], ['FALSE'], ['true']] };
    expect(await member('in', false, source)).toEqual(['FALSE']);
    expect(await member('!in', false, source)).toEqual(['TRUE', 'true']);
  });

  it('a number row value matches a numeric list cell and its text form', async () => {
    const source = { headers: ['Flag'], rows: [[1], [2.5], [3]] };
    expect(await member('in', 2.5, source)).toEqual([2.5]);
    expect(await member('in', '2.5', source)).toEqual([2.5]);
    expect(await member('!in', 1, source)).toEqual([2.5, 3]);
  });

  it('a date list cell matches its canonical date string', async () => {
    const source = { headers: ['Flag'], rows: [['2026-01-15'], ['2026-01-16']] };
    const day = new Date(Date.UTC(2026, 0, 15));
    expect(await member('in', day, source)).toEqual(['2026-01-15']);
    expect(await member('!in', day, source)).toEqual(['2026-01-16']);
  });

  it('a rich-text list cell matches its text', async () => {
    const source = { headers: ['Flag'], rows: [['open'], ['closed']] };
    const rich = { richText: [{ text: 'op' }, { text: 'en' }] };
    expect(await member('in', rich, source)).toEqual(['open']);
  });

  it('keeps the empty-value rule: never in, always !in', async () => {
    const source = {
      headers: ['Flag', 'Id'],
      rows: [
        ['', 1],
        ['   ', 2],
        [null, 3],
        ['x', 4],
      ],
    };
    const ids = (op: 'in' | '!in') =>
      render([[`{{ @filter [Flag] ${op} __lists__[Allowed] }}`], ['{{ [Id] }}']], source, [
        ['Allowed'],
        ['x'],
      ]);
    expect(await ids('in')).toEqual([4]);
    expect(await ids('!in')).toEqual([1, 2, 3]);
  });

  it('trims list entries and skips blank ones', async () => {
    const source = { headers: ['Flag'], rows: [['open'], ['closed'], ['']] };
    const out = await render(
      [['{{ @filter [Flag] in __lists__[Allowed] }}'], ['{{ [Flag] }}']],
      source,
      [['Allowed'], ['  open  '], ['   '], [null], ['closed']],
    );
    expect(out).toEqual(['open', 'closed']);
  });

  // A template written by a library (ExcelJS, openpyxl) can carry a formula
  // with no cached result. Its value is unknowable, which matters only to a
  // filter that uses that list.
  describe('a formula cell in __lists__', () => {
    const source = { headers: ['Flag'], rows: [['open'], ['closed']] };
    const template = (list: string): Cell[][] => [
      [`{{ @filter [Flag] in __lists__[${list}] }}`],
      ['{{ [Flag] }}'],
    ];
    const uncached = { formula: 'A2&"x"' } as Cell;

    it('uses the cached result', async () => {
      const lists = [['Allowed'], [{ formula: '"op"&"en"', result: 'open' }]];
      expect(await render(template('Allowed'), source, lists)).toEqual(['open']);
    });

    it('does not fail a template that never uses the list', async () => {
      const lists = [
        ['Allowed', 'Helper'],
        ['open', uncached],
      ];
      expect(await render(template('Allowed'), source, lists)).toEqual(['open']);
    });

    it('fails a filter that uses the list, naming the cell', async () => {
      const lists = [
        ['Allowed', 'Helper'],
        ['open', uncached],
      ];
      let error: unknown;
      try {
        await render(template('Helper'), source, lists);
      } catch (e) {
        error = e;
      }
      expect(isXtlError(error) && error.code).toBe('xl3/cell/formula-no-cache');
      expect((error as Error).message).toContain('__lists__ cell B2 (list "Helper")');
    });
  });
});
