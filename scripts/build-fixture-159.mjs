// Build conformance fixture 159 — subtotal-mixed-row error (issue #66).
//
// Authored from the spec (language.md § "Group + Subtotal", ADR-0038 /
// ADR-0058) — NOT by running the reference impl. See conformance/AUTHORING.md.
//
// The gap this fixture closes: a `@subtotal` row binds to a group boundary
// where there is no "current row", so it MUST NOT carry a current-row
// `[Column]` reference outside an aggregate — the spec requires an error.
// The pre-fix impl silently reclassified such a row as a SECOND data-row
// template: the subtotal band was emitted after EVERY data row with its
// `@subtotal` cells evaluating as block-level (grand-total) aggregates. The
// render succeeded with plausible-but-wrong numbers and no diagnostic — the
// worst failure mode for a template author (hit in production 2026-07-06).
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

function configSheet(wb, sourceSheet = 'Data') {
  const cfg = wb.addWorksheet('__config__');
  cfg.getCell('A1').value = 'name';             cfg.getCell('B1').value = 'subtotal-mixed-row';
  cfg.getCell('A2').value = 'source_sheet';     cfg.getCell('B2').value = sourceSheet;
  cfg.getCell('A3').value = 'source_table';     cfg.getCell('B3').value = '1';
  cfg.getCell('A4').value = 'output_file_pattern'; cfg.getCell('B4').value = 'output.xlsx';
  return cfg;
}

{
  const dir = join(ROOT, '159-subtotal-mixed-row-error');
  mkdirSync(dir, { recursive: true });

  // Template — a @group block whose subtotal row (row 3) illegally carries
  // a current-row [Customer] reference OUTSIDE the aggregate (in A3), next
  // to a legal @subtotal cell (C3).
  const tpl = new ExcelJS.Workbook();
  configSheet(tpl);
  const rep = tpl.addWorksheet('Report');
  rep.getCell('A1').value = '{{ @group [Customer] }}';
  rep.getCell('A2').value = '{{ [Region] }}';
  rep.getCell('B2').value = '{{ [Customer] }}';
  rep.getCell('C2').value = '{{ [Amount] }}';
  rep.getCell('A3').value = '{{ [Customer] }} subtotal'; // illegal current-row ref
  rep.getCell('C3').value = '{{ @subtotal SUM([Amount]) }}';
  await save(tpl, join(dir, 'template.xlsx'));

  // Data.
  const data = new ExcelJS.Workbook();
  const dws = data.addWorksheet('Data');
  dws.getCell('A1').value = 'Region';  dws.getCell('B1').value = 'Customer'; dws.getCell('C1').value = 'Amount';
  dws.getCell('A2').value = 'East';    dws.getCell('B2').value = 'Acme';     dws.getCell('C2').value = 100;
  dws.getCell('A3').value = 'East';    dws.getCell('B3').value = 'Acme';     dws.getCell('C3').value = 50;
  dws.getCell('A4').value = 'West';    dws.getCell('B4').value = 'Beta';     dws.getCell('C4').value = 200;
  await save(data, join(dir, 'data.xlsx'));

  writeFileSync(join(dir, 'meta.yaml'),
`description: 'A @subtotal row that also carries a current-row [Column] reference outside an aggregate raises xl3/subtotal/mixed-row (language.md "Group + Subtotal", ADR-0038/ADR-0058). The pre-fix impl silently demoted the row to a second data-row template and emitted grand-total values after every data row. Diagnostic substring: "may not carry per-row [Column] references".'
spec_section: language.md#group--subtotal / ADR-0073 / ADR-0038 / ADR-0058
spec_version: "0.1"
tags: [adr-0038, adr-0058, subtotal, error, negative-path, issue-66]
verified_by: [manual-script]
expected_error: 'may not carry per-row [Column] references'
expected_error_code: 'xl3/subtotal/mixed-row'
`);
}

console.log('Fixture 159 written.');
