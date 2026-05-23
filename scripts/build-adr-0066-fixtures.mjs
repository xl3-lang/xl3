// Build 5 conformance fixtures for ADR-0066 (column-scoped data block).
import ExcelJS from 'exceljs';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = '/Users/wefun/workspaces/playground/xl3/conformance/fixtures';

async function save(wb, path) {
  const buf = await wb.xlsx.writeBuffer();
  writeFileSync(path, Buffer.from(buf));
}

function configSheet(wb, sourceSheet = 'Data') {
  const cfg = wb.addWorksheet('__config__');
  cfg.getCell('A1').value = 'name';      cfg.getCell('B1').value = 'fixture';
  cfg.getCell('A2').value = 'source_sheet'; cfg.getCell('B2').value = sourceSheet;
  cfg.getCell('A3').value = 'source_table'; cfg.getCell('B3').value = '1';
  cfg.getCell('A4').value = 'output_file_pattern'; cfg.getCell('B4').value = 'output.xlsx';
  return cfg;
}

// =====================================================================
// 141 — block-column-scoped-side-cells: static side cells preserved
// =====================================================================
{
  const dir = join(ROOT, '141-block-column-scoped-side-cells');
  mkdirSync(dir, { recursive: true });

  // Template
  const tpl = new ExcelJS.Workbook();
  configSheet(tpl);
  const rep = tpl.addWorksheet('Report');
  rep.getCell('A1').value = 'Customer';
  rep.getCell('B1').value = 'Amount';
  rep.getCell('A2').value = '{{ [Customer] }}';
  rep.getCell('B2').value = '{{ [Amount] }}';
  rep.getCell('D2').value = 'side-info';      // outside, same row as block
  rep.getCell('D3').value = 'sidebar-row-2';  // outside, below block row
  await save(tpl, join(dir, 'template.xlsx'));

  // Data
  const data = new ExcelJS.Workbook();
  const dws = data.addWorksheet('Data');
  dws.getCell('A1').value = 'Customer'; dws.getCell('B1').value = 'Amount';
  dws.getCell('A2').value = 'Acme';  dws.getCell('B2').value = 100;
  dws.getCell('A3').value = 'Beta';  dws.getCell('B3').value = 200;
  dws.getCell('A4').value = 'Gamma'; dws.getCell('B4').value = 300;
  await save(data, join(dir, 'data.xlsx'));

  // Expected — outside D2 stays at row 2, D3 stays at row 3 (NOT shifted)
  const exp = new ExcelJS.Workbook();
  const ers = exp.addWorksheet('Report');
  ers.getCell('A1').value = 'Customer';
  ers.getCell('B1').value = 'Amount';
  ers.getCell('A2').value = 'Acme';  ers.getCell('B2').value = 100;
  ers.getCell('A3').value = 'Beta';  ers.getCell('B3').value = 200;
  ers.getCell('A4').value = 'Gamma'; ers.getCell('B4').value = 300;
  ers.getCell('D2').value = 'side-info';     // ADR-0066: NOT cloned, original position
  ers.getCell('D3').value = 'sidebar-row-2'; // ADR-0066: NOT shifted
  await save(exp, join(dir, 'expected.xlsx'));

  writeFileSync(join(dir, 'meta.yaml'),
`description: ADR-0066 — static outside-block cells stay at original row positions across expansion (not cloned, not shifted).
spec_section: ADR-0066
spec_version: "0.1"
tags: [adr-0066, column-scoped-block, outside-cells]
verified_by: [manual-script]
`);
}

