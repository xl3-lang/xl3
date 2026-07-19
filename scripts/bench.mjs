#!/usr/bin/env node
// Performance baseline. Run: `npm run bench`
//
// Three scenarios that approximate realistic operator workloads:
//
//  1. Wide-and-flat: 10k rows, 8 columns, single source, IF + ROUND
//     per row. Measures the row-iteration hot path.
//
//  2. Multi-sheet: 1k rows × 5 group keys = 5 sheets. Measures
//     grouping + per-sheet rendering overhead.
//
//  3. Multi-source join: 5k primary rows joined with 1k joined rows
//     by Account. Measures the join index + per-row lookup.
//
// Each scenario is run 3 times; the median is reported. Numbers are
// not part of the conformance contract — they're a regression
// signal. A 2× degradation in any scenario should be investigated.

import ExcelJS from 'exceljs';
import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { performance } from 'node:perf_hooks';
import { convert } from '@xl3-lang/xl3';

const HERE = dirname(fileURLToPath(import.meta.url));

async function buildWideFlat() {
  const tpl = new ExcelJS.Workbook();
  addConfig(tpl, [
    ['name', 'wide-flat'],
    ['source_sheet', 'Data'],
    ['source_table', '1'],
    ['output_file_pattern', 'wide.xlsx'],
  ]);
  const ts = tpl.addWorksheet('Out');
  ts.getCell('A1').value = 'Account';
  ts.getCell('B1').value = 'Region';
  ts.getCell('C1').value = 'Amount';
  ts.getCell('D1').value = 'Tier';
  ts.getCell('A2').value = '{{ [Account] }}';
  ts.getCell('B2').value = '{{ [Region] }}';
  ts.getCell('C2').value = '{{ ROUND([Amount], 2) }}';
  ts.getCell('D2').value = '{{ IF([Amount] > 10000, "Priority", "Standard") }}';
  const tplBuf = await tpl.xlsx.writeBuffer();

  const data = new ExcelJS.Workbook();
  const ds = data.addWorksheet('Data');
  ds.getCell('A1').value = 'Account';
  ds.getCell('B1').value = 'Region';
  ds.getCell('C1').value = 'Amount';
  for (let i = 0; i < 10000; i++) {
    ds.getCell(`A${i + 2}`).value = `Acct-${i}`;
    ds.getCell(`B${i + 2}`).value = i % 5 === 0 ? 'Seoul' : 'Busan';
    ds.getCell(`C${i + 2}`).value = (i * 7) % 30000;
  }
  const dataBuf = await data.xlsx.writeBuffer();

  return { tpl: tplBuf, data: dataBuf };
}

async function buildMultiSheet() {
  const tpl = new ExcelJS.Workbook();
  addConfig(tpl, [
    ['name', 'multi-sheet'],
    ['source_sheet', 'Data'],
    ['source_table', '1'],
    ['output_file_pattern', 'multi.xlsx'],
  ]);
  const ts = tpl.addWorksheet('{{ Region }}');
  ts.getCell('A1').value = 'Account';
  ts.getCell('B1').value = 'Amount';
  ts.getCell('A2').value = '{{ [Account] }}';
  ts.getCell('B2').value = '{{ [Amount] }}';
  const tplBuf = await tpl.xlsx.writeBuffer();

  const regions = ['Seoul', 'Busan', 'Daegu', 'Incheon', 'Jeju'];
  const data = new ExcelJS.Workbook();
  const ds = data.addWorksheet('Data');
  ds.getCell('A1').value = 'Account';
  ds.getCell('B1').value = 'Region';
  ds.getCell('C1').value = 'Amount';
  for (let i = 0; i < 5000; i++) {
    ds.getCell(`A${i + 2}`).value = `A${i}`;
    ds.getCell(`B${i + 2}`).value = regions[i % regions.length];
    ds.getCell(`C${i + 2}`).value = i;
  }
  const dataBuf = await data.xlsx.writeBuffer();

  return { tpl: tplBuf, data: dataBuf };
}

