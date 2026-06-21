#!/usr/bin/env node
// Generates the English playground samples served from the /try page.
// Output: website/static/playground-samples/sample-{raw,template}.xlsx
//
// Keep this in sync with build-ko-samples.mjs (same structure, English copy).
// The template's reserved config sheet MUST be named `__config__` (ADR-0011).

import ExcelJS from 'exceljs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeDeterministicXlsx } from '../../scripts/deterministic-xlsx.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, '..', 'static', 'playground-samples');

const RAW_ROWS = [
  ['Account', 'Region', 'Renewal', 'Owner'],
  ['Acme Logistics', 'Seoul', 18400, 'Mina'],
  ['Beta Works', 'Busan', 7200, 'Joon'],
  ['Core Labs', 'Daejeon', 12600, 'Hana'],
  ['Delta Retail', 'Incheon', 9800, 'Sol'],
  ['Evergreen Foods', 'Gwangju', 21300, 'Mina'],
];

async function buildRaw() {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'xl3 playground';
  const ws = wb.addWorksheet('Raw');
  for (const row of RAW_ROWS) ws.addRow(row);

  ws.getRow(1).font = { bold: true };
  ws.getRow(1).alignment = { horizontal: 'left' };
  ws.getColumn(1).width = 18;
  ws.getColumn(2).width = 10;
  ws.getColumn(3).width = 12;
  ws.getColumn(4).width = 10;
  ws.getColumn(3).numFmt = '#,##0';

  return wb;
}

async function buildTemplate() {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'xl3 playground';

  // ADR-0011: reserved config sheet is dunder-wrapped (`__config__`).
  const cfg = wb.addWorksheet('__config__');
  cfg.addRow(['name', 'Sample customer renewal report']);
  cfg.addRow(['source_sheet', 'Raw']);
  cfg.addRow(['source_table', '1']);
  cfg.addRow(['output_file_pattern', 'customer-renewal-report.xlsx']);
  cfg.getColumn(1).width = 22;
  cfg.getColumn(2).width = 36;
  cfg.getColumn(1).font = { bold: true };

  const report = wb.addWorksheet('Renewal Report');

  // Title (merged across A1:E1)
  const titleRow = report.addRow(['Customer Renewal Pipeline']);
  titleRow.font = { bold: true, size: 16 };
  report.mergeCells('A1:E1');

  // Subtitle (merged across A2:E2)
  report.addRow(['Operators upload raw.xlsx and this template. Rules are archived in __config__.']);
  report.mergeCells('A2:E2');
  report.getRow(2).font = { italic: true, color: { argb: 'FF666666' } };

  // Stats row
  report.addRow(['Accounts', '{{ COUNT() }}', '', 'Priority rule', 'Renewal > 10,000']);
  report.getRow(3).font = { bold: true };

  // Spacer row
  report.addRow([]);

  // Empty row for visual separation
  report.addRow([]);

  // Header row (row 6)
  report.addRow(['Account', 'Region', 'Renewal', 'Owner', 'Tier']);
  report.getRow(6).font = { bold: true };
  report.getRow(6).alignment = { horizontal: 'left' };

  // Data row (row 7) — template expressions
  report.addRow([
    '{{ [Account] }}',
    '{{ [Region] }}',
    '{{ [Renewal] }}',
    '{{ [Owner] }}',
    '{{ IF([Renewal] > 10000, "Priority", "Standard") }}',
  ]);

  report.getColumn(1).width = 18;
  report.getColumn(2).width = 10;
  report.getColumn(3).width = 14;
  report.getColumn(4).width = 12;
  report.getColumn(5).width = 12;
  report.getColumn(3).numFmt = '#,##0';

  return wb;
}

async function main() {
  const rawPath = join(outDir, 'sample-raw.xlsx');
  const tplPath = join(outDir, 'sample-template.xlsx');

  await writeDeterministicXlsx(await buildRaw(), rawPath);
  console.log(`  wrote ${rawPath}`);

  await writeDeterministicXlsx(await buildTemplate(), tplPath);
  console.log(`  wrote ${tplPath}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