// =====================================================================
// 142 — block-column-scoped-side-formulas: outside formulas + refs preserved
// =====================================================================
{
  const dir = join(ROOT, '142-block-column-scoped-side-formulas');
  mkdirSync(dir, { recursive: true });

  const tpl = new ExcelJS.Workbook();
  configSheet(tpl);
  const rep = tpl.addWorksheet('Report');
  rep.getCell('A1').value = 'Customer';
  rep.getCell('B1').value = 'Amount';
  rep.getCell('A2').value = '{{ [Customer] }}';
  rep.getCell('B2').value = '{{ [Amount] }}';
  // Outside formula references — should NOT shift (#47 scenario)
  rep.getCell('D2').value = 'Sum (outside)';
  rep.getCell('E2').value = { formula: 'SUM(B:B)' }; // whole-column ref, safe under any expansion
  rep.getCell('D3').value = 'Note';
  rep.getCell('E3').value = { formula: 'E2*2' };     // narrow ref to outside cell — stays valid because E2 doesn't shift
  await save(tpl, join(dir, 'template.xlsx'));

  const data = new ExcelJS.Workbook();
  const dws = data.addWorksheet('Data');
  dws.getCell('A1').value = 'Customer'; dws.getCell('B1').value = 'Amount';
  dws.getCell('A2').value = 'X'; dws.getCell('B2').value = 10;
  dws.getCell('A3').value = 'Y'; dws.getCell('B3').value = 20;
  await save(data, join(dir, 'data.xlsx'));

  const exp = new ExcelJS.Workbook();
  const ers = exp.addWorksheet('Report');
  ers.getCell('A1').value = 'Customer';
  ers.getCell('B1').value = 'Amount';
  ers.getCell('A2').value = 'X'; ers.getCell('B2').value = 10;
  ers.getCell('A3').value = 'Y'; ers.getCell('B3').value = 20;
  ers.getCell('D2').value = 'Sum (outside)';
  ers.getCell('E2').value = { formula: 'SUM(B:B)' };
  ers.getCell('D3').value = 'Note';
  ers.getCell('E3').value = { formula: 'E2*2' };
  await save(exp, join(dir, 'expected.xlsx'));

  writeFileSync(join(dir, 'meta.yaml'),
`description: ADR-0066 — outside-block formula cells preserved verbatim; row references in shifted-cell formulas are NOT stale because outside cells do not shift (#47 regression).
spec_section: ADR-0066
spec_version: "0.1"
tags: [adr-0066, column-scoped-block, outside-formulas]
verified_by: [manual-script]
`);
}

// =====================================================================
// 143 — block-shared-formula-side-cells: shared-formula owners outside block not duplicated (#46 regression)
// =====================================================================
{
  const dir = join(ROOT, '143-block-shared-formula-side-cells');
  mkdirSync(dir, { recursive: true });

  const tpl = new ExcelJS.Workbook();
  configSheet(tpl);
  const rep = tpl.addWorksheet('Report');
  rep.getCell('A1').value = 'Customer';
  rep.getCell('B1').value = 'Amount';
  rep.getCell('A2').value = '{{ [Customer] }}';
  rep.getCell('B2').value = '{{ [Amount] }}';
  // Outside shared formula owner + slave (the #46 trigger)
  rep.getCell('D2').value = 'group-A';
  rep.getCell('E2').value = { formula: 'SUMIF($A:$A,$D2,$B:$B)', ref: 'E2:E3', shareType: 'shared' };
  rep.getCell('D3').value = 'group-B';
  rep.getCell('E3').value = { sharedFormula: 'E2' };
  await save(tpl, join(dir, 'template.xlsx'));

  const data = new ExcelJS.Workbook();
  const dws = data.addWorksheet('Data');
  dws.getCell('A1').value = 'Customer'; dws.getCell('B1').value = 'Amount';
  for (let i = 0; i < 8; i++) {
    dws.getCell(`A${i+2}`).value = i % 2 === 0 ? 'group-A' : 'group-B';
    dws.getCell(`B${i+2}`).value = 100 * (i + 1);
  }
  await save(data, join(dir, 'data.xlsx'));

  // Expected: outside D/E cells stay at rows 2-3 only. NOT 8 duplicates.
  const exp = new ExcelJS.Workbook();
  const ers = exp.addWorksheet('Report');
  ers.getCell('A1').value = 'Customer';
  ers.getCell('B1').value = 'Amount';
  for (let i = 0; i < 8; i++) {
    ers.getCell(`A${i+2}`).value = i % 2 === 0 ? 'group-A' : 'group-B';
    ers.getCell(`B${i+2}`).value = 100 * (i + 1);
  }
  // Side cells preserved at original positions (rows 2-3, cols D/E).
  // The shared formula owner E2 + slave E3 are preserved as-is from
  // template. Critically: D4..D9 and E4..E9 are EMPTY (not duplicated
  // owners — the #46 fix).
  ers.getCell('D2').value = 'group-A';
  ers.getCell('E2').value = { formula: 'SUMIF($A:$A,$D2,$B:$B)', ref: 'E2:E3', shareType: 'shared' };
  ers.getCell('D3').value = 'group-B';
  ers.getCell('E3').value = { sharedFormula: 'E2' };
  await save(exp, join(dir, 'expected.xlsx'));

  writeFileSync(join(dir, 'meta.yaml'),
`description: ADR-0066 + #46 regression — shared-formula owner cells in outside-block positions are NOT cloned into expanded rows. Side cells stay at original row positions.
spec_section: ADR-0066
spec_version: "0.1"
tags: [adr-0066, column-scoped-block, shared-formula, issue-46]
verified_by: [manual-script]
`);
}

