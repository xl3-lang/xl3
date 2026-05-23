// Build 10 conformance fixtures for Phase 2 (ADRs 0067-0069).
import ExcelJS from 'exceljs';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = '/Users/wefun/workspaces/playground/xl3/conformance/fixtures';

async function save(wb, path) {
  writeFileSync(path, Buffer.from(await wb.xlsx.writeBuffer()));
}

function makeConfig(wb, sources = []) {
  const cfg = wb.addWorksheet('__config__');
  cfg.getCell('A1').value = 'name';      cfg.getCell('B1').value = 'fixture';
  cfg.getCell('A2').value = 'source_sheet'; cfg.getCell('B2').value = 'Primary';
  cfg.getCell('A3').value = 'source_table'; cfg.getCell('B3').value = '1';
  cfg.getCell('A4').value = 'output_file_pattern'; cfg.getCell('B4').value = 'output.xlsx';
  if (sources.length > 0) {
    const ss = wb.addWorksheet('__sources__');
    ss.getCell('A1').value = 'name'; ss.getCell('B1').value = 'sheet'; ss.getCell('C1').value = 'table';
    for (let i = 0; i < sources.length; i++) {
      const s = sources[i];
      ss.getCell(i+2, 1).value = s.name;
      ss.getCell(i+2, 2).value = s.sheet;
      ss.getCell(i+2, 3).value = s.table || '1';
    }
  }
}

// ─────────────────────────────────────────────────────────────────
// 146 — multi-block-explicit-two-tables: two side-by-side blocks,
// default source. Validates parser detects both, renderer expands
// both.
// ─────────────────────────────────────────────────────────────────
{
  const dir = join(ROOT, '146-multi-block-explicit-two-tables');
  mkdirSync(dir, { recursive: true });
  const tpl = new ExcelJS.Workbook();
  makeConfig(tpl);
  const rep = tpl.addWorksheet('Report');
  rep.getCell('A1').value = '{{ @block A:B }}';
  rep.getCell('D1').value = '{{ @block D:E }}';
  rep.getCell('A2').value = 'Customer'; rep.getCell('B2').value = 'Amount';
  rep.getCell('D2').value = 'Customer'; rep.getCell('E2').value = 'Amount';
  rep.getCell('A3').value = '{{ [Customer] }}'; rep.getCell('B3').value = '{{ [Amount] }}';
  rep.getCell('D3').value = '{{ [Customer] }}'; rep.getCell('E3').value = '{{ [Amount] }}';
  await save(tpl, join(dir, 'template.xlsx'));

  const data = new ExcelJS.Workbook();
  const ws = data.addWorksheet('Primary');
  ws.getCell('A1').value = 'Customer'; ws.getCell('B1').value = 'Amount';
  ws.getCell('A2').value = 'A'; ws.getCell('B2').value = 100;
  ws.getCell('A3').value = 'B'; ws.getCell('B3').value = 200;
  await save(data, join(dir, 'data.xlsx'));

  // After directive row 1 removal, every row shifts up by 1.
  const exp = new ExcelJS.Workbook();
  const er = exp.addWorksheet('Report');
  er.getCell('A1').value = 'Customer'; er.getCell('B1').value = 'Amount';
  er.getCell('D1').value = 'Customer'; er.getCell('E1').value = 'Amount';
  er.getCell('A2').value = 'A'; er.getCell('B2').value = 100;
  er.getCell('D2').value = 'A'; er.getCell('E2').value = 100;
  er.getCell('A3').value = 'B'; er.getCell('B3').value = 200;
  er.getCell('D3').value = 'B'; er.getCell('E3').value = 200;
  await save(exp, join(dir, 'expected.xlsx'));

  writeFileSync(join(dir, 'meta.yaml'),
`description: ADR-0067/0068 — two @block A:B and @block D:E side-by-side on the same sheet, both bound to the default source, both expand independently.
spec_section: ADR-0067
spec_version: "0.1"
tags: [adr-0067, adr-0068, multi-block, explicit-blocks]
verified_by: [manual-script]
`);
}

// ─────────────────────────────────────────────────────────────────
// 149 — block-col-range-explicit: @block A:D form
// ─────────────────────────────────────────────────────────────────
{
  const dir = join(ROOT, '149-block-col-range-explicit');
  mkdirSync(dir, { recursive: true });
  const tpl = new ExcelJS.Workbook();
  makeConfig(tpl);
  const rep = tpl.addWorksheet('Report');
  rep.getCell('A1').value = '{{ @block A:C }}';
  rep.getCell('A2').value = 'Customer'; rep.getCell('B2').value = 'Amount'; rep.getCell('C2').value = 'Tier';
  rep.getCell('A3').value = '{{ [Customer] }}'; rep.getCell('B3').value = '{{ [Amount] }}'; rep.getCell('C3').value = '{{ [Tier] }}';
  await save(tpl, join(dir, 'template.xlsx'));

  const data = new ExcelJS.Workbook();
  const ws = data.addWorksheet('Primary');
  ws.getCell('A1').value = 'Customer'; ws.getCell('B1').value = 'Amount'; ws.getCell('C1').value = 'Tier';
  ws.getCell('A2').value = 'X'; ws.getCell('B2').value = 100; ws.getCell('C2').value = 'VIP';
  ws.getCell('A3').value = 'Y'; ws.getCell('B3').value = 200; ws.getCell('C3').value = 'Std';
  await save(data, join(dir, 'data.xlsx'));

  // After directive row 1 removal, every row shifts up by 1.
  const exp = new ExcelJS.Workbook();
  const er = exp.addWorksheet('Report');
  er.getCell('A1').value = 'Customer'; er.getCell('B1').value = 'Amount'; er.getCell('C1').value = 'Tier';
  er.getCell('A2').value = 'X'; er.getCell('B2').value = 100; er.getCell('C2').value = 'VIP';
  er.getCell('A3').value = 'Y'; er.getCell('B3').value = 200; er.getCell('C3').value = 'Std';
  await save(exp, join(dir, 'expected.xlsx'));

  writeFileSync(join(dir, 'meta.yaml'),
`description: ADR-0067 — @block A:C col-range explicit form; row-range auto-detected from marker rows below.
spec_section: ADR-0067
spec_version: "0.1"
tags: [adr-0067, block-directive, col-range]
verified_by: [manual-script]
`);
}

