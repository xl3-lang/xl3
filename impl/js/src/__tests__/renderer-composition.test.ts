import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import { convertJson, previewJson } from '../index.js';
import type { OutputFile, Xl3SourceJson } from '../types.js';

function source(headers: string[], rows: Xl3SourceJson['sources'][string]['rows']): Xl3SourceJson {
  return { version: 'xl3-source-json/0.1', sources: { default: { headers, rows } } };
}

async function load(file: OutputFile): Promise<ExcelJS.Workbook> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(
    file.data.buffer.slice(file.data.byteOffset, file.data.byteOffset + file.data.byteLength),
  );
  return workbook;
}

describe('grouping and block composition', () => {
  it.each(['file', 'sheet'])('keeps distinct composite %s keys separate', async (kind) => {
    const template = new ExcelJS.Workbook();
    const config = template.addWorksheet('__config__');
    config.addRow(['output_file_pattern', kind === 'file' ? '{{A}}-{{B}}.xlsx' : 'out.xlsx']);
    const sheet = template.addWorksheet(kind === 'sheet' ? '{{A}}-{{B}}' : 'Report');
    sheet.addRow(['{{ [Value] }}']);
    const files = await convertJson(
      await template.xlsx.writeBuffer(),
      source(
        ['A', 'B', 'Value'],
        [
          ['x|B=y', 'z', 100],
          ['x', 'y|B=z', 200],
        ],
      ),
    );
    const books = await Promise.all(files.map(load));
    expect(books.flatMap((book) => book.worksheets.map((s) => s.getCell('A1').value))).toEqual([
      100, 200,
    ]);
    expect(
      books.flatMap((book) => book.worksheets).every((s) => s.getCell('A2').value === null),
    ).toBe(true);
    if (kind === 'file')
      expect(files.map((f) => f.filename)).toEqual(['x_B=y-z.xlsx', 'x-y_B=z.xlsx']);
    else expect(books[0]!.worksheets.map((s) => s.name)).toEqual(['x|B=y-z', 'x-y|B=z']);
  });

  it.each([1, 2])(
    'removes an empty %i-row block without deleting its neighbor or side cells',
    async (height) => {
      const template = new ExcelJS.Workbook();
      const sheet = template.addWorksheet('Report');
      sheet.addRow([
        '{{ @block A:B }}',
        '{{ @filter [Amount] > 100 }}',
        null,
        '{{ @block D:E }}',
        '{{ @filter [Amount] > 0 }}',
      ]);
      sheet.addRow(['Left', 'Amount', null, 'Right', 'Amount']);
      for (let r = 3; r < 3 + height; r++) {
        sheet.getCell(`A${r}`).value = '{{ [Amount] }}';
        sheet.getCell(`B${r}`).value = '{{ [Amount] }}';
      }
      sheet.getCell('D3').value = '{{ [Amount] }}';
      sheet.getCell('E3').value = '{{ [Amount] }}';
      sheet.getCell('G3').value = 'SIDE';
      sheet.getCell('G3').font = { bold: true };
      sheet.mergeCells('G3:H3');
      sheet.getCell('G4').value = { formula: '1+2', result: 3 };
      sheet.getCell(`A${3 + height}`).value = 'LEFT FOOTER';
      sheet.mergeCells(`A${3 + height}:B${3 + height}`);
      sheet.getCell('D4').value = 'RIGHT FOOTER';

      const [file] = await convertJson(
        await template.xlsx.writeBuffer(),
        source(['Amount'], [[10], [20]]),
      );
      const output = (await load(file!)).getWorksheet('Report')!;
      expect(output.getCell('A2').value).toBe('LEFT FOOTER');
      expect(output.getCell('A3').value).toBeNull();
      expect(output.getCell('D2').value).toBe(10);
      expect(output.getCell('D3').value).toBe(20);
      expect(output.getCell('D4').value).toBe('RIGHT FOOTER');
      expect(output.getCell('G2').value).toBe('SIDE');
      expect(output.getCell('G2').font.bold).toBe(true);
      expect(output.getCell('G3').value).toEqual({ formula: '1+2', result: 3 });
      expect(output.model.merges).toEqual(expect.arrayContaining(['A2:B2', 'G2:H2']));
    },
  );

  it('shifts a later block by the expanded row count of a multi-row block', async () => {
    const template = new ExcelJS.Workbook();
    const sheet = template.addWorksheet('Report');
    sheet.addRows([
      ['{{ @block A2:B3 }}'],
      ['{{ [Value] }}', 'first'],
      ['{{ [Value] }}', 'second'],
      [],
      ['{{ @block A6:B6 }}'],
      ['{{ [Value] }}', 'last'],
    ]);
    const [file] = await convertJson(
      await template.xlsx.writeBuffer(),
      source(['Value'], [[10], [20]]),
    );
    const output = (await load(file!)).getWorksheet('Report')!;
    expect(
      Array.from({ length: 7 }, (_, i) => [
        output.getCell(`A${i + 1}`).value,
        output.getCell(`B${i + 1}`).value,
      ]),
    ).toEqual([
      [10, 'first'],
      [10, 'second'],
      [20, 'first'],
      [20, 'second'],
      [null, null],
      [10, 'last'],
      [20, 'last'],
    ]);
  });

  it('preserves merges owned by columns outside an empty block', async () => {
    const template = new ExcelJS.Workbook();
    const sheet = template.addWorksheet('Report');
    sheet.getCell('B1').value = '{{ @block B3:C3 }}';
    sheet.getCell('C1').value = '{{ @filter [Amount] > 100 }}';
    sheet.getCell('E1').value = '{{ @block E3:F3 }}';
    sheet.getCell('F1').value = '{{ @filter [Amount] > 0 }}';
    sheet.getCell('C3').value = '{{ [Amount] }}';
    sheet.getCell('E3').value = '{{ [Amount] }}';
    for (const row of [3, 5]) {
      sheet.mergeCells(`A${row}:B${row}`);
      sheet.getCell(`A${row}`).value = `SIDE ${row}`;
      sheet.getCell(`A${row}`).font = { bold: true };
    }
    sheet.getCell('C4').value = 'FOOTER';
    const [file] = await convertJson(
      await template.xlsx.writeBuffer(),
      source(['Amount'], [[10], [20]]),
    );
    const output = (await load(file!)).getWorksheet('Report')!;
    expect(output.getCell('A2').value).toBe('SIDE 3');
    expect(output.getCell('A4').value).toBe('SIDE 5');
    expect(output.getCell('A2').font.bold).toBe(true);
    expect(output.getCell('A4').font.bold).toBe(true);
    expect(output.getCell('B3').value).toBeNull();
    expect(output.getCell('C2').value).toBe('FOOTER');
    expect(output.model.merges).toEqual(expect.arrayContaining(['A2:B2', 'A4:B4']));
  });

  it.each(['value', 'style', 'merge'])(
    'rejects shifting a footer into a preserved outside merge: %s',
    async (kind) => {
      const template = new ExcelJS.Workbook();
      const sheet = template.addWorksheet('Report');
      sheet.getCell('B1').value = '{{ @block B3:C3 }}';
      sheet.getCell('C1').value = '{{ @filter [Amount] > 100 }}';
      sheet.getCell('E1').value = '{{ @block E3:F3 }}';
      sheet.getCell('F1').value = '{{ @filter [Amount] > 0 }}';
      sheet.getCell('C3').value = '{{ [Amount] }}';
      sheet.getCell('E3').value = '{{ [Amount] }}';
      sheet.mergeCells('A3:B3');
      sheet.getCell('A3').value = 'SIDE';
      if (kind === 'value') sheet.getCell('B4').value = 'FOOTER';
      else if (kind === 'style') sheet.getCell('B4').font = { bold: true };
      else sheet.mergeCells('B4:C4');
      await expect(
        convertJson(await template.xlsx.writeBuffer(), source(['Amount'], [[10]])),
      ).rejects.toMatchObject({ code: 'xl3/block/overlap' });
    },
  );

  it.each(['value', 'style', 'inherited style'])(
    'checks outside merge restoration against expanded %s',
    async (kind) => {
      const template = new ExcelJS.Workbook();
      const sheet = template.addWorksheet('Report');
      sheet.addRow([
        '{{ @block A3:B3 }}',
        '{{ @filter [Amount] > 20 }}',
        null,
        '{{ @block D3:E3 }}',
        '{{ @filter [Amount] > 0 }}',
      ]);
      sheet.getCell('A3').value = '{{ [Amount] }}';
      if (kind === 'value') sheet.getCell('D3').value = '{{ [Amount] }}';
      else if (kind === 'style') sheet.getCell('D3').font = { italic: true };
      else sheet.getColumn('D').font = { italic: true };
      sheet.getCell('E3').value = '{{ [Amount] }}';
      sheet.mergeCells('A5:D5');
      sheet.getCell('A5').value = 'FOOTER';
      const conversion = convertJson(
        await template.xlsx.writeBuffer(),
        source(['Amount'], [[10], [20], [30]]),
      );
      if (kind === 'inherited style') {
        const [file] = await conversion;
        const output = (await load(file!)).getWorksheet('Report')!;
        expect(output.model.merges).toEqual(['A4:D4']);
        expect(output.getCell('A4').value).toBe('FOOTER');
        expect([2, 3, 4].map((row) => output.getCell(`E${row}`).value)).toEqual([10, 20, 30]);
      } else {
        await expect(conversion).rejects.toMatchObject({ code: 'xl3/block/overlap' });
      }
    },
  );

  it('reports a domain error when an expanded footer merge meets an outside merge', async () => {
    const template = new ExcelJS.Workbook();
    const sheet = template.addWorksheet('Report');
    sheet.getCell('B1').value = '{{ [Name] }}';
    sheet.getCell('C1').value = '{{ [Amount] }}';
    sheet.mergeCells('B3:E3');
    sheet.getCell('B3').value = 'TOTAL';
    sheet.mergeCells('D5:E5');
    sheet.getCell('D5').value = 'SIDE';
    await expect(
      convertJson(
        await template.xlsx.writeBuffer(),
        source(
          ['Name', 'Amount'],
          [
            ['A', 10],
            ['B', 20],
            ['C', 30],
          ],
        ),
      ),
    ).rejects.toMatchObject({ code: 'xl3/block/overlap' });
  });

  it('evaluates static footers before empty blocks shift them', async () => {
    const template = new ExcelJS.Workbook();
    const sheet = template.addWorksheet('Report');
    sheet.addRow([
      '{{ @block A3:B3 }}',
      '{{ @filter [Amount] > 100 }}',
      null,
      '{{ @block D3:E3 }}',
      '{{ @filter [Amount] > 0 }}',
    ]);
    sheet.getCell('A3').value = '{{ [Amount] }}';
    sheet.getCell('D3').value = '{{ [Amount] }}';
    sheet.getCell('A4').value = 'Total {{ SUM(default[Amount]) }}';
    const [file] = await convertJson(
      await template.xlsx.writeBuffer(),
      source(['Amount'], [[10], [20]]),
    );
    const output = (await load(file!)).getWorksheet('Report')!;
    expect(output.getCell('A2').value).toBe('Total 30');
    expect(output.getCell('D2').value).toBe(10);
    expect(output.getCell('D3').value).toBe(20);
  });

  it('evaluates cross-boundary merged aggregates in their owning block context', async () => {
    const template = new ExcelJS.Workbook();
    const sheet = template.addWorksheet('Report');
    sheet.addRow([
      '{{ @block A3:B4 }}',
      '{{ @filter [Amount] < 20 }}',
      null,
      null,
      '{{ @block E3:F3 }}',
      '{{ @filter [Amount] > 10 }}',
    ]);
    sheet.mergeCells('A3:C3');
    sheet.getCell('A3').value = '{{ SUM([Amount]) }}';
    sheet.getCell('B4').value = '{{ [Amount] }}';
    sheet.getCell('E3').value = '{{ [Amount] }}';
    const [file] = await convertJson(
      await template.xlsx.writeBuffer(),
      source(['Amount'], [[10], [20]]),
    );
    const output = (await load(file!)).getWorksheet('Report')!;
    expect(output.getCell('A2').value).toBe(10);
    expect(output.getCell('B3').value).toBe(10);
    expect(output.getCell('E2').value).toBe(20);
    expect(output.model.merges).toEqual(['A2:C2']);
  });

  it.each(['value', 'merge', 'style'])(
    'rejects a moved merge that would overwrite neighboring %s',
    async (kind) => {
      const template = new ExcelJS.Workbook();
      const sheet = template.addWorksheet('Report');
      sheet.addRow([
        '{{ @block A3:B3 }}',
        '{{ @filter [Amount] > 100 }}',
        null,
        '{{ @block D3:E3 }}',
        '{{ @filter [Amount] > 0 }}',
      ]);
      sheet.getCell('A3').value = '{{ [Amount] }}';
      sheet.getCell('D3').value = '{{ [Amount] }}';
      if (kind === 'style') sheet.getCell('D4').font = { italic: true };
      else sheet.getCell('D4').value = 'NEIGHBOR';
      if (kind === 'merge') sheet.mergeCells('D4:E4');
      sheet.mergeCells('A5:E5');
      sheet.getCell('A5').value = 'FOOTER';
      await expect(
        convertJson(await template.xlsx.writeBuffer(), source(['Amount'], [[10]])),
      ).rejects.toMatchObject({ code: 'xl3/block/overlap' });
    },
  );

  it('keeps outside merges in place when a grouped block expands', async () => {
    const template = new ExcelJS.Workbook();
    const sheet = template.addWorksheet('Report');
    sheet.addRows([
      ['{{ @group [Category] }}'],
      ['{{ [Category] }}', '{{ [Amount] }}'],
      ['Subtotal', '{{ @subtotal SUM([Amount]) }}'],
    ]);
    sheet.mergeCells('D4:E5');
    sheet.getCell('D4').value = 'SIDE';
    sheet.getCell('D4').font = { italic: true };
    const [file] = await convertJson(
      await template.xlsx.writeBuffer(),
      source(
        ['Category', 'Amount'],
        [
          ['A', 10],
          ['A', 20],
          ['B', 30],
        ],
      ),
    );
    const output = (await load(file!)).getWorksheet('Report')!;
    expect(output.model.merges).toEqual(['D3:E4']);
    expect(output.getCell('D3').value).toBe('SIDE');
    expect(output.getCell('D3').font.italic).toBe(true);
    expect(output.getCell('D6').value).toBeNull();
    expect(output.getCell('B3').value).toBe(30);
    expect(output.getCell('B5').value).toBe(30);
  });

  it('renders static side cells once without re-evaluating marker-shaped source values', async () => {
    const template = new ExcelJS.Workbook();
    const sheet = template.addWorksheet('Report');
    sheet.addRows([
      ['{{ @block A2:A2 }}', null, '{{ @block C2:C2 }}'],
      ['{{ [Value] }}', null, '{{ [Amount] }}', 'Total {{ SUM(default[Amount]) }}'],
    ]);
    const [file] = await convertJson(
      await template.xlsx.writeBuffer(),
      source(
        ['Value', 'Amount'],
        [
          ['{{ 1 + 1 }}', 10],
          ['{{ 2 + 2 }}', 20],
        ],
      ),
    );
    const output = (await load(file!)).getWorksheet('Report')!;
    expect(output.getCell('A1').value).toBe('{{ 1 + 1 }}');
    expect(output.getCell('A2').value).toBe('{{ 2 + 2 }}');
    expect(output.getCell('D1').value).toBe('Total 30');
  });

  it.each(['Report', '{{Region}}'])(
    'uses the active source to retain and preview %s',
    async (name) => {
      const template = new ExcelJS.Workbook();
      template.addWorksheet('__sources__').addRows([
        ['name', 'sheet'],
        ['Orders', 'Orders'],
      ]);
      template
        .addWorksheet(name)
        .addRows([['{{ @source Orders }}'], ['{{ @filter [Amount] > 0 }}'], ['{{ [Amount] }}']]);
      const data = source(['Region'], [['Seoul']]);
      data.sources.Orders = { headers: ['Amount'], rows: [[10], [20], [-1]] };
      const buffer = await template.xlsx.writeBuffer();
      const preview = await previewJson(buffer, data);
      const [file] = await convertJson(buffer, data);
      const output = await load(file!);
      expect(output.worksheets).toHaveLength(1);
      expect(output.worksheets[0]!.getCell('A1').value).toBe(10);
      expect(output.worksheets[0]!.getCell('A2').value).toBe(20);
      expect(preview.files[0]!.sheets).toEqual([
        { name: name === 'Report' ? name : 'Seoul', rowCount: 2 },
      ]);
    },
  );

  it.each([false, true])('applies top after the join (explicit block: %s)', async (explicit) => {
    const template = new ExcelJS.Workbook();
    template.addWorksheet('__sources__').addRows([
      ['name', 'sheet'],
      ['Customers', 'Customers'],
    ]);
    const sheet = template.addWorksheet('Report');
    if (explicit) sheet.addRow(['{{ @block A4:B4 }}']);
    sheet.addRows([
      ['{{ @join Customers on Customers[ID] = default[CustomerID] }}'],
      ['{{ @top 1 }}'],
      ['{{ [CustomerID] }}', '{{ Customers[Name] }}'],
    ]);
    // Two blocks exercise the separate block renderer as well as the legacy path.
    if (explicit) {
      sheet.getCell('D1').value = '{{ @block D4:D4 }}';
      sheet.getCell('D4').value = '{{ [CustomerID] }}';
    }
    const data = source(['CustomerID'], [['missing'], ['c1'], ['c2']]);
    data.sources.Customers = {
      headers: ['ID', 'Name'],
      rows: [
        ['c1', 'Alice'],
        ['c2', 'Bob'],
      ],
    };
    const [file] = await convertJson(await template.xlsx.writeBuffer(), data);
    const output = (await load(file!)).getWorksheet('Report')!;
    expect(output.getCell('A1').value).toBe('c1');
    expect(output.getCell('B1').value).toBe('Alice');
    expect(output.getCell('A2').value).toBeNull();
  });

  it.each([
    ['Report', 'Report'],
    ['{{Region}}', 'Seoul'],
  ])(
    'previews joined row counts while retaining an unmatched sheet: %s',
    async (templateName, outputName) => {
      const template = new ExcelJS.Workbook();
      template.addWorksheet('__sources__').addRows([
        ['name', 'sheet'],
        ['Customers', 'Customers'],
      ]);
      template
        .addWorksheet(templateName!)
        .addRows([
          ['{{ @join Customers on Customers[ID] = default[ID] }}'],
          ['{{ @top 2 }}'],
          ['ID'],
          ['{{ [ID] }}'],
        ]);
      const data = source(
        ['ID', 'Region'],
        [
          ['missing', 'Seoul'],
          ['c1', 'Seoul'],
        ],
      );
      const buffer = await template.xlsx.writeBuffer();
      for (const rows of [[['c1']], []]) {
        data.sources.Customers = { headers: ['ID'], rows };
        const preview = await previewJson(buffer, data);
        const [file] = await convertJson(buffer, data);
        const output = (await load(file!)).getWorksheet(outputName!)!;
        expect(output.getCell('A1').value).toBe('ID');
        expect(output.getCell('A2').value).toBe(rows.length ? 'c1' : null);
        expect(preview.files[0]!.sheets).toEqual([{ name: outputName, rowCount: rows.length }]);
      }
    },
  );

  it('copies preservation metadata independently to each grouped sheet', async () => {
    const template = new ExcelJS.Workbook();
    const sheet = template.addWorksheet('{{Region}}');
    sheet.addRow(['{{ [Amount] }}']);
    sheet.getCell('A1').note = 'Keep this comment';
    sheet.getCell('A1').dataValidation = { type: 'whole', operator: 'greaterThan', formulae: [0] };
    sheet.addConditionalFormatting({
      ref: 'A1',
      rules: [
        {
          type: 'cellIs',
          operator: 'greaterThan',
          formulae: ['0'],
          priority: 1,
          style: { font: { bold: true } },
        },
      ],
    });
    await sheet.protect('password', { spinCount: 1 });
    const [file] = await convertJson(
      await template.xlsx.writeBuffer(),
      source(
        ['Region', 'Amount'],
        [
          ['Seoul', 10],
          ['Seoul', 20],
          ['Busan', 30],
        ],
      ),
    );
    const output = await load(file!);
    for (const [name, endRow] of [
      ['Seoul', 2],
      ['Busan', 1],
    ] as const) {
      const result = output.getWorksheet(name)!;
      const model = result.model as unknown as {
        conditionalFormattings: { ref: string }[];
        sheetProtection: { sheet: boolean; hashValue: string };
      };
      expect(model.conditionalFormattings.map((cf) => cf.ref)).toEqual([
        endRow === 1 ? 'A1' : `A1:A${endRow}`,
      ]);
      expect(result.getCell('A1').note).toBe('Keep this comment');
      expect(model.sheetProtection.sheet).toBe(true);
      expect(model.sheetProtection.hashValue).toBeTruthy();
      for (let r = 1; r <= endRow; r++)
        expect(result.getCell(`A${r}`).dataValidation).toMatchObject({
          type: 'whole',
          formulae: [0],
        });
      expect(result.getCell(`A${endRow + 1}`).dataValidation).toBeUndefined();
    }
  });
});
