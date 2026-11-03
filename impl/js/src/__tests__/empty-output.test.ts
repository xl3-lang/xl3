import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import { convertJson, previewJson } from '../index.js';
import type { OutputFile, Xl3SourceJson } from '../types.js';

// ADR-0080: what an empty block, sheet, and file produce. One rule decides
// all three: what the template names statically renders once; what the
// data names renders only for data that survived the directives.

type Rows = Xl3SourceJson['sources'][string]['rows'];

function source(headers: string[], rows: Rows): Xl3SourceJson {
  return { version: 'xl3-source-json/0.1', sources: { default: { headers, rows } } };
}

async function load(file: OutputFile): Promise<ExcelJS.Workbook> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(
    file.data.buffer.slice(file.data.byteOffset, file.data.byteOffset + file.data.byteLength),
  );
  return workbook;
}

function template(
  pattern: string,
  sheets: Record<string, (string | null)[][]>,
  extra?: (wb: ExcelJS.Workbook) => void,
): ExcelJS.Workbook {
  const wb = new ExcelJS.Workbook();
  wb.addWorksheet('__config__').addRow(['output_file_pattern', pattern]);
  extra?.(wb);
  for (const [name, rows] of Object.entries(sheets)) wb.addWorksheet(name).addRows(rows);
  return wb;
}

async function run(wb: ExcelJS.Workbook, data: Xl3SourceJson) {
  const buffer = await wb.xlsx.writeBuffer();
  const [files, preview] = await Promise.all([
    convertJson(buffer, data),
    previewJson(buffer, data),
  ]);
  const books = await Promise.all(files.map(load));
  return { files, books, preview };
}

const REPORT = [
  ['Customer', 'Amount'],
  ['{{ @filter [Amount] > 1000 }}'],
  ['{{ [Customer] }}', '{{ [Amount] }}'],
  ['Total', '{{ SUM([Amount]) }}'],
];

const DATA = source(
  ['Customer', 'Region', 'Amount'],
  [
    ['Acme', 'Seoul', 100],
    ['Beta', 'Busan', 200],
  ],
);

