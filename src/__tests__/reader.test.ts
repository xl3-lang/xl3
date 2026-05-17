import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import { readSource } from '../reader.js';

async function workbookBuffer(): Promise<ArrayBuffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Raw');

  sheet.getCell('A1').value = 'ignored';
  sheet.getCell('B3').value = 'Customer';
  sheet.getCell('C3').value = 'Amount';
  sheet.getCell('D3').value = 'Region';
  sheet.getCell('E3').value = 'ignored';

  sheet.getCell('B4').value = 'Acme';
  sheet.getCell('C4').value = 1200;
  sheet.getCell('D4').value = 'Seoul';
  sheet.getCell('E4').value = 'outside';

  sheet.getCell('B5').value = 'Beta';
  sheet.getCell('C5').value = 350;
  sheet.getCell('D5').value = 'Busan';

  const data = await workbook.xlsx.writeBuffer();
  return data as ArrayBuffer;
}

describe('readSource', () => {
  it('uses source_table as the table start and column window', async () => {
    const source = await readSource(await workbookBuffer(), 'Raw', { sourceTable: 'B3:D' });

    expect(source.headers).toEqual(['Customer', 'Amount', 'Region']);
    expect(source.rows).toEqual([
      { Customer: 'Acme', Amount: 1200, Region: 'Seoul' },
      { Customer: 'Beta', Amount: 350, Region: 'Busan' },
    ]);
  });

  it('accepts a source_table row shorthand', async () => {
    const source = await readSource(await workbookBuffer(), 'Raw', { sourceTable: '3' });

    expect(source.headers).toEqual(['Customer', 'Amount', 'Region', 'ignored']);
    expect(source.rows[0]).toEqual({
      Customer: 'Acme',
      Amount: 1200,
      Region: 'Seoul',
      ignored: 'outside',
    });
  });

  it('uses a finite source_table range when an end row is present', async () => {
    const source = await readSource(await workbookBuffer(), 'Raw', { sourceTable: 'B3:D4' });

    expect(source.rows).toEqual([
      { Customer: 'Acme', Amount: 1200, Region: 'Seoul' },
    ]);
  });

  it('treats an explicit source_table end row as a hard boundary', async () => {
    const source = await readSource(await workbookBuffer(), 'Raw', { sourceTable: 'B3:D3' });

    expect(source.headers).toEqual(['Customer', 'Amount', 'Region']);
    expect(source.rows).toEqual([]);
  });

  it('rejects empty headers inside the source_table span', async () => {
    await expect(readSource(await workbookBuffer(), 'Raw', { sourceTable: 'B3:F' }))
      .rejects.toThrow('source_table header cell F3 is empty');
  });

  it('rejects duplicate source_table headers', async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Raw');
    sheet.getCell('A1').value = 'Customer';
    sheet.getCell('B1').value = 'Customer';
    const data = await workbook.xlsx.writeBuffer();

    await expect(readSource(data as ArrayBuffer, 'Raw', { sourceTable: 'A1:B' }))
      .rejects.toThrow('source_table has duplicate header "Customer"');
  });

  it('rejects zero-based source_table row shorthand', async () => {
    await expect(readSource(await workbookBuffer(), 'Raw', { sourceTable: '0' }))
      .rejects.toThrow('source_table row numbers must be 1-based positive integers: 0');
  });

  it('rejects zero-based source_table range rows', async () => {
    await expect(readSource(await workbookBuffer(), 'Raw', { sourceTable: 'A0:D' }))
      .rejects.toThrow('source_table row numbers must be 1-based positive integers: A0:D');
  });

  it('rejects formula source_table column names without cached results', async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Raw');
    sheet.getCell('A1').value = { formula: '"Customer"' };
    sheet.getCell('A2').value = 'Acme';
    const data = await workbook.xlsx.writeBuffer();

    await expect(readSource(data as ArrayBuffer, 'Raw', { sourceTable: 'A1:A' }))
      .rejects.toThrow('Formula cell A1 has no cached result');
  });

  it('reads rich-text source_table headers', async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Raw');
    sheet.getCell('B3').value = { richText: [{ text: 'Cus' }, { text: 'tomer' }] };
    sheet.getCell('C3').value = 'Amount';
    sheet.getCell('D3').value = 'Region';
    sheet.getCell('B4').value = 'Acme';
    sheet.getCell('C4').value = 10;
    sheet.getCell('D4').value = 'Seoul';
    const data = await workbook.xlsx.writeBuffer();

    const source = await readSource(data as ArrayBuffer, 'Raw', { sourceTable: 'B3:D' });
    expect(source.headers).toEqual(['Customer', 'Amount', 'Region']);
    expect(source.rows).toEqual([{ Customer: 'Acme', Amount: 10, Region: 'Seoul' }]);
  });

  it('reads formula source_table headers from cached results', async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Raw');
    sheet.getCell('B3').value = { formula: '"Customer"', result: 'Customer' };
    sheet.getCell('C3').value = 'Amount';
    sheet.getCell('D3').value = 'Region';
    sheet.getCell('B4').value = 'Acme';
    sheet.getCell('C4').value = 10;
    sheet.getCell('D4').value = 'Seoul';
    const data = await workbook.xlsx.writeBuffer();

    const source = await readSource(data as ArrayBuffer, 'Raw', { sourceTable: 'B3:D' });
    expect(source.headers).toEqual(['Customer', 'Amount', 'Region']);
    expect(source.rows).toEqual([{ Customer: 'Acme', Amount: 10, Region: 'Seoul' }]);
  });

  it('treats horizontally-merged headers as one column at the master', async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Raw');
    // Row 1: J1:M1 merged = "품목", N1 = "수량", O1 = "단가"
    sheet.getCell('J1').value = '품목';
    sheet.mergeCells('J1:M1');
    sheet.getCell('N1').value = '수량';
    sheet.getCell('O1').value = '단가';

    sheet.getCell('J2').value = '노트북';
    sheet.getCell('N2').value = 2;
    sheet.getCell('O2').value = 1500000;

    sheet.getCell('J3').value = '마우스';
    sheet.getCell('N3').value = 5;
    sheet.getCell('O3').value = 25000;

    const data = await workbook.xlsx.writeBuffer();

    const source = await readSource(data as ArrayBuffer, 'Raw', { sourceTable: 'J1:O' });
    expect(source.headers).toEqual(['품목', '수량', '단가']);
    expect(source.rows).toEqual([
      { 품목: '노트북', 수량: 2, 단가: 1500000 },
      { 품목: '마우스', 수량: 5, 단가: 25000 },
    ]);
  });

  it('infers a table around a horizontally-merged header (row shorthand)', async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Raw');
    sheet.getCell('B1').value = '품목';
    sheet.mergeCells('B1:D1');
    sheet.getCell('E1').value = '수량';

    sheet.getCell('B2').value = '노트북';
    sheet.getCell('E2').value = 2;

    const data = await workbook.xlsx.writeBuffer();

    const source = await readSource(data as ArrayBuffer, 'Raw', { sourceTable: '1' });
    expect(source.headers).toEqual(['품목', '수량']);
    expect(source.rows).toEqual([{ 품목: '노트북', 수량: 2 }]);
  });

  it('does not treat vertically-merged single-column headers as duplicates', async () => {
    // Two-row header band where each column is vertically merged across rows 1-2.
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Raw');
    sheet.getCell('A1').value = '품목';
    sheet.mergeCells('A1:A2');
    sheet.getCell('B1').value = '수량';
    sheet.mergeCells('B1:B2');

    sheet.getCell('A3').value = '노트북';
    sheet.getCell('B3').value = 2;

    const data = await workbook.xlsx.writeBuffer();

    // Header row = 2 (the second row of each vertical merge); slaves of vertically
    // merged headers return the master's text — column count is unchanged.
    const source = await readSource(data as ArrayBuffer, 'Raw', { sourceTable: 'A2:B' });
    expect(source.headers).toEqual(['품목', '수량']);
    expect(source.rows).toEqual([{ 품목: '노트북', 수량: 2 }]);
  });

  it('handles 2D merge header at the slave row (vertical-direction slave reads master)', async () => {
    // Recommended pattern for multi-row header bands per ADR-0033 amendment:
    // pick the LAST row of the band as the header row. Vertical-direction
    // slaves read the master's text; horizontal-direction slaves are
    // transparent. The first data row is then immediately below the band.
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Raw');
    sheet.getCell('J11').value = '품목';
    sheet.mergeCells('J11:M12');
    sheet.getCell('N11').value = '수량';
    sheet.mergeCells('N11:N12');
    sheet.getCell('J13').value = '노트북';
    sheet.getCell('N13').value = 5;

    const data = await workbook.xlsx.writeBuffer();
    const source = await readSource(data as ArrayBuffer, 'Raw', { sourceTable: 'J12:N' });
    expect(source.headers).toEqual(['품목', '수량']);
    expect(source.rows).toEqual([{ 품목: '노트북', 수량: 5 }]);
  });

  it('picking the master row of a 2D merge band yields a phantom data row at the slave row', async () => {
    // Documented gotcha per ADR-0033 amendment: if the user picks the master
    // row of a 2D merge band as `source_table`, the slave rows of that band
    // are read as data rows carrying the merge master's value. Authors of
    // multi-row header bands SHOULD use the band's LAST row instead.
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Raw');
    sheet.getCell('J11').value = '품목';
    sheet.mergeCells('J11:M12');
    sheet.getCell('N11').value = '수량';
    sheet.mergeCells('N11:N12');
    sheet.getCell('J13').value = '노트북';
    sheet.getCell('N13').value = 5;

    const data = await workbook.xlsx.writeBuffer();
    const source = await readSource(data as ArrayBuffer, 'Raw', { sourceTable: 'J11:N' });
    expect(source.headers).toEqual(['품목', '수량']);
    expect(source.rows).toEqual([
      { 품목: '품목', 수량: '수량' },     // phantom row 12 from the merge band
      { 품목: '노트북', 수량: 5 },
    ]);
  });

  it('errors when the source_table range starts inside a merged header (no master in window)', async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Raw');
    // J1:M1 merged at J1 = "품목", but window starts at K1 (slave-only)
    sheet.getCell('J1').value = '품목';
    sheet.mergeCells('J1:M1');

    const data = await workbook.xlsx.writeBuffer();

    await expect(readSource(data as ArrayBuffer, 'Raw', { sourceTable: 'K1:M' }))
      .rejects.toThrow(/source_table row 1 resolves to no headers.*merged header/);
  });

  it('broadcasts merged data-row master values to slave rows (ADR-0035 vertical)', async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Data');
    sheet.getCell('A1').value = 'Customer';
    sheet.getCell('B1').value = 'Amount';
    sheet.getCell('A2').value = 'Acme';
    sheet.mergeCells('A2:A4');
    sheet.getCell('B2').value = 1000;
    sheet.getCell('B3').value = 500;
    sheet.getCell('B4').value = 200;
    sheet.getCell('A5').value = 'Beta';
    sheet.getCell('B5').value = 300;

    const data = await workbook.xlsx.writeBuffer();
    const source = await readSource(data as ArrayBuffer, 'Data', { sourceTable: '1' });

    expect(source.rows).toEqual([
      { Customer: 'Acme', Amount: 1000 },
      { Customer: 'Acme', Amount: 500 },
      { Customer: 'Acme', Amount: 200 },
      { Customer: 'Beta', Amount: 300 },
    ]);
  });

  it('broadcasts horizontally-merged data-row values to slave columns (ADR-0035 horizontal)', async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Data');
    sheet.getCell('A1').value = 'Customer';
    sheet.getCell('B1').value = 'Note';
    sheet.getCell('C1').value = 'Amount';
    sheet.getCell('A2').value = 'Acme';
    sheet.getCell('B2').value = 'memo';
    sheet.mergeCells('B2:C2');
    sheet.getCell('A3').value = 'Beta';
    sheet.getCell('B3').value = 'b';
    sheet.getCell('C3').value = 200;

    const data = await workbook.xlsx.writeBuffer();
    const source = await readSource(data as ArrayBuffer, 'Data', { sourceTable: '1' });

    expect(source.rows).toEqual([
      { Customer: 'Acme', Note: 'memo', Amount: 'memo' },
      { Customer: 'Beta', Note: 'b', Amount: 200 },
    ]);
  });

  it('skips rows whose every cell is empty by ADR-0007 (including whitespace-only)', async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Raw');
    sheet.getCell('A1').value = 'Customer';
    sheet.getCell('B1').value = 'Memo';

    sheet.getCell('A2').value = 'Acme';
    sheet.getCell('B2').value = 'first';

    sheet.getCell('A3').value = '   ';
    sheet.getCell('B3').value = '\t  ';

    sheet.getCell('A4').value = 'Beta';
    sheet.getCell('B4').value = '   '; // single non-empty cell keeps the row

    const data = await workbook.xlsx.writeBuffer();

    const source = await readSource(data as ArrayBuffer, 'Raw', { sourceTable: '1' });
    expect(source.rows).toEqual([
      { Customer: 'Acme', Memo: 'first' },
      { Customer: 'Beta', Memo: '   ' },
    ]);
  });

});
