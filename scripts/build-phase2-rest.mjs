// Build the remaining Phase 2 fixtures: 147, 148, 150, 154, 155.
import ExcelJS from 'exceljs';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = '/Users/wefun/workspaces/playground/xl3/conformance/fixtures';

async function save(wb, path) {
  writeFileSync(path, Buffer.from(await wb.xlsx.writeBuffer()));
}

function defaultConfig(wb, sourceSheet = 'Primary') {
  const cfg = wb.addWorksheet('__config__');
  cfg.getCell('A1').value = 'name';      cfg.getCell('B1').value = 'fixture';
  cfg.getCell('A2').value = 'source_sheet'; cfg.getCell('B2').value = sourceSheet;
  cfg.getCell('A3').value = 'source_table'; cfg.getCell('B3').value = '1';
  cfg.getCell('A4').value = 'output_file_pattern'; cfg.getCell('B4').value = 'output.xlsx';
}

function addSources(wb, sources) {
  const ss = wb.addWorksheet('__sources__');
  ss.getCell('A1').value = 'name';
  ss.getCell('B1').value = 'sheet';
  ss.getCell('C1').value = 'table';
  for (let i = 0; i < sources.length; i++) {
    ss.getCell(i+2, 1).value = sources[i].name;
    ss.getCell(i+2, 2).value = sources[i].sheet;
    ss.getCell(i+2, 3).value = sources[i].table || '1';
  }
}

// =====================================================================
// 147 — multi-block-different-sources: two @block, each with own @source
// =====================================================================
{
  const dir = join(ROOT, '147-multi-block-different-sources');
  mkdirSync(dir, { recursive: true });
  const tpl = new ExcelJS.Workbook();
  defaultConfig(tpl, 'Customers');
  addSources(tpl, [
    { name: 'Customers', sheet: 'Customers' },
    { name: 'Vendors',   sheet: 'Vendors' },
  ]);
  const rep = tpl.addWorksheet('Report');
  rep.getCell('A1').value = '{{ @block A:B }}'; rep.getCell('B1').value = '{{ @source Customers }}';
  rep.getCell('D1').value = '{{ @block D:E }}'; rep.getCell('E1').value = '{{ @source Vendors }}';
  rep.getCell('A2').value = 'Customer'; rep.getCell('B2').value = 'Total';
  rep.getCell('D2').value = 'Vendor';   rep.getCell('E2').value = 'Region';
  rep.getCell('A3').value = '{{ [Name] }}'; rep.getCell('B3').value = '{{ [Total] }}';
  rep.getCell('D3').value = '{{ [Name] }}'; rep.getCell('E3').value = '{{ [Region] }}';
  await save(tpl, join(dir, 'template.xlsx'));

  const data = new ExcelJS.Workbook();
  const c = data.addWorksheet('Customers');
  c.getCell('A1').value = 'Name'; c.getCell('B1').value = 'Total';
  c.getCell('A2').value = 'Acme'; c.getCell('B2').value = 1000;
  c.getCell('A3').value = 'Beta'; c.getCell('B3').value = 2000;
  const v = data.addWorksheet('Vendors');
  v.getCell('A1').value = 'Name'; v.getCell('B1').value = 'Region';
  v.getCell('A2').value = 'Alpha Foods'; v.getCell('B2').value = 'Seoul';
  v.getCell('A3').value = 'Gamma Foods'; v.getCell('B3').value = 'Busan';
  v.getCell('A4').value = 'Delta Foods'; v.getCell('B4').value = 'Daegu';
  await save(data, join(dir, 'data.xlsx'));

  // Both blocks expand independently; block 1 has 2 records, block 2 has 3.
  // After directive row 1 removal: headers at row 1, block 1 data at rows 2-3, block 2 data at rows 2-4.
  const exp = new ExcelJS.Workbook();
  const e = exp.addWorksheet('Report');
  e.getCell('A1').value = 'Customer'; e.getCell('B1').value = 'Total';
  e.getCell('D1').value = 'Vendor';   e.getCell('E1').value = 'Region';
  e.getCell('A2').value = 'Acme'; e.getCell('B2').value = 1000;
  e.getCell('A3').value = 'Beta'; e.getCell('B3').value = 2000;
  e.getCell('D2').value = 'Alpha Foods'; e.getCell('E2').value = 'Seoul';
  e.getCell('D3').value = 'Gamma Foods'; e.getCell('E3').value = 'Busan';
  e.getCell('D4').value = 'Delta Foods'; e.getCell('E4').value = 'Daegu';
  await save(exp, join(dir, 'expected.xlsx'));

  writeFileSync(join(dir, 'meta.yaml'),
`description: ADR-0068/0069 — two @block side-by-side, each bound to a different source via @source proximity scoping. Block 1 iterates Customers (2 rows), block 2 iterates Vendors (3 rows); both expand independently per ADR-0066 column-scoped splice.
spec_section: ADR-0068
spec_version: "0.1"
tags: [adr-0068, adr-0069, multi-block, multi-source]
verified_by: [manual-script]
`);
}

