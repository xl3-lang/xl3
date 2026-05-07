import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import { readConfigSheet } from '../parser.js';

describe('readConfigSheet', () => {
  it.each(['header_row', 'source_range', 'source_header_range'])(
    'rejects removed source config key %s',
    (key) => {
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('__config__');
      sheet.getCell('A1').value = key;
      sheet.getCell('B1').value = '1';

      expect(() => readConfigSheet(workbook))
        .toThrow(`Config key "${key}" was removed. Use "source_table" instead.`);
    },
  );
});
