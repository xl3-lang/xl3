#!/usr/bin/env node
// Build the example template+data .xlsx pairs in `examples/`.
// Run with `node examples/scripts/build.mjs` (or `npm run examples:build`).
//
// Each example demonstrates a different shape of XTL template a real
// operator workflow would use. The intent is for new users to copy
// one of these as a starting point. Conformance fixtures cover unit
// behavior; examples cover composed shapes.

import ExcelJS from 'exceljs';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');

async function writeBook(wb, filePath) {
  await mkdir(dirname(filePath), { recursive: true });
  const buf = await wb.xlsx.writeBuffer();
  await writeFile(filePath, Buffer.from(buf));
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
  sh.getCell('D1').value = 'description';
  rows.forEach((row, i) => {
    sh.getCell(`A${i + 2}`).value = row.name;
    sh.getCell(`B${i + 2}`).value = row.sheet;
    sh.getCell(`C${i + 2}`).value = row.table;
    if (row.description) sh.getCell(`D${i + 2}`).value = row.description;
  });
}

function addLists(wb, lists) {
  const sh = wb.addWorksheet('__lists__');
  Object.entries(lists).forEach(([name, values], col) => {
    const letter = String.fromCharCode(65 + col);
    sh.getCell(`${letter}1`).value = name;
    values.forEach((v, i) => (sh.getCell(`${letter}${i + 2}`).value = v));
  });
}

// ---------------------------------------------------------------------------
// 01 - basic renewal report
// Single default source; demonstrates substitution, IF, SUM, @sort, @top.
// ---------------------------------------------------------------------------
async function buildBasicRenewalReport() {
  const dir = join(ROOT, '01-basic-renewal-report');

  // template.xlsx
  {
    const wb = new ExcelJS.Workbook();
    addConfig(wb, [
      ['name', 'renewal-report'],
      ['source_sheet', 'Customers'],
      ['source_table', '1'],
      ['output_file_pattern', 'renewal-report.xlsx'],
    ]);
    const sh = wb.addWorksheet('Renewals');
    sh.getCell('A1').value = 'Account';
    sh.getCell('B1').value = 'Region';
    sh.getCell('C1').value = 'Amount';
    sh.getCell('D1').value = 'Tier';
    sh.getCell('A2').value = '{{ @sort [Amount] desc }}';
    sh.getCell('A3').value = '{{ @top 10 }}';
    sh.getCell('A4').value = '{{ [Account] }}';
    sh.getCell('B4').value = '{{ [Region] }}';
    sh.getCell('C4').value = '{{ [Amount] }}';
    sh.getCell('D4').value = '{{ IF([Amount] > 10000, "Priority", "Standard") }}';
    sh.getCell('A6').value = 'Total';
    sh.getCell('C6').value = '{{ SUM([Amount]) }}';
    sh.getCell('A6').font = { bold: true };
    sh.getCell('C6').font = { bold: true };
    await writeBook(wb, join(dir, 'template.xlsx'));
  }

  // data.xlsx
  {
    const wb = new ExcelJS.Workbook();
    const sh = wb.addWorksheet('Customers');
    sh.getCell('A1').value = 'Account';
    sh.getCell('B1').value = 'Region';
    sh.getCell('C1').value = 'Amount';
    const rows = [
      ['Acme Logistics', 'Seoul', 18400],
      ['Beta Works', 'Busan', 7200],
      ['Coreon', 'Seoul', 22500],
      ['Delta Press', 'Daegu', 4900],
      ['Echo Foods', 'Busan', 12100],
    ];
    rows.forEach(([a, r, am], i) => {
      sh.getCell(`A${i + 2}`).value = a;
      sh.getCell(`B${i + 2}`).value = r;
      sh.getCell(`C${i + 2}`).value = am;
    });
    await writeBook(wb, join(dir, 'data.xlsx'));
  }
}