// =====================================================================
// 148 — multi-block-different-start-rows: vertically stacked blocks
// =====================================================================
{
  const dir = join(ROOT, '148-multi-block-different-start-rows');
  mkdirSync(dir, { recursive: true });
  const tpl = new ExcelJS.Workbook();
  defaultConfig(tpl, 'Customers');
  addSources(tpl, [
    { name: 'Customers', sheet: 'Customers' },
    { name: 'Vendors',   sheet: 'Vendors' },
  ]);
  const rep = tpl.addWorksheet('Report');
  // Block 1 at rows 1-3
  rep.getCell('A1').value = '{{ @block A:B }}'; rep.getCell('B1').value = '{{ @source Customers }}';
  rep.getCell('A2').value = 'Customer'; rep.getCell('B2').value = 'Total';
  rep.getCell('A3').value = '{{ [Name] }}'; rep.getCell('B3').value = '{{ [Total] }}';
  // Static gap row 4
  rep.getCell('A4').value = '(vendors below)';
  // Block 2 at rows 5-7
  rep.getCell('A5').value = '{{ @block A:B }}'; rep.getCell('B5').value = '{{ @source Vendors }}';
  rep.getCell('A6').value = 'Vendor'; rep.getCell('B6').value = 'Region';
  rep.getCell('A7').value = '{{ [Name] }}'; rep.getCell('B7').value = '{{ [Region] }}';
  await save(tpl, join(dir, 'template.xlsx'));

  const data = new ExcelJS.Workbook();
  const c = data.addWorksheet('Customers');
  c.getCell('A1').value = 'Name'; c.getCell('B1').value = 'Total';
  c.getCell('A2').value = 'Acme'; c.getCell('B2').value = 1000;
  c.getCell('A3').value = 'Beta'; c.getCell('B3').value = 2000;
  const v = data.addWorksheet('Vendors');
  v.getCell('A1').value = 'Name'; v.getCell('B1').value = 'Region';
  v.getCell('A2').value = 'Alpha Foods'; v.getCell('B2').value = 'Seoul';
  v.getCell('A3').value = 'Gamma Foods'; v.getCell('B3').value = 'Busan';
  await save(data, join(dir, 'data.xlsx'));

  // After directive row 1 + row 5 removal (2 rows): all rows shift up by 2.
  // Block 1 data at rows 2-3 (was 3-4, then -2 for directive removals at rows 1,5).
  // Actually: directive rows are 1 and 5. Removing both:
  //   - remove row 5 first (reverse order), then row 1
  //   - original row 1 removed, row 5 removed
  //   - row 2 (header "Customer/Total") → row 1
  //   - row 3 (markers) → row 2 — expanded to 2 records → rows 2-3
  //   - row 4 (static "(vendors below)") → row 3 (after block 1 expansion: → row 4)
  //   - row 5 removed
  //   - row 6 (header "Vendor/Region") → row 4 (then +1 from block 1 expansion = row 5)
  //   - row 7 (markers) → row 5 → expanded to 2 records → rows 5-6
  const exp = new ExcelJS.Workbook();
  const e = exp.addWorksheet('Report');
  e.getCell('A1').value = 'Customer'; e.getCell('B1').value = 'Total';
  e.getCell('A2').value = 'Acme'; e.getCell('B2').value = 1000;
  e.getCell('A3').value = 'Beta'; e.getCell('B3').value = 2000;
  e.getCell('A4').value = '(vendors below)';
  e.getCell('A5').value = 'Vendor'; e.getCell('B5').value = 'Region';
  e.getCell('A6').value = 'Alpha Foods'; e.getCell('B6').value = 'Seoul';
  e.getCell('A7').value = 'Gamma Foods'; e.getCell('B7').value = 'Busan';
  await save(exp, join(dir, 'expected.xlsx'));

  writeFileSync(join(dir, 'meta.yaml'),
`description: ADR-0068 — two @block vertically stacked on the same sheet (same column range, different start rows). Block 1's expansion shifts block 2 down because their column ranges overlap; this is the only case where multi-block row shifts cascade per ADR-0066.
spec_section: ADR-0068
spec_version: "0.1"
tags: [adr-0068, multi-block, stacked-blocks]
verified_by: [manual-script]
`);
}

