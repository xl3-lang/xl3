import { describe, it, expect } from 'vitest';
import ExcelJS from 'exceljs';
import { convertJson, readInputsSheet } from '../index.js';
import { isXtlError } from '../error-codes.js';

/**
 * Issue #126 — reserved-sheet reads.
 *
 * `__config__[key]` returned an empty string for an undeclared key and,
 * because the lookup did not check own properties, the JavaScript
 * prototype's value for names such as `constructor`. ADR-0056 requires
 * `xl3/expression/unknown-name` for an undeclared key, for `__config__`
 * and `__inputs__` alike, and makes system keys readable.
 */

type Sheets = Record<string, unknown[][]>;

async function render(
  expr: string,
  sheets: Sheets = {},
  extra: {
    sources?: Record<string, { headers: string[]; rows: unknown[][] }>;
    inputs?: Record<string, unknown>;
  } = {},
): Promise<unknown> {
  const template = new ExcelJS.Workbook();
  for (const [name, rows] of Object.entries(sheets)) template.addWorksheet(name).addRows(rows);
  template.addWorksheet('Report').getCell('A1').value = `{{ ${expr} }}`;

  const files = await convertJson(
    (await template.xlsx.writeBuffer()) as ArrayBuffer,
    {
      version: 'xl3-source-json/0.1',
      sources: { default: { headers: ['Name'], rows: [['Alpha']] }, ...extra.sources },
    },
    extra.inputs ? { inputs: extra.inputs } : undefined,
  );
  const output = new ExcelJS.Workbook();
  const data = files[0]!.data;
  await output.xlsx.load(
    data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer,
  );
  return output.getWorksheet('Report')!.getCell('A1').value;
}

async function errorCode(run: Promise<unknown>): Promise<string | undefined> {
  try {
    await run;
  } catch (e) {
    return isXtlError(e) ? e.code : `not an xl3 error: ${String(e)}`;
  }
  return undefined;
}

describe('#126 __config__ / __inputs__ reads', () => {
  const config: Sheets = {
    __config__: [
      ['name', 'Monthly report'],
      ['title', 'Q2 Sales'],
      ['zero', 0],
      ['flag', false],
      ['blank', ''],
      ['constructor', 'declared'],
    ],
  };

  it.each(['missing', 'constructor', 'toString', 'hasOwnProperty', '__proto__', 'valueOf'])(
    'an undeclared key %s raises unknown-name',
    async (key) => {
      expect(await errorCode(render(`__config__[${key}]`))).toBe('xl3/expression/unknown-name');
    },
  );

  it('an undeclared key raises beside declared ones', async () => {
    expect(await errorCode(render('__config__[toString]', config))).toBe(
      'xl3/expression/unknown-name',
    );
    expect(await errorCode(render('__config__[Title]', config))).toBe(
      'xl3/expression/unknown-name',
    );
  });

  it.each([
    ['title', 'Q2 Sales'],
    ['zero', '0'],
    ['flag', 'false'],
    ['constructor', 'declared'],
  ])('a declared key %s resolves to its value', async (key, expected) => {
    expect(await render(`__config__[${key}]`, config)).toBe(expected);
  });

  it('a declared key with an empty value resolves to empty, not an error', async () => {
    expect(await render('"[" & __config__[blank] & "]"', config)).toBe('[]');
  });

  it('system keys are readable (ADR-0056)', async () => {
    expect(await render('__config__[name]', config)).toBe('Monthly report');
    // A system key the template leaves out reads as empty.
    expect(await render('"[" & __config__[description] & "]"', config)).toBe('[]');
    expect(await render('"[" & __config__[match_pattern] & "]"')).toBe('[]');
  });

  const inputs: Sheets = {
    __inputs__: [
      ['name', 'type', 'default'],
      ['period', 'text', '2026-Q2'],
      ['constructor', 'text', 'declared'],
    ],
  };

  it('a declared input resolves to its value', async () => {
    expect(await render('__inputs__[period]', inputs)).toBe('2026-Q2');
    expect(await render('__inputs__[period]', inputs, { inputs: { period: 'H1' } })).toBe('H1');
    expect(await render('__inputs__[constructor]', inputs)).toBe('declared');
  });

  it.each(['missing', 'toString', '__proto__'])(
    'an undeclared input %s raises unknown-name',
    async (key) => {
      expect(await errorCode(render(`__inputs__[${key}]`, inputs))).toBe(
        'xl3/expression/unknown-name',
      );
      expect(await errorCode(render(`__inputs__[${key}]`))).toBe('xl3/expression/unknown-name');
    },
  );

  it('an input default reads __config__ under the same rule', async () => {
    const withDefault = (key: string): Sheets => ({
      ...config,
      __inputs__: [
        ['name', 'type', 'default'],
        ['heading', 'text', `{{ __config__[${key}] }}`],
      ],
    });
    expect(await render('__inputs__[heading]', withDefault('title'))).toBe('Q2 Sales');
    expect(await render('__inputs__[heading]', withDefault('name'))).toBe('Monthly report');
    expect(await errorCode(render('__inputs__[heading]', withDefault('ghost')))).toBe(
      'xl3/expression/unknown-name',
    );
  });

  it('readInputsSheet reads the workbook config unless a key is overridden', async () => {
    const wb = new ExcelJS.Workbook();
    wb.addWorksheet('__config__').addRows([
      ['name', 'Monthly report'],
      ['title', 'Q2'],
    ]);
    wb.addWorksheet('__inputs__').addRows([
      ['name', 'type', 'default'],
      ['x', 'text', '{{ __config__[title] }}'],
      ['y', 'text', '{{ __config__[name] }}'],
    ]);
    const defaults = (specs: { name: string; default?: string }[]) =>
      Object.fromEntries(specs.map((s) => [s.name, s.default]));

    expect(defaults(readInputsSheet(wb))).toEqual({ x: 'Q2', y: 'Monthly report' });
    expect(defaults(readInputsSheet(wb, {}))).toEqual({ x: 'Q2', y: 'Monthly report' });
    expect(defaults(readInputsSheet(wb, { title: 'H1' }))).toEqual({
      x: 'H1',
      y: 'Monthly report',
    });
  });
});
