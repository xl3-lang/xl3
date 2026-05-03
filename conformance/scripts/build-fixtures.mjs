// Authoring-only script. Not part of the conformance corpus.
//
// Constructs template.xlsx, data.xlsx, and expected.xlsx for fixtures
// 001..003 by writing each cell explicitly from spec prose.
//
// Cardinal rule (conformance/AUTHORING.md): expected.xlsx is authored from
// the spec, never produced by running the reference implementation. This
// script never imports anything from `src/`. exceljs is used only as a
// generic xlsx writer — the same way Excel itself would be in a manual flow.

import ExcelJS from 'exceljs';
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(__dirname, '..', 'fixtures');

async function writeBook(wb, path) {
  const buf = await wb.xlsx.writeBuffer();
  await writeFile(path, Buffer.from(buf));
}

function addConfig(wb, entries) {
  const sh = wb.addWorksheet('_config', { state: 'hidden' });
  entries.forEach(([k, v], i) => {
    sh.getCell(i + 1, 1).value = k;
    sh.getCell(i + 1, 2).value = v;
  });
}

// ---------------------------------------------------------------------------
// 001 - bracket-substitution
//
// Concept: a single-cell {{ [Field] }} expression substitutes the field value
// from each source row. Two rows -> two rendered output rows.
// Spec section: language.md "Source Columns"; evaluation.md "Render Phases".
// ---------------------------------------------------------------------------
async function build001() {
  const dir = join(FIXTURES, '001-bracket-substitution');

  // template.xlsx
  {
    const wb = new ExcelJS.Workbook();
    addConfig(wb, [
      ['name', 'bracket-substitution'],
      ['source_sheet', 'Data'],
      ['header_row', '1'],
      ['output_file_pattern', 'output.xlsx'],
    ]);
    const sh = wb.addWorksheet('Report');
    sh.getCell('A1').value = 'Customer';   // literal header
    sh.getCell('A2').value = '{{ [Customer] }}'; // data block
    await writeBook(wb, join(dir, 'template.xlsx'));
  }

  // data.xlsx
  {
    const wb = new ExcelJS.Workbook();
    const sh = wb.addWorksheet('Data');
    sh.getCell('A1').value = 'Customer';
    sh.getCell('A2').value = 'Acme';
    sh.getCell('A3').value = 'Beta';
    await writeBook(wb, join(dir, 'data.xlsx'));
  }

  // expected.xlsx (authored from spec, cell by cell)
  // Per spec evaluation.md:
  //   - phase 7: expand repeat blocks (A2 detected as data block, 2 rows -> 2 rendered rows)
  //   - phase 8: evaluate static/data cells
  //   - single-expression cell preserves source value type (string -> string)
  //   - phase 9: _config and directive rows removed
  {
    const wb = new ExcelJS.Workbook();
    const sh = wb.addWorksheet('Report');
    sh.getCell('A1').value = 'Customer';
    sh.getCell('A2').value = 'Acme';
    sh.getCell('A3').value = 'Beta';
    await writeBook(wb, join(dir, 'expected.xlsx'));
  }
}

