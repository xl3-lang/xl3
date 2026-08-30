import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import { convert, preview, writeConfigSheet } from '../index.js';

async function toBuffer(workbook: ExcelJS.Workbook): Promise<ArrayBuffer> {
  return (await workbook.xlsx.writeBuffer()) as ArrayBuffer;
}

describe('preview', () => {
  it('omits a grouped sheet when its single-block filter emits no rows', async () => {
    const template = new ExcelJS.Workbook();
    writeConfigSheet(template, {
      name: 'Preview parity',
      description: '',
      source_sheet: 'Raw',
      source_table: '1',
      output_file_pattern: 'out.xlsx',
      match_pattern: '*',
    });
    const report = template.addWorksheet('{{ Region }}');
    report.getCell('A1').value = '{{ @filter [Status] = "open" }}';
    report.getCell('A2').value = '{{ [Customer] }}';

    const source = new ExcelJS.Workbook();
    const raw = source.addWorksheet('Raw');
    raw.addRow(['Customer', 'Region', 'Status']);
    raw.addRow(['Acme', 'Seoul', 'open']);
    raw.addRow(['Beta', 'Jeju', 'closed']);

    const templateBuffer = await toBuffer(template);
    const sourceBuffer = await toBuffer(source);
    const [planned, rendered] = await Promise.all([
      preview(templateBuffer, sourceBuffer),
      convert(templateBuffer, sourceBuffer),
    ]);

    expect(planned.files[0]!.sheets).toEqual([{ name: 'Seoul', rowCount: 1 }]);

    const output = new ExcelJS.Workbook();
    await output.xlsx.load(rendered[0]!.data);
    expect(output.worksheets.map((sheet) => sheet.name)).toEqual(['Seoul']);
  });
});