// ---------------------------------------------------------------------------
// 02 - sheet-per-region with __lists__ filter
// Demonstrates group keys (one sheet per region) and a list-sheet filter.
// ---------------------------------------------------------------------------
async function buildPerRegionSheets() {
  const dir = join(ROOT, '02-sheet-per-region');

  {
    const wb = new ExcelJS.Workbook();
    addConfig(wb, [
      ['name', 'per-region-report'],
      ['source_sheet', 'Customers'],
      ['source_table', '1'],
      ['output_file_pattern', 'regions-{{ TODAY() }}.xlsx'],
    ]);
    addLists(wb, { ActiveRegions: ['Seoul', 'Busan', 'Daegu'] });

    // Sheet name uses a group key (Region). One worksheet per region.
    const sh = wb.addWorksheet('{{ Region }}');
    sh.getCell('A1').value = 'Account';
    sh.getCell('B1').value = 'Amount';
    sh.getCell('C1').value = 'Status';
    sh.getCell('A2').value = '{{ @filter [Region] in __lists__[ActiveRegions] }}';
    sh.getCell('A3').value = '{{ @sort [Amount] desc }}';
    sh.getCell('A4').value = '{{ [Account] }}';
    sh.getCell('B4').value = '{{ [Amount] }}';
    sh.getCell('C4').value = '{{ IF(IFEMPTY([Status], "open") = "open", "open", "closed") }}';
    sh.getCell('A6').value = 'Region total';
    sh.getCell('B6').value = '{{ SUM([Amount]) }}';
    sh.getCell('A6').font = { bold: true };
    sh.getCell('B6').font = { bold: true };

    await writeBook(wb, join(dir, 'template.xlsx'));
  }

  {
    const wb = new ExcelJS.Workbook();
    const sh = wb.addWorksheet('Customers');
    sh.getCell('A1').value = 'Account';
    sh.getCell('B1').value = 'Region';
    sh.getCell('C1').value = 'Amount';
    sh.getCell('D1').value = 'Status';
    const rows = [
      ['Acme Logistics', 'Seoul', 18400, 'open'],
      ['Beta Works', 'Busan', 7200, ''],
      ['Coreon', 'Seoul', 22500, 'closed'],
      ['Delta Press', 'Daegu', 4900, 'open'],
      ['Echo Foods', 'Busan', 12100, 'open'],
      ['Foxtrot', 'Jeju', 15000, 'open'], // filtered out (not in list)
    ];
    rows.forEach(([a, r, am, st], i) => {
      sh.getCell(`A${i + 2}`).value = a;
      sh.getCell(`B${i + 2}`).value = r;
      sh.getCell(`C${i + 2}`).value = am;
      sh.getCell(`D${i + 2}`).value = st;
    });
    await writeBook(wb, join(dir, 'data.xlsx'));
  }
}

