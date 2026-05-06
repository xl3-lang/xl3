// Authoring-only script. Not part of the conformance corpus.
//
// Constructs template.xlsx, data.xlsx, and expected.xlsx for fixtures by
// writing each cell explicitly from spec prose.
//
// Cardinal rule (conformance/AUTHORING.md): expected.xlsx is authored from
// the spec, never produced by running the reference implementation. This
// script never imports anything from `src/`. exceljs is used only as a
// generic xlsx writer — the same way Excel itself would be in a manual flow.

import ExcelJS from 'exceljs';
import JSZip from 'jszip';
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(__dirname, '..', 'fixtures');

async function writeBook(wb, path) {
  const buf = await wb.xlsx.writeBuffer();
  await writeFile(path, Buffer.from(buf));
}

async function writeCrossWriterVariantBook(wb, path) {
  const buf = await wb.xlsx.writeBuffer();
  const zip = await JSZip.loadAsync(buf);

  renameZipFile(zip, 'xl/worksheets/sheet1.xml', 'xl/worksheets/sheet7.xml');
  await rewriteZipXml(zip, '[Content_Types].xml', (xml) =>
    xml.replace('/xl/worksheets/sheet1.xml', '/xl/worksheets/sheet7.xml'));
  await rewriteZipXml(zip, 'xl/_rels/workbook.xml.rels', (xml) =>
    xml
      .replace('Target="worksheets/sheet1.xml"', "Target='worksheets/sheet7.xml'")
      .replace(
        /<Relationship Id="([^"]+)" Type="([^"]+\/worksheet)" Target='worksheets\/sheet7\.xml'\/>/,
        (_m, id, type) => `<Relationship Target='worksheets/sheet7.xml' Type='${type}' Id='${id}'></Relationship>`,
      ));
  await rewriteZipXml(zip, 'xl/workbook.xml', (xml) =>
    xml.replace(
      /<sheet sheetId="1" name="R" state="visible" r:id="([^"]+)"\/>/,
      (_m, id) => `<sheet r:id='${id}' sheetId='42' state='visible' name='R'></sheet>`,
    ));
  await rewriteZipXml(zip, 'xl/worksheets/sheet7.xml', (xml) =>
    xml
      .replace(/<pageSetup\b([^>]*)\/>/g, (_m, attrs) => `<pageSetup${attrs} copies='1' firstPageNumber='1' useFirstPageNumber='1'></pageSetup>`)
      .replace(/<c r="B2" s="1">/g, "<c s='1' r='B2'>"));

  const out = await zip.generateAsync({ type: 'uint8array' });
  await writeFile(path, Buffer.from(out));
}

function renameZipFile(zip, from, to) {
  const file = zip.file(from);
  if (!file) throw new Error(`missing zip part ${from}`);
  zip.remove(from);
  zip.file(to, file.async('uint8array'));
}