describe('ADR-0080 empty output', () => {
  it('keeps a static sheet whose only block filters to zero rows', async () => {
    const { files, books, preview } = await run(template('out.xlsx', { Report: REPORT }), DATA);
    expect(files.map((f) => f.filename)).toEqual(['out.xlsx']);
    const sheet = books[0]!.getWorksheet('Report')!;
    expect(sheet.getCell('A1').value).toBe('Customer');
    // Block rows are removed with the N = 0 splice; the footer moves up.
    expect(sheet.getCell('A2').value).toBe('Total');
    expect(sheet.getCell('B2').value).toBe(0);
    expect(preview.files).toEqual([
      { filename: 'out.xlsx', sheets: [{ name: 'Report', rowCount: 0 }] },
    ]);
  });

  it('keeps every static sheet even when each one filters to zero rows', async () => {
    const { books, preview } = await run(
      template('out.xlsx', { Report: REPORT, Notes: [['Static notes']] }),
      DATA,
    );
    expect(books[0]!.worksheets.map((s) => s.name)).toEqual(['Report', 'Notes']);
    expect(preview.files[0]!.sheets.map((s) => s.name)).toEqual(['Report', 'Notes']);
  });

  it('omits a group sheet whose block filters to zero rows', async () => {
    const { books, preview } = await run(
      template('out.xlsx', {
        Summary: [['Summary']],
        '{{Region}}': [['{{ @filter [Amount] > 150 }}'], ['{{ [Customer] }}']],
      }),
      DATA,
    );
    expect(books[0]!.worksheets.map((s) => s.name)).toEqual(['Summary', 'Busan']);
    // A sheet without a data block counts its group's rows.
    expect(preview.files[0]!.sheets).toEqual([
      { name: 'Summary', rowCount: 2 },
      { name: 'Busan', rowCount: 1 },
    ]);
  });

  it('omits a group sheet whose block joins to zero rows', async () => {
    const wb = template(
      'out.xlsx',
      {
        Summary: [['Summary']],
        '{{Region}}': [
          ['{{ @join Customers on Customers[ID] = default[Customer] }}'],
          ['{{ [Customer] }}', '{{ Customers[Name] }}'],
        ],
      },
      (book) =>
        book.addWorksheet('__sources__').addRows([
          ['name', 'sheet'],
          ['Customers', 'Customers'],
        ]),
    );
    const data = source(DATA.sources.default!.headers, DATA.sources.default!.rows);
    data.sources.Customers = { headers: ['ID', 'Name'], rows: [['Beta', 'Beta Works']] };
    const { books, preview } = await run(wb, data);
    expect(books[0]!.worksheets.map((s) => s.name)).toEqual(['Summary', 'Busan']);
    expect(books[0]!.getWorksheet('Busan')!.getCell('B1').value).toBe('Beta Works');
    expect(preview.files[0]!.sheets.map((s) => s.name)).toEqual(['Summary', 'Busan']);
  });

  it('omits a multi-block group sheet only when every block is empty', async () => {
    const sheet = [
      ['{{ @block A3:A3 }}', null, '{{ @block C3:C3 }}'],
      ['{{ @filter [Amount] > 150 }}', null, '{{ @filter [Amount] > 1000 }}'],
      ['{{ [Customer] }}', null, '{{ [Customer] }}'],
    ];
    const { books, preview } = await run(
      template('out.xlsx', { Summary: [['Summary']], '{{Region}}': sheet }),
      DATA,
    );
    // Seoul: both blocks empty -> omitted. Busan: the left block has a row.
    expect(books[0]!.worksheets.map((s) => s.name)).toEqual(['Summary', 'Busan']);
    expect(books[0]!.getWorksheet('Busan')!.getCell('A1').value).toBe('Beta');
    expect(preview.files[0]!.sheets.map((s) => s.name)).toEqual(['Summary', 'Busan']);
  });

  it('emits one file for a static pattern when the source has zero rows', async () => {
    const { files, books, preview } = await run(
      template('out.xlsx', { Report: REPORT }),
      source(['Customer', 'Region', 'Amount'], []),
    );
    expect(files.map((f) => f.filename)).toEqual(['out.xlsx']);
    const sheet = books[0]!.getWorksheet('Report')!;
    expect(sheet.getCell('A1').value).toBe('Customer');
    expect(sheet.getCell('A2').value).toBe('Total');
    expect(sheet.getCell('B2').value).toBe(0);
    expect(preview.files).toEqual([
      { filename: 'out.xlsx', sheets: [{ name: 'Report', rowCount: 0 }] },
    ]);
  });

  it('emits no file for a row-keyed pattern when the source has zero rows', async () => {
    const { files, preview } = await run(
      template('{{Region}}.xlsx', { Report: REPORT }),
      source(['Customer', 'Region', 'Amount'], []),
    );
    expect(files).toEqual([]);
    expect(preview.files).toEqual([]);
  });

  it('skips a file whose sheets are all omitted instead of writing an empty workbook', async () => {
    const { files, preview } = await run(
      template('{{Region}}.xlsx', {
        '{{Customer}}': [['{{ @filter [Amount] > 150 }}'], ['{{ [Customer] }}']],
      }),
      DATA,
    );
    // Seoul's only customer filters out, so Seoul.xlsx would hold no sheet.
    expect(files.map((f) => f.filename)).toEqual(['Busan.xlsx']);
    expect(preview.files.map((f) => f.filename)).toEqual(['Busan.xlsx']);
  });

  it('returns no file when every file group would be empty', async () => {
    const { files, preview } = await run(
      template('out.xlsx', {
        '{{Region}}': [['{{ @filter [Amount] > 1000 }}'], ['{{ [Customer] }}']],
      }),
      DATA,
    );
    expect(files).toEqual([]);
    expect(preview.files).toEqual([]);
  });

  it('leaves a zero-row @repeat right block empty instead of raw template text', async () => {
    const { books, preview } = await run(
      template('out.xlsx', {
        Report: [
          ['Customers'],
          ['{{ @filter [Amount] > 1000 }}'],
          ['{{ @repeat right }}'],
          ['{{ [Customer] }}'],
        ],
      }),
      DATA,
    );
    const sheet = books[0]!.getWorksheet('Report')!;
    expect(sheet.getCell('A1').value).toBe('Customers');
    expect(sheet.getCell('A2').value).toBeNull();
    expect(preview.files[0]!.sheets).toEqual([{ name: 'Report', rowCount: 0 }]);
  });

  it('evaluates source columns as empty in a static file name over zero rows', async () => {
    const { files, preview } = await run(
      template('R_{{ IF(Region = "", "none", Region) }}.xlsx', { Report: REPORT }),
      source(['Customer', 'Region', 'Amount'], []),
    );
    expect(files.map((f) => f.filename)).toEqual(['R_none.xlsx']);
    expect(preview.files.map((f) => f.filename)).toEqual(['R_none.xlsx']);
  });
});

describe('ADR-0080 preview lists the sheets convert produces', () => {
  async function sheetNames(wb: ExcelJS.Workbook, data: Xl3SourceJson) {
    const { books, preview } = await run(wb, data);
    const converted = books.map((book) => book.worksheets.map((s) => s.name));
    const previewed = preview.files.map((f) => f.sheets.map((s) => s.name));
    expect(previewed).toEqual(converted);
    return converted;
  }
  const regions = (values: string[]) =>
    source(
      ['Region', 'Customer'],
      values.map((v, i) => [v, `C${i}`]),
    );

  it('sanitizes group sheet names the same way', async () => {
    const wb = template('out.xlsx', { '{{Region}}': [['{{ [Customer] }}']] });
    expect(await sheetNames(wb, regions(['A/B']))).toEqual([['A_B']]);
  });

  it('skips a group sheet whose name is already taken, ignoring case', async () => {
    const wb = template('out.xlsx', {
      Summary: [['Summary']],
      '{{Region}}': [['{{ [Customer] }}']],
    });
    // `summary` collides with the static sheet; `seoul` with `Seoul`.
    expect(await sheetNames(wb, regions(['Seoul', 'summary', 'seoul']))).toEqual([
      ['Summary', 'Seoul'],
    ]);
  });

  it('does not name a group sheet after a hidden pass-through sheet', async () => {
    const wb = template('out.xlsx', { '{{Region}}': [['{{ [Customer] }}']] }, (book) => {
      book.addWorksheet('Lookup', { state: 'hidden' });
    });
    const { files, preview } = await run(wb, regions(['Lookup']));
    expect(files).toEqual([]);
    expect(preview.files).toEqual([]);
  });
});