// ---------------------------------------------------------------------------
// 002 - if-function
//
// Concept: IF(cond, then, else) with a comparison operator inside a data row.
// Spec section: language.md "Functions / IF" and "Operators".
// ---------------------------------------------------------------------------
async function build002() {
  const dir = join(FIXTURES, '002-if-function');

  // template.xlsx
  {
    const wb = new ExcelJS.Workbook();
    addConfig(wb, [
      ['name', 'if-function'],
      ['source_sheet', 'Data'],
      ['header_row', '1'],
      ['output_file_pattern', 'output.xlsx'],
    ]);
    const sh = wb.addWorksheet('Report');
    sh.getCell('A1').value = 'Customer';
    sh.getCell('B1').value = 'Amount';
    sh.getCell('C1').value = 'Tier';
    sh.getCell('A2').value = '{{ [Customer] }}';
    sh.getCell('B2').value = '{{ [Amount] }}';
    sh.getCell('C2').value = '{{ IF([Amount] > 50, "big", "small") }}';
    await writeBook(wb, join(dir, 'template.xlsx'));
  }

  // data.xlsx
  {
    const wb = new ExcelJS.Workbook();
    const sh = wb.addWorksheet('Data');
    sh.getCell('A1').value = 'Customer';
    sh.getCell('B1').value = 'Amount';
    sh.getCell('A2').value = 'Acme';
    sh.getCell('B2').value = 30;
    sh.getCell('A3').value = 'Beta';
    sh.getCell('B3').value = 70;
    await writeBook(wb, join(dir, 'data.xlsx'));
  }

  // expected.xlsx
  // Reasoning per spec:
  //   - row 2 (Acme, 30): IF(30 > 50, "big", "small") = "small"
  //   - row 3 (Beta, 70): IF(70 > 50, "big", "small") = "big"
  //   - single-expression cells preserve source type:
  //     B2=30 (number), B3=70 (number); C cells are IF results -> strings
  {
    const wb = new ExcelJS.Workbook();
    const sh = wb.addWorksheet('Report');
    sh.getCell('A1').value = 'Customer';
    sh.getCell('B1').value = 'Amount';
    sh.getCell('C1').value = 'Tier';
    sh.getCell('A2').value = 'Acme';
    sh.getCell('B2').value = 30;
    sh.getCell('C2').value = 'small';
    sh.getCell('A3').value = 'Beta';
    sh.getCell('B3').value = 70;
    sh.getCell('C3').value = 'big';
    await writeBook(wb, join(dir, 'expected.xlsx'));
  }
}

// ---------------------------------------------------------------------------
// 003 - list-sheet-filter
//
// Concept: @filter [field] in _ListSheet keeps only rows whose field value
// appears in the list sheet's first column. List sheet is removed from output.
// Spec section: language.md "Directives / Filter"; evaluation.md "List Sheets".
// ---------------------------------------------------------------------------
async function build003() {
  const dir = join(FIXTURES, '003-list-sheet-filter');

  // template.xlsx
  {
    const wb = new ExcelJS.Workbook();
    addConfig(wb, [
      ['name', 'list-sheet-filter'],
      ['source_sheet', 'Data'],
      ['header_row', '1'],
      ['output_file_pattern', 'output.xlsx'],
    ]);
    const sh = wb.addWorksheet('Report');
    sh.getCell('A1').value = 'Customer';
    sh.getCell('B1').value = 'Amount';
    sh.getCell('A2').value = '{{ @filter [Customer] in _Allowed }}'; // directive row
    sh.getCell('A3').value = '{{ [Customer] }}';
    sh.getCell('B3').value = '{{ [Amount] }}';

    const list = wb.addWorksheet('_Allowed');
    list.getCell('A1').value = 'Acme';
    list.getCell('A2').value = 'Beta';

    await writeBook(wb, join(dir, 'template.xlsx'));
  }

  // data.xlsx
  {
    const wb = new ExcelJS.Workbook();
    const sh = wb.addWorksheet('Data');
    sh.getCell('A1').value = 'Customer';
    sh.getCell('B1').value = 'Amount';
    sh.getCell('A2').value = 'Acme';
    sh.getCell('B2').value = 30;
    sh.getCell('A3').value = 'Beta';
    sh.getCell('B3').value = 70;
    sh.getCell('A4').value = 'Charlie';
    sh.getCell('B4').value = 100;
    await writeBook(wb, join(dir, 'data.xlsx'));
  }

  // expected.xlsx
  // Reasoning per spec:
  //   - filter directive row keeps Acme, Beta (in _Allowed); drops Charlie
  //   - directive row is removed from output
  //   - _Allowed list sheet is removed from output
  //   - rendered rows occupy A2..B3 of the Report sheet
  {
    const wb = new ExcelJS.Workbook();
    const sh = wb.addWorksheet('Report');
    sh.getCell('A1').value = 'Customer';
    sh.getCell('B1').value = 'Amount';
    sh.getCell('A2').value = 'Acme';
    sh.getCell('B2').value = 30;
    sh.getCell('A3').value = 'Beta';
    sh.getCell('B3').value = 70;
    await writeBook(wb, join(dir, 'expected.xlsx'));
  }
}