async function rewriteZipXml(zip, name, transform) {
  const file = zip.file(name);
  if (!file) throw new Error(`missing zip part ${name}`);
  zip.file(name, transform(await file.async('string')));
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
      ['source_table', '1'],
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
      ['source_table', '1'],
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
      ['source_table', '1'],
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
      ['source_table', '1'],
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
      ['source_table', '1'],
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

// ---------------------------------------------------------------------------
// 006 - filename-forbidden-chars
//
// Concept: characters in `< > : " / \ | ? *` and ASCII control chars in the
// rendered output filename are replaced with `_` per ADR-0002.
// Spec section: evaluation.md "Output Filenames".
// ---------------------------------------------------------------------------
async function build006() {
  const dir = join(FIXTURES, '006-filename-forbidden-chars');
  await import('node:fs/promises').then((fs) => fs.mkdir(join(dir, 'expected'), { recursive: true }));

  // template.xlsx
  {
    const wb = new ExcelJS.Workbook();
    addConfig(wb, [
      ['name', 'filename-forbidden-chars'],
      ['source_sheet', 'Data'],
      ['source_table', '1'],
      ['output_file_pattern', '{{ [Department] }}_report.xlsx'],
    ]);
    const sh = wb.addWorksheet('Report');
    sh.getCell('A1').value = '{{ Department }}';
    sh.getCell('A2').value = '{{ [Item] }}';
    await writeBook(wb, join(dir, 'template.xlsx'));
  }

  // data.xlsx — Department contains "/" which is forbidden in filenames.
  {
    const wb = new ExcelJS.Workbook();
    const sh = wb.addWorksheet('Data');
    sh.getCell('A1').value = 'Department';
    sh.getCell('B1').value = 'Item';
    sh.getCell('A2').value = 'R&D/Sales';
    sh.getCell('B2').value = 'Widget';
    await writeBook(wb, join(dir, 'data.xlsx'));
  }

  // expected/ — pattern resolves to "R&D/Sales_report.xlsx"; sanitization
  // replaces `/` with `_` -> "R&D_Sales_report.xlsx". The file content
  // itself is the rendered Report sheet.
  {
    const wb = new ExcelJS.Workbook();
    const sh = wb.addWorksheet('Report');
    sh.getCell('A1').value = 'R&D/Sales';
    sh.getCell('A2').value = 'Widget';
    await writeBook(wb, join(dir, 'expected', 'R&D_Sales_report.xlsx'));
  }
}

// ---------------------------------------------------------------------------
// 007 - filename-reserved-name
//
// Concept: a sanitized basename equal to a Windows reserved device name
// (CON, PRN, ..., COM1-9, LPT1-9) gets a single `_` appended per ADR-0002.
// Spec section: evaluation.md "Output Filenames".
// ---------------------------------------------------------------------------
async function build007() {
  const dir = join(FIXTURES, '007-filename-reserved-name');
  await import('node:fs/promises').then((fs) => fs.mkdir(join(dir, 'expected'), { recursive: true }));

  // template.xlsx
  {
    const wb = new ExcelJS.Workbook();
    addConfig(wb, [
      ['name', 'filename-reserved-name'],
      ['source_sheet', 'Data'],
      ['source_table', '1'],
      ['output_file_pattern', '{{ [Customer] }}.xlsx'],
    ]);
    const sh = wb.addWorksheet('Report');
    sh.getCell('A1').value = '{{ Customer }}';
    await writeBook(wb, join(dir, 'template.xlsx'));
  }

  // data.xlsx — Customer = "CON", a Windows reserved device name.
  {
    const wb = new ExcelJS.Workbook();
    const sh = wb.addWorksheet('Data');
    sh.getCell('A1').value = 'Customer';
    sh.getCell('A2').value = 'CON';
    await writeBook(wb, join(dir, 'data.xlsx'));
  }

  // expected/ — basename "CON" matches a reserved name; sanitization appends
  // a single "_" -> "CON_.xlsx".
  {
    const wb = new ExcelJS.Workbook();
    const sh = wb.addWorksheet('Report');
    sh.getCell('A1').value = 'CON';
    await writeBook(wb, join(dir, 'expected', 'CON_.xlsx'));
  }
}

// ---------------------------------------------------------------------------
// 008 - numfmt-numeric-string-coercion
//
// Concept: a single-expression cell with a numeric numFmt MUST coerce a
// numeric string source value to a number (ADR-0003).
// Spec section: evaluation.md "Single-Expression Cells".
// ---------------------------------------------------------------------------
async function build008() {
  const dir = join(FIXTURES, '008-numfmt-numeric-string-coercion');

  // template.xlsx — A2 has a numeric numFmt "0.00" and a single-expression cell.
  {
    const wb = new ExcelJS.Workbook();
    addConfig(wb, [
      ['name', 'numfmt-numeric-string-coercion'],
      ['source_sheet', 'Data'],
      ['source_table', '1'],
      ['output_file_pattern', 'output.xlsx'],
    ]);
    const sh = wb.addWorksheet('R');
    sh.getCell('A1').value = 'Amount';
    sh.getCell('A2').value = '{{ [Amount] }}';
    sh.getCell('A2').numFmt = '0.00';
    await writeBook(wb, join(dir, 'template.xlsx'));
  }

  // data.xlsx — Amount is a STRING "30.5".
  {
    const wb = new ExcelJS.Workbook();
    const sh = wb.addWorksheet('Data');
    sh.getCell('A1').value = 'Amount';
    sh.getCell('A2').value = '30.5';
    await writeBook(wb, join(dir, 'data.xlsx'));
  }

  // expected.xlsx — A2 is a number 30.5 (string was coerced per template numFmt).
  {
    const wb = new ExcelJS.Workbook();
    const sh = wb.addWorksheet('R');
    sh.getCell('A1').value = 'Amount';
    sh.getCell('A2').value = 30.5;
    sh.getCell('A2').numFmt = '0.00';
    await writeBook(wb, join(dir, 'expected.xlsx'));
  }
}

// ---------------------------------------------------------------------------
// 009 - numfmt-date-string-coercion
//
// Concept: a single-expression cell with a date numFmt MUST coerce a date-like
// string source value to a Date (ADR-0003).
// ---------------------------------------------------------------------------
async function build009() {
  const dir = join(FIXTURES, '009-numfmt-date-string-coercion');

  // template.xlsx — A2 has a date numFmt and a single-expression cell.
  {
    const wb = new ExcelJS.Workbook();
    addConfig(wb, [
      ['name', 'numfmt-date-string-coercion'],
      ['source_sheet', 'Data'],
      ['source_table', '1'],
      ['output_file_pattern', 'output.xlsx'],
    ]);
    const sh = wb.addWorksheet('R');
    sh.getCell('A1').value = 'OrderDate';
    sh.getCell('A2').value = '{{ [OrderDate] }}';
    sh.getCell('A2').numFmt = 'yyyy-mm-dd';
    await writeBook(wb, join(dir, 'template.xlsx'));
  }

  // data.xlsx — OrderDate is a STRING "2026-05-03".
  {
    const wb = new ExcelJS.Workbook();
    const sh = wb.addWorksheet('Data');
    sh.getCell('A1').value = 'OrderDate';
    sh.getCell('A2').value = '2026-05-03';
    await writeBook(wb, join(dir, 'data.xlsx'));
  }

  // expected.xlsx — A2 is the Date 2026-05-03 (string was coerced).
  {
    const wb = new ExcelJS.Workbook();
    const sh = wb.addWorksheet('R');
    sh.getCell('A1').value = 'OrderDate';
    sh.getCell('A2').value = new Date(2026, 4, 3);
    sh.getCell('A2').numFmt = 'yyyy-mm-dd';
    await writeBook(wb, join(dir, 'expected.xlsx'));
  }
}

// ---------------------------------------------------------------------------
// 010 - numfmt-text-format-coercion
//
// Concept: a single-expression cell with the text format `@` MUST coerce
// the value to a string, even if the source value is a number (ADR-0003).
// ---------------------------------------------------------------------------
async function build010() {
  const dir = join(FIXTURES, '010-numfmt-text-format-coercion');

  // template.xlsx — A2 has numFmt "@" and a single-expression cell.
  {
    const wb = new ExcelJS.Workbook();
    addConfig(wb, [
      ['name', 'numfmt-text-format-coercion'],
      ['source_sheet', 'Data'],
      ['source_table', '1'],
      ['output_file_pattern', 'output.xlsx'],
    ]);
    const sh = wb.addWorksheet('R');
    sh.getCell('A1').value = 'Code';
    sh.getCell('A2').value = '{{ [Code] }}';
    sh.getCell('A2').numFmt = '@';
    await writeBook(wb, join(dir, 'template.xlsx'));
  }

  // data.xlsx — Code is a NUMBER 12345 (preserves leading zeros etc. is the use case).
  {
    const wb = new ExcelJS.Workbook();
    const sh = wb.addWorksheet('Data');
    sh.getCell('A1').value = 'Code';
    sh.getCell('A2').value = 12345;
    await writeBook(wb, join(dir, 'data.xlsx'));
  }

  // expected.xlsx — A2 is the string "12345" (number was coerced via @).
  {
    const wb = new ExcelJS.Workbook();
    const sh = wb.addWorksheet('R');
    sh.getCell('A1').value = 'Code';
    sh.getCell('A2').value = '12345';
    sh.getCell('A2').numFmt = '@';
    await writeBook(wb, join(dir, 'expected.xlsx'));
  }
}

// ---------------------------------------------------------------------------
// 011 - text-date-format
//
// Concept: TEXT(date, "YYYY-MM-DD") formats a date value using the XTL 0.1
// date token subset.
// Spec section: language.md "Text Formatting".
// ---------------------------------------------------------------------------
async function build011() {
  const dir = join(FIXTURES, '011-text-date-format');

  // template.xlsx
  {
    const wb = new ExcelJS.Workbook();
    addConfig(wb, [
      ['name', 'text-date-format'],
      ['source_sheet', 'Data'],
      ['source_table', '1'],
      ['output_file_pattern', 'output.xlsx'],
    ]);
    const sh = wb.addWorksheet('R');
    sh.getCell('A1').value = 'Formatted';
    sh.getCell('A2').value = '{{ TEXT([OrderDate], "YYYY-MM-DD") }}';
    await writeBook(wb, join(dir, 'template.xlsx'));
  }

  // data.xlsx — OrderDate is a date cell.
  {
    const wb = new ExcelJS.Workbook();
    const sh = wb.addWorksheet('Data');
    sh.getCell('A1').value = 'OrderDate';
    sh.getCell('A2').value = new Date(2026, 4, 3);
    sh.getCell('A2').numFmt = 'yyyy-mm-dd';
    await writeBook(wb, join(dir, 'data.xlsx'));
  }

  // expected.xlsx — TEXT() always returns a string.
  {
    const wb = new ExcelJS.Workbook();
    const sh = wb.addWorksheet('R');
    sh.getCell('A1').value = 'Formatted';
    sh.getCell('A2').value = '2026-05-03';
    await writeBook(wb, join(dir, 'expected.xlsx'));
  }
}

// ---------------------------------------------------------------------------
// 012 - text-number-format
//
// Concept: TEXT(number, format) supports the XTL 0.1 numeric subset:
// "#,##0", "0.00", and "#,##0.00".
// Spec section: language.md "Text Formatting".
// ---------------------------------------------------------------------------
async function build012() {
  const dir = join(FIXTURES, '012-text-number-format');

  // template.xlsx
  {
    const wb = new ExcelJS.Workbook();
    addConfig(wb, [
      ['name', 'text-number-format'],
      ['source_sheet', 'Data'],
      ['source_table', '1'],
      ['output_file_pattern', 'output.xlsx'],
    ]);
    const sh = wb.addWorksheet('R');
    sh.getCell('A1').value = 'Grouped';
    sh.getCell('B1').value = 'Fixed';
    sh.getCell('C1').value = 'GroupedFixed';
    sh.getCell('A2').value = '{{ TEXT([Amount], "#,##0") }}';
    sh.getCell('B2').value = '{{ TEXT([Amount], "0.00") }}';
    sh.getCell('C2').value = '{{ TEXT([Amount], "#,##0.00") }}';
    await writeBook(wb, join(dir, 'template.xlsx'));
  }

  // data.xlsx — value chosen to exercise grouping and fixed decimals.
  {
    const wb = new ExcelJS.Workbook();
    const sh = wb.addWorksheet('Data');
    sh.getCell('A1').value = 'Amount';
    sh.getCell('A2').value = 1234.5;
    await writeBook(wb, join(dir, 'data.xlsx'));
  }

  // expected.xlsx — TEXT() returns strings; "#,##0" rounds to an integer.
  {
    const wb = new ExcelJS.Workbook();
    const sh = wb.addWorksheet('R');
    sh.getCell('A1').value = 'Grouped';
    sh.getCell('B1').value = 'Fixed';
    sh.getCell('C1').value = 'GroupedFixed';
    sh.getCell('A2').value = '1,235';
    sh.getCell('B2').value = '1234.50';
    sh.getCell('C2').value = '1,234.50';
    await writeBook(wb, join(dir, 'expected.xlsx'));
  }
}

// ---------------------------------------------------------------------------
// 013 - rich-text-template-expression
//
// Concept: rich-text template cells are parsed by concatenating text runs in
// order before expression detection.
// Spec section: evaluation.md "Cell Text Extraction".
// ---------------------------------------------------------------------------
async function build013() {
  const dir = join(FIXTURES, '013-rich-text-template-expression');

  // template.xlsx — the expression is split across rich-text runs.
  {
    const wb = new ExcelJS.Workbook();
    addConfig(wb, [
      ['name', 'rich-text-template-expression'],
      ['source_sheet', 'Data'],
      ['source_table', '1'],
      ['output_file_pattern', 'output.xlsx'],
    ]);
    const sh = wb.addWorksheet('R');
    sh.getCell('A1').value = 'Customer';
    sh.getCell('A2').value = {
      richText: [
        { text: '{{ ' },
        { text: '[Customer]' },
        { text: ' }}' },
      ],
    };
    await writeBook(wb, join(dir, 'template.xlsx'));
  }

  // data.xlsx
  {
    const wb = new ExcelJS.Workbook();
    const sh = wb.addWorksheet('Data');
    sh.getCell('A1').value = 'Customer';
    sh.getCell('A2').value = 'Acme';
    await writeBook(wb, join(dir, 'data.xlsx'));
  }

  // expected.xlsx
  {
    const wb = new ExcelJS.Workbook();
    const sh = wb.addWorksheet('R');
    sh.getCell('A1').value = 'Customer';
    sh.getCell('A2').value = 'Acme';
    await writeBook(wb, join(dir, 'expected.xlsx'));
  }
}

// ---------------------------------------------------------------------------
// 014 - source-formula-cached-result
//
// Concept: XTL does not recalculate formulas. Source formula cells use the
// cached result when present.
// Spec section: evaluation.md "Cell Text Extraction".
// ---------------------------------------------------------------------------
async function build014() {
  const dir = join(FIXTURES, '014-source-formula-cached-result');

  // template.xlsx
  {
    const wb = new ExcelJS.Workbook();
    addConfig(wb, [
      ['name', 'source-formula-cached-result'],
      ['source_sheet', 'Data'],
      ['source_table', '1'],
      ['output_file_pattern', 'output.xlsx'],
    ]);
    const sh = wb.addWorksheet('R');
    sh.getCell('A1').value = 'Total';
    sh.getCell('A2').value = '{{ [Total] }}';
    await writeBook(wb, join(dir, 'template.xlsx'));
  }

  // data.xlsx — Total is a formula cell with a cached result.
  {
    const wb = new ExcelJS.Workbook();
    const sh = wb.addWorksheet('Data');
    sh.getCell('A1').value = 'Total';
    sh.getCell('B1').value = 'Left';
    sh.getCell('C1').value = 'Right';
    sh.getCell('A2').value = { formula: 'B2+C2', result: 42 };
    sh.getCell('B2').value = 20;
    sh.getCell('C2').value = 22;
    await writeBook(wb, join(dir, 'data.xlsx'));
  }

  // expected.xlsx — cached formula result 42 is used as the source value.
  {
    const wb = new ExcelJS.Workbook();
    const sh = wb.addWorksheet('R');
    sh.getCell('A1').value = 'Total';
    sh.getCell('A2').value = 42;
    await writeBook(wb, join(dir, 'expected.xlsx'));
  }
}

// ---------------------------------------------------------------------------
// 015 - source-sheet-prefix-first-match
//
// Concept: source_sheet ending in `*` is a prefix pattern and selects the
// first matching worksheet in workbook order.
// Spec section: evaluation.md "Source Data Model".
// ---------------------------------------------------------------------------
async function build015() {
  const dir = join(FIXTURES, '015-source-sheet-prefix-first-match');

  // template.xlsx
  {
    const wb = new ExcelJS.Workbook();
    addConfig(wb, [
      ['name', 'source-sheet-prefix-first-match'],
      ['source_sheet', 'Data_*'],
      ['source_table', '1'],
      ['output_file_pattern', 'output.xlsx'],
    ]);
    const sh = wb.addWorksheet('R');
    sh.getCell('A1').value = 'Customer';
    sh.getCell('A2').value = '{{ [Customer] }}';
    await writeBook(wb, join(dir, 'template.xlsx'));
  }

  // data.xlsx — Data_2025 appears before Data_2026 and should be selected.
  {
    const wb = new ExcelJS.Workbook();
    const older = wb.addWorksheet('Data_2025');
    older.getCell('A1').value = 'Customer';
    older.getCell('A2').value = 'First';
    const newer = wb.addWorksheet('Data_2026');
    newer.getCell('A1').value = 'Customer';
    newer.getCell('A2').value = 'Second';
    await writeBook(wb, join(dir, 'data.xlsx'));
  }

  // expected.xlsx
  {
    const wb = new ExcelJS.Workbook();
    const sh = wb.addWorksheet('R');
    sh.getCell('A1').value = 'Customer';
    sh.getCell('A2').value = 'First';
    await writeBook(wb, join(dir, 'expected.xlsx'));
  }
}

// ---------------------------------------------------------------------------
// 016 - text-number-negative-rounding
//
// Concept: Numeric TEXT() formats round negative .5 boundaries half away from
// zero, matching ROUND().
// Spec section: language.md "Text Formatting".
// ---------------------------------------------------------------------------
async function build016() {
  const dir = join(FIXTURES, '016-text-number-negative-rounding');

  // template.xlsx
  {
    const wb = new ExcelJS.Workbook();
    addConfig(wb, [
      ['name', 'text-number-negative-rounding'],
      ['source_sheet', 'Data'],
      ['source_table', '1'],
      ['output_file_pattern', 'output.xlsx'],
    ]);
    const sh = wb.addWorksheet('R');
    sh.getCell('A1').value = 'Integer';
    sh.getCell('B1').value = 'Fixed';
    sh.getCell('A2').value = '{{ TEXT([IntegerValue], "0") }}';
    sh.getCell('B2').value = '{{ TEXT([FixedValue], "0.00") }}';
    await writeBook(wb, join(dir, 'template.xlsx'));
  }

  // data.xlsx — exercise negative half boundaries for integer and decimal
  // TEXT() rounding.
  {
    const wb = new ExcelJS.Workbook();
    const sh = wb.addWorksheet('Data');
    sh.getCell('A1').value = 'IntegerValue';
    sh.getCell('B1').value = 'FixedValue';
    sh.getCell('A2').value = -2.5;
    sh.getCell('B2').value = -2.345;
    await writeBook(wb, join(dir, 'data.xlsx'));
  }

  // expected.xlsx — TEXT() returns strings and rounds half away from zero.
  {
    const wb = new ExcelJS.Workbook();
    const sh = wb.addWorksheet('R');
    sh.getCell('A1').value = 'Integer';
    sh.getCell('B1').value = 'Fixed';
    sh.getCell('A2').value = '-3';
    sh.getCell('B2').value = '-2.35';
    await writeBook(wb, join(dir, 'expected.xlsx'));
  }
}

// ---------------------------------------------------------------------------
// 017 - source-sheet-prefix-no-match-error
//
// Concept: source_sheet prefix patterns with no matching worksheet are errors.
// Spec section: evaluation.md "Source Data Model".
// ---------------------------------------------------------------------------
async function build017() {
  const dir = join(FIXTURES, '017-source-sheet-prefix-no-match-error');

  // template.xlsx
  {
    const wb = new ExcelJS.Workbook();
    addConfig(wb, [
      ['name', 'source-sheet-prefix-no-match-error'],
      ['source_sheet', 'Missing_*'],
      ['source_table', '1'],
      ['output_file_pattern', 'output.xlsx'],
    ]);
    const sh = wb.addWorksheet('R');
    sh.getCell('A1').value = 'Customer';
    sh.getCell('A2').value = '{{ [Customer] }}';
    await writeBook(wb, join(dir, 'template.xlsx'));
  }

  // data.xlsx — no sheet starts with Missing_.
  {
    const wb = new ExcelJS.Workbook();
    const sh = wb.addWorksheet('Data');
    sh.getCell('A1').value = 'Customer';
    sh.getCell('A2').value = 'Acme';
    await writeBook(wb, join(dir, 'data.xlsx'));
  }
}

// ---------------------------------------------------------------------------
// 018 - source-formula-missing-cached-result-error
//
// Concept: XTL does not recalculate source formulas; a source formula cell with
// no cached result is an error.
// Spec section: evaluation.md "Cell Text Extraction".
// ---------------------------------------------------------------------------
async function build018() {
  const dir = join(FIXTURES, '018-source-formula-missing-cached-result-error');

  // template.xlsx
  {
    const wb = new ExcelJS.Workbook();
    addConfig(wb, [
      ['name', 'source-formula-missing-cached-result-error'],
      ['source_sheet', 'Data'],
      ['source_table', '1'],
      ['output_file_pattern', 'output.xlsx'],
    ]);
    const sh = wb.addWorksheet('R');
    sh.getCell('A1').value = 'Total';
    sh.getCell('A2').value = '{{ [Total] }}';
    await writeBook(wb, join(dir, 'template.xlsx'));
  }

  // data.xlsx — Total is a formula cell with no cached result.
  {
    const wb = new ExcelJS.Workbook();
    const sh = wb.addWorksheet('Data');
    sh.getCell('A1').value = 'Total';
    sh.getCell('B1').value = 'Left';
    sh.getCell('C1').value = 'Right';
    sh.getCell('A2').value = { formula: 'B2+C2' };
    sh.getCell('B2').value = 20;
    sh.getCell('C2').value = 22;
    await writeBook(wb, join(dir, 'data.xlsx'));
  }
}

// ---------------------------------------------------------------------------
// 019 - filename-empty-basename-error
//
// Concept: output filename sanitization reports an error when the rendered
// filename has an empty basename.
// Spec section: evaluation.md "Output Filenames".
// ---------------------------------------------------------------------------
async function build019() {
  const dir = join(FIXTURES, '019-filename-empty-basename-error');

  // template.xlsx
  {
    const wb = new ExcelJS.Workbook();
    addConfig(wb, [
      ['name', 'filename-empty-basename-error'],
      ['source_sheet', 'Data'],
      ['source_table', '1'],
      ['output_file_pattern', '{{ [Name] }}.xlsx'],
    ]);
    const sh = wb.addWorksheet('Report');
    sh.getCell('A1').value = 'Item';
    sh.getCell('A2').value = '{{ [Item] }}';
    await writeBook(wb, join(dir, 'template.xlsx'));
  }

  // data.xlsx — Name is empty, so the pattern renders to ".xlsx".
  {
    const wb = new ExcelJS.Workbook();
    const sh = wb.addWorksheet('Data');
    sh.getCell('A1').value = 'Name';
    sh.getCell('B1').value = 'Item';
    sh.getCell('A2').value = '';
    sh.getCell('B2').value = 'Widget';
    await writeBook(wb, join(dir, 'data.xlsx'));
  }
}

// ---------------------------------------------------------------------------
// 020 - filename-length-overflow-error
//
// Concept: output filename sanitization reports an error when the UTF-8 byte
// length exceeds 255 bytes.
// Spec section: evaluation.md "Output Filenames".
// ---------------------------------------------------------------------------
async function build020() {
  const dir = join(FIXTURES, '020-filename-length-overflow-error');

  // template.xlsx
  {
    const wb = new ExcelJS.Workbook();
    addConfig(wb, [
      ['name', 'filename-length-overflow-error'],
      ['source_sheet', 'Data'],
      ['source_table', '1'],
      ['output_file_pattern', '{{ [Name] }}.xlsx'],
    ]);
    const sh = wb.addWorksheet('Report');
    sh.getCell('A1').value = 'Item';
    sh.getCell('A2').value = '{{ [Item] }}';
    await writeBook(wb, join(dir, 'template.xlsx'));
  }

  // data.xlsx — 251 ASCII bytes + ".xlsx" = 256 UTF-8 bytes.
  {
    const wb = new ExcelJS.Workbook();
    const sh = wb.addWorksheet('Data');
    sh.getCell('A1').value = 'Name';
    sh.getCell('B1').value = 'Item';
    sh.getCell('A2').value = 'a'.repeat(251);
    sh.getCell('B2').value = 'Widget';
    await writeBook(wb, join(dir, 'data.xlsx'));
  }
}

// ---------------------------------------------------------------------------
// 021 - numfmt-number-coercion-error
//
// Concept: a single-expression cell with a numeric numFmt reports an error
// when the source value cannot be coerced to a number.
// Spec section: evaluation.md "Single-Expression Cells".
// ---------------------------------------------------------------------------
async function build021() {
  const dir = join(FIXTURES, '021-numfmt-number-coercion-error');

  // template.xlsx
  {
    const wb = new ExcelJS.Workbook();
    addConfig(wb, [
      ['name', 'numfmt-number-coercion-error'],
      ['source_sheet', 'Data'],
      ['source_table', '1'],
      ['output_file_pattern', 'output.xlsx'],
    ]);
    const sh = wb.addWorksheet('R');
    sh.getCell('A1').value = 'Amount';
    sh.getCell('A2').value = '{{ [Amount] }}';
    sh.getCell('A2').numFmt = '0.00';
    await writeBook(wb, join(dir, 'template.xlsx'));
  }

  // data.xlsx
  {
    const wb = new ExcelJS.Workbook();
    const sh = wb.addWorksheet('Data');
    sh.getCell('A1').value = 'Amount';
    sh.getCell('A2').value = 'not-a-number';
    await writeBook(wb, join(dir, 'data.xlsx'));
  }
}

// ---------------------------------------------------------------------------
// 022 - numfmt-date-coercion-error
//
// Concept: a single-expression cell with a date numFmt reports an error when
// the source value cannot be coerced to a date.
// Spec section: evaluation.md "Single-Expression Cells".
// ---------------------------------------------------------------------------
async function build022() {
  const dir = join(FIXTURES, '022-numfmt-date-coercion-error');

  // template.xlsx
  {
    const wb = new ExcelJS.Workbook();
    addConfig(wb, [
      ['name', 'numfmt-date-coercion-error'],
      ['source_sheet', 'Data'],
      ['source_table', '1'],
      ['output_file_pattern', 'output.xlsx'],
    ]);
    const sh = wb.addWorksheet('R');
    sh.getCell('A1').value = 'OrderDate';
    sh.getCell('A2').value = '{{ [OrderDate] }}';
    sh.getCell('A2').numFmt = 'yyyy-mm-dd';
    await writeBook(wb, join(dir, 'template.xlsx'));
  }

  // data.xlsx
  {
    const wb = new ExcelJS.Workbook();
    const sh = wb.addWorksheet('Data');
    sh.getCell('A1').value = 'OrderDate';
    sh.getCell('A2').value = 'not-a-date';
    await writeBook(wb, join(dir, 'data.xlsx'));
  }
}

// ---------------------------------------------------------------------------
// 023 - today-utc-dynamic
//
// Concept: TODAY() returns the UTC date at render time. The expected value is
// dynamic, so meta.yaml declares expected_dynamic instead of expected.xlsx.
// Spec section: language.md "Row and Date Functions"; ADR-0001; ADR-0005.
// ---------------------------------------------------------------------------
async function build023() {
  const dir = join(FIXTURES, '023-today-utc-dynamic');

  // template.xlsx
  {
    const wb = new ExcelJS.Workbook();
    addConfig(wb, [
      ['name', 'today-utc-dynamic'],
      ['source_sheet', 'Data'],
      ['source_table', '1'],
      ['output_file_pattern', 'output.xlsx'],
    ]);
    const sh = wb.addWorksheet('R');
    sh.getCell('A1').value = 'Today';
    sh.getCell('A2').value = '{{ TEXT(TODAY(), "YYYY-MM-DD") }}';
    await writeBook(wb, join(dir, 'template.xlsx'));
  }

  // data.xlsx — one row is enough to render the template.
  {
    const wb = new ExcelJS.Workbook();
    const sh = wb.addWorksheet('Data');
    sh.getCell('A1').value = 'Item';
    sh.getCell('A2').value = 'Widget';
    await writeBook(wb, join(dir, 'data.xlsx'));
  }
}

// ---------------------------------------------------------------------------
// 024 - stage2-merge-preservation
//
// Concept: Stage 2 fixtures can assert workbook structure that Stage 1 cannot
// observe. This fixture checks a merged footer range below an expanded data
// block shifts down and remains merged.
// Spec section: evaluation.md "Render Phases"; ADR-0006.
// ---------------------------------------------------------------------------
async function build024() {
  const dir = join(FIXTURES, '024-stage2-merge-preservation');

  // template.xlsx
  {
    const wb = new ExcelJS.Workbook();
    addConfig(wb, [
      ['name', 'stage2-merge-preservation'],
      ['source_sheet', 'Data'],
      ['source_table', '1'],
      ['output_file_pattern', 'output.xlsx'],
    ]);
    const sh = wb.addWorksheet('R');
    sh.getCell('A1').value = 'Customer';
    sh.getCell('A2').value = '{{ [Customer] }}';
    sh.getCell('A3').value = 'Footer';
    sh.mergeCells('A3:B3');
    await writeBook(wb, join(dir, 'template.xlsx'));
  }

  // data.xlsx — two source rows expand the one-row block by one row.
  {
    const wb = new ExcelJS.Workbook();
    const sh = wb.addWorksheet('Data');
    sh.getCell('A1').value = 'Customer';
    sh.getCell('A2').value = 'Acme';
    sh.getCell('A3').value = 'Beta';
    await writeBook(wb, join(dir, 'data.xlsx'));
  }

  // expected.xlsx — the merged footer has shifted from A3:B3 to A4:B4.
  {
    const wb = new ExcelJS.Workbook();
    const sh = wb.addWorksheet('R');
    sh.getCell('A1').value = 'Customer';
    sh.getCell('A2').value = 'Acme';
    sh.getCell('A3').value = 'Beta';
    sh.getCell('A4').value = 'Footer';
    sh.mergeCells('A4:B4');
    await writeBook(wb, join(dir, 'expected.xlsx'));
  }
}

// ---------------------------------------------------------------------------
// 025 - stage2-style-numfmt-preservation
//
// Concept: Stage 2 comparison can assert style and number-format preservation
// that Stage 1 cell-value comparison cannot observe.
// Spec section: evaluation.md "Cell Evaluation"; ADR-0006.
// ---------------------------------------------------------------------------
async function build025() {
  const dir = join(FIXTURES, '025-stage2-style-numfmt-preservation');

  // template.xlsx
  {
    const wb = new ExcelJS.Workbook();
    addConfig(wb, [
      ['name', 'stage2-style-numfmt-preservation'],
      ['source_sheet', 'Data'],
      ['source_table', '1'],
      ['output_file_pattern', 'output.xlsx'],
    ]);
    const sh = wb.addWorksheet('R');
    sh.getCell('A1').value = 'Amount';
    sh.getCell('A2').value = '{{ [Amount] }}';
    sh.getCell('A2').numFmt = '#,##0.00';
    sh.getCell('A2').font = { bold: true, color: { argb: 'FF1F4E79' } };
    sh.getCell('A2').fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFD9EAF7' },
    };
    await writeBook(wb, join(dir, 'template.xlsx'));
  }

  // data.xlsx
  {
    const wb = new ExcelJS.Workbook();
    const sh = wb.addWorksheet('Data');
    sh.getCell('A1').value = 'Amount';
    sh.getCell('A2').value = 1234.5;
    await writeBook(wb, join(dir, 'data.xlsx'));
  }

  // expected.xlsx — A2 keeps the template style and numFmt while receiving the
  // source numeric value.
  {
    const wb = new ExcelJS.Workbook();
    const sh = wb.addWorksheet('R');
    sh.getCell('A1').value = 'Amount';
    sh.getCell('A2').value = 1234.5;
    sh.getCell('A2').numFmt = '#,##0.00';
    sh.getCell('A2').font = { bold: true, color: { argb: 'FF1F4E79' } };
    sh.getCell('A2').fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFD9EAF7' },
    };
    await writeBook(wb, join(dir, 'expected.xlsx'));
  }
}