// ---------------------------------------------------------------------------
// 03 - multi-source with @join + XLOOKUP + runtime input
// Combines every shape porters need to demonstrate XTL 0.1 fully.
// ---------------------------------------------------------------------------
async function buildMultiSourceJoin() {
  const dir = join(ROOT, '03-multi-source-join');

  {
    const wb = new ExcelJS.Workbook();
    addConfig(wb, [
      ['name', 'multi-source-join'],
      ['source_sheet', 'Renewals'],
      ['source_table', '1'],
      ['output_file_pattern', '{{ __inputs__[month] }}-renewals.xlsx'],
    ]);
    addSources(wb, [
      { name: 'Renewals', sheet: 'Renewals', table: '1', description: 'Per-month renewal events' },
      { name: 'Customers', sheet: 'Customers', table: '1', description: 'Master customer table' },
    ]);

    // __inputs__ sheet: a host-supplied month token used in the
    // filename and a header label.
    const inp = wb.addWorksheet('__inputs__');
    inp.getCell('A1').value = 'name';
    inp.getCell('B1').value = 'type';
    inp.getCell('C1').value = 'default';
    inp.getCell('D1').value = 'label';
    inp.getCell('A2').value = 'month';
    inp.getCell('B2').value = 'text';
    inp.getCell('C2').value = '2026-05';
    inp.getCell('D2').value = 'Report month';

    const sh = wb.addWorksheet('Report');
    sh.getCell('A1').value = 'Renewal report — {{ __inputs__[month] }}';
    sh.mergeCells('A1:E1');
    sh.getCell('A1').font = { bold: true, size: 14 };

    sh.getCell('A3').value = 'Account';
    sh.getCell('B3').value = 'Owner';
    sh.getCell('C3').value = 'Region';
    sh.getCell('D3').value = 'Amount';
    sh.getCell('E3').value = 'Tier';
    sh.getRow(3).font = { bold: true };

    // @source + @join: iterate Renewals, paired with the matching
    // Customers row by Account.
    sh.getCell('A4').value = '{{ @source Renewals }}';
    sh.getCell('A5').value = '{{ @join Customers on Customers[Account] = Renewals[Account] }}';
    sh.getCell('A6').value = '{{ @sort [Amount] desc }}';

    sh.getCell('A7').value = '{{ Renewals[Account] }}';
    sh.getCell('B7').value = '{{ Customers[Owner] }}';
    sh.getCell('C7').value = '{{ Customers[Region] }}';
    sh.getCell('D7').value = '{{ Renewals[Amount] }}';
    sh.getCell('E7').value = '{{ IF(Renewals[Amount] > 15000, "Priority", "Standard") }}';

    sh.getCell('A9').value = 'Total renewals (after join):';
    sh.getCell('D9').value = '{{ SUM(Renewals[Amount]) }}';
    sh.getCell('A9').font = { bold: true };
    sh.getCell('D9').font = { bold: true };

    sh.getCell('A11').value = 'XLOOKUP demo: Coreon owner →';
    sh.getCell('B11').value = '{{ XLOOKUP("Coreon", Customers[Account], Customers[Owner], "(unknown)") }}';

    await writeBook(wb, join(dir, 'template.xlsx'));
  }

  {
    const wb = new ExcelJS.Workbook();
    const cust = wb.addWorksheet('Customers');
    cust.getCell('A1').value = 'Account';
    cust.getCell('B1').value = 'Owner';
    cust.getCell('C1').value = 'Region';
    [
      ['Acme Logistics', 'Mina', 'Seoul'],
      ['Beta Works', 'Joon', 'Busan'],
      ['Coreon', 'Hana', 'Seoul'],
      ['Delta Press', 'Sora', 'Daegu'],
      ['Echo Foods', 'Tae', 'Busan'],
    ].forEach(([a, o, r], i) => {
      cust.getCell(`A${i + 2}`).value = a;
      cust.getCell(`B${i + 2}`).value = o;
      cust.getCell(`C${i + 2}`).value = r;
    });

    const ren = wb.addWorksheet('Renewals');
    ren.getCell('A1').value = 'Account';
    ren.getCell('B1').value = 'Amount';
    [
      ['Acme Logistics', 18400],
      ['Beta Works', 7200],
      ['Coreon', 22500],
      ['Delta Press', 4900],
      ['Echo Foods', 12100],
      ['Foxtrot', 9000], // unmatched in Customers — dropped by inner join
    ].forEach(([a, am], i) => {
      ren.getCell(`A${i + 2}`).value = a;
      ren.getCell(`B${i + 2}`).value = am;
    });

    await writeBook(wb, join(dir, 'data.xlsx'));
  }
}

const examples = [
  ['01', buildBasicRenewalReport],
  ['02', buildPerRegionSheets],
  ['03', buildMultiSourceJoin],
];

const selected = new Set(process.argv.slice(2));
const active = selected.size > 0
  ? examples.filter(([id]) => selected.has(id))
  : examples;

const built = [];
for (const [id, fn] of active) {
  await fn();
  built.push(id);
}
console.log(`built examples: ${built.join(', ')}`);
