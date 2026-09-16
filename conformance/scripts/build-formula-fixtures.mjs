// ADR-0080 authoring only. Expected formulas are written out by hand below;
// this script never imports or runs xl3. ExcelJS is only the XLSX writer.
import ExcelJS from 'exceljs';
import { fileURLToPath } from 'node:url';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { writeDeterministicXlsx } from '../../scripts/deterministic-xlsx.mjs';

const root = fileURLToPath(new URL('../fixtures/', import.meta.url));

function makeTemplate(formula = 'B2*2') {
  const wb = new ExcelJS.Workbook();
  const config = wb.addWorksheet('__config__', { state: 'hidden' });
  config.addRows([
    ['source_sheet', 'Raw'],
    ['source_table', '1'],
    ['output_file_pattern', 'out.xlsx'],
    ['formula_mode', 'adjust'],
  ]);
  const sheet = wb.addWorksheet('Report');
  sheet.addRows([
    ['Item', 'Amount', 'Double', 'Intersection', 'Row'],
    [
      '{{ [Item] }}',
      '{{ [Amount] }}',
      { formula, result: 999 },
      { formula: 'SUM(B2 (B2:B2))' },
      { formula: 'ROW(E2)' },
    ],
    ['Total', { formula: 'SUM(B2:B2)', result: 999 }],
  ]);
  styleRecord(sheet, 2);
  return wb;
}

function styleRecord(sheet, row) {
  sheet.getRow(row).height = 28;
  sheet.getCell(`B${row}`).numFmt = '#,##0.00';
  sheet.getCell(`C${row}`).font = { bold: true };
}

function makeData() {
  const wb = new ExcelJS.Workbook();
  wb.addWorksheet('Raw').addRows([
    ['Item', 'Amount'],
    ['A', 10],
    ['B', 20],
    ['C', 30],
  ]);
  return wb;
}

const regular = join(root, '173-formula-reference-adjustment');
await mkdir(regular, { recursive: true });
await writeDeterministicXlsx(makeTemplate(), join(regular, 'template.xlsx'));
await writeDeterministicXlsx(makeData(), join(regular, 'data.xlsx'));
const expected = new ExcelJS.Workbook();
const sheet = expected.addWorksheet('Report');
sheet.addRows([
  ['Item', 'Amount', 'Double', 'Intersection', 'Row'],
  ['A', 10, { formula: 'B2*2' }, { formula: 'SUM(B2 (B2:B2))' }, { formula: 'ROW(E2)' }],
  ['B', 20, { formula: 'B3*2' }, { formula: 'SUM(B3 (B3:B3))' }, { formula: 'ROW(E3)' }],
  ['C', 30, { formula: 'B4*2' }, { formula: 'SUM(B4 (B4:B4))' }, { formula: 'ROW(E4)' }],
  ['Total', { formula: 'SUM(B2:B4)' }],
]);
for (const row of [2, 3, 4]) styleRecord(sheet, row);
expected.calcProperties.fullCalcOnLoad = true;
await writeDeterministicXlsx(expected, join(regular, 'expected.xlsx'));
await writeFile(
  join(regular, 'meta.yaml'),
  `description: "Opt-in A1 formula adjustment replicates relative references and grows footer ranges while preserving styles."
spec_section: ADR-0080; evaluation.md "Template Configuration"
spec_version: "0.1"
tags: [adr-0080, formula, repeat, preservation, stage2]
comparison_stage: 2
verified_by: [hand, spec-derivation]
`,
);

const rejected = join(root, '174-formula-sheet-reference-rejected');
await mkdir(rejected, { recursive: true });
await writeDeterministicXlsx(makeTemplate('Other!B2'), join(rejected, 'template.xlsx'));
await writeDeterministicXlsx(makeData(), join(rejected, 'data.xlsx'));
await writeFile(
  join(rejected, 'meta.yaml'),
  `description: "Adjustment mode rejects explicit sheet references instead of silently retaining stale coordinates."
spec_section: ADR-0080
spec_version: "0.1"
tags: [adr-0080, formula, validation]
verified_by: [hand, spec-derivation]
expected_error: "Report!C2: Only unqualified A1 references are supported"
`,
);
