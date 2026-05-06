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

});