// ---------------------------------------------------------------------------
// 026 - stage2-splice-merge-style-preservation
//
// Concept: a single Stage 2 fixture can catch interactions between row
// expansion, merge shifting, and rendered-cell style/numFmt preservation.
// Spec section: evaluation.md "Render Phases"; evaluation.md "Cell Evaluation";
// ADR-0006.
// ---------------------------------------------------------------------------
async function build026() {
  const dir = join(FIXTURES, '026-stage2-splice-merge-style-preservation');

  // template.xlsx
  {
    const wb = new ExcelJS.Workbook();
    addConfig(wb, [
      ['name', 'stage2-splice-merge-style-preservation'],
      ['source_sheet', 'Data'],
      ['source_table', '1'],
      ['output_file_pattern', 'output.xlsx'],
    ]);
    const sh = wb.addWorksheet('R');
    sh.getCell('A1').value = 'Customer';
    sh.getCell('B1').value = 'Amount';
    sh.getCell('A2').value = '{{ [Customer] }}';
    sh.getCell('B2').value = '{{ [Amount] }}';
    sh.getCell('B2').numFmt = '#,##0.00';
    sh.getCell('B2').font = { bold: true, color: { argb: 'FF1F4E79' } };
    sh.getCell('B2').fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFD9EAF7' },
    };
    sh.getCell('A3').value = 'Approved total';
    sh.getCell('A3').font = { italic: true };
    sh.mergeCells('A3:C3');
    await writeBook(wb, join(dir, 'template.xlsx'));
  }

  // data.xlsx — three source rows expand the one-row block by two rows.
  {
    const wb = new ExcelJS.Workbook();
    const sh = wb.addWorksheet('Data');
    sh.getCell('A1').value = 'Customer';
    sh.getCell('B1').value = 'Amount';
    sh.getCell('A2').value = 'Acme';
    sh.getCell('B2').value = 1234.5;
    sh.getCell('A3').value = 'Beta';
    sh.getCell('B3').value = 67.89;
    sh.getCell('A4').value = 'Coda';
    sh.getCell('B4').value = 10;
    await writeBook(wb, join(dir, 'data.xlsx'));
  }

  // expected.xlsx — rendered amount cells keep the template numFmt/style, and
  // the footer merge shifts from A3:C3 to A5:C5 after row expansion.
  {
    const wb = new ExcelJS.Workbook();
    const sh = wb.addWorksheet('R');
    sh.getCell('A1').value = 'Customer';
    sh.getCell('B1').value = 'Amount';
    const rows = [
      ['Acme', 1234.5],
      ['Beta', 67.89],
      ['Coda', 10],
    ];
    rows.forEach(([customer, amount], i) => {
      const row = i + 2;
      sh.getCell(row, 1).value = customer;
      sh.getCell(row, 2).value = amount;
      sh.getCell(row, 2).numFmt = '#,##0.00';
      sh.getCell(row, 2).font = { bold: true, color: { argb: 'FF1F4E79' } };
      sh.getCell(row, 2).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFD9EAF7' },
      };
    });
    sh.getCell('A5').value = 'Approved total';
    sh.getCell('A5').font = { italic: true };
    sh.mergeCells('A5:C5');
    await writeBook(wb, join(dir, 'expected.xlsx'));
  }
}