// =====================================================================
// 150 — block-full-rect-explicit: @block A2:D3 form positive-path
// =====================================================================
{
  const dir = join(ROOT, '150-block-full-rect-explicit');
  mkdirSync(dir, { recursive: true });
  const tpl = new ExcelJS.Workbook();
  defaultConfig(tpl);
  const rep = tpl.addWorksheet('Report');
  // Header at row 2 is OUTSIDE the explicit A3:C3 block, so it stays
  // in place (no cloning per record) per ADR-0066 outside-cell
  // preservation; the block expands a single-row template only.
  rep.getCell('A1').value = '{{ @block A3:C3 }}';
  rep.getCell('A2').value = 'Item';
  rep.getCell('B2').value = 'Qty';
  rep.getCell('C2').value = 'Price';
  rep.getCell('A3').value = '{{ [Item] }}';
  rep.getCell('B3').value = '{{ [Qty] }}';
  rep.getCell('C3').value = '{{ [Price] }}';
  await save(tpl, join(dir, 'template.xlsx'));

  const data = new ExcelJS.Workbook();
  const ws = data.addWorksheet('Primary');
  ws.getCell('A1').value = 'Item'; ws.getCell('B1').value = 'Qty'; ws.getCell('C1').value = 'Price';
  ws.getCell('A2').value = 'Apple'; ws.getCell('B2').value = 3; ws.getCell('C2').value = 10;
  ws.getCell('A3').value = 'Banana'; ws.getCell('B3').value = 5; ws.getCell('C3').value = 7;
  await save(data, join(dir, 'data.xlsx'));

  // After directive row 1 removal: header at row 1, markers at row 2.
  // Single-row block (templateRowCount=1) expands to 2 records at
  // rows 2 and 3.
  const exp = new ExcelJS.Workbook();
  const e = exp.addWorksheet('Report');
  e.getCell('A1').value = 'Item';   e.getCell('B1').value = 'Qty';   e.getCell('C1').value = 'Price';
  e.getCell('A2').value = 'Apple';  e.getCell('B2').value = 3;       e.getCell('C2').value = 10;
  e.getCell('A3').value = 'Banana'; e.getCell('B3').value = 5;       e.getCell('C3').value = 7;
  await save(exp, join(dir, 'expected.xlsx'));

  writeFileSync(join(dir, 'meta.yaml'),
`description: ADR-0067 — @block A3:C3 full-rect form with explicit row and column boundaries. The header at row 2 is outside the block and stays at its original row per ADR-0066 outside-cell preservation.
spec_section: ADR-0067
spec_version: "0.1"
tags: [adr-0067, block-directive, full-rect]
verified_by: [manual-script]
`);
}

