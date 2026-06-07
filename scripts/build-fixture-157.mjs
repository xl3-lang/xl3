// Build conformance fixture 157 — ADR-0066 side cells next to a
// @group/@subtotal block (issue #51).
//
// Authored from spec prose (evaluation.md Render Phases 7/9 + ADR-0038
// interleaved subtotals + ADR-0066 outside-cell preservation), NOT by
// running the reference impl — see conformance/AUTHORING.md. exceljs is
// used only as a generic xlsx writer.
//
// The gap this fixture closes: no corpus fixture combines
// @group/@subtotal with ADR-0066 outside-block cells, so a grouped
// engine that emits side rows once per group (xl3-rs#3) passes the
// whole corpus while diverging at stage 1. This pins the reference
// layout: the side summary appears EXACTLY ONCE, at its original row
// in the post-directive-removal coordinate system.
//
// Expected derivation (by hand):
//   template:  r1 headers | r2 @sort | r3 @group | r4 data markers |
//              r5 subtotal row | P6/Q6 side | P16/Q16 side
//   10 records, 2 group keys, 5 rows each (after @sort).
//   Phase 7 grouped expansion: block rows 4-5 -> 12 output rows
//     (5 data + 1 subtotal per group); outside cells stay at r6/r16.
//   Phase 9 removes directive rows r2/r3 -> everything below shifts
//     up 2 (row-wide; ADR-0066's no-shift guarantee is scoped to the
//     EXPANSION splice only).
//   => r1 headers; r2-6 group-1 data; r7 subtotal 2500;
//      r8-12 group-2 data; r13 subtotal 3000;
//      P4/Q4 = TOTAL/5500 (inside group-1's span);
//      P14/Q14 = GRAND/9999 (beyond the whole grouped output).
import ExcelJS from 'exceljs';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', 'conformance', 'fixtures');

async function save(wb, path) {
  const buf = await wb.xlsx.writeBuffer();
  writeFileSync(path, Buffer.from(buf));
}

function configSheet(wb, sourceSheet = 'Raw') {
  const cfg = wb.addWorksheet('__config__');
  cfg.getCell('A1').value = 'name';      cfg.getCell('B1').value = 'fixture';
  cfg.getCell('A2').value = 'source_sheet'; cfg.getCell('B2').value = sourceSheet;
  cfg.getCell('A3').value = 'source_table'; cfg.getCell('B3').value = '1';
  cfg.getCell('A4').value = 'output_file_pattern'; cfg.getCell('B4').value = 'output.xlsx';
  return cfg;
}

// =====================================================================
// 157 — group-block-side-cells: outside cells next to a grouped block
// are emitted exactly once at their original (post-directive-removal)
// rows — never once per group.
// =====================================================================
{
  const dir = join(ROOT, '157-group-block-side-cells');
  mkdirSync(dir, { recursive: true });

  // Template
  const tpl = new ExcelJS.Workbook();
  configSheet(tpl);
  const main = tpl.addWorksheet('Main');
  main.getCell('A1').value = 'a';
  main.getCell('B1').value = 'b';
  main.getCell('A2').value = '{{ @sort [a] }}';
  main.getCell('A3').value = '{{ @group [a] }}';
  main.getCell('A4').value = '{{ [a] }}';
  main.getCell('B4').value = '{{ [b] }}';
  main.getCell('A5').value = 'Subtotal';
  main.getCell('B5').value = '{{ @subtotal SUM([b]) }}';
  // Side summary (outside cols P/Q) below the block's template rows —
  // lands inside group-1's output span after expansion.
  main.getCell('P6').value = 'TOTAL';
  main.getCell('Q6').value = 5500;
  // Second side row whose original position falls beyond the whole
  // grouped output — exercises the restore-at-original-row semantics
  // past the last subtotal row.
  main.getCell('P16').value = 'GRAND';
  main.getCell('Q16').value = 9999;
  await save(tpl, join(dir, 'template.xlsx'));

  // Data — 10 records, 2 group keys interleaved in source order;
  // @sort [a] makes the groups contiguous (group-1 first).
  const data = new ExcelJS.Workbook();
  const ws = data.addWorksheet('Raw');
  ws.getCell('A1').value = 'a';
  ws.getCell('B1').value = 'b';
  for (let i = 0; i < 10; i++) {
    ws.getCell(`A${i + 2}`).value = i % 2 === 0 ? 'group-1' : 'group-2';
    ws.getCell(`B${i + 2}`).value = 100 * (i + 1);
  }
  await save(data, join(dir, 'data.xlsx'));

  // Expected — hand-computed (see derivation in the header comment).
  // group-1 b values (source order): 100, 300, 500, 700, 900 -> 2500
  // group-2 b values (source order): 200, 400, 600, 800, 1000 -> 3000
  const exp = new ExcelJS.Workbook();
  const ers = exp.addWorksheet('Main');
  ers.getCell('A1').value = 'a';
  ers.getCell('B1').value = 'b';
  const g1 = [100, 300, 500, 700, 900];
  const g2 = [200, 400, 600, 800, 1000];
  g1.forEach((b, i) => {
    ers.getCell(`A${2 + i}`).value = 'group-1';
    ers.getCell(`B${2 + i}`).value = b;
  });
  ers.getCell('A7').value = 'Subtotal';
  ers.getCell('B7').value = 2500;
  g2.forEach((b, i) => {
    ers.getCell(`A${8 + i}`).value = 'group-2';
    ers.getCell(`B${8 + i}`).value = b;
  });
  ers.getCell('A13').value = 'Subtotal';
  ers.getCell('B13').value = 3000;
  // Side cells: exactly once, at original rows shifted only by the
  // phase-9 directive-row removal (r6 -> r4, r16 -> r14).
  ers.getCell('P4').value = 'TOTAL';
  ers.getCell('Q4').value = 5500;
  ers.getCell('P14').value = 'GRAND';
  ers.getCell('Q14').value = 9999;
  await save(exp, join(dir, 'expected.xlsx'));

  writeFileSync(join(dir, 'meta.yaml'),
`description: ADR-0066 outside-block cells next to a @group/@subtotal block are emitted exactly once at their original (post-directive-removal) row positions — never duplicated per group. Pins the grouped variant of the side-summary layout for compose-model engines.
spec_section: evaluation.md Render Phases / ADR-0038 / ADR-0066
spec_version: "0.1"
tags: [adr-0066, adr-0038, group, subtotal, outside-cells]
verified_by: [manual-script]
`);
}

console.log('Fixture 157 written.');
