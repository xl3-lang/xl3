// Build conformance fixture 156 — native static/outside cell value
// preservation (issue #49).
//
// Authored from spec prose (evaluation.md outside cells "preserved
// verbatim" + ADR-0066), NOT by running the reference impl — see
// conformance/AUTHORING.md. exceljs is used only as a generic xlsx
// writer.
//
// The gap this fixture closes: preservation of native numbers / dates /
// booleans in static and outside cells comes for free in splice-model
// engines (the OOXML cell object survives untouched), but compose-model
// implementations (xl3-wasm, xl3-py) re-emit every cell and must carry
// the native value through explicitly. No prior fixture pinned a bare
// typed scalar in a static or outside cell — xl3-py stringified them
// (`5500` → "5500") while passing 148/148.
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
  cfg.getCell('A1').value = 'name';      cfg.getCell('B1').value = 'fixture';
  cfg.getCell('A2').value = 'source_sheet'; cfg.getCell('B2').value = sourceSheet;
  cfg.getCell('A3').value = 'source_table'; cfg.getCell('B3').value = '1';
  cfg.getCell('A4').value = 'output_file_pattern'; cfg.getCell('B4').value = 'output.xlsx';
  return cfg;
}

// =====================================================================
// 156 — static-native-value-preservation: native number/boolean/date
// cells in static rows and outside cells survive expansion as TYPED
// values, not text.
// =====================================================================
{
  const dir = join(ROOT, '156-static-native-value-preservation');
  mkdirSync(dir, { recursive: true });

  // Template
  const tpl = new ExcelJS.Workbook();
  configSheet(tpl);
  const rep = tpl.addWorksheet('Report');
  rep.getCell('A1').value = 'a';
  rep.getCell('B1').value = 'b';
  // Data block (col-scoped to A:B)
  rep.getCell('A2').value = '{{ [a] }}';
  rep.getCell('B2').value = '{{ [b] }}';
  // Static row inside block columns BELOW the template row — shifts
  // with expansion; native number + boolean must survive as typed cells.
  rep.getCell('A3').value = 123;                            // native number
  rep.getCell('B3').value = true;                           // native boolean
  // Second static row — native date + control text.
  rep.getCell('A4').value = new Date(Date.UTC(2026, 0, 15)); // native date
  rep.getCell('B4').value = 'static-note';                   // text control
  // Outside cells (right of the A:B hull, below the template row) —
  // stay at row 3 while the block expands past them; the native number
  // must survive as a numeric cell (5500, not "5500").
  rep.getCell('D3').value = 'side-label';
  rep.getCell('E3').value = 5500;                            // native number
  await save(tpl, join(dir, 'template.xlsx'));

  // Data — 3 records so the block expands past the static/outside rows.
  const data = new ExcelJS.Workbook();
  const dws = data.addWorksheet('Data');
  dws.getCell('A1').value = 'a';  dws.getCell('B1').value = 'b';
  dws.getCell('A2').value = 'r1'; dws.getCell('B2').value = 10;
  dws.getCell('A3').value = 'r2'; dws.getCell('B3').value = 20;
  dws.getCell('A4').value = 'r3'; dws.getCell('B4').value = 30;
  await save(data, join(dir, 'data.xlsx'));

  // Expected — hand-computed from the spec:
  // - template row 2 expands to rows 2-4 (3 records, +2 inserted rows)
  // - inside-col static rows 3/4 shift to rows 5/6, values verbatim
  //   (typed: numeric 123, boolean TRUE, date 2026-01-15)
  // - outside cells D3/E3 do NOT shift (ADR-0066), E3 stays numeric 5500
  const exp = new ExcelJS.Workbook();
  const ers = exp.addWorksheet('Report');
  ers.getCell('A1').value = 'a';
  ers.getCell('B1').value = 'b';
  ers.getCell('A2').value = 'r1'; ers.getCell('B2').value = 10;
  ers.getCell('A3').value = 'r2'; ers.getCell('B3').value = 20;
  ers.getCell('A4').value = 'r3'; ers.getCell('B4').value = 30;
  ers.getCell('A5').value = 123;                             // typed number
  ers.getCell('B5').value = true;                            // typed boolean
  ers.getCell('A6').value = new Date(Date.UTC(2026, 0, 15)); // typed date
  ers.getCell('B6').value = 'static-note';
  ers.getCell('D3').value = 'side-label';
  ers.getCell('E3').value = 5500;                            // typed number
  await save(exp, join(dir, 'expected.xlsx'));

  writeFileSync(join(dir, 'meta.yaml'),
`description: Native number/boolean/date values in static rows and outside-block cells survive expansion as typed cells, not text ("5500" != 5500). Pins the value-layer half of "preserved verbatim" that splice-model engines get for free and compose-model engines must carry explicitly.
spec_section: evaluation.md outside cells / ADR-0066
spec_version: "0.1"
tags: [static, value-model, adr-0066, outside-cells]
verified_by: [manual-script]
`);
}

console.log('Fixture 156 written.');