async function buildMultiSourceJoin() {
  const tpl = new ExcelJS.Workbook();
  addConfig(tpl, [
    ['name', 'multi-source-join'],
    ['source_sheet', 'Renewals'],
    ['source_table', '1'],
    ['output_file_pattern', 'join.xlsx'],
  ]);
  addSources(tpl, [
    { name: 'Renewals', sheet: 'Renewals', table: '1' },
    { name: 'Customers', sheet: 'Customers', table: '1' },
  ]);
  const ts = tpl.addWorksheet('Out');
  ts.getCell('A1').value = 'Account';
  ts.getCell('B1').value = 'Region';
  ts.getCell('C1').value = 'Amount';
  ts.getCell('A2').value = '{{ @source Renewals }}';
  ts.getCell('A3').value = '{{ @join Customers on Customers[Account] = Renewals[Account] }}';
  ts.getCell('A4').value = '{{ Renewals[Account] }}';
  ts.getCell('B4').value = '{{ Customers[Region] }}';
  ts.getCell('C4').value = '{{ Renewals[Amount] }}';
  const tplBuf = await tpl.xlsx.writeBuffer();

  const data = new ExcelJS.Workbook();
  const cust = data.addWorksheet('Customers');
  cust.getCell('A1').value = 'Account';
  cust.getCell('B1').value = 'Region';
  for (let i = 0; i < 1000; i++) {
    cust.getCell(`A${i + 2}`).value = `A${i}`;
    cust.getCell(`B${i + 2}`).value = i % 2 === 0 ? 'Seoul' : 'Busan';
  }
  const ren = data.addWorksheet('Renewals');
  ren.getCell('A1').value = 'Account';
  ren.getCell('B1').value = 'Amount';
  for (let i = 0; i < 5000; i++) {
    // 80% match rate (i % 1000 < 1000), 20% will be dropped by inner join.
    ren.getCell(`A${i + 2}`).value = `A${i % 1250}`;
    ren.getCell(`B${i + 2}`).value = i;
  }
  const dataBuf = await data.xlsx.writeBuffer();

  return { tpl: tplBuf, data: dataBuf };
}

function addConfig(wb, rows) {
  const sh = wb.addWorksheet('__config__');
  sh.getCell('A1').value = 'key';
  sh.getCell('B1').value = 'value';
  rows.forEach(([k, v], i) => {
    sh.getCell(`A${i + 2}`).value = k;
    sh.getCell(`B${i + 2}`).value = v;
  });
}

function addSources(wb, rows) {
  const sh = wb.addWorksheet('__sources__');
  sh.getCell('A1').value = 'name';
  sh.getCell('B1').value = 'sheet';
  sh.getCell('C1').value = 'table';
  rows.forEach((row, i) => {
    sh.getCell(`A${i + 2}`).value = row.name;
    sh.getCell(`B${i + 2}`).value = row.sheet;
    sh.getCell(`C${i + 2}`).value = row.table;
  });
}

async function timeRun(fn) {
  const samples = [];
  for (let i = 0; i < 3; i++) {
    const t0 = performance.now();
    await fn();
    samples.push(performance.now() - t0);
  }
  samples.sort((a, b) => a - b);
  return samples[1]; // median of 3
}

const scenarios = [
  ['wide-flat (10k rows × 4 cols)', buildWideFlat],
  ['multi-sheet (5k rows × 5 sheets)', buildMultiSheet],
  ['multi-source-join (5k × 1k)', buildMultiSourceJoin],
];

console.log('xl3 bench — median of 3 runs');
console.log('-'.repeat(60));
for (const [name, build] of scenarios) {
  const { tpl, data } = await build();
  const median = await timeRun(async () => {
    const out = await convert(tpl, data);
    if (out.length === 0) throw new Error('no output');
  });
  console.log(`  ${name.padEnd(40)} ${median.toFixed(0).padStart(6)} ms`);
}