// ---------------------------------------------------------------------------
// 027 - stage2-cross-writer-canonicalization
//
// Concept: Stage 2 comparison must ignore known OOXML writer differences that
// do not change workbook semantics, such as generated sheet part names,
// volatile sheet ids, quote style, attribute order, and default page setup
// values.
// Spec section: conformance/runner-protocol.md "Stage 2 output comparison";
// ADR-0006.
// ---------------------------------------------------------------------------
async function build027() {
  const dir = join(FIXTURES, '027-stage2-cross-writer-canonicalization');

  // template.xlsx
  {
    const wb = new ExcelJS.Workbook();
    addConfig(wb, [
      ['name', 'stage2-cross-writer-canonicalization'],
      ['source_sheet', 'Data'],
      ['source_table', '1'],
      ['output_file_pattern', 'output.xlsx'],
    ]);
    const sh = wb.addWorksheet('R');
    sh.pageSetup.fitToWidth = 1;
    sh.getCell('A1').value = 'Customer';
    sh.getCell('B1').value = 'Amount';
    sh.getCell('A2').value = '{{ [Customer] }}';
    sh.getCell('B2').value = '{{ [Amount] }}';
    sh.getCell('B2').numFmt = '#,##0.00';
    sh.getCell('B2').font = { bold: true, color: { argb: 'FF1F4E79' } };
    await writeBook(wb, join(dir, 'template.xlsx'));
  }

  // data.xlsx
  {
    const wb = new ExcelJS.Workbook();
    const sh = wb.addWorksheet('Data');
    sh.getCell('A1').value = 'Customer';
    sh.getCell('B1').value = 'Amount';
    sh.getCell('A2').value = 'Acme';
    sh.getCell('B2').value = 1234.5;
    await writeBook(wb, join(dir, 'data.xlsx'));
  }

  // expected.xlsx — authored to the same workbook semantics, then rewritten at
  // the OOXML package level to simulate writer-specific serialization noise.
  {
    const wb = new ExcelJS.Workbook();
    const sh = wb.addWorksheet('R');
    sh.pageSetup.fitToWidth = 1;
    sh.getCell('A1').value = 'Customer';
    sh.getCell('B1').value = 'Amount';
    sh.getCell('A2').value = 'Acme';
    sh.getCell('B2').value = 1234.5;
    sh.getCell('B2').numFmt = '#,##0.00';
    sh.getCell('B2').font = { bold: true, color: { argb: 'FF1F4E79' } };
    await writeCrossWriterVariantBook(wb, join(dir, 'expected.xlsx'));
  }
}

const builders = [
  ['001', build001],
  ['002', build002],
  ['003', build003],
  ['004', build004],
  ['005', build005],
  ['006', build006],
  ['007', build007],
  ['008', build008],
  ['009', build009],
  ['010', build010],
  ['011', build011],
  ['012', build012],
  ['013', build013],
  ['014', build014],
  ['015', build015],
  ['016', build016],
  ['017', build017],
  ['018', build018],
  ['019', build019],
  ['020', build020],
  ['021', build021],
  ['022', build022],
  ['023', build023],
  ['024', build024],
  ['025', build025],
  ['026', build026],
  ['027', build027],
];

const selected = new Set(process.argv.slice(2));
const activeBuilders = selected.size > 0
  ? builders.filter(([id]) => selected.has(id))
  : builders;

if (activeBuilders.length === 0) {
  throw new Error(`No matching fixture builders for: ${[...selected].join(', ')}`);
}

for (const [, build] of activeBuilders) {
  await build();
}

console.log(`built fixtures ${activeBuilders.map(([id]) => id).join(', ')}`);
