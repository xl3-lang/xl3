#!/usr/bin/env node
// Build the example template+data .xlsx pairs in `examples/`.
// Run with `node examples/scripts/build.mjs` (or `npm run examples:build`).
//
// Each example demonstrates a different shape of XTL template a real
// operator workflow would use. The intent is for new users to copy
// one of these as a starting point. Conformance fixtures cover unit
// behavior; examples cover composed shapes.

import ExcelJS from 'exceljs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeDeterministicXlsx } from '../../scripts/deterministic-xlsx.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');

// Reproducible serialization (fixed doc + zip timestamps) so repeated
// builds leave the tree clean — see scripts/deterministic-xlsx.mjs.
const writeBook = writeDeterministicXlsx;

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

// ---------------------------------------------------------------------------
// 04 - cafe weekly sales report (Korean B2B context)
// Demonstrates the 0.6 grouping directives: @sort + @group + @subtotal
// emit per-category subtotal rows inside a single data block.
// Also covers: per-row IF nesting for a tier label, mid-cell template
// composition for a localized header, and ADR-0050 computed default
// for the period label.
// ---------------------------------------------------------------------------
async function buildCafeWeeklyReport() {
  const dir = join(ROOT, '04-cafe-weekly-report');

  // template.xlsx
  {
    const wb = new ExcelJS.Workbook();
    addConfig(wb, [
      ['name', 'cafe-weekly-report'],
      ['source_sheet', 'Sales'],
      ['source_table', '1'],
      ['output_file_pattern', '레인보우카페_주간리포트_{{ __inputs__[period_label] }}.xlsx'],
    ]);

    // ADR-0050: default is an XTL template — evaluated once at
    // readTemplateInputs() time, so the host UI shows today's date
    // rather than the literal `{{ ... }}` string.
    const inp = wb.addWorksheet('__inputs__');
    inp.getCell('A1').value = 'name';
    inp.getCell('B1').value = 'type';
    inp.getCell('C1').value = 'default';
    inp.getCell('D1').value = 'label';
    inp.getCell('A2').value = 'period_label';
    inp.getCell('B2').value = 'text';
    // Note: TEXT() format tokens are case-sensitive in xl3 0.6 —
    // "YYYY-MM-DD" works; lowercase "yyyy-mm-dd" passes "yyyy" through
    // and reads "mm" as minutes (TODAY() is midnight, so it returns
    // "00"). Use uppercase for date format strings.
    inp.getCell('C2').value = '{{ TEXT(TODAY(), "YYYY-MM-DD") }}';
    inp.getCell('D2').value = '리포트 기준일';

    const sh = wb.addWorksheet('주간 리포트');

    // Title block
    sh.getCell('A1').value = '레인보우 카페';
    sh.mergeCells('A1:G1');
    sh.getCell('A1').font = { bold: true, size: 16 };

    sh.getCell('A2').value = '{{ __inputs__[period_label] }} 기준 주간 매출 리포트';
    sh.mergeCells('A2:G2');
    sh.getCell('A2').font = { italic: true, size: 11 };

    // Column header row
    sh.getCell('A4').value = '일자';
    sh.getCell('B4').value = '요일';
    sh.getCell('C4').value = '카테고리';
    sh.getCell('D4').value = '메뉴';
    sh.getCell('E4').value = '수량';
    sh.getCell('F4').value = '매출';
    sh.getCell('G4').value = '등급';
    sh.getRow(4).font = { bold: true };

    // Directives that scope the data block (ADR-0038): sort then group
    // by category. With three distinct categories in the raw data
    // (커피 / 논커피 / 베이커리), the @subtotal row below emits three
    // times — once per category boundary.
    sh.getCell('A5').value = '{{ @sort [카테고리] }}';
    sh.getCell('A6').value = '{{ @group [카테고리] }}';

    // Data row — exactly one row, expanded once per source row.
    sh.getCell('A7').value = '{{ [일자] }}';
    sh.getCell('B7').value = '{{ [요일] }}';
    sh.getCell('C7').value = '{{ [카테고리] }}';
    sh.getCell('D7').value = '{{ [메뉴] }}';
    sh.getCell('E7').value = '{{ [수량] }}';
    sh.getCell('F7').value = '{{ [매출] }}';
    sh.getCell('G7').value = '{{ IF([수량] >= 15, "베스트", IF([수량] >= 10, "양호", "보통")) }}';

    // @subtotal row — emits at each [카테고리] group boundary.
    // ADR-0038 accepts SUM/COUNT/AVERAGE/MIN/MAX of a single column
    // only — composite expressions (SUM([A]) * 1.1, IF(...)) are
    // deferred and would raise xl3/subtotal/bad-aggregate.
    sh.getCell('A8').value = '카테고리 소계';
    sh.getCell('E8').value = '{{ @subtotal SUM([수량]) }}';
    sh.getCell('F8').value = '{{ @subtotal SUM([매출]) }}';
    sh.getRow(8).font = { bold: true };
    sh.getRow(8).border = { top: { style: 'thin' } };

    await writeBook(wb, join(dir, 'template.xlsx'));
  }

  // data.xlsx — 9 menu items × 7 weekdays = 63 rows.
  // 매출 is precomputed (수량 × 단가) so it can be summed by @subtotal,
  // which accepts only single-column aggregates.
  {
    const wb = new ExcelJS.Workbook();
    const sh = wb.addWorksheet('Sales');
    sh.getCell('A1').value = '일자';
    sh.getCell('B1').value = '요일';
    sh.getCell('C1').value = '카테고리';
    sh.getCell('D1').value = '메뉴';
    sh.getCell('E1').value = '수량';
    sh.getCell('F1').value = '매출';

    const menu = [
      // [카테고리, 메뉴, 단가]
      ['커피',     '아메리카노',   4500],
      ['커피',     '카페라떼',     5500],
      ['커피',     '카푸치노',     5500],
      ['커피',     '바닐라라떼',   6000],
      ['커피',     '카라멜마끼아또', 6000],
      ['논커피',   '녹차라떼',     5500],
      ['논커피',   '초콜릿',       5500],
      ['베이커리', '크루아상',     4500],
      ['베이커리', '치즈케이크',   6500],
    ];
    const days = [
      ['2026-05-11', '월', 1.0],
      ['2026-05-12', '화', 1.0],
      ['2026-05-13', '수', 1.0],
      ['2026-05-14', '목', 1.0],
      ['2026-05-15', '금', 1.0],
      ['2026-05-16', '토', 1.5], // weekend bumps quantities
      ['2026-05-17', '일', 1.5],
    ];
    // Per-menu base quantity tuned so categories differ visibly.
    const baseQty = {
      '커피': 13, '논커피': 6, '베이커리': 9,
    };

    let r = 2;
    for (const [date, dow, mult] of days) {
      for (const [cat, item, price] of menu) {
        let qty = Math.round(baseQty[cat] * mult);
        // Two flagship coffees pop a touch higher on every day.
        if (item === '아메리카노' || item === '바닐라라떼') qty += 1;
        // Treat-day bump for one bakery item on weekends.
        if (mult > 1 && item === '치즈케이크') qty += 1;
        const sales = qty * price;
        sh.getCell(`A${r}`).value = date;
        sh.getCell(`B${r}`).value = dow;
        sh.getCell(`C${r}`).value = cat;
        sh.getCell(`D${r}`).value = item;
        sh.getCell(`E${r}`).value = qty;
        sh.getCell(`F${r}`).value = sales;
        r++;
      }
    }

    await writeBook(wb, join(dir, 'data.xlsx'));
  }
}

const examples = [
  ['01', buildBasicRenewalReport],
  ['02', buildPerRegionSheets],
  ['03', buildMultiSourceJoin],
  ['04', buildCafeWeeklyReport],
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
