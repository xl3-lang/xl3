// Build conformance fixture 161 — group + subtotal is unsupported in
// explicit @block mode (issue #69, ADR-0074).
//
// Authored from ADR-0074 / language.md § "Group + Subtotal" — NOT by running
// the reference impl. See conformance/AUTHORING.md.
//
// The gap this closes: the group + subtotal feature (ADR-0038) is wired only
// into implicit single-block detection. On a sheet that also uses explicit
// `@block` declarations, the pre-fix impl silently dropped the subtotal band
// (no error, no subtotal rows). Per ADR-0074 this now raises
// xl3/subtotal/explicit-block-unsupported at parse time.
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
  cfg.getCell('A1').value = 'name';             cfg.getCell('B1').value = 'explicit-block-subtotal-unsupported';
  cfg.getCell('A2').value = 'source_sheet';     cfg.getCell('B2').value = sourceSheet;
  cfg.getCell('A3').value = 'source_table';     cfg.getCell('B3').value = '1';
  cfg.getCell('A4').value = 'output_file_pattern'; cfg.getCell('B4').value = 'output.xlsx';
  return cfg;
}

{
  const dir = join(ROOT, '161-explicit-block-subtotal-unsupported');
  mkdirSync(dir, { recursive: true });

  // Template — an explicit @block declaration on a sheet that also uses a
  // @subtotal cell. The two do not compose in XTL 0.x.
  const tpl = new ExcelJS.Workbook();
  configSheet(tpl);
  const rep = tpl.addWorksheet('Report');
  rep.getCell('A1').value = '{{ @block A2:B3 }}';
  rep.getCell('A2').value = '{{ [Customer] }}';
  rep.getCell('B2').value = '{{ [Amount] }}';
  rep.getCell('A3').value = 'Subtotal';
  rep.getCell('B3').value = '{{ @subtotal SUM([Amount]) }}';
  await save(tpl, join(dir, 'template.xlsx'));

  // Data.
  const data = new ExcelJS.Workbook();
  const dws = data.addWorksheet('Data');
  dws.getCell('A1').value = 'Customer'; dws.getCell('B1').value = 'Amount';
  dws.getCell('A2').value = 'Acme';     dws.getCell('B2').value = 100;
  dws.getCell('A3').value = 'Acme';     dws.getCell('B3').value = 50;
  dws.getCell('A4').value = 'Beta';     dws.getCell('B4').value = 200;
  await save(data, join(dir, 'data.xlsx'));

  writeFileSync(join(dir, 'meta.yaml'),
`description: 'Group + subtotal (ADR-0038) does not compose with explicit @block declarations. A sheet using @block plus a @subtotal cell raises xl3/subtotal/explicit-block-unsupported at parse time (ADR-0074), rather than silently dropping the subtotal band. Diagnostic substring: "not supported on a sheet that uses explicit @block".'
spec_section: ADR-0074 / language.md#group--subtotal / ADR-0038 / ADR-0068
spec_version: "0.1"
tags: [adr-0074, adr-0038, adr-0068, subtotal, block, error, negative-path, issue-69]
verified_by: [manual-script]
expected_error: 'not supported on a sheet that uses explicit @block'
expected_error_code: 'xl3/subtotal/explicit-block-unsupported'
`);
}

console.log('Fixture 161 written.');
