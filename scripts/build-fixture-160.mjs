// Build conformance fixture 160 — a formula cell's cached result is NOT a
// template marker (issue #66, the self-corruption path).
//
// Authored from the spec (ADR-0046 "Cell formula preservation" +
// language.md § "Group + Subtotal") — NOT by running the reference impl.
// See conformance/AUTHORING.md.
//
// The gap this fixture closes: marker/directive recognition scans a cell's
// literal text. A native Excel/LibreOffice label formula caches its
// computed `<v>` result; if that cached string happens to look like a
// marker (e.g. `INDIRECT("B"&(ROW()-1))&" / Subtotal"` caches
// `{{ [Customer] }} / Subtotal` after an open-and-save), the pre-fix parser
// read the cache as a LIVE marker and demoted the @subtotal row to a data
// row — the template corrupted itself with no author edit. A formula cell
// is preserved verbatim (ADR-0046) and re-evaluated by Excel at open; its
// cached result MUST NOT introduce template markers. So the row here stays
// a proper @subtotal row: the label formula is preserved, and the band
// fires once per group with per-group sums (not repeated grand totals).
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
  cfg.getCell('A1').value = 'name';             cfg.getCell('B1').value = 'subtotal-formula-cache-not-marker';
  cfg.getCell('A2').value = 'source_sheet';     cfg.getCell('B2').value = sourceSheet;
  cfg.getCell('A3').value = 'source_table';     cfg.getCell('B3').value = '1';
  cfg.getCell('A4').value = 'output_file_pattern'; cfg.getCell('B4').value = 'output.xlsx';
  return cfg;
}

// The subtotal-row label formula. Its cached <v> is deliberately a
// marker-looking string to simulate a round-tripped template.
const LABEL_FORMULA = 'INDIRECT("B"&(ROW()-1))&" / Subtotal"';
const LABEL_CACHE = '{{ [Customer] }} / Subtotal';

{
  const dir = join(ROOT, '160-subtotal-formula-cache-not-marker');
  mkdirSync(dir, { recursive: true });

  // Template — @group block; the subtotal row's A cell is a NATIVE FORMULA
  // whose cached result contains marker-looking text.
  const tpl = new ExcelJS.Workbook();
  configSheet(tpl);
  const rep = tpl.addWorksheet('Report');
  rep.getCell('A1').value = '{{ @group [Customer] }}';
  rep.getCell('A2').value = '{{ [Region] }}';
  rep.getCell('B2').value = '{{ [Customer] }}';
  rep.getCell('C2').value = '{{ [Amount] }}';
  rep.getCell('A3').value = { formula: LABEL_FORMULA, result: LABEL_CACHE };
  rep.getCell('C3').value = '{{ @subtotal SUM([Amount]) }}';
  await save(tpl, join(dir, 'template.xlsx'));

  // Data — Acme = 100 + 50 = 150, Beta = 200.
  const data = new ExcelJS.Workbook();
  const dws = data.addWorksheet('Data');
  dws.getCell('A1').value = 'Region';  dws.getCell('B1').value = 'Customer'; dws.getCell('C1').value = 'Amount';
  dws.getCell('A2').value = 'East';    dws.getCell('B2').value = 'Acme';     dws.getCell('C2').value = 100;
  dws.getCell('A3').value = 'East';    dws.getCell('B3').value = 'Acme';     dws.getCell('C3').value = 50;
  dws.getCell('A4').value = 'West';    dws.getCell('B4').value = 'Beta';     dws.getCell('C4').value = 200;
  await save(data, join(dir, 'data.xlsx'));

  // Expected — hand-computed. Data rows expand per record; the subtotal band
  // fires once at each @group boundary with the per-group SUM([Amount]).
  // The A label formula is preserved verbatim (ADR-0046 compares formula
  // TEXT; the cached result is not part of the contract).
  const exp = new ExcelJS.Workbook();
  const ers = exp.addWorksheet('Report');
  ers.getCell('A1').value = 'East'; ers.getCell('B1').value = 'Acme'; ers.getCell('C1').value = 100;
  ers.getCell('A2').value = 'East'; ers.getCell('B2').value = 'Acme'; ers.getCell('C2').value = 50;
  ers.getCell('A3').value = { formula: LABEL_FORMULA };            ers.getCell('C3').value = 150;
  ers.getCell('A4').value = 'West'; ers.getCell('B4').value = 'Beta'; ers.getCell('C4').value = 200;
  ers.getCell('A5').value = { formula: LABEL_FORMULA };            ers.getCell('C5').value = 200;
  await save(exp, join(dir, 'expected.xlsx'));

  writeFileSync(join(dir, 'meta.yaml'),
`description: A formula cell's cached <v> result is NOT template text — marker/directive recognition ignores formula cells (ADR-0046). A @subtotal row whose label is a native formula caching \`{{ [Customer] }} / Subtotal\` stays a proper subtotal row: the label formula is preserved verbatim and the band fires once per @group boundary with per-group SUM([Amount]) (150, 200), not the demoted grand-total-after-every-row symptom (issue #66 self-corruption path).
spec_section: ADR-0073 / ADR-0046 / language.md#group--subtotal / ADR-0038
spec_version: "0.1"
tags: [adr-0046, adr-0038, subtotal, formula-preservation, issue-66]
verified_by: [manual-script]
`);
}

console.log('Fixture 160 written.');