// =====================================================================
// 154 — multi-block-per-block-filter: per-block @filter
// =====================================================================
{
  const dir = join(ROOT, '154-multi-block-per-block-filter');
  mkdirSync(dir, { recursive: true });
  const tpl = new ExcelJS.Workbook();
  defaultConfig(tpl);
  const rep = tpl.addWorksheet('Report');
  // Block 1: filter Status="VIP"
  rep.getCell('A1').value = '{{ @block A:B }}'; rep.getCell('B1').value = '{{ @filter [Status] = "VIP" }}';
  // Block 2: filter Status="Standard"
  rep.getCell('D1').value = '{{ @block D:E }}'; rep.getCell('E1').value = '{{ @filter [Status] = "Standard" }}';
  rep.getCell('A2').value = 'VIP Customer'; rep.getCell('B2').value = 'Amount';
  rep.getCell('D2').value = 'Standard Customer'; rep.getCell('E2').value = 'Amount';
  rep.getCell('A3').value = '{{ [Name] }}'; rep.getCell('B3').value = '{{ [Amount] }}';
  rep.getCell('D3').value = '{{ [Name] }}'; rep.getCell('E3').value = '{{ [Amount] }}';
  await save(tpl, join(dir, 'template.xlsx'));

  const data = new ExcelJS.Workbook();
  const ws = data.addWorksheet('Primary');
  ws.getCell('A1').value = 'Name'; ws.getCell('B1').value = 'Amount'; ws.getCell('C1').value = 'Status';
  ws.getCell('A2').value = 'Acme'; ws.getCell('B2').value = 1000; ws.getCell('C2').value = 'VIP';
  ws.getCell('A3').value = 'Beta'; ws.getCell('B3').value = 500;  ws.getCell('C3').value = 'Standard';
  ws.getCell('A4').value = 'Gamma'; ws.getCell('B4').value = 2000; ws.getCell('C4').value = 'VIP';
  ws.getCell('A5').value = 'Delta'; ws.getCell('B5').value = 300;  ws.getCell('C5').value = 'Standard';
  await save(data, join(dir, 'data.xlsx'));

  // After directive row 1 removal: headers at row 1.
  // Block 1 (VIP filter): Acme/1000, Gamma/2000 at rows 2-3.
  // Block 2 (Standard filter): Beta/500, Delta/300 at rows 2-3.
  const exp = new ExcelJS.Workbook();
  const e = exp.addWorksheet('Report');
  e.getCell('A1').value = 'VIP Customer';      e.getCell('B1').value = 'Amount';
  e.getCell('D1').value = 'Standard Customer'; e.getCell('E1').value = 'Amount';
  e.getCell('A2').value = 'Acme';  e.getCell('B2').value = 1000;
  e.getCell('A3').value = 'Gamma'; e.getCell('B3').value = 2000;
  e.getCell('D2').value = 'Beta';  e.getCell('E2').value = 500;
  e.getCell('D3').value = 'Delta'; e.getCell('E3').value = 300;
  await save(exp, join(dir, 'expected.xlsx'));

  writeFileSync(join(dir, 'meta.yaml'),
`description: ADR-0069 — each @block gets its own @filter via proximity scoping. Block 1 (col A:B) gets the VIP filter; block 2 (col D:E) gets the Standard filter; the two blocks iterate the same source but produce filtered subsets independently.
spec_section: ADR-0069
spec_version: "0.1"
tags: [adr-0069, multi-block, per-block-filter, directive-scoping]
verified_by: [manual-script]
`);
}

// =====================================================================
// 155 — multi-block-row-function-scope: ROW() per block
// =====================================================================
{
  const dir = join(ROOT, '155-multi-block-row-function-scope');
  mkdirSync(dir, { recursive: true });
  const tpl = new ExcelJS.Workbook();
  defaultConfig(tpl);
  const rep = tpl.addWorksheet('Report');
  rep.getCell('A1').value = '{{ @block A:B }}';
  rep.getCell('D1').value = '{{ @block D:E }}';
  rep.getCell('A2').value = '#'; rep.getCell('B2').value = 'Customer';
  rep.getCell('D2').value = '#'; rep.getCell('E2').value = 'Customer';
  rep.getCell('A3').value = '{{ ROW() }}'; rep.getCell('B3').value = '{{ [Name] }}';
  rep.getCell('D3').value = '{{ ROW() }}'; rep.getCell('E3').value = '{{ [Name] }}';
  await save(tpl, join(dir, 'template.xlsx'));

  const data = new ExcelJS.Workbook();
  const ws = data.addWorksheet('Primary');
  ws.getCell('A1').value = 'Name';
  ws.getCell('A2').value = 'Acme';
  ws.getCell('A3').value = 'Beta';
  ws.getCell('A4').value = 'Gamma';
  await save(data, join(dir, 'data.xlsx'));

  // Each block's ROW() starts at 1 independently (block-scoped per ADR-0066).
  const exp = new ExcelJS.Workbook();
  const e = exp.addWorksheet('Report');
  e.getCell('A1').value = '#'; e.getCell('B1').value = 'Customer';
  e.getCell('D1').value = '#'; e.getCell('E1').value = 'Customer';
  e.getCell('A2').value = 1; e.getCell('B2').value = 'Acme';
  e.getCell('A3').value = 2; e.getCell('B3').value = 'Beta';
  e.getCell('A4').value = 3; e.getCell('B4').value = 'Gamma';
  e.getCell('D2').value = 1; e.getCell('E2').value = 'Acme';
  e.getCell('D3').value = 2; e.getCell('E3').value = 'Beta';
  e.getCell('D4').value = 3; e.getCell('E4').value = 'Gamma';
  await save(exp, join(dir, 'expected.xlsx'));

  writeFileSync(join(dir, 'meta.yaml'),
`description: ADR-0066 + ADR-0069 — ROW() returns the iteration index of the block that contains the cell. In a sheet with two blocks both iterating the same 3-row source, each block's ROW() column independently produces 1,2,3 — proving the function is block-scoped by cell position.
spec_section: ADR-0066
spec_version: "0.1"
tags: [adr-0066, adr-0069, row-function, multi-block]
verified_by: [manual-script]
`);
}

console.log('Fixtures 147, 148, 150, 154, 155 written.');
