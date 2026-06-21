#!/usr/bin/env node
// Generates Korean-localized playground samples that mirror the structure of
// the English samples but use Korean field names, company names, and labels.
// Output: website/static/playground-samples/sample-{raw,template}-ko.xlsx

import ExcelJS from 'exceljs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeDeterministicXlsx } from '../../scripts/deterministic-xlsx.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, '..', 'static', 'playground-samples');

const RAW_ROWS = [
  ['거래처', '지역', '갱신액', '담당자'],
  ['한솔물산', '서울', 18400, '민아'],
  ['베타웍스', '부산', 7200, '준호'],
  ['코어식품', '대전', 12600, '하나'],
  ['델타리테일', '인천', 9800, '솔'],
  ['에버그린푸드', '광주', 21300, '민아'],
];

async function buildRaw() {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'xl3 playground';
  const ws = wb.addWorksheet('원본');
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
  cfg.addRow(['name', '거래처 갱신 리포트 샘플']);
  cfg.addRow(['source_sheet', '원본']);
  cfg.addRow(['source_table', '1']);
  cfg.addRow(['output_file_pattern', '거래처-갱신-리포트.xlsx']);
  cfg.getColumn(1).width = 22;
  cfg.getColumn(2).width = 36;
  cfg.getColumn(1).font = { bold: true };

  const report = wb.addWorksheet('갱신 리포트');

  // Title (merged across A1:E1)
  const titleRow = report.addRow(['거래처 갱신 파이프라인']);
  titleRow.font = { bold: true, size: 16 };
  report.mergeCells('A1:E1');

  // Subtitle (merged across A2:E2)
  report.addRow(['운영자가 raw.xlsx 와 이 템플릿을 업로드합니다. 규칙은 __config__ 시트에 보관됩니다.']);
  report.mergeCells('A2:E2');
  report.getRow(2).font = { italic: true, color: { argb: 'FF666666' } };

  // Stats row
  report.addRow(['거래처 수', '{{ COUNT() }}', '', '우선 기준', '갱신액 > 10,000']);
  report.getRow(3).font = { bold: true };

  // Spacer row
  report.addRow([]);

  // Empty row for visual separation (mirrors English template's row 5)
  report.addRow([]);

  // Header row (row 6)
  report.addRow(['거래처', '지역', '갱신액', '담당자', '등급']);
  report.getRow(6).font = { bold: true };
  report.getRow(6).alignment = { horizontal: 'left' };

  // Data row (row 7) — template expressions
  report.addRow([
    '{{ [거래처] }}',
    '{{ [지역] }}',
    '{{ [갱신액] }}',
    '{{ [담당자] }}',
    '{{ IF([갱신액] > 10000, "우선", "일반") }}',
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
  const rawPath = join(outDir, 'sample-raw-ko.xlsx');
  const tplPath = join(outDir, 'sample-template-ko.xlsx');

  await writeDeterministicXlsx(await buildRaw(), rawPath);
  console.log(`  wrote ${rawPath}`);

  await writeDeterministicXlsx(await buildTemplate(), tplPath);
  console.log(`  wrote ${tplPath}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
