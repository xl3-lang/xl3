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
  it('uses source_header_range as the header row and column window', async () => {
    const source = await readSource(await workbookBuffer(), 'Raw', 1, undefined, 'B3:D3');

    expect(source.headers).toEqual(['Customer', 'Amount', 'Region']);
    expect(source.rows).toEqual([
      { Customer: 'Acme', Amount: 1200, Region: 'Seoul' },
      { Customer: 'Beta', Amount: 350, Region: 'Busan' },
    ]);
  });

  it('requires source_header_range to be a single-row range', async () => {
    await expect(readSource(await workbookBuffer(), 'Raw', 1, undefined, 'B3:D4'))
      .rejects.toThrow('source_header_range must be a single-row Excel range');
  });

  it('rejects source_range and source_header_range together', async () => {
    await expect(readSource(await workbookBuffer(), 'Raw', 1, 'B3:D5', 'B3:D3'))
      .rejects.toThrow('source_range and source_header_range cannot both be set');
  });
});