// ---------------------------------------------------------------------------
// 004 - repeat-right-default
//
// Concept: `@repeat right` without an explicit count uses colSpan = 1.
// Spec section: language.md "Repeat Right" — "when omitted, the column
// span is `1`."
// ---------------------------------------------------------------------------
async function build004() {
  const dir = join(FIXTURES, '004-repeat-right-default');

  // template.xlsx
  {
    const wb = new ExcelJS.Workbook();
    addConfig(wb, [
      ['name', 'repeat-right-default'],
      ['source_sheet', 'Data'],
      ['header_row', '1'],
      ['output_file_pattern', 'output.xlsx'],
    ]);
    const sh = wb.addWorksheet('Report');
    sh.getCell('A1').value = '{{ @repeat right }}';
    sh.getCell('A2').value = '{{ [Customer] }}';
    await writeBook(wb, join(dir, 'template.xlsx'));
  }

  // data.xlsx
  {
    const wb = new ExcelJS.Workbook();
    const sh = wb.addWorksheet('Data');
    sh.getCell('A1').value = 'Customer';
    sh.getCell('A2').value = 'Acme';
    sh.getCell('A3').value = 'Beta';
    sh.getCell('A4').value = 'Gamma';
    await writeBook(wb, join(dir, 'data.xlsx'));
  }

  // expected.xlsx
  // Reasoning: 3 source rows; @repeat right with no number => colSpan=1;
  // the single template column A is repeated rightward into A,B,C.
  // The directive row is removed.
  {
    const wb = new ExcelJS.Workbook();
    const sh = wb.addWorksheet('Report');
    sh.getCell('A1').value = 'Acme';
    sh.getCell('B1').value = 'Beta';
    sh.getCell('C1').value = 'Gamma';
    await writeBook(wb, join(dir, 'expected.xlsx'));
  }
}

// ---------------------------------------------------------------------------
// 005 - round-half-away-from-zero
//
// Concept: ROUND uses half-away-from-zero rounding, matching Excel's
// ROUND(). Distinguishes the spec from JS Math.round (half-to-+Inf) and
// from banker's rounding (IEEE 754 default).
// Spec section: language.md "Numeric Functions / ROUND".
// ---------------------------------------------------------------------------
async function build005() {
  const dir = join(FIXTURES, '005-round-half-away-from-zero');

  // template.xlsx
  {
    const wb = new ExcelJS.Workbook();
    addConfig(wb, [
      ['name', 'round-half-away-from-zero'],
      ['source_sheet', 'Data'],
      ['header_row', '1'],
      ['output_file_pattern', 'output.xlsx'],
    ]);
    const sh = wb.addWorksheet('R');
    sh.getCell('A1').value = 'Input';
    sh.getCell('B1').value = 'Rounded';
    sh.getCell('A2').value = '{{ [Value] }}';
    sh.getCell('B2').value = '{{ ROUND([Value], 0) }}';
    await writeBook(wb, join(dir, 'template.xlsx'));
  }

  // data.xlsx — exercise positive and negative .5 boundaries
  {
    const wb = new ExcelJS.Workbook();
    const sh = wb.addWorksheet('Data');
    sh.getCell('A1').value = 'Value';
    sh.getCell('A2').value = 2.5;
    sh.getCell('A3').value = -2.5;
    sh.getCell('A4').value = 1.4;
    sh.getCell('A5').value = -1.4;
    await writeBook(wb, join(dir, 'data.xlsx'));
  }

  // expected.xlsx
  // Per spec: half-away-from-zero. ROUND(2.5,0)=3, ROUND(-2.5,0)=-3,
  // ROUND(1.4,0)=1, ROUND(-1.4,0)=-1.
  {
    const wb = new ExcelJS.Workbook();
    const sh = wb.addWorksheet('R');
    sh.getCell('A1').value = 'Input';
    sh.getCell('B1').value = 'Rounded';
    sh.getCell('A2').value = 2.5;
    sh.getCell('B2').value = 3;
    sh.getCell('A3').value = -2.5;
    sh.getCell('B3').value = -3;
    sh.getCell('A4').value = 1.4;
    sh.getCell('B4').value = 1;
    sh.getCell('A5').value = -1.4;
    sh.getCell('B5').value = -1;
    await writeBook(wb, join(dir, 'expected.xlsx'));
  }
}

await build001();
await build002();
await build003();
await build004();
await build005();
console.log('built fixtures 001-005');