// ─────────────────────────────────────────────────────────────────
// 151 — block-overlap-error
// ─────────────────────────────────────────────────────────────────
{
  const dir = join(ROOT, '151-block-overlap-error');
  mkdirSync(dir, { recursive: true });
  const tpl = new ExcelJS.Workbook();
  makeConfig(tpl);
  const rep = tpl.addWorksheet('Report');
  // Two overlapping @block declarations — A:D and C:F overlap at C-D
  rep.getCell('A1').value = '{{ @block A:D }}';
  rep.getCell('E1').value = '{{ @block C:F }}';
  rep.getCell('A2').value = '{{ [a] }}'; rep.getCell('D2').value = '{{ [d] }}';
  rep.getCell('F2').value = '{{ [f] }}';
  await save(tpl, join(dir, 'template.xlsx'));

  const data = new ExcelJS.Workbook();
  const ws = data.addWorksheet('Primary');
  ws.getCell('A1').value = 'a'; ws.getCell('B1').value = 'd'; ws.getCell('C1').value = 'f';
  ws.getCell('A2').value = 1; ws.getCell('B2').value = 2; ws.getCell('C2').value = 3;
  await save(data, join(dir, 'data.xlsx'));

  writeFileSync(join(dir, 'meta.yaml'),
`description: ADR-0068 — two @block declarations whose column ranges overlap raise xl3/block/overlap at parse time.
spec_section: ADR-0068
spec_version: "0.1"
tags: [adr-0068, multi-block, error, negative-path]
verified_by: [manual-script]
expected_error: "overlap"
expected_error_code: 'xl3/block/overlap'
`);
}

// ─────────────────────────────────────────────────────────────────
// 152 — block-empty-table-error
// ─────────────────────────────────────────────────────────────────
{
  const dir = join(ROOT, '152-block-empty-table-error');
  mkdirSync(dir, { recursive: true });
  const tpl = new ExcelJS.Workbook();
  makeConfig(tpl);
  const rep = tpl.addWorksheet('Report');
  // @block declared but no marker cells inside
  rep.getCell('A1').value = '{{ @block A2:D7 }}';
  rep.getCell('A2').value = 'just static text';
  rep.getCell('B2').value = 'no markers here';
  await save(tpl, join(dir, 'template.xlsx'));

  const data = new ExcelJS.Workbook();
  const ws = data.addWorksheet('Primary');
  ws.getCell('A1').value = 'x'; ws.getCell('A2').value = 1;
  await save(data, join(dir, 'data.xlsx'));

  writeFileSync(join(dir, 'meta.yaml'),
`description: ADR-0067 — @block A2:D7 declared but contains no marker cells. Raises xl3/block/empty-table.
spec_section: ADR-0067
spec_version: "0.1"
tags: [adr-0067, block-directive, error, negative-path]
verified_by: [manual-script]
expected_error: "no [Column] marker cells"
expected_error_code: 'xl3/block/empty-table'
`);
}

// ─────────────────────────────────────────────────────────────────
// 153 — directive-orphan-error
// ─────────────────────────────────────────────────────────────────
{
  const dir = join(ROOT, '153-directive-orphan-error');
  mkdirSync(dir, { recursive: true });
  const tpl = new ExcelJS.Workbook();
  makeConfig(tpl);
  const rep = tpl.addWorksheet('Report');
  // @block A:B, but @filter is in col F — no col-overlap
  rep.getCell('A1').value = '{{ @block A:B }}';
  rep.getCell('F1').value = '{{ @filter [Status] = "VIP" }}';
  rep.getCell('A2').value = '{{ [Customer] }}'; rep.getCell('B2').value = '{{ [Status] }}';
  await save(tpl, join(dir, 'template.xlsx'));

  const data = new ExcelJS.Workbook();
  const ws = data.addWorksheet('Primary');
  ws.getCell('A1').value = 'Customer'; ws.getCell('B1').value = 'Status';
  ws.getCell('A2').value = 'X'; ws.getCell('B2').value = 'VIP';
  await save(data, join(dir, 'data.xlsx'));

  writeFileSync(join(dir, 'meta.yaml'),
`description: ADR-0069 — @filter directive placed outside any @block's column range raises xl3/directive/orphan at parse time.
spec_section: ADR-0069
spec_version: "0.1"
tags: [adr-0069, directive-scoping, error, negative-path]
verified_by: [manual-script]
expected_error: "is not above any @block whose col-range overlaps"
expected_error_code: 'xl3/directive/orphan'
`);
}

console.log('Fixtures 146, 149, 151, 152, 153 written.');