// =====================================================================
// 144 — block-side-cells-after-block: rows BELOW block, inside-col vs outside-col distinction
// =====================================================================
{
  const dir = join(ROOT, '144-block-side-cells-after-block');
  mkdirSync(dir, { recursive: true });

  const tpl = new ExcelJS.Workbook();
  configSheet(tpl);
  const rep = tpl.addWorksheet('Report');
  rep.getCell('A1').value = 'Item';
  rep.getCell('B1').value = 'Qty';
  rep.getCell('A2').value = '{{ [Item] }}';
  rep.getCell('B2').value = '{{ [Qty] }}';
  // Row 3 — INSIDE-col footer (cols A,B = block cols) — SHIFTS with expansion
  rep.getCell('A3').value = 'Total';
  rep.getCell('B3').value = { formula: 'SUM(B2:B2)' };
  // Outside col side cell at row 3 — STAYS at row 3
  rep.getCell('D3').value = 'side note';
  await save(tpl, join(dir, 'template.xlsx'));

  const data = new ExcelJS.Workbook();
  const dws = data.addWorksheet('Data');
  dws.getCell('A1').value = 'Item'; dws.getCell('B1').value = 'Qty';
  dws.getCell('A2').value = 'Apple'; dws.getCell('B2').value = 3;
  dws.getCell('A3').value = 'Banana'; dws.getCell('B3').value = 5;
  dws.getCell('A4').value = 'Cherry'; dws.getCell('B4').value = 7;
  await save(data, join(dir, 'data.xlsx'));

  // Expected: data rows 2-4 (3 records), footer at row 5 (shifted from 3),
  // side note STAYS at row 3 (NOT shifted)
  const exp = new ExcelJS.Workbook();
  const ers = exp.addWorksheet('Report');
  ers.getCell('A1').value = 'Item'; ers.getCell('B1').value = 'Qty';
  ers.getCell('A2').value = 'Apple'; ers.getCell('B2').value = 3;
  ers.getCell('A3').value = 'Banana'; ers.getCell('B3').value = 5;
  ers.getCell('A4').value = 'Cherry'; ers.getCell('B4').value = 7;
  ers.getCell('A5').value = 'Total';
  ers.getCell('B5').value = { formula: 'SUM(B2:B2)' };
  ers.getCell('D3').value = 'side note';
  await save(exp, join(dir, 'expected.xlsx'));

  writeFileSync(join(dir, 'meta.yaml'),
`description: ADR-0066 — inside-col cells below the data block (e.g., a footer in block columns) DO shift with expansion; outside-col cells below the data block stay at their original row positions.
spec_section: ADR-0066
spec_version: "0.1"
tags: [adr-0066, column-scoped-block, footer, outside-cells]
verified_by: [manual-script]
`);
}

// =====================================================================
// 145 — block-bracket-outside-error: [col] reference in outside cell raises parse error
// (deferred until error code is implemented — placeholder fixture)
// =====================================================================
// Skipped for now — `xl3/expression/bracket-outside-block` is part of the
// follow-up commit. Will land as fixture 145 in 0.7.1.

console.log('Fixtures 141-144 written.');
