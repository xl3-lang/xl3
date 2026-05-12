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
import { mkdir, writeFile } from 'node:fs/promises';
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
  const sh = wb.addWorksheet('__config__', { state: 'hidden' });
  entries.forEach(([k, v], i) => {
    sh.getCell(i + 1, 1).value = k;
    sh.getCell(i + 1, 2).value = v;
  });
}

// ADR-0011: __lists__ sheet — header row holds list names; columns
// below hold values.
function addLists(wb, lists, opts = {}) {
  const sh = wb.addWorksheet('__lists__', { state: opts.state ?? 'hidden' });
  const names = Object.keys(lists);
  names.forEach((name, col) => {
    sh.getCell(1, col + 1).value = name;
    lists[name].forEach((value, row) => {
      sh.getCell(row + 2, col + 1).value = value;
    });
  });
}

// ADR-0012: __sources__ sheet — one row per source with name/sheet/table.
function addSources(wb, rows, opts = {}) {
  const sh = wb.addWorksheet('__sources__', { state: opts.state ?? 'hidden' });
  const headers = ['name', 'sheet', 'table', 'description'];
  headers.forEach((h, i) => { sh.getCell(1, i + 1).value = h; });
  rows.forEach((row, rIdx) => {
    headers.forEach((h, cIdx) => {
      if (row[h] !== undefined) sh.getCell(rIdx + 2, cIdx + 1).value = row[h];
    });
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
  //   - phase 9: __config__ and directive rows removed
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
// Concept: @filter [field] in __lists__[name] keeps only rows whose field
// value appears in the named list. The __lists__ sheet is removed from
// output.
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
    sh.getCell('A2').value = '{{ @filter [Customer] in __lists__[Allowed] }}'; // directive row
    sh.getCell('A3').value = '{{ [Customer] }}';
    sh.getCell('B3').value = '{{ [Amount] }}';

    addLists(wb, { Allowed: ['Acme', 'Beta'] }, { state: 'visible' });

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
  //   - filter directive row keeps Acme, Beta (in __lists__[Allowed]); drops Charlie
  //   - directive row is removed from output
  //   - __lists__ sheet is removed from output
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
    sh.getCell('A2').value = new Date(Date.UTC(2026, 4, 3));
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
    sh.getCell('A2').value = new Date(Date.UTC(2026, 4, 3));
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

  // template.xlsx — filename pattern interpolates a __config__ author
  // key that resolves to empty. ADR-0026's "(blank)" placeholder for
  // group keys does NOT apply to non-group-key sources like
  // __config__, so the rendered filename is ".xlsx" → empty basename
  // → sanitization error per ADR-0002.
  {
    const wb = new ExcelJS.Workbook();
    addConfig(wb, [
      ['name', 'filename-empty-basename-error'],
      ['source_sheet', 'Data'],
      ['source_table', '1'],
      ['output_file_pattern', '{{ __config__[suffix] }}.xlsx'],
      ['suffix', ''], // author-defined empty value
    ]);
    const sh = wb.addWorksheet('Report');
    sh.getCell('A1').value = 'Item';
    sh.getCell('A2').value = '{{ [Item] }}';
    await writeBook(wb, join(dir, 'template.xlsx'));
  }

  // data.xlsx
  {
    const wb = new ExcelJS.Workbook();
    const sh = wb.addWorksheet('Data');
    sh.getCell('A1').value = 'Item';
    sh.getCell('A2').value = 'Widget';
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

// ---------------------------------------------------------------------------
// 028 - source-table-row-shorthand
//
// Concept: source_table = N selects row N as the source column-name row and
// reads rows below it through the worksheet's used row end.
// Spec section: evaluation.md "Source Data Model".
// ---------------------------------------------------------------------------
async function build028() {
  const dir = join(FIXTURES, '028-source-table-row-shorthand');

  // template.xlsx
  {
    const wb = new ExcelJS.Workbook();
    addConfig(wb, [
      ['name', 'source-table-row-shorthand'],
      ['source_sheet', 'Data'],
      ['source_table', '3'],
      ['output_file_pattern', 'output.xlsx'],
    ]);
    const sh = wb.addWorksheet('Report');
    sh.getCell('A1').value = 'Customer';
    sh.getCell('B1').value = 'Amount';
    sh.getCell('A2').value = '{{ [Customer] }}';
    sh.getCell('B2').value = '{{ [Amount] }}';
    await writeBook(wb, join(dir, 'template.xlsx'));
  }

  // data.xlsx
  {
    const wb = new ExcelJS.Workbook();
    const sh = wb.addWorksheet('Data');
    sh.getCell('A1').value = 'ignored';
    sh.getCell('A2').value = 'also ignored';
    sh.getCell('A3').value = 'Customer';
    sh.getCell('B3').value = 'Amount';
    sh.getCell('C3').value = 'Region';
    sh.getCell('A4').value = 'Acme';
    sh.getCell('B4').value = 10;
    sh.getCell('C4').value = 'Seoul';
    sh.getCell('A5').value = 'Beta';
    sh.getCell('B5').value = 20;
    sh.getCell('C5').value = 'Busan';
    await writeBook(wb, join(dir, 'data.xlsx'));
  }

  // expected.xlsx
  {
    const wb = new ExcelJS.Workbook();
    const sh = wb.addWorksheet('Report');
    sh.getCell('A1').value = 'Customer';
    sh.getCell('B1').value = 'Amount';
    sh.getCell('A2').value = 'Acme';
    sh.getCell('B2').value = 10;
    sh.getCell('A3').value = 'Beta';
    sh.getCell('B3').value = 20;
    await writeBook(wb, join(dir, 'expected.xlsx'));
  }
}

// ---------------------------------------------------------------------------
// 029 - source-table-open-range
//
// Concept: source_table = B3:D selects B3:D3 as source column names and reads
// rows below that column window through the worksheet's used row end.
// Spec section: evaluation.md "Source Data Model".
// ---------------------------------------------------------------------------
async function build029() {
  const dir = join(FIXTURES, '029-source-table-open-range');

  // template.xlsx
  {
    const wb = new ExcelJS.Workbook();
    addConfig(wb, [
      ['name', 'source-table-open-range'],
      ['source_sheet', 'Data'],
      ['source_table', 'B3:D'],
      ['output_file_pattern', 'output.xlsx'],
    ]);
    const sh = wb.addWorksheet('Report');
    sh.getCell('A1').value = 'Customer';
    sh.getCell('B1').value = 'Amount';
    sh.getCell('C1').value = 'Region';
    sh.getCell('A2').value = '{{ [Customer] }}';
    sh.getCell('B2').value = '{{ [Amount] }}';
    sh.getCell('C2').value = '{{ [Region] }}';
    await writeBook(wb, join(dir, 'template.xlsx'));
  }

  // data.xlsx
  {
    const wb = new ExcelJS.Workbook();
    const sh = wb.addWorksheet('Data');
    sh.getCell('A3').value = 'outside-left';
    sh.getCell('B3').value = 'Customer';
    sh.getCell('C3').value = 'Amount';
    sh.getCell('D3').value = 'Region';
    sh.getCell('E3').value = 'outside-right';
    sh.getCell('B4').value = 'Acme';
    sh.getCell('C4').value = 10;
    sh.getCell('D4').value = 'Seoul';
    sh.getCell('E4').value = 'ignored';
    sh.getCell('B5').value = 'Beta';
    sh.getCell('C5').value = 20;
    sh.getCell('D5').value = 'Busan';
    await writeBook(wb, join(dir, 'data.xlsx'));
  }

  // expected.xlsx
  {
    const wb = new ExcelJS.Workbook();
    const sh = wb.addWorksheet('Report');
    sh.getCell('A1').value = 'Customer';
    sh.getCell('B1').value = 'Amount';
    sh.getCell('C1').value = 'Region';
    sh.getCell('A2').value = 'Acme';
    sh.getCell('B2').value = 10;
    sh.getCell('C2').value = 'Seoul';
    sh.getCell('A3').value = 'Beta';
    sh.getCell('B3').value = 20;
    sh.getCell('C3').value = 'Busan';
    await writeBook(wb, join(dir, 'expected.xlsx'));
  }
}

// ---------------------------------------------------------------------------
// 030 - source-table-finite-range
//
// Concept: source_table = B3:D4 reads only data rows within the declared end
// row, even when later worksheet rows contain values.
// Spec section: evaluation.md "Source Data Model".
// ---------------------------------------------------------------------------
async function build030() {
  const dir = join(FIXTURES, '030-source-table-finite-range');

  // template.xlsx
  {
    const wb = new ExcelJS.Workbook();
    addConfig(wb, [
      ['name', 'source-table-finite-range'],
      ['source_sheet', 'Data'],
      ['source_table', 'B3:D4'],
      ['output_file_pattern', 'output.xlsx'],
    ]);
    const sh = wb.addWorksheet('Report');
    sh.getCell('A1').value = 'Customer';
    sh.getCell('B1').value = 'Amount';
    sh.getCell('C1').value = 'Region';
    sh.getCell('A2').value = '{{ [Customer] }}';
    sh.getCell('B2').value = '{{ [Amount] }}';
    sh.getCell('C2').value = '{{ [Region] }}';
    await writeBook(wb, join(dir, 'template.xlsx'));
  }

  // data.xlsx
  {
    const wb = new ExcelJS.Workbook();
    const sh = wb.addWorksheet('Data');
    sh.getCell('B3').value = 'Customer';
    sh.getCell('C3').value = 'Amount';
    sh.getCell('D3').value = 'Region';
    sh.getCell('B4').value = 'Acme';
    sh.getCell('C4').value = 10;
    sh.getCell('D4').value = 'Seoul';
    sh.getCell('B5').value = 'Beta';
    sh.getCell('C5').value = 20;
    sh.getCell('D5').value = 'Busan';
    await writeBook(wb, join(dir, 'data.xlsx'));
  }

  // expected.xlsx
  {
    const wb = new ExcelJS.Workbook();
    const sh = wb.addWorksheet('Report');
    sh.getCell('A1').value = 'Customer';
    sh.getCell('B1').value = 'Amount';
    sh.getCell('C1').value = 'Region';
    sh.getCell('A2').value = 'Acme';
    sh.getCell('B2').value = 10;
    sh.getCell('C2').value = 'Seoul';
    await writeBook(wb, join(dir, 'expected.xlsx'));
  }
}

// ---------------------------------------------------------------------------
// 031 - source-table-zero-data-range
//
// Concept: source_table = B3:D3 is valid and has zero source data rows. Since
// no source rows exist, conversion produces zero output files.
// Spec section: evaluation.md "Source Data Model".
// ---------------------------------------------------------------------------
async function build031() {
  const dir = join(FIXTURES, '031-source-table-zero-data-range');

  // template.xlsx
  {
    const wb = new ExcelJS.Workbook();
    addConfig(wb, [
      ['name', 'source-table-zero-data-range'],
      ['source_sheet', 'Data'],
      ['source_table', 'B3:D3'],
      ['output_file_pattern', 'output.xlsx'],
    ]);
    const sh = wb.addWorksheet('Report');
    sh.getCell('A1').value = 'Customer';
    sh.getCell('A2').value = '{{ [Customer] }}';
    await writeBook(wb, join(dir, 'template.xlsx'));
  }

  // data.xlsx
  {
    const wb = new ExcelJS.Workbook();
    const sh = wb.addWorksheet('Data');
    sh.getCell('B3').value = 'Customer';
    sh.getCell('C3').value = 'Amount';
    sh.getCell('D3').value = 'Region';
    sh.getCell('B4').value = 'Acme';
    sh.getCell('C4').value = 10;
    sh.getCell('D4').value = 'Seoul';
    await writeBook(wb, join(dir, 'data.xlsx'));
  }

  // expected/ empty directory means zero output files.
  await mkdir(join(dir, 'expected'), { recursive: true });
}

// ---------------------------------------------------------------------------
// 032 - source-table-empty-column-name-error
//
// Concept: empty source column names inside the selected span are errors.
// Spec section: evaluation.md "Source Data Model".
// ---------------------------------------------------------------------------
async function build032() {
  const dir = join(FIXTURES, '032-source-table-empty-column-name-error');

  // template.xlsx
  {
    const wb = new ExcelJS.Workbook();
    addConfig(wb, [
      ['name', 'source-table-empty-column-name-error'],
      ['source_sheet', 'Data'],
      ['source_table', 'B3:D'],
      ['output_file_pattern', 'output.xlsx'],
    ]);
    const sh = wb.addWorksheet('Report');
    sh.getCell('A1').value = '{{ [Customer] }}';
    await writeBook(wb, join(dir, 'template.xlsx'));
  }

  // data.xlsx
  {
    const wb = new ExcelJS.Workbook();
    const sh = wb.addWorksheet('Data');
    sh.getCell('B3').value = 'Customer';
    sh.getCell('D3').value = 'Region';
    sh.getCell('B4').value = 'Acme';
    sh.getCell('D4').value = 'Seoul';
    await writeBook(wb, join(dir, 'data.xlsx'));
  }
}

// ---------------------------------------------------------------------------
// 033 - source-table-duplicate-column-name-error
//
// Concept: duplicate source column names inside the selected span are errors.
// Spec section: evaluation.md "Source Data Model".
// ---------------------------------------------------------------------------
async function build033() {
  const dir = join(FIXTURES, '033-source-table-duplicate-column-name-error');

  // template.xlsx
  {
    const wb = new ExcelJS.Workbook();
    addConfig(wb, [
      ['name', 'source-table-duplicate-column-name-error'],
      ['source_sheet', 'Data'],
      ['source_table', 'A1:B'],
      ['output_file_pattern', 'output.xlsx'],
    ]);
    const sh = wb.addWorksheet('Report');
    sh.getCell('A1').value = '{{ [Customer] }}';
    await writeBook(wb, join(dir, 'template.xlsx'));
  }

  // data.xlsx
  {
    const wb = new ExcelJS.Workbook();
    const sh = wb.addWorksheet('Data');
    sh.getCell('A1').value = 'Customer';
    sh.getCell('B1').value = 'Customer';
    sh.getCell('A2').value = 'Acme';
    sh.getCell('B2').value = 'Beta';
    await writeBook(wb, join(dir, 'data.xlsx'));
  }
}

// ---------------------------------------------------------------------------
// 034 - source-table-invalid-selector-error
//
// Concept: source_table selectors use 1-based positive row numbers. Row zero
// is invalid.
// Spec section: evaluation.md "Source Data Model".
// ---------------------------------------------------------------------------
async function build034() {
  const dir = join(FIXTURES, '034-source-table-invalid-selector-error');

  // template.xlsx
  {
    const wb = new ExcelJS.Workbook();
    addConfig(wb, [
      ['name', 'source-table-invalid-selector-error'],
      ['source_sheet', 'Data'],
      ['source_table', '0'],
      ['output_file_pattern', 'output.xlsx'],
    ]);
    const sh = wb.addWorksheet('Report');
    sh.getCell('A1').value = '{{ [Customer] }}';
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
}

// ---------------------------------------------------------------------------
// 035 - source-table-rich-text-header
//
// Concept: rich-text source column-name cells are read by concatenating their
// text runs before source_table parsing.
// Spec section: evaluation.md "Source Data Model".
// ---------------------------------------------------------------------------
async function build035() {
  const dir = join(FIXTURES, '035-source-table-rich-text-header');
  await mkdir(dir, { recursive: true });

  // template.xlsx
  {
    const wb = new ExcelJS.Workbook();
    addConfig(wb, [
      ['name', 'source-table-rich-text-header'],
      ['source_sheet', 'Data'],
      ['source_table', 'B3:D'],
      ['output_file_pattern', 'output.xlsx'],
    ]);
    const sh = wb.addWorksheet('Report');
    sh.getCell('A1').value = 'Customer';
    sh.getCell('B1').value = 'Amount';
    sh.getCell('C1').value = 'Region';
    sh.getCell('A2').value = '{{ [Customer] }}';
    sh.getCell('B2').value = '{{ [Amount] }}';
    sh.getCell('C2').value = '{{ [Region] }}';
    await writeBook(wb, join(dir, 'template.xlsx'));
  }

  // data.xlsx
  {
    const wb = new ExcelJS.Workbook();
    const sh = wb.addWorksheet('Data');
    sh.getCell('B3').value = { richText: [{ text: 'Cus' }, { text: 'tomer' }] };
    sh.getCell('C3').value = 'Amount';
    sh.getCell('D3').value = 'Region';
    sh.getCell('B4').value = 'Acme';
    sh.getCell('C4').value = 10;
    sh.getCell('D4').value = 'Seoul';
    await writeBook(wb, join(dir, 'data.xlsx'));
  }

  // expected.xlsx
  {
    const wb = new ExcelJS.Workbook();
    const sh = wb.addWorksheet('Report');
    sh.getCell('A1').value = 'Customer';
    sh.getCell('B1').value = 'Amount';
    sh.getCell('C1').value = 'Region';
    sh.getCell('A2').value = 'Acme';
    sh.getCell('B2').value = 10;
    sh.getCell('C2').value = 'Seoul';
    await writeBook(wb, join(dir, 'expected.xlsx'));
  }
}

// ---------------------------------------------------------------------------
// 036 - source-table-formula-header
//
// Concept: formula source column-name cells use their cached formula result.
// Spec section: evaluation.md "Source Data Model".
// ---------------------------------------------------------------------------
async function build036() {
  const dir = join(FIXTURES, '036-source-table-formula-header');
  await mkdir(dir, { recursive: true });

  // template.xlsx
  {
    const wb = new ExcelJS.Workbook();
    addConfig(wb, [
      ['name', 'source-table-formula-header'],
      ['source_sheet', 'Data'],
      ['source_table', 'B3:D'],
      ['output_file_pattern', 'output.xlsx'],
    ]);
    const sh = wb.addWorksheet('Report');
    sh.getCell('A1').value = 'Customer';
    sh.getCell('B1').value = 'Amount';
    sh.getCell('C1').value = 'Region';
    sh.getCell('A2').value = '{{ [Customer] }}';
    sh.getCell('B2').value = '{{ [Amount] }}';
    sh.getCell('C2').value = '{{ [Region] }}';
    await writeBook(wb, join(dir, 'template.xlsx'));
  }

  // data.xlsx
  {
    const wb = new ExcelJS.Workbook();
    const sh = wb.addWorksheet('Data');
    sh.getCell('B3').value = { formula: '"Customer"', result: 'Customer' };
    sh.getCell('C3').value = 'Amount';
    sh.getCell('D3').value = 'Region';
    sh.getCell('B4').value = 'Acme';
    sh.getCell('C4').value = 10;
    sh.getCell('D4').value = 'Seoul';
    await writeBook(wb, join(dir, 'data.xlsx'));
  }

  // expected.xlsx
  {
    const wb = new ExcelJS.Workbook();
    const sh = wb.addWorksheet('Report');
    sh.getCell('A1').value = 'Customer';
    sh.getCell('B1').value = 'Amount';
    sh.getCell('C1').value = 'Region';
    sh.getCell('A2').value = 'Acme';
    sh.getCell('B2').value = 10;
    sh.getCell('C2').value = 'Seoul';
    await writeBook(wb, join(dir, 'expected.xlsx'));
  }
}

// ---------------------------------------------------------------------------
// 037 - source-table-formula-header-missing-cache-error
//
// Concept: formula source column-name cells without cached results are errors.
// Spec section: evaluation.md "Source Data Model".
// ---------------------------------------------------------------------------
async function build037() {
  const dir = join(FIXTURES, '037-source-table-formula-header-missing-cache-error');
  await mkdir(dir, { recursive: true });

  // template.xlsx
  {
    const wb = new ExcelJS.Workbook();
    addConfig(wb, [
      ['name', 'source-table-formula-header-missing-cache-error'],
      ['source_sheet', 'Data'],
      ['source_table', 'B3:D'],
      ['output_file_pattern', 'output.xlsx'],
    ]);
    const sh = wb.addWorksheet('Report');
    sh.getCell('A1').value = '{{ [Customer] }}';
    await writeBook(wb, join(dir, 'template.xlsx'));
  }

  // data.xlsx
  {
    const wb = new ExcelJS.Workbook();
    const sh = wb.addWorksheet('Data');
    sh.getCell('B3').value = { formula: '"Customer"' };
    sh.getCell('C3').value = 'Amount';
    sh.getCell('D3').value = 'Region';
    sh.getCell('B4').value = 'Acme';
    sh.getCell('C4').value = 10;
    sh.getCell('D4').value = 'Seoul';
    await writeBook(wb, join(dir, 'data.xlsx'));
  }
}

// ---------------------------------------------------------------------------
// 038 - source-sheet-exact-match-beats-prefix
//
// Concept: exact source_sheet matches take precedence over prefix patterns.
// Spec section: evaluation.md "Source Data Model".
// ---------------------------------------------------------------------------
async function build038() {
  const dir = join(FIXTURES, '038-source-sheet-exact-match-beats-prefix');
  await mkdir(dir, { recursive: true });

  // template.xlsx
  {
    const wb = new ExcelJS.Workbook();
    addConfig(wb, [
      ['name', 'source-sheet-exact-match-beats-prefix'],
      ['source_sheet', 'Data'],
      ['source_table', '1'],
      ['output_file_pattern', 'output.xlsx'],
    ]);
    const sh = wb.addWorksheet('R');
    sh.getCell('A1').value = 'Customer';
    sh.getCell('A2').value = '{{ [Customer] }}';
    await writeBook(wb, join(dir, 'template.xlsx'));
  }

  // data.xlsx — the exact Data sheet must be chosen, not Data_2025.
  {
    const wb = new ExcelJS.Workbook();
    const prefix = wb.addWorksheet('Data_2025');
    prefix.getCell('A1').value = 'Customer';
    prefix.getCell('A2').value = 'Wrong';
    const exact = wb.addWorksheet('Data');
    exact.getCell('A1').value = 'Customer';
    exact.getCell('A2').value = 'Right';
    await writeBook(wb, join(dir, 'data.xlsx'));
  }

  // expected.xlsx
  {
    const wb = new ExcelJS.Workbook();
    const sh = wb.addWorksheet('R');
    sh.getCell('A1').value = 'Customer';
    sh.getCell('A2').value = 'Right';
    await writeBook(wb, join(dir, 'expected.xlsx'));
  }
}

// ---------------------------------------------------------------------------
// 039 - source-sheet-default-first-worksheet
//
// Concept: source_sheet omitted defaults to the first worksheet in workbook
// order.
// Spec section: evaluation.md "Source Data Model".
// ---------------------------------------------------------------------------
async function build039() {
  const dir = join(FIXTURES, '039-source-sheet-default-first-worksheet');
  await mkdir(dir, { recursive: true });

  // template.xlsx
  {
    const wb = new ExcelJS.Workbook();
    addConfig(wb, [
      ['name', 'source-sheet-default-first-worksheet'],
      ['source_table', '1'],
      ['output_file_pattern', 'output.xlsx'],
    ]);
    const sh = wb.addWorksheet('R');
    sh.getCell('A1').value = 'Customer';
    sh.getCell('A2').value = '{{ [Customer] }}';
    await writeBook(wb, join(dir, 'template.xlsx'));
  }

  // data.xlsx — the first worksheet must be used because source_sheet is omitted.
  {
    const wb = new ExcelJS.Workbook();
    const first = wb.addWorksheet('First');
    first.getCell('A1').value = 'Customer';
    first.getCell('A2').value = 'First';
    const second = wb.addWorksheet('Second');
    second.getCell('A1').value = 'Customer';
    second.getCell('A2').value = 'Second';
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
// 040 - list-sheet-hidden-states-removed
//
// Concept: list sheets may be hidden or very hidden, and they are removed from
// output workbooks either way.
// Spec section: evaluation.md "List Sheets".
// ---------------------------------------------------------------------------
async function build040() {
  const dir = join(FIXTURES, '040-list-sheet-hidden-states-removed');
  await mkdir(dir, { recursive: true });

  // template.xlsx
  // ADR-0011: lists are consolidated into the single __lists__ reserved
  // sheet. The fixture's contract — that the list sheet is removed
  // from output regardless of its visibility state — applies to that
  // single sheet. We use `veryHidden` (the strongest state) to lock in
  // the most restrictive variant.
  {
    const wb = new ExcelJS.Workbook();
    addConfig(wb, [
      ['name', 'list-sheet-hidden-states-removed'],
      ['source_sheet', 'Data'],
      ['source_table', '1'],
      ['output_file_pattern', 'output.xlsx'],
    ]);
    const sh = wb.addWorksheet('Report');
    sh.getCell('A1').value = 'Customer';
    sh.getCell('B1').value = 'Amount';
    sh.getCell('A2').value = '{{ @filter [Customer] in __lists__[Allowed] }}';
    sh.getCell('A3').value = '{{ @filter [Customer] !in __lists__[Excluded] }}';
    sh.getCell('A4').value = '{{ [Customer] }}';
    sh.getCell('B4').value = '{{ [Amount] }}';

    addLists(wb, {
      Allowed: ['Acme', 'Beta'],
      Excluded: ['Gamma'],
    }, { state: 'veryHidden' });

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
    sh.getCell('A4').value = 'Gamma';
    sh.getCell('B4').value = 100;
    await writeBook(wb, join(dir, 'data.xlsx'));
  }

  // expected.xlsx
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
// 041 - row-function-inside-repeat-block
//
// Concept: ROW() returns the 1-based index of the current rendered data row
// inside the repeat/data block.
// Spec section: language.md "Row and Date Functions".
// ---------------------------------------------------------------------------
async function build041() {
  const dir = join(FIXTURES, '041-row-function-inside-repeat-block');
  await mkdir(dir, { recursive: true });

  // template.xlsx
  {
    const wb = new ExcelJS.Workbook();
    addConfig(wb, [
      ['name', 'row-function-inside-repeat-block'],
      ['source_sheet', 'Data'],
      ['source_table', '1'],
      ['output_file_pattern', 'output.xlsx'],
    ]);
    const sh = wb.addWorksheet('Report');
    sh.getCell('A1').value = 'Item';
    sh.getCell('B1').value = 'Row';
    sh.getCell('A2').value = '{{ [Item] }}';
    sh.getCell('B2').value = '{{ ROW() }}';
    await writeBook(wb, join(dir, 'template.xlsx'));
  }

  // data.xlsx
  {
    const wb = new ExcelJS.Workbook();
    const sh = wb.addWorksheet('Data');
    sh.getCell('A1').value = 'Item';
    sh.getCell('A2').value = 'Acme';
    sh.getCell('A3').value = 'Beta';
    await writeBook(wb, join(dir, 'data.xlsx'));
  }

  // expected.xlsx
  {
    const wb = new ExcelJS.Workbook();
    const sh = wb.addWorksheet('Report');
    sh.getCell('A1').value = 'Item';
    sh.getCell('B1').value = 'Row';
    sh.getCell('A2').value = 'Acme';
    sh.getCell('B2').value = 1;
    sh.getCell('A3').value = 'Beta';
    sh.getCell('B3').value = 2;
    await writeBook(wb, join(dir, 'expected.xlsx'));
  }
}

// ---------------------------------------------------------------------------
// 042 - row-function-outside-repeat-block-error
//
// Concept: ROW() is only valid inside a repeat/data block; static rendering
// outside that context must fail.
// Spec section: language.md "Row and Date Functions".
// ---------------------------------------------------------------------------
async function build042() {
  const dir = join(FIXTURES, '042-row-function-outside-repeat-block-error');
  await mkdir(dir, { recursive: true });

  // template.xlsx
  {
    const wb = new ExcelJS.Workbook();
    addConfig(wb, [
      ['name', 'row-function-outside-repeat-block-error'],
      ['source_sheet', 'Data'],
      ['source_table', '1'],
      ['output_file_pattern', 'output.xlsx'],
    ]);
    const sh = wb.addWorksheet('Report');
    sh.getCell('A1').value = '{{ ROW() }}';
    await writeBook(wb, join(dir, 'template.xlsx'));
  }

  // data.xlsx
  {
    const wb = new ExcelJS.Workbook();
    const sh = wb.addWorksheet('Data');
    sh.getCell('A1').value = 'Item';
    sh.getCell('A2').value = 'Acme';
    await writeBook(wb, join(dir, 'data.xlsx'));
  }
}

// ---------------------------------------------------------------------------
// 043 - ifempty-function
//
// Concept: IFEMPTY returns the fallback for empty values and passes through
// non-empty values.
// Spec section: language.md "Functions / IFEMPTY".
// ---------------------------------------------------------------------------
async function build043() {
  const dir = join(FIXTURES, '043-ifempty-function');
  await mkdir(dir, { recursive: true });

  // template.xlsx
  {
    const wb = new ExcelJS.Workbook();
    addConfig(wb, [
      ['name', 'ifempty-function'],
      ['source_sheet', 'Data'],
      ['source_table', '1'],
      ['output_file_pattern', 'output.xlsx'],
    ]);
    const sh = wb.addWorksheet('Report');
    sh.getCell('A1').value = 'Customer';
    sh.getCell('B1').value = 'Memo';
    sh.getCell('A2').value = '{{ [Customer] }}';
    sh.getCell('B2').value = '{{ IFEMPTY([Memo], "-") }}';
    await writeBook(wb, join(dir, 'template.xlsx'));
  }

  // data.xlsx
  {
    const wb = new ExcelJS.Workbook();
    const sh = wb.addWorksheet('Data');
    sh.getCell('A1').value = 'Customer';
    sh.getCell('B1').value = 'Memo';
    sh.getCell('A2').value = 'Acme';
    sh.getCell('A3').value = 'Beta';
    sh.getCell('B3').value = 'hello';
    await writeBook(wb, join(dir, 'data.xlsx'));
  }

  // expected.xlsx
  {
    const wb = new ExcelJS.Workbook();
    const sh = wb.addWorksheet('Report');
    sh.getCell('A1').value = 'Customer';
    sh.getCell('B1').value = 'Memo';
    sh.getCell('A2').value = 'Acme';
    sh.getCell('B2').value = '-';
    sh.getCell('A3').value = 'Beta';
    sh.getCell('B3').value = 'hello';
    await writeBook(wb, join(dir, 'expected.xlsx'));
  }
}

// ---------------------------------------------------------------------------
// 044 - sort-and-top-order
//
// Concept: sort runs before top, so the top N rows are selected from the
// sorted row set.
// Spec section: evaluation.md "Directives".
// ---------------------------------------------------------------------------
async function build044() {
  const dir = join(FIXTURES, '044-sort-and-top-order');
  await mkdir(dir, { recursive: true });

  // template.xlsx
  {
    const wb = new ExcelJS.Workbook();
    addConfig(wb, [
      ['name', 'sort-and-top-order'],
      ['source_sheet', 'Data'],
      ['source_table', '1'],
      ['output_file_pattern', 'output.xlsx'],
    ]);
    const sh = wb.addWorksheet('Report');
    sh.getCell('A1').value = 'Customer';
    sh.getCell('B1').value = 'Amount';
    sh.getCell('A2').value = '{{ @sort [Amount] desc }}';
    sh.getCell('A3').value = '{{ @top 2 }}';
    sh.getCell('A4').value = '{{ [Customer] }}';
    sh.getCell('B4').value = '{{ [Amount] }}';
    await writeBook(wb, join(dir, 'template.xlsx'));
  }

  // data.xlsx
  {
    const wb = new ExcelJS.Workbook();
    const sh = wb.addWorksheet('Data');
    sh.getCell('A1').value = 'Customer';
    sh.getCell('B1').value = 'Amount';
    sh.getCell('A2').value = 'Acme';
    sh.getCell('B2').value = 10;
    sh.getCell('A3').value = 'Beta';
    sh.getCell('B3').value = 30;
    sh.getCell('A4').value = 'Charlie';
    sh.getCell('B4').value = 20;
    await writeBook(wb, join(dir, 'data.xlsx'));
  }

  // expected.xlsx
  {
    const wb = new ExcelJS.Workbook();
    const sh = wb.addWorksheet('Report');
    sh.getCell('A1').value = 'Customer';
    sh.getCell('B1').value = 'Amount';
    sh.getCell('A2').value = 'Beta';
    sh.getCell('B2').value = 30;
    sh.getCell('A3').value = 'Charlie';
    sh.getCell('B3').value = 20;
    await writeBook(wb, join(dir, 'expected.xlsx'));
  }
}

// ---------------------------------------------------------------------------
// 045 - list-sheet-not-in-filter
//
// Concept: `@filter ... !in _Sheet` keeps rows whose values are not present in
// the list sheet and removes the list sheet from output.
// Spec section: evaluation.md "List Sheets" and language.md "Directives / Filter".
// ---------------------------------------------------------------------------
async function build045() {
  const dir = join(FIXTURES, '045-list-sheet-not-in-filter');
  await mkdir(dir, { recursive: true });

  // template.xlsx
  {
    const wb = new ExcelJS.Workbook();
    addConfig(wb, [
      ['name', 'list-sheet-not-in-filter'],
      ['source_sheet', 'Data'],
      ['source_table', '1'],
      ['output_file_pattern', 'output.xlsx'],
    ]);
    const sh = wb.addWorksheet('Report');
    sh.getCell('A1').value = 'Customer';
    sh.getCell('B1').value = 'Amount';
    sh.getCell('A2').value = '{{ @filter [Customer] !in __lists__[Excluded] }}';
    sh.getCell('A3').value = '{{ [Customer] }}';
    sh.getCell('B3').value = '{{ [Amount] }}';

    addLists(wb, { Excluded: ['Beta', 'Charlie'] }, { state: 'visible' });

    await writeBook(wb, join(dir, 'template.xlsx'));
  }

  // data.xlsx
  {
    const wb = new ExcelJS.Workbook();
    const sh = wb.addWorksheet('Data');
    sh.getCell('A1').value = 'Customer';
    sh.getCell('B1').value = 'Amount';
    sh.getCell('A2').value = 'Acme';
    sh.getCell('B2').value = 10;
    sh.getCell('A3').value = 'Beta';
    sh.getCell('B3').value = 20;
    sh.getCell('A4').value = 'Charlie';
    sh.getCell('B4').value = 30;
    await writeBook(wb, join(dir, 'data.xlsx'));
  }

  // expected.xlsx
  {
    const wb = new ExcelJS.Workbook();
    const sh = wb.addWorksheet('Report');
    sh.getCell('A1').value = 'Customer';
    sh.getCell('B1').value = 'Amount';
    sh.getCell('A2').value = 'Acme';
    sh.getCell('B2').value = 10;
    await writeBook(wb, join(dir, 'expected.xlsx'));
  }
}

// ---------------------------------------------------------------------------
// 046 - count-field-non-empty
//
// Concept: COUNT([field]) counts non-empty values in the current row set.
// Spec section: language.md "Functions / Aggregates".
// ---------------------------------------------------------------------------
async function build046() {
  const dir = join(FIXTURES, '046-count-field-non-empty');
  await mkdir(dir, { recursive: true });

  // template.xlsx
  {
    const wb = new ExcelJS.Workbook();
    addConfig(wb, [
      ['name', 'count-field-non-empty'],
      ['source_sheet', 'Data'],
      ['source_table', '1'],
      ['output_file_pattern', 'output.xlsx'],
    ]);
    const sh = wb.addWorksheet('Report');
    sh.getCell('A1').value = 'Customer';
    sh.getCell('B1').value = 'MemoCount';
    sh.getCell('A2').value = '{{ [Customer] }}';
    sh.getCell('B2').value = '{{ COUNT([Memo]) }}';
    await writeBook(wb, join(dir, 'template.xlsx'));
  }

  // data.xlsx
  {
    const wb = new ExcelJS.Workbook();
    const sh = wb.addWorksheet('Data');
    sh.getCell('A1').value = 'Customer';
    sh.getCell('B1').value = 'Memo';
    sh.getCell('A2').value = 'Acme';
    sh.getCell('B2').value = 'hello';
    sh.getCell('A3').value = 'Beta';
    sh.getCell('B3').value = '';
    sh.getCell('A4').value = 'Charlie';
    sh.getCell('B4').value = 'world';
    await writeBook(wb, join(dir, 'data.xlsx'));
  }

  // expected.xlsx
  {
    const wb = new ExcelJS.Workbook();
    const sh = wb.addWorksheet('Report');
    sh.getCell('A1').value = 'Customer';
    sh.getCell('B1').value = 'MemoCount';
    sh.getCell('A2').value = 'Acme';
    sh.getCell('B2').value = 2;
    sh.getCell('A3').value = 'Beta';
    sh.getCell('B3').value = 2;
    sh.getCell('A4').value = 'Charlie';
    sh.getCell('B4').value = 2;
    await writeBook(wb, join(dir, 'expected.xlsx'));
  }
}

// ---------------------------------------------------------------------------
// 047 - aggregate-functions
//
// Concept: core aggregates operate on the current rendered row set.
// Spec section: language.md "Functions / Aggregates".
// ---------------------------------------------------------------------------
async function build047() {
  const dir = join(FIXTURES, '047-aggregate-functions');
  await mkdir(dir, { recursive: true });

  // template.xlsx
  {
    const wb = new ExcelJS.Workbook();
    addConfig(wb, [
      ['name', 'aggregate-functions'],
      ['source_sheet', 'Data'],
      ['source_table', '1'],
      ['output_file_pattern', 'output.xlsx'],
    ]);
    const sh = wb.addWorksheet('Report');
    sh.getCell('A1').value = 'Customer';
    sh.getCell('B1').value = 'Count';
    sh.getCell('C1').value = 'Sum';
    sh.getCell('D1').value = 'Avg';
    sh.getCell('E1').value = 'Min';
    sh.getCell('F1').value = 'Max';
    sh.getCell('A2').value = '{{ [Customer] }}';
    sh.getCell('B2').value = '{{ COUNT() }}';
    sh.getCell('C2').value = '{{ SUM([Amount]) }}';
    sh.getCell('D2').value = '{{ AVERAGE([Amount]) }}';
    sh.getCell('E2').value = '{{ MIN([Amount]) }}';
    sh.getCell('F2').value = '{{ MAX([Amount]) }}';
    await writeBook(wb, join(dir, 'template.xlsx'));
  }

  // data.xlsx
  {
    const wb = new ExcelJS.Workbook();
    const sh = wb.addWorksheet('Data');
    sh.getCell('A1').value = 'Customer';
    sh.getCell('B1').value = 'Amount';
    sh.getCell('A2').value = 'Acme';
    sh.getCell('B2').value = 10;
    sh.getCell('A3').value = 'Beta';
    sh.getCell('B3').value = 20;
    sh.getCell('A4').value = 'Charlie';
    sh.getCell('B4').value = 30;
    await writeBook(wb, join(dir, 'data.xlsx'));
  }

  // expected.xlsx
  {
    const wb = new ExcelJS.Workbook();
    const sh = wb.addWorksheet('Report');
    sh.getCell('A1').value = 'Customer';
    sh.getCell('B1').value = 'Count';
    sh.getCell('C1').value = 'Sum';
    sh.getCell('D1').value = 'Avg';
    sh.getCell('E1').value = 'Min';
    sh.getCell('F1').value = 'Max';
    sh.getCell('A2').value = 'Acme';
    sh.getCell('B2').value = 3;
    sh.getCell('C2').value = 60;
    sh.getCell('D2').value = 20;
    sh.getCell('E2').value = 10;
    sh.getCell('F2').value = 30;
    sh.getCell('A3').value = 'Beta';
    sh.getCell('B3').value = 3;
    sh.getCell('C3').value = 60;
    sh.getCell('D3').value = 20;
    sh.getCell('E3').value = 10;
    sh.getCell('F3').value = 30;
    sh.getCell('A4').value = 'Charlie';
    sh.getCell('B4').value = 3;
    sh.getCell('C4').value = 60;
    sh.getCell('D4').value = 20;
    sh.getCell('E4').value = 10;
    sh.getCell('F4').value = 30;
    await writeBook(wb, join(dir, 'expected.xlsx'));
  }
}

// ---------------------------------------------------------------------------
// 048 - if-and-comparison-boundaries
//
// Concept: comparison operators drive IF() and @filter behavior around the
// zero boundary.
// Spec section: language.md "Functions / IF" and "Operators"; evaluation.md
// "Directives".
// ---------------------------------------------------------------------------
async function build048() {
  const dir = join(FIXTURES, '048-if-and-comparison-boundaries');
  await mkdir(dir, { recursive: true });

  // template.xlsx
  {
    const wb = new ExcelJS.Workbook();
    addConfig(wb, [
      ['name', 'if-and-comparison-boundaries'],
      ['source_sheet', 'Data'],
      ['source_table', '1'],
      ['output_file_pattern', 'output.xlsx'],
    ]);
    const sh = wb.addWorksheet('Report');
    sh.getCell('A1').value = 'Amount';
    sh.getCell('B1').value = 'gt0';
    sh.getCell('C1').value = 'ge0';
    sh.getCell('D1').value = 'eq0';
    sh.getCell('E1').value = 'ne0';
    sh.getCell('F1').value = 'le0';
    sh.getCell('A2').value = '{{ @filter [Amount] >= 0 }}';
    sh.getCell('A3').value = '{{ [Amount] }}';
    sh.getCell('B3').value = '{{ IF([Amount] > 0, "positive", "non-positive") }}';
    sh.getCell('C3').value = '{{ IF([Amount] >= 0, "non-negative", "negative") }}';
    sh.getCell('D3').value = '{{ IF([Amount] = 0, "zero", "non-zero") }}';
    sh.getCell('E3').value = '{{ IF([Amount] != 0, "non-zero", "zero") }}';
    sh.getCell('F3').value = '{{ IF([Amount] <= 0, "lte-zero", "gt-zero") }}';
    await writeBook(wb, join(dir, 'template.xlsx'));
  }

  // data.xlsx
  {
    const wb = new ExcelJS.Workbook();
    const sh = wb.addWorksheet('Data');
    sh.getCell('A1').value = 'Amount';
    sh.getCell('A2').value = -1;
    sh.getCell('A3').value = 0;
    sh.getCell('A4').value = 1;
    await writeBook(wb, join(dir, 'data.xlsx'));
  }

  // expected.xlsx
  {
    const wb = new ExcelJS.Workbook();
    const sh = wb.addWorksheet('Report');
    sh.getCell('A1').value = 'Amount';
    sh.getCell('B1').value = 'gt0';
    sh.getCell('C1').value = 'ge0';
    sh.getCell('D1').value = 'eq0';
    sh.getCell('E1').value = 'ne0';
    sh.getCell('F1').value = 'le0';
    sh.getCell('A2').value = 0;
    sh.getCell('B2').value = 'non-positive';
    sh.getCell('C2').value = 'non-negative';
    sh.getCell('D2').value = 'zero';
    sh.getCell('E2').value = 'zero';
    sh.getCell('F2').value = 'lte-zero';
    sh.getCell('A3').value = 1;
    sh.getCell('B3').value = 'positive';
    sh.getCell('C3').value = 'non-negative';
    // D3: IF([Amount] = 0, "zero", "non-zero") with Amount=1 → "non-zero"
    // Pre-rc.1 fixtures had "zero" here, frozen against a normalizer
    // bug that made `=` fall through (xl3-py issue #1, finding #5).
    sh.getCell('D3').value = 'non-zero';
    sh.getCell('E3').value = 'non-zero';
    sh.getCell('F3').value = 'gt-zero';
    await writeBook(wb, join(dir, 'expected.xlsx'));
  }
}

// ---------------------------------------------------------------------------
// 049 - filename-sanitization-warning
//
// Concept: sanitizing a rendered filename emits a warning without changing
// output semantics.
// Spec section: evaluation.md "Output Filenames"; ADR-0002.
// ---------------------------------------------------------------------------
async function build049() {
  const dir = join(FIXTURES, '049-filename-sanitization-warning');
  await mkdir(dir, { recursive: true });

  // template.xlsx
  {
    const wb = new ExcelJS.Workbook();
    addConfig(wb, [
      ['name', 'filename-sanitization-warning'],
      ['source_sheet', 'Data'],
      ['source_table', '1'],
      ['output_file_pattern', '{{ Customer }}.xlsx'],
    ]);
    const sh = wb.addWorksheet('Report');
    sh.getCell('A1').value = 'Customer';
    sh.getCell('A2').value = '{{ [Customer] }}';
    await writeBook(wb, join(dir, 'template.xlsx'));
  }

  // data.xlsx
  {
    const wb = new ExcelJS.Workbook();
    const sh = wb.addWorksheet('Data');
    sh.getCell('A1').value = 'Customer';
    sh.getCell('A2').value = 'Acme:North';
    await writeBook(wb, join(dir, 'data.xlsx'));
  }

  // expected.xlsx
  {
    const outDir = join(dir, 'expected');
    await mkdir(outDir, { recursive: true });
    const wb = new ExcelJS.Workbook();
    const sh = wb.addWorksheet('Report');
    sh.getCell('A1').value = 'Customer';
    sh.getCell('A2').value = 'Acme:North';
    await writeBook(wb, join(outDir, 'Acme_North.xlsx'));
  }
}

// ---------------------------------------------------------------------------
// 050 - empty-ifempty-whitespace-only
//
// Concept: IFEMPTY treats whitespace-only strings as empty per ADR-0007's
// empty predicate.
// Spec section: evaluation.md "Empty Values"; language.md "Functions /
// IFEMPTY"; ADR-0007.
// ---------------------------------------------------------------------------
async function build050() {
  const dir = join(FIXTURES, '050-empty-ifempty-whitespace-only');
  await mkdir(dir, { recursive: true });

  // template.xlsx
  {
    const wb = new ExcelJS.Workbook();
    addConfig(wb, [
      ['name', 'empty-ifempty-whitespace-only'],
      ['source_sheet', 'Data'],
      ['source_table', '1'],
      ['output_file_pattern', 'output.xlsx'],
    ]);
    const sh = wb.addWorksheet('Report');
    sh.getCell('A1').value = 'Customer';
    sh.getCell('B1').value = 'Memo';
    sh.getCell('A2').value = '{{ [Customer] }}';
    sh.getCell('B2').value = '{{ IFEMPTY([Memo], "-") }}';
    await writeBook(wb, join(dir, 'template.xlsx'));
  }

  // data.xlsx
  {
    const wb = new ExcelJS.Workbook();
    const sh = wb.addWorksheet('Data');
    sh.getCell('A1').value = 'Customer';
    sh.getCell('B1').value = 'Memo';
    sh.getCell('A2').value = 'Acme';
    sh.getCell('B2').value = 'first';
    sh.getCell('A3').value = 'Beta';
    sh.getCell('B3').value = '   ';
    sh.getCell('A4').value = 'Gamma';
    sh.getCell('B4').value = '\t\n';
    sh.getCell('A5').value = 'Delta';
    sh.getCell('B5').value = 'second';
    await writeBook(wb, join(dir, 'data.xlsx'));
  }

  // expected.xlsx
  // Per ADR-0007, "   " and "\t\n" are empty strings (Unicode whitespace
  // trimmed → length 0). IFEMPTY returns the fallback "-" for those.
  {
    const wb = new ExcelJS.Workbook();
    const sh = wb.addWorksheet('Report');
    sh.getCell('A1').value = 'Customer';
    sh.getCell('B1').value = 'Memo';
    sh.getCell('A2').value = 'Acme';
    sh.getCell('B2').value = 'first';
    sh.getCell('A3').value = 'Beta';
    sh.getCell('B3').value = '-';
    sh.getCell('A4').value = 'Gamma';
    sh.getCell('B4').value = '-';
    sh.getCell('A5').value = 'Delta';
    sh.getCell('B5').value = 'second';
    await writeBook(wb, join(dir, 'expected.xlsx'));
  }
}

// ---------------------------------------------------------------------------
// 051 - empty-ifempty-zero-not-empty
//
// Concept: the number 0 is non-empty per ADR-0007. IFEMPTY passes 0
// through and preserves its numeric type.
// Spec section: evaluation.md "Empty Values"; language.md "Functions /
// IFEMPTY"; ADR-0007.
// ---------------------------------------------------------------------------
async function build051() {
  const dir = join(FIXTURES, '051-empty-ifempty-zero-not-empty');
  await mkdir(dir, { recursive: true });

  // template.xlsx
  {
    const wb = new ExcelJS.Workbook();
    addConfig(wb, [
      ['name', 'empty-ifempty-zero-not-empty'],
      ['source_sheet', 'Data'],
      ['source_table', '1'],
      ['output_file_pattern', 'output.xlsx'],
    ]);
    const sh = wb.addWorksheet('Report');
    sh.getCell('A1').value = 'Customer';
    sh.getCell('B1').value = 'Amount';
    sh.getCell('A2').value = '{{ [Customer] }}';
    sh.getCell('B2').value = '{{ IFEMPTY([Amount], "-") }}';
    await writeBook(wb, join(dir, 'template.xlsx'));
  }

  // data.xlsx
  {
    const wb = new ExcelJS.Workbook();
    const sh = wb.addWorksheet('Data');
    sh.getCell('A1').value = 'Customer';
    sh.getCell('B1').value = 'Amount';
    sh.getCell('A2').value = 'Acme';
    sh.getCell('B2').value = 0;
    sh.getCell('A3').value = 'Beta';
    // B3 left blank — empty cell.
    sh.getCell('A4').value = 'Gamma';
    sh.getCell('B4').value = 100;
    await writeBook(wb, join(dir, 'data.xlsx'));
  }

  // expected.xlsx
  // Acme's Amount is the number 0 — non-empty, IFEMPTY passes it through.
  // Beta's Amount cell is blank — empty, IFEMPTY returns the string "-".
  // Gamma's Amount is 100 — passed through.
  {
    const wb = new ExcelJS.Workbook();
    const sh = wb.addWorksheet('Report');
    sh.getCell('A1').value = 'Customer';
    sh.getCell('B1').value = 'Amount';
    sh.getCell('A2').value = 'Acme';
    sh.getCell('B2').value = 0;
    sh.getCell('A3').value = 'Beta';
    sh.getCell('B3').value = '-';
    sh.getCell('A4').value = 'Gamma';
    sh.getCell('B4').value = 100;
    await writeBook(wb, join(dir, 'expected.xlsx'));
  }
}

// ---------------------------------------------------------------------------
// 052 - empty-count-field-whitespace-zero-false
//
// Concept: COUNT([field]) counts rows whose field is non-empty per
// ADR-0007. Whitespace-only strings are empty; 0 and FALSE are non-empty.
// Spec section: evaluation.md "Empty Values"; language.md "Aggregates";
// ADR-0007.
// ---------------------------------------------------------------------------
async function build052() {
  const dir = join(FIXTURES, '052-empty-count-field-whitespace-zero-false');
  await mkdir(dir, { recursive: true });

  // template.xlsx
  {
    const wb = new ExcelJS.Workbook();
    addConfig(wb, [
      ['name', 'empty-count-field-whitespace-zero-false'],
      ['source_sheet', 'Data'],
      ['source_table', '1'],
      ['output_file_pattern', 'output.xlsx'],
    ]);
    const sh = wb.addWorksheet('Report');
    sh.getCell('A1').value = 'Customer';
    sh.getCell('B1').value = 'NonEmptyMemos';
    sh.getCell('A2').value = '{{ [Customer] }}';
    sh.getCell('B2').value = '{{ COUNT([Memo]) }}';
    await writeBook(wb, join(dir, 'template.xlsx'));
  }

  // data.xlsx — six rows; Memo values cover the empty/non-empty matrix.
  // Customer is set on every row so no row is skipped by the empty-row rule.
  {
    const wb = new ExcelJS.Workbook();
    const sh = wb.addWorksheet('Data');
    sh.getCell('A1').value = 'Customer';
    sh.getCell('B1').value = 'Memo';
    sh.getCell('A2').value = 'a';            // Memo blank — empty
    sh.getCell('A3').value = 'b';
    sh.getCell('B3').value = '';             // empty string — empty
    sh.getCell('A4').value = 'c';
    sh.getCell('B4').value = '   ';          // whitespace-only — empty
    sh.getCell('A5').value = 'd';
    sh.getCell('B5').value = 'x';            // non-empty string
    sh.getCell('A6').value = 'e';
    sh.getCell('B6').value = 0;              // number 0 — non-empty
    sh.getCell('A7').value = 'f';
    sh.getCell('B7').value = false;          // boolean false — non-empty
    await writeBook(wb, join(dir, 'data.xlsx'));
  }

  // expected.xlsx
  // COUNT([Memo]) over the rendered row set: 3 rows are non-empty
  // (rows d/x, e/0, f/false). The aggregate value is the same on every
  // rendered row.
  {
    const wb = new ExcelJS.Workbook();
    const sh = wb.addWorksheet('Report');
    sh.getCell('A1').value = 'Customer';
    sh.getCell('B1').value = 'NonEmptyMemos';
    sh.getCell('A2').value = 'a';
    sh.getCell('B2').value = 3;
    sh.getCell('A3').value = 'b';
    sh.getCell('B3').value = 3;
    sh.getCell('A4').value = 'c';
    sh.getCell('B4').value = 3;
    sh.getCell('A5').value = 'd';
    sh.getCell('B5').value = 3;
    sh.getCell('A6').value = 'e';
    sh.getCell('B6').value = 3;
    sh.getCell('A7').value = 'f';
    sh.getCell('B7').value = 3;
    await writeBook(wb, join(dir, 'expected.xlsx'));
  }
}

// ---------------------------------------------------------------------------
// 053 - empty-row-skip-whitespace-only
//
// Concept: a source row whose every cell is empty per ADR-0007 is
// skipped before grouping and rendering. Whitespace-only cells count as
// empty.
// Spec section: evaluation.md "Empty Values"; evaluation.md "Source Data
// Model" empty-row skip; ADR-0007.
// ---------------------------------------------------------------------------
async function build053() {
  const dir = join(FIXTURES, '053-empty-row-skip-whitespace-only');
  await mkdir(dir, { recursive: true });

  // template.xlsx
  {
    const wb = new ExcelJS.Workbook();
    addConfig(wb, [
      ['name', 'empty-row-skip-whitespace-only'],
      ['source_sheet', 'Data'],
      ['source_table', '1'],
      ['output_file_pattern', 'output.xlsx'],
    ]);
    const sh = wb.addWorksheet('Report');
    sh.getCell('A1').value = 'Customer';
    sh.getCell('B1').value = 'Memo';
    sh.getCell('A2').value = '{{ [Customer] }}';
    sh.getCell('B2').value = '{{ [Memo] }}';
    await writeBook(wb, join(dir, 'template.xlsx'));
  }

  // data.xlsx
  // Row 3 has whitespace in every cell — skipped per ADR-0007.
  // Row 5 has whitespace Customer + non-empty Memo — at least one cell is
  // non-empty, so the row is kept; Customer renders as the original
  // whitespace string (ADR-0007 only governs the *empty* predicate, not
  // value preservation).
  {
    const wb = new ExcelJS.Workbook();
    const sh = wb.addWorksheet('Data');
    sh.getCell('A1').value = 'Customer';
    sh.getCell('B1').value = 'Memo';
    sh.getCell('A2').value = 'Acme';
    sh.getCell('B2').value = 'first';
    sh.getCell('A3').value = '   ';
    sh.getCell('B3').value = '\t  ';
    sh.getCell('A4').value = 'Beta';
    sh.getCell('B4').value = 'second';
    sh.getCell('A5').value = '   ';
    sh.getCell('B5').value = 'kept';
    await writeBook(wb, join(dir, 'data.xlsx'));
  }

  // expected.xlsx
  {
    const wb = new ExcelJS.Workbook();
    const sh = wb.addWorksheet('Report');
    sh.getCell('A1').value = 'Customer';
    sh.getCell('B1').value = 'Memo';
    sh.getCell('A2').value = 'Acme';
    sh.getCell('B2').value = 'first';
    sh.getCell('A3').value = 'Beta';
    sh.getCell('B3').value = 'second';
    sh.getCell('A4').value = '   ';
    sh.getCell('B4').value = 'kept';
    await writeBook(wb, join(dir, 'expected.xlsx'));
  }
}

// ---------------------------------------------------------------------------
// 054 - empty-list-membership
//
// Concept: list-sheet reading drops empty cells per ADR-0007. A
// source-row value that is empty never matches `@filter ... in
// _Sheet`. Combined, an empty Customer never sneaks into membership
// even when the list sheet originally contained an empty entry.
// Spec section: evaluation.md "Empty Values"; evaluation.md "List
// Sheets"; ADR-0007.
// ---------------------------------------------------------------------------
async function build054() {
  const dir = join(FIXTURES, '054-empty-list-membership');
  await mkdir(dir, { recursive: true });

  // template.xlsx
  {
    const wb = new ExcelJS.Workbook();
    addConfig(wb, [
      ['name', 'empty-list-membership'],
      ['source_sheet', 'Data'],
      ['source_table', '1'],
      ['output_file_pattern', 'output.xlsx'],
    ]);

    // __lists__ sheet — column "Allowed" carries the allowed values.
    // The whitespace and blank entries are dropped per ADR-0007 when
    // read.
    addLists(wb, { Allowed: ['Acme', '   ', '', 'Beta'] }, { state: 'visible' });

    const sh = wb.addWorksheet('Report');
    sh.getCell('A1').value = 'Customer';
    sh.getCell('B1').value = 'Status';
    sh.getCell('A2').value = '{{ @filter [Customer] in __lists__[Allowed] }}';
    sh.getCell('A3').value = '{{ [Customer] }}';
    sh.getCell('B3').value = '{{ [Status] }}';
    await writeBook(wb, join(dir, 'template.xlsx'));
  }

  // data.xlsx
  // Row 2: Acme/open — Customer matches Acme → kept.
  // Row 3: ""/open — Customer is empty; never matches `in` per ADR-0007 → dropped.
  // Row 4: Beta/open — matches Beta → kept.
  // Row 5: "  "/open — Customer is whitespace-only (empty per ADR-0007);
  //                    never matches `in` → dropped.
  // Row 6: Charlie/open — not in _Allowed → dropped.
  {
    const wb = new ExcelJS.Workbook();
    const sh = wb.addWorksheet('Data');
    sh.getCell('A1').value = 'Customer';
    sh.getCell('B1').value = 'Status';
    sh.getCell('A2').value = 'Acme';
    sh.getCell('B2').value = 'open';
    sh.getCell('A3').value = '';
    sh.getCell('B3').value = 'open';
    sh.getCell('A4').value = 'Beta';
    sh.getCell('B4').value = 'open';
    sh.getCell('A5').value = '   ';
    sh.getCell('B5').value = 'open';
    sh.getCell('A6').value = 'Charlie';
    sh.getCell('B6').value = 'open';
    await writeBook(wb, join(dir, 'data.xlsx'));
  }

  // expected.xlsx
  // Only Acme and Beta survive the filter. The list sheet is removed
  // from output (existing rule).
  {
    const wb = new ExcelJS.Workbook();
    const sh = wb.addWorksheet('Report');
    sh.getCell('A1').value = 'Customer';
    sh.getCell('B1').value = 'Status';
    sh.getCell('A2').value = 'Acme';
    sh.getCell('B2').value = 'open';
    sh.getCell('A3').value = 'Beta';
    sh.getCell('B3').value = 'open';
    await writeBook(wb, join(dir, 'expected.xlsx'));
  }
}

// ---------------------------------------------------------------------------
// 055 - if-truthy-zero-and-empty
//
// Concept: bare-value IF truthiness per ADR-0008. The number 0 and empty
// values (per ADR-0007) are falsy; non-empty strings, non-zero numbers,
// and TRUE are truthy.
// Spec section: language.md "Functions / IF"; ADR-0008.
// ---------------------------------------------------------------------------
async function build055() {
  const dir = join(FIXTURES, '055-if-truthy-zero-and-empty');
  await mkdir(dir, { recursive: true });

  // template.xlsx
  {
    const wb = new ExcelJS.Workbook();
    addConfig(wb, [
      ['name', 'if-truthy-zero-and-empty'],
      ['source_sheet', 'Data'],
      ['source_table', '1'],
      ['output_file_pattern', 'output.xlsx'],
    ]);
    const sh = wb.addWorksheet('Report');
    sh.getCell('A1').value = 'Label';
    sh.getCell('B1').value = 'Branch';
    sh.getCell('A2').value = '{{ [Label] }}';
    sh.getCell('B2').value = '{{ IF([Value], "y", "n") }}';
    await writeBook(wb, join(dir, 'template.xlsx'));
  }

  // data.xlsx — six rows covering each truthiness branch.
  {
    const wb = new ExcelJS.Workbook();
    const sh = wb.addWorksheet('Data');
    sh.getCell('A1').value = 'Label';
    sh.getCell('B1').value = 'Value';
    sh.getCell('A2').value = 'zero-num';
    sh.getCell('B2').value = 0;
    sh.getCell('A3').value = 'one-num';
    sh.getCell('B3').value = 1;
    sh.getCell('A4').value = 'empty-str';
    // B4 left blank — empty cell.
    sh.getCell('A5').value = 'word';
    sh.getCell('B5').value = 'x';
    sh.getCell('A6').value = 'spaces';
    sh.getCell('B6').value = '   ';
    sh.getCell('A7').value = 'bool-true';
    sh.getCell('B7').value = true;
    await writeBook(wb, join(dir, 'data.xlsx'));
  }

  // expected.xlsx
  // ADR-0008: 0, "", "  " are falsy → "n". 1, "x", TRUE are truthy → "y".
  {
    const wb = new ExcelJS.Workbook();
    const sh = wb.addWorksheet('Report');
    sh.getCell('A1').value = 'Label';
    sh.getCell('B1').value = 'Branch';
    sh.getCell('A2').value = 'zero-num';
    sh.getCell('B2').value = 'n';
    sh.getCell('A3').value = 'one-num';
    sh.getCell('B3').value = 'y';
    sh.getCell('A4').value = 'empty-str';
    sh.getCell('B4').value = 'n';
    sh.getCell('A5').value = 'word';
    sh.getCell('B5').value = 'y';
    sh.getCell('A6').value = 'spaces';
    sh.getCell('B6').value = 'n';
    sh.getCell('A7').value = 'bool-true';
    sh.getCell('B7').value = 'y';
    await writeBook(wb, join(dir, 'expected.xlsx'));
  }
}

// ---------------------------------------------------------------------------
// 056 - if-truthy-string-zero-not-special
//
// Concept: ADR-0008 explicitly does not treat the strings "0" and
// "false" as falsy. Strings with non-whitespace content are truthy.
// Spec section: language.md "Functions / IF"; ADR-0008 Decision and
// Consequences.
// ---------------------------------------------------------------------------
async function build056() {
  const dir = join(FIXTURES, '056-if-truthy-string-zero-not-special');
  await mkdir(dir, { recursive: true });

  // template.xlsx
  {
    const wb = new ExcelJS.Workbook();
    addConfig(wb, [
      ['name', 'if-truthy-string-zero-not-special'],
      ['source_sheet', 'Data'],
      ['source_table', '1'],
      ['output_file_pattern', 'output.xlsx'],
    ]);
    const sh = wb.addWorksheet('Report');
    sh.getCell('A1').value = 'Label';
    sh.getCell('B1').value = 'Branch';
    sh.getCell('A2').value = '{{ [Label] }}';
    sh.getCell('B2').value = '{{ IF([Flag], "y", "n") }}';
    await writeBook(wb, join(dir, 'template.xlsx'));
  }

  // data.xlsx — three string flags that JavaScript's `Boolean()` would
  // call truthy and the reference implementation used to special-case.
  {
    const wb = new ExcelJS.Workbook();
    const sh = wb.addWorksheet('Data');
    sh.getCell('A1').value = 'Label';
    sh.getCell('B1').value = 'Flag';
    sh.getCell('A2').value = 'zero-string';
    sh.getCell('B2').value = '0';
    sh.getCell('A3').value = 'false-string';
    sh.getCell('B3').value = 'false';
    sh.getCell('A4').value = 'FALSE-string';
    sh.getCell('B4').value = 'FALSE';
    await writeBook(wb, join(dir, 'data.xlsx'));
  }

  // expected.xlsx — every row picks the truthy branch.
  {
    const wb = new ExcelJS.Workbook();
    const sh = wb.addWorksheet('Report');
    sh.getCell('A1').value = 'Label';
    sh.getCell('B1').value = 'Branch';
    sh.getCell('A2').value = 'zero-string';
    sh.getCell('B2').value = 'y';
    sh.getCell('A3').value = 'false-string';
    sh.getCell('B3').value = 'y';
    sh.getCell('A4').value = 'FALSE-string';
    sh.getCell('B4').value = 'y';
    await writeBook(wb, join(dir, 'expected.xlsx'));
  }
}

// ---------------------------------------------------------------------------
// 057 - if-truthy-boolean
//
// Concept: a Boolean source cell drives IF truthiness directly per
// ADR-0008. TRUE picks the truthy branch; FALSE picks the falsy branch.
// Spec section: language.md "Functions / IF"; ADR-0008.
// ---------------------------------------------------------------------------
async function build057() {
  const dir = join(FIXTURES, '057-if-truthy-boolean');
  await mkdir(dir, { recursive: true });

  // template.xlsx
  {
    const wb = new ExcelJS.Workbook();
    addConfig(wb, [
      ['name', 'if-truthy-boolean'],
      ['source_sheet', 'Data'],
      ['source_table', '1'],
      ['output_file_pattern', 'output.xlsx'],
    ]);
    const sh = wb.addWorksheet('Report');
    sh.getCell('A1').value = 'Customer';
    sh.getCell('B1').value = 'State';
    sh.getCell('A2').value = '{{ [Customer] }}';
    sh.getCell('B2').value = '{{ IF([Active], "active", "archived") }}';
    await writeBook(wb, join(dir, 'template.xlsx'));
  }

  // data.xlsx
  {
    const wb = new ExcelJS.Workbook();
    const sh = wb.addWorksheet('Data');
    sh.getCell('A1').value = 'Customer';
    sh.getCell('B1').value = 'Active';
    sh.getCell('A2').value = 'Acme';
    sh.getCell('B2').value = true;
    sh.getCell('A3').value = 'Beta';
    sh.getCell('B3').value = false;
    await writeBook(wb, join(dir, 'data.xlsx'));
  }

  // expected.xlsx
  {
    const wb = new ExcelJS.Workbook();
    const sh = wb.addWorksheet('Report');
    sh.getCell('A1').value = 'Customer';
    sh.getCell('B1').value = 'State';
    sh.getCell('A2').value = 'Acme';
    sh.getCell('B2').value = 'active';
    sh.getCell('A3').value = 'Beta';
    sh.getCell('B3').value = 'archived';
    await writeBook(wb, join(dir, 'expected.xlsx'));
  }
}

// ---------------------------------------------------------------------------
// 058 - if-comparison-result
//
// Concept: a comparison expression evaluates to a Boolean and feeds IF
// truthiness directly per ADR-0008. The same algorithm pins both `IF`
// and `@filter` (ADR-0009).
// Spec section: language.md "Functions / IF"; ADR-0008.
// ---------------------------------------------------------------------------
async function build058() {
  const dir = join(FIXTURES, '058-if-comparison-result');
  await mkdir(dir, { recursive: true });

  // template.xlsx
  {
    const wb = new ExcelJS.Workbook();
    addConfig(wb, [
      ['name', 'if-comparison-result'],
      ['source_sheet', 'Data'],
      ['source_table', '1'],
      ['output_file_pattern', 'output.xlsx'],
    ]);
    const sh = wb.addWorksheet('Report');
    sh.getCell('A1').value = 'Label';
    sh.getCell('B1').value = 'Tier';
    sh.getCell('A2').value = '{{ [Label] }}';
    sh.getCell('B2').value = '{{ IF([Amount] > 100, "high", "low") }}';
    await writeBook(wb, join(dir, 'template.xlsx'));
  }

  // data.xlsx
  {
    const wb = new ExcelJS.Workbook();
    const sh = wb.addWorksheet('Data');
    sh.getCell('A1').value = 'Label';
    sh.getCell('B1').value = 'Amount';
    sh.getCell('A2').value = 'a';
    sh.getCell('B2').value = 50;
    sh.getCell('A3').value = 'b';
    sh.getCell('B3').value = 150;
    sh.getCell('A4').value = 'c';
    sh.getCell('B4').value = 100; // boundary — NOT > 100
    await writeBook(wb, join(dir, 'data.xlsx'));
  }

  // expected.xlsx
  {
    const wb = new ExcelJS.Workbook();
    const sh = wb.addWorksheet('Report');
    sh.getCell('A1').value = 'Label';
    sh.getCell('B1').value = 'Tier';
    sh.getCell('A2').value = 'a';
    sh.getCell('B2').value = 'low';
    sh.getCell('A3').value = 'b';
    sh.getCell('B3').value = 'high';
    sh.getCell('A4').value = 'c';
    sh.getCell('B4').value = 'low';
    await writeBook(wb, join(dir, 'expected.xlsx'));
  }
}

// ---------------------------------------------------------------------------
// 059 - compare-numeric-string-vs-number
//
// Concept: ADR-0009's comparison algorithm parses both operands as
// numbers when each is a number or a string parseable as a finite
// number. `IF` and `@filter` route through the same shared algorithm.
// Spec section: language.md "Comparison and String Coercion"; ADR-0009.
// ---------------------------------------------------------------------------
async function build059() {
  const dir = join(FIXTURES, '059-compare-numeric-string-vs-number');
  await mkdir(dir, { recursive: true });

  // template.xlsx
  {
    const wb = new ExcelJS.Workbook();
    addConfig(wb, [
      ['name', 'compare-numeric-string-vs-number'],
      ['source_sheet', 'Data'],
      ['source_table', '1'],
      ['output_file_pattern', 'output.xlsx'],
    ]);
    const sh = wb.addWorksheet('Report');
    sh.getCell('A1').value = 'Customer';
    sh.getCell('B1').value = 'Tier';
    sh.getCell('A2').value = '{{ [Customer] }}';
    sh.getCell('B2').value = '{{ IF([Amount] > 100, "high", "low") }}';
    await writeBook(wb, join(dir, 'template.xlsx'));
  }

  // data.xlsx — Amount column mixes string and numeric values to prove
  // both flow through the same compareValues path.
  {
    const wb = new ExcelJS.Workbook();
    const sh = wb.addWorksheet('Data');
    sh.getCell('A1').value = 'Customer';
    sh.getCell('B1').value = 'Amount';
    sh.getCell('A2').value = 'Acme';
    sh.getCell('B2').value = '150';      // string parseable as number
    sh.getCell('A3').value = 'Beta';
    sh.getCell('B3').value = 50;         // number
    sh.getCell('A4').value = 'Gamma';
    sh.getCell('B4').value = '100';      // boundary string — NOT > 100
    await writeBook(wb, join(dir, 'data.xlsx'));
  }

  // expected.xlsx
  {
    const wb = new ExcelJS.Workbook();
    const sh = wb.addWorksheet('Report');
    sh.getCell('A1').value = 'Customer';
    sh.getCell('B1').value = 'Tier';
    sh.getCell('A2').value = 'Acme';
    sh.getCell('B2').value = 'high';
    sh.getCell('A3').value = 'Beta';
    sh.getCell('B3').value = 'low';
    sh.getCell('A4').value = 'Gamma';
    sh.getCell('B4').value = 'low';
    await writeBook(wb, join(dir, 'expected.xlsx'));
  }
}

// ---------------------------------------------------------------------------
// 060 - compare-string-codepoint-order
//
// Concept: ADR-0009 mandates Unicode code-point order for the string
// fallback path of comparison. No locale-aware collation is applied.
// Spec section: language.md "Comparison and String Coercion"; ADR-0009.
// ---------------------------------------------------------------------------
async function build060() {
  const dir = join(FIXTURES, '060-compare-string-codepoint-order');
  await mkdir(dir, { recursive: true });

  // template.xlsx — sort by Customer ascending.
  {
    const wb = new ExcelJS.Workbook();
    addConfig(wb, [
      ['name', 'compare-string-codepoint-order'],
      ['source_sheet', 'Data'],
      ['source_table', '1'],
      ['output_file_pattern', 'output.xlsx'],
    ]);
    const sh = wb.addWorksheet('Report');
    sh.getCell('A1').value = 'Customer';
    sh.getCell('A2').value = '{{ @sort [Customer] asc }}';
    sh.getCell('A3').value = '{{ [Customer] }}';
    await writeBook(wb, join(dir, 'template.xlsx'));
  }

  // data.xlsx
  // ASCII A (0x41) < ASCII B (0x42) < CJK Hangul block (0xAC00..).
  // Source rows authored deliberately out of order so the sort has work
  // to do.
  {
    const wb = new ExcelJS.Workbook();
    const sh = wb.addWorksheet('Data');
    sh.getCell('A1').value = 'Customer';
    sh.getCell('A2').value = '가나';
    sh.getCell('A3').value = 'Beta';
    sh.getCell('A4').value = '다라';
    sh.getCell('A5').value = 'Acme';
    await writeBook(wb, join(dir, 'data.xlsx'));
  }

  // expected.xlsx — code-point order: ASCII letters first, then Hangul.
  // 가 (U+AC00) < 다 (U+B2E4).
  {
    const wb = new ExcelJS.Workbook();
    const sh = wb.addWorksheet('Report');
    sh.getCell('A1').value = 'Customer';
    sh.getCell('A2').value = 'Acme';
    sh.getCell('A3').value = 'Beta';
    sh.getCell('A4').value = '가나';
    sh.getCell('A5').value = '다라';
    await writeBook(wb, join(dir, 'expected.xlsx'));
  }
}

// ---------------------------------------------------------------------------
// 061 - concat-canonical-form
//
// Concept: ADR-0009 defines the canonical string form per type. `&`
// stringifies each operand using the canonical form. Booleans are
// uppercase, integers omit the decimal point.
// Spec section: language.md "Comparison and String Coercion"; ADR-0009.
// ---------------------------------------------------------------------------
async function build061() {
  const dir = join(FIXTURES, '061-concat-canonical-form');
  await mkdir(dir, { recursive: true });

  // template.xlsx
  {
    const wb = new ExcelJS.Workbook();
    addConfig(wb, [
      ['name', 'concat-canonical-form'],
      ['source_sheet', 'Data'],
      ['source_table', '1'],
      ['output_file_pattern', 'output.xlsx'],
    ]);
    const sh = wb.addWorksheet('Report');
    sh.getCell('A1').value = 'Customer';
    sh.getCell('B1').value = 'Summary';
    sh.getCell('A2').value = '{{ [Customer] }}';
    sh.getCell('B2').value = '{{ [Active] & " (" & [Count] & ")" }}';
    await writeBook(wb, join(dir, 'template.xlsx'));
  }

  // data.xlsx
  {
    const wb = new ExcelJS.Workbook();
    const sh = wb.addWorksheet('Data');
    sh.getCell('A1').value = 'Customer';
    sh.getCell('B1').value = 'Active';
    sh.getCell('C1').value = 'Count';
    sh.getCell('A2').value = 'Acme';
    sh.getCell('B2').value = true;
    sh.getCell('C2').value = 0;
    sh.getCell('A3').value = 'Beta';
    sh.getCell('B3').value = false;
    sh.getCell('C3').value = 12;
    await writeBook(wb, join(dir, 'data.xlsx'));
  }

  // expected.xlsx
  // canonicalString(true) = "TRUE"; canonicalString(0) = "0"; etc.
  {
    const wb = new ExcelJS.Workbook();
    const sh = wb.addWorksheet('Report');
    sh.getCell('A1').value = 'Customer';
    sh.getCell('B1').value = 'Summary';
    sh.getCell('A2').value = 'Acme';
    sh.getCell('B2').value = 'TRUE (0)';
    sh.getCell('A3').value = 'Beta';
    sh.getCell('B3').value = 'FALSE (12)';
    await writeBook(wb, join(dir, 'expected.xlsx'));
  }
}

// ---------------------------------------------------------------------------
// 062 - concat-empty-stringifies-to-empty
//
// Concept: ADR-0009's canonical string form for an empty value (per
// ADR-0007) is the empty string. `&` over an empty operand contributes
// nothing.
// Spec section: language.md "Comparison and String Coercion"; ADR-0009.
// ---------------------------------------------------------------------------
async function build062() {
  const dir = join(FIXTURES, '062-concat-empty-stringifies-to-empty');
  await mkdir(dir, { recursive: true });

  // template.xlsx
  {
    const wb = new ExcelJS.Workbook();
    addConfig(wb, [
      ['name', 'concat-empty-stringifies-to-empty'],
      ['source_sheet', 'Data'],
      ['source_table', '1'],
      ['output_file_pattern', 'output.xlsx'],
    ]);
    const sh = wb.addWorksheet('Report');
    sh.getCell('A1').value = 'Customer';
    sh.getCell('B1').value = 'Bracketed';
    sh.getCell('A2').value = '{{ [Customer] }}';
    sh.getCell('B2').value = '{{ "[" & [Memo] & "]" }}';
    await writeBook(wb, join(dir, 'template.xlsx'));
  }

  // data.xlsx
  {
    const wb = new ExcelJS.Workbook();
    const sh = wb.addWorksheet('Data');
    sh.getCell('A1').value = 'Customer';
    sh.getCell('B1').value = 'Memo';
    sh.getCell('A2').value = 'Acme';
    // B2 left blank — empty.
    sh.getCell('A3').value = 'Beta';
    sh.getCell('B3').value = '   '; // whitespace — empty per ADR-0007.
    sh.getCell('A4').value = 'Gamma';
    sh.getCell('B4').value = 'note';
    await writeBook(wb, join(dir, 'data.xlsx'));
  }

  // expected.xlsx
  {
    const wb = new ExcelJS.Workbook();
    const sh = wb.addWorksheet('Report');
    sh.getCell('A1').value = 'Customer';
    sh.getCell('B1').value = 'Bracketed';
    sh.getCell('A2').value = 'Acme';
    sh.getCell('B2').value = '[]';
    sh.getCell('A3').value = 'Beta';
    sh.getCell('B3').value = '[]';
    sh.getCell('A4').value = 'Gamma';
    sh.getCell('B4').value = '[note]';
    await writeBook(wb, join(dir, 'expected.xlsx'));
  }
}

// ---------------------------------------------------------------------------
// 063 - compare-empty-vs-value
//
// Concept: ADR-0009 rules 1 and 2 — two empty operands compare equal,
// while exactly one empty operand makes `=` false. `@filter [Memo] = ""`
// therefore matches rows whose Memo is empty per ADR-0007 (missing,
// blank, or whitespace-only) and excludes rows with non-empty Memo.
// Spec section: language.md "Comparison and String Coercion"; ADR-0009.
// ---------------------------------------------------------------------------
async function build063() {
  const dir = join(FIXTURES, '063-compare-empty-vs-value');
  await mkdir(dir, { recursive: true });

  // template.xlsx
  {
    const wb = new ExcelJS.Workbook();
    addConfig(wb, [
      ['name', 'compare-empty-vs-value'],
      ['source_sheet', 'Data'],
      ['source_table', '1'],
      ['output_file_pattern', 'output.xlsx'],
    ]);
    const sh = wb.addWorksheet('Report');
    sh.getCell('A1').value = 'Customer';
    sh.getCell('B1').value = 'Memo';
    sh.getCell('A2').value = '{{ @filter [Memo] = "" }}';
    sh.getCell('A3').value = '{{ [Customer] }}';
    sh.getCell('B3').value = '{{ [Memo] }}';
    await writeBook(wb, join(dir, 'template.xlsx'));
  }

  // data.xlsx
  {
    const wb = new ExcelJS.Workbook();
    const sh = wb.addWorksheet('Data');
    sh.getCell('A1').value = 'Customer';
    sh.getCell('B1').value = 'Memo';
    sh.getCell('A2').value = 'Acme';
    // B2 blank — empty.
    sh.getCell('A3').value = 'Beta';
    sh.getCell('B3').value = 'note';
    sh.getCell('A4').value = 'Gamma';
    sh.getCell('B4').value = '   ';
    sh.getCell('A5').value = 'Delta';
    sh.getCell('B5').value = 'memo';
    await writeBook(wb, join(dir, 'data.xlsx'));
  }

  // expected.xlsx — only Acme and Gamma survive: both Memo cells are
  // empty per ADR-0007, so compareValues against the empty filter value
  // returns 0 (rule 1). The renderer writes the source cell value as-is
  // for `{{ [Memo] }}`, so Acme's B2 is the empty string from a blank
  // source cell and Gamma's B3 keeps its whitespace.
  {
    const wb = new ExcelJS.Workbook();
    const sh = wb.addWorksheet('Report');
    sh.getCell('A1').value = 'Customer';
    sh.getCell('B1').value = 'Memo';
    sh.getCell('A2').value = 'Acme';
    sh.getCell('B2').value = '';
    sh.getCell('A3').value = 'Gamma';
    sh.getCell('B3').value = '   ';
    await writeBook(wb, join(dir, 'expected.xlsx'));
  }
}

// ---------------------------------------------------------------------------
// 064 - compare-unicode-minus-not-numeric
//
// Concept: ADR-0009's "trim, then Number()" rule does not accept the
// Unicode minus sign (U+2212). A row whose value is "−5" (U+2212)
// compared against the number -5 therefore falls through to the
// canonical-string fallback and does not match.
// Spec section: language.md "Comparison and String Coercion"; ADR-0009
// Consequences.
// ---------------------------------------------------------------------------
async function build064() {
  const dir = join(FIXTURES, '064-compare-unicode-minus-not-numeric');
  await mkdir(dir, { recursive: true });

  // template.xlsx — filter rows whose Amount equals -5 (number).
  {
    const wb = new ExcelJS.Workbook();
    addConfig(wb, [
      ['name', 'compare-unicode-minus-not-numeric'],
      ['source_sheet', 'Data'],
      ['source_table', '1'],
      ['output_file_pattern', 'output.xlsx'],
    ]);
    const sh = wb.addWorksheet('Report');
    sh.getCell('A1').value = 'Customer';
    sh.getCell('B1').value = 'Amount';
    sh.getCell('A2').value = '{{ @filter [Amount] = -5 }}';
    sh.getCell('A3').value = '{{ [Customer] }}';
    sh.getCell('B3').value = '{{ [Amount] }}';
    await writeBook(wb, join(dir, 'template.xlsx'));
  }

  // data.xlsx — three rows: ASCII-minus number, Unicode-minus string,
  // and a non-matching value.
  {
    const wb = new ExcelJS.Workbook();
    const sh = wb.addWorksheet('Data');
    sh.getCell('A1').value = 'Customer';
    sh.getCell('B1').value = 'Amount';
    sh.getCell('A2').value = 'Acme';
    sh.getCell('B2').value = -5;          // numeric -5 — matches.
    sh.getCell('A3').value = 'Beta';
    sh.getCell('B3').value = '−5';   // string "−5" with U+2212 — NO match.
    sh.getCell('A4').value = 'Gamma';
    sh.getCell('B4').value = 5;           // numeric 5 — NO match.
    await writeBook(wb, join(dir, 'data.xlsx'));
  }

  // expected.xlsx — only Acme survives the filter. Beta's Unicode-minus
  // string falls into rule 5 (string fallback) and "−5" != "-5" by
  // code-point comparison.
  {
    const wb = new ExcelJS.Workbook();
    const sh = wb.addWorksheet('Report');
    sh.getCell('A1').value = 'Customer';
    sh.getCell('B1').value = 'Amount';
    sh.getCell('A2').value = 'Acme';
    sh.getCell('B2').value = -5;
    await writeBook(wb, join(dir, 'expected.xlsx'));
  }
}

function addInputs(wb, header, rows) {
  const sh = wb.addWorksheet('__inputs__', { state: 'hidden' });
  header.forEach((h, i) => {
    sh.getCell(1, i + 1).value = h;
  });
  rows.forEach((row, rIdx) => {
    row.forEach((v, cIdx) => {
      sh.getCell(rIdx + 2, cIdx + 1).value = v;
    });
  });
}

// ---------------------------------------------------------------------------
// 065 - input-text-default-applied
//
// Concept: a `__inputs__` sheet declares a text input with a default. When
// the host omits the input, the default flows into the expression
// context as `__inputs__[name]` and templates render it.
// Spec section: evaluation.md "Inputs"; ADR-0010.
// ---------------------------------------------------------------------------
async function build065() {
  const dir = join(FIXTURES, '065-input-text-default-applied');
  await mkdir(dir, { recursive: true });

  // template.xlsx
  {
    const wb = new ExcelJS.Workbook();
    addConfig(wb, [
      ['name', 'input-text-default-applied'],
      ['source_sheet', 'Data'],
      ['source_table', '1'],
      ['output_file_pattern', 'output.xlsx'],
    ]);
    addInputs(wb, ['name', 'type', 'default', 'label'], [
      ['month', 'text', '2026-05', 'Report month'],
    ]);
    const sh = wb.addWorksheet('Report');
    sh.getCell('A1').value = 'Report month: {{ __inputs__[month] }}';
    sh.getCell('A2').value = 'Customer';
    sh.getCell('A3').value = '{{ [Customer] }}';
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

  // expected.xlsx — default fills in.
  {
    const wb = new ExcelJS.Workbook();
    const sh = wb.addWorksheet('Report');
    sh.getCell('A1').value = 'Report month: 2026-05';
    sh.getCell('A2').value = 'Customer';
    sh.getCell('A3').value = 'Acme';
    sh.getCell('A4').value = 'Beta';
    await writeBook(wb, join(dir, 'expected.xlsx'));
  }
}

// ---------------------------------------------------------------------------
// 066 - input-text-host-supplied
//
// Concept: when the host supplies a value for a declared input, that
// value flows through the expression context (overriding any default)
// and reaches every reference site, including sheet names and the
// output filename pattern.
// Spec section: evaluation.md "Inputs"; ADR-0010.
// ---------------------------------------------------------------------------
async function build066() {
  const dir = join(FIXTURES, '066-input-text-host-supplied');
  await mkdir(dir, { recursive: true });

  // template.xlsx
  {
    const wb = new ExcelJS.Workbook();
    addConfig(wb, [
      ['name', 'input-text-host-supplied'],
      ['source_sheet', 'Data'],
      ['source_table', '1'],
      ['output_file_pattern', '{{ __inputs__[region] }}_report.xlsx'],
    ]);
    addInputs(wb, ['name', 'type', 'label'], [
      ['region', 'text', 'Region'],
    ]);
    const sh = wb.addWorksheet('Report');
    sh.getCell('A1').value = 'Region: {{ __inputs__[region] }}';
    sh.getCell('A2').value = 'Customer';
    sh.getCell('A3').value = '{{ [Customer] }}';
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

  // expected.xlsx — single-file output named after the supplied input.
  {
    const outDir = join(dir, 'expected');
    await mkdir(outDir, { recursive: true });
    const wb = new ExcelJS.Workbook();
    const sh = wb.addWorksheet('Report');
    sh.getCell('A1').value = 'Region: Seoul';
    sh.getCell('A2').value = 'Customer';
    sh.getCell('A3').value = 'Acme';
    await writeBook(wb, join(outDir, 'Seoul_report.xlsx'));
  }
}

// ---------------------------------------------------------------------------
// 067 - input-missing-required-error
//
// Concept: a required input (no default declared) that the host omits
// is an error.
// Spec section: evaluation.md "Inputs"; ADR-0010.
// ---------------------------------------------------------------------------
async function build067() {
  const dir = join(FIXTURES, '067-input-missing-required-error');
  await mkdir(dir, { recursive: true });

  // template.xlsx — region is required; no default.
  {
    const wb = new ExcelJS.Workbook();
    addConfig(wb, [
      ['name', 'input-missing-required-error'],
      ['source_sheet', 'Data'],
      ['source_table', '1'],
      ['output_file_pattern', 'output.xlsx'],
    ]);
    addInputs(wb, ['name', 'type', 'label'], [
      ['region', 'text', 'Region'],
    ]);
    const sh = wb.addWorksheet('Report');
    sh.getCell('A1').value = '{{ __inputs__[region] }}';
    await writeBook(wb, join(dir, 'template.xlsx'));
  }

  // data.xlsx — minimal source.
  {
    const wb = new ExcelJS.Workbook();
    const sh = wb.addWorksheet('Data');
    sh.getCell('A1').value = 'Customer';
    sh.getCell('A2').value = 'Acme';
    await writeBook(wb, join(dir, 'data.xlsx'));
  }

  // No expected.xlsx — the meta.yaml declares the expected_error.
}

// ---------------------------------------------------------------------------
// 068 - input-select-host-supplied
//
// Concept: a `select` input restricts host values to the declared
// pipe-separated options. A valid choice flows through like any other
// text input.
// Spec section: evaluation.md "Inputs"; ADR-0010.
// ---------------------------------------------------------------------------
async function build068() {
  const dir = join(FIXTURES, '068-input-select-host-supplied');
  await mkdir(dir, { recursive: true });

  // template.xlsx
  {
    const wb = new ExcelJS.Workbook();
    addConfig(wb, [
      ['name', 'input-select-host-supplied'],
      ['source_sheet', 'Data'],
      ['source_table', '1'],
      ['output_file_pattern', 'output.xlsx'],
    ]);
    addInputs(
      wb,
      ['name', 'type', 'options', 'label'],
      [['region', 'select', 'Seoul|Busan|Daegu', 'Region']],
    );
    const sh = wb.addWorksheet('Report');
    sh.getCell('A1').value = 'Region';
    sh.getCell('A2').value = '{{ __inputs__[region] }}';
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
    const sh = wb.addWorksheet('Report');
    sh.getCell('A1').value = 'Region';
    sh.getCell('A2').value = 'Busan';
    await writeBook(wb, join(dir, 'expected.xlsx'));
  }
}

// ---------------------------------------------------------------------------
// 069 - source-multi-declaration
//
// Concept: a `__sources__` sheet declares an additional named source
// alongside the implicit default source. Aggregates over the named
// source operate on its full row set.
// Spec section: evaluation.md "External Data Sources"; ADR-0012.
// ---------------------------------------------------------------------------
async function build069() {
  const dir = join(FIXTURES, '069-source-multi-declaration');
  await mkdir(dir, { recursive: true });

  // template.xlsx
  {
    const wb = new ExcelJS.Workbook();
    addConfig(wb, [
      ['name', 'source-multi-declaration'],
      ['source_sheet', 'Customers'],
      ['source_table', '1'],
      ['output_file_pattern', 'output.xlsx'],
    ]);
    addSources(wb, [
      { name: 'Renewals', sheet: 'Renewals', table: '1' },
    ]);
    const sh = wb.addWorksheet('Report');
    sh.getCell('A1').value = 'Customer';
    sh.getCell('B1').value = 'TotalRenewal';
    sh.getCell('A2').value = '{{ [Customer] }}';
    sh.getCell('B2').value = '{{ SUM(Renewals[Amount]) }}';
    await writeBook(wb, join(dir, 'template.xlsx'));
  }

  // data.xlsx — two sheets: Customers (default), Renewals (named).
  {
    const wb = new ExcelJS.Workbook();
    const cust = wb.addWorksheet('Customers');
    cust.getCell('A1').value = 'Customer';
    cust.getCell('A2').value = 'Acme';
    cust.getCell('A3').value = 'Beta';

    const ren = wb.addWorksheet('Renewals');
    ren.getCell('A1').value = 'Account';
    ren.getCell('B1').value = 'Amount';
    ren.getCell('A2').value = 'Acme';
    ren.getCell('B2').value = 100;
    ren.getCell('A3').value = 'Beta';
    ren.getCell('B3').value = 200;
    ren.getCell('A4').value = 'Acme';
    ren.getCell('B4').value = 50;
    await writeBook(wb, join(dir, 'data.xlsx'));
  }

  // expected.xlsx
  // SUM(Renewals[Amount]) = 100 + 200 + 50 = 350 over Renewals' full set,
  // independent of which Customers row is rendering.
  {
    const wb = new ExcelJS.Workbook();
    const sh = wb.addWorksheet('Report');
    sh.getCell('A1').value = 'Customer';
    sh.getCell('B1').value = 'TotalRenewal';
    sh.getCell('A2').value = 'Acme';
    sh.getCell('B2').value = 350;
    sh.getCell('A3').value = 'Beta';
    sh.getCell('B3').value = 350;
    await writeBook(wb, join(dir, 'expected.xlsx'));
  }
}

// ---------------------------------------------------------------------------
// 070 - source-aggregate-cross-source
//
// Concept: COUNT/AVG/MIN/MAX over a named source operate on its full
// row set, not the active block's rows.
// Spec section: language.md "Functions / Aggregates"; ADR-0012.
// ---------------------------------------------------------------------------
async function build070() {
  const dir = join(FIXTURES, '070-source-aggregate-cross-source');
  await mkdir(dir, { recursive: true });

  // template.xlsx
  {
    const wb = new ExcelJS.Workbook();
    addConfig(wb, [
      ['name', 'source-aggregate-cross-source'],
      ['source_sheet', 'Customers'],
      ['source_table', '1'],
      ['output_file_pattern', 'output.xlsx'],
    ]);
    addSources(wb, [
      { name: 'Renewals', sheet: 'Renewals', table: '1' },
    ]);
    const sh = wb.addWorksheet('Report');
    sh.getCell('A1').value = 'Customer';
    sh.getCell('B1').value = 'RenewalCount';
    sh.getCell('C1').value = 'MinAmount';
    sh.getCell('D1').value = 'MaxAmount';
    sh.getCell('A2').value = '{{ [Customer] }}';
    sh.getCell('B2').value = '{{ COUNT(Renewals[Account]) }}';
    sh.getCell('C2').value = '{{ MIN(Renewals[Amount]) }}';
    sh.getCell('D2').value = '{{ MAX(Renewals[Amount]) }}';
    await writeBook(wb, join(dir, 'template.xlsx'));
  }

  // data.xlsx
  {
    const wb = new ExcelJS.Workbook();
    const cust = wb.addWorksheet('Customers');
    cust.getCell('A1').value = 'Customer';
    cust.getCell('A2').value = 'Acme';

    const ren = wb.addWorksheet('Renewals');
    ren.getCell('A1').value = 'Account';
    ren.getCell('B1').value = 'Amount';
    ren.getCell('A2').value = 'Acme';
    ren.getCell('B2').value = 50;
    ren.getCell('A3').value = 'Beta';
    ren.getCell('B3').value = 200;
    ren.getCell('A4').value = 'Gamma';
    ren.getCell('B4').value = 130;
    await writeBook(wb, join(dir, 'data.xlsx'));
  }

  // expected.xlsx
  // COUNT(Renewals[Account]) = 3, MIN = 50, MAX = 200.
  {
    const wb = new ExcelJS.Workbook();
    const sh = wb.addWorksheet('Report');
    sh.getCell('A1').value = 'Customer';
    sh.getCell('B1').value = 'RenewalCount';
    sh.getCell('C1').value = 'MinAmount';
    sh.getCell('D1').value = 'MaxAmount';
    sh.getCell('A2').value = 'Acme';
    sh.getCell('B2').value = 3;
    sh.getCell('C2').value = 50;
    sh.getCell('D2').value = 200;
    await writeBook(wb, join(dir, 'expected.xlsx'));
  }
}

// ---------------------------------------------------------------------------
// 071 - source-directive-active
//
// Concept: the @source directive scopes a data block to a named
// source. Inside that block, [Column] resolves to the named source's
// current row.
// Spec section: evaluation.md "External Data Sources"; ADR-0012.
// ---------------------------------------------------------------------------
async function build071() {
  const dir = join(FIXTURES, '071-source-directive-active');
  await mkdir(dir, { recursive: true });

  // template.xlsx
  {
    const wb = new ExcelJS.Workbook();
    addConfig(wb, [
      ['name', 'source-directive-active'],
      ['source_sheet', 'Customers'],
      ['source_table', '1'],
      ['output_file_pattern', 'output.xlsx'],
    ]);
    addSources(wb, [
      { name: 'Renewals', sheet: 'Renewals', table: '1' },
    ]);
    const sh = wb.addWorksheet('Report');
    sh.getCell('A1').value = 'Account';
    sh.getCell('B1').value = 'Amount';
    sh.getCell('A2').value = '{{ @source Renewals }}';
    sh.getCell('A3').value = '{{ [Account] }}';
    sh.getCell('B3').value = '{{ [Amount] }}';
    await writeBook(wb, join(dir, 'template.xlsx'));
  }

  // data.xlsx
  {
    const wb = new ExcelJS.Workbook();
    const cust = wb.addWorksheet('Customers');
    cust.getCell('A1').value = 'Customer';
    cust.getCell('A2').value = 'Acme';

    const ren = wb.addWorksheet('Renewals');
    ren.getCell('A1').value = 'Account';
    ren.getCell('B1').value = 'Amount';
    ren.getCell('A2').value = 'Acme';
    ren.getCell('B2').value = 50;
    ren.getCell('A3').value = 'Beta';
    ren.getCell('B3').value = 200;
    await writeBook(wb, join(dir, 'data.xlsx'));
  }

  // expected.xlsx — block iterates over Renewals' rows; [Account] and
  // [Amount] resolve to current Renewals row.
  {
    const wb = new ExcelJS.Workbook();
    const sh = wb.addWorksheet('Report');
    sh.getCell('A1').value = 'Account';
    sh.getCell('B1').value = 'Amount';
    sh.getCell('A2').value = 'Acme';
    sh.getCell('B2').value = 50;
    sh.getCell('A3').value = 'Beta';
    sh.getCell('B3').value = 200;
    await writeBook(wb, join(dir, 'expected.xlsx'));
  }
}

// ---------------------------------------------------------------------------
// 072 - source-undeclared-error
//
// Concept: referencing an undeclared source via @source is a parse-time
// error.
// Spec section: evaluation.md "External Data Sources"; ADR-0012.
// ---------------------------------------------------------------------------
async function build072() {
  const dir = join(FIXTURES, '072-source-undeclared-error');
  await mkdir(dir, { recursive: true });

  // template.xlsx — no __sources__ sheet, but @source Renewals used.
  {
    const wb = new ExcelJS.Workbook();
    addConfig(wb, [
      ['name', 'source-undeclared-error'],
      ['source_sheet', 'Customers'],
      ['source_table', '1'],
      ['output_file_pattern', 'output.xlsx'],
    ]);
    const sh = wb.addWorksheet('Report');
    sh.getCell('A1').value = 'Account';
    sh.getCell('A2').value = '{{ @source Renewals }}';
    sh.getCell('A3').value = '{{ [Account] }}';
    await writeBook(wb, join(dir, 'template.xlsx'));
  }

  // data.xlsx
  {
    const wb = new ExcelJS.Workbook();
    const cust = wb.addWorksheet('Customers');
    cust.getCell('A1').value = 'Customer';
    cust.getCell('A2').value = 'Acme';
    await writeBook(wb, join(dir, 'data.xlsx'));
  }

  // No expected.xlsx — meta.yaml asserts expected_error.
}

// ---------------------------------------------------------------------------
// 073 - source-row-cross-error
//
// Concept: row-level reference to a non-active source's column is an
// error. Aggregates over the same source remain valid.
// Spec section: evaluation.md "External Data Sources"; ADR-0012.
// ---------------------------------------------------------------------------
async function build073() {
  const dir = join(FIXTURES, '073-source-row-cross-error');
  await mkdir(dir, { recursive: true });

  // template.xlsx — Renewals[Amount] referenced at row level inside the
  // default block.
  {
    const wb = new ExcelJS.Workbook();
    addConfig(wb, [
      ['name', 'source-row-cross-error'],
      ['source_sheet', 'Customers'],
      ['source_table', '1'],
      ['output_file_pattern', 'output.xlsx'],
    ]);
    addSources(wb, [
      { name: 'Renewals', sheet: 'Renewals', table: '1' },
    ]);
    const sh = wb.addWorksheet('Report');
    sh.getCell('A1').value = 'Customer';
    sh.getCell('B1').value = 'CrossRef';
    sh.getCell('A2').value = '{{ [Customer] }}';
    sh.getCell('B2').value = '{{ Renewals[Amount] }}';
    await writeBook(wb, join(dir, 'template.xlsx'));
  }

  // data.xlsx
  {
    const wb = new ExcelJS.Workbook();
    const cust = wb.addWorksheet('Customers');
    cust.getCell('A1').value = 'Customer';
    cust.getCell('A2').value = 'Acme';

    const ren = wb.addWorksheet('Renewals');
    ren.getCell('A1').value = 'Account';
    ren.getCell('B1').value = 'Amount';
    ren.getCell('A2').value = 'Acme';
    ren.getCell('B2').value = 100;
    await writeBook(wb, join(dir, 'data.xlsx'));
  }

  // No expected.xlsx — meta.yaml asserts expected_error.
}

// ---------------------------------------------------------------------------
// 074 - xlookup-basic
//
// Concept: 3-arg XLOOKUP returns the corresponding return-array value
// for the first row whose lookup-array matches the lookup value.
// Every row is expected to match (no fallback path tested here).
// Spec section: language.md "XLOOKUP"; ADR-0013.
// ---------------------------------------------------------------------------
async function build074() {
  const dir = join(FIXTURES, '074-xlookup-basic');
  await mkdir(dir, { recursive: true });

  // template.xlsx
  {
    const wb = new ExcelJS.Workbook();
    addConfig(wb, [
      ['name', 'xlookup-basic'],
      ['source_sheet', 'Renewals'],
      ['source_table', '1'],
      ['output_file_pattern', 'output.xlsx'],
    ]);
    addSources(wb, [
      { name: 'Customers', sheet: 'Customers', table: '1' },
    ]);
    const sh = wb.addWorksheet('Report');
    sh.getCell('A1').value = 'Account';
    sh.getCell('B1').value = 'Customer';
    sh.getCell('A2').value = '{{ [Account] }}';
    sh.getCell('B2').value = '{{ XLOOKUP([Account], Customers[Account], Customers[Name]) }}';
    await writeBook(wb, join(dir, 'template.xlsx'));
  }

  // data.xlsx
  {
    const wb = new ExcelJS.Workbook();
    const ren = wb.addWorksheet('Renewals');
    ren.getCell('A1').value = 'Account';
    ren.getCell('A2').value = 'Acme';
    ren.getCell('A3').value = 'Beta';

    const cust = wb.addWorksheet('Customers');
    cust.getCell('A1').value = 'Account';
    cust.getCell('B1').value = 'Name';
    cust.getCell('A2').value = 'Acme';
    cust.getCell('B2').value = 'Acme Logistics';
    cust.getCell('A3').value = 'Beta';
    cust.getCell('B3').value = 'Beta Works';
    await writeBook(wb, join(dir, 'data.xlsx'));
  }

  // expected.xlsx
  {
    const wb = new ExcelJS.Workbook();
    const sh = wb.addWorksheet('Report');
    sh.getCell('A1').value = 'Account';
    sh.getCell('B1').value = 'Customer';
    sh.getCell('A2').value = 'Acme';
    sh.getCell('B2').value = 'Acme Logistics';
    sh.getCell('A3').value = 'Beta';
    sh.getCell('B3').value = 'Beta Works';
    await writeBook(wb, join(dir, 'expected.xlsx'));
  }
}

// ---------------------------------------------------------------------------
// 075 - xlookup-fallback
//
// Concept: 4-arg XLOOKUP returns the fallback when no row matches.
// Spec section: language.md "XLOOKUP"; ADR-0013.
// ---------------------------------------------------------------------------
async function build075() {
  const dir = join(FIXTURES, '075-xlookup-fallback');
  await mkdir(dir, { recursive: true });

  // template.xlsx
  {
    const wb = new ExcelJS.Workbook();
    addConfig(wb, [
      ['name', 'xlookup-fallback'],
      ['source_sheet', 'Renewals'],
      ['source_table', '1'],
      ['output_file_pattern', 'output.xlsx'],
    ]);
    addSources(wb, [
      { name: 'Customers', sheet: 'Customers', table: '1' },
    ]);
    const sh = wb.addWorksheet('Report');
    sh.getCell('A1').value = 'Account';
    sh.getCell('B1').value = 'Tier';
    sh.getCell('A2').value = '{{ [Account] }}';
    sh.getCell('B2').value = '{{ XLOOKUP([Account], Customers[Account], Customers[Tier], "Standard") }}';
    await writeBook(wb, join(dir, 'template.xlsx'));
  }

  // data.xlsx — Gamma exists in Renewals but not Customers.
  {
    const wb = new ExcelJS.Workbook();
    const ren = wb.addWorksheet('Renewals');
    ren.getCell('A1').value = 'Account';
    ren.getCell('A2').value = 'Acme';
    ren.getCell('A3').value = 'Gamma';

    const cust = wb.addWorksheet('Customers');
    cust.getCell('A1').value = 'Account';
    cust.getCell('B1').value = 'Tier';
    cust.getCell('A2').value = 'Acme';
    cust.getCell('B2').value = 'Priority';
    await writeBook(wb, join(dir, 'data.xlsx'));
  }

  // expected.xlsx — Gamma's lookup misses; fallback "Standard" returned.
  {
    const wb = new ExcelJS.Workbook();
    const sh = wb.addWorksheet('Report');
    sh.getCell('A1').value = 'Account';
    sh.getCell('B1').value = 'Tier';
    sh.getCell('A2').value = 'Acme';
    sh.getCell('B2').value = 'Priority';
    sh.getCell('A3').value = 'Gamma';
    sh.getCell('B3').value = 'Standard';
    await writeBook(wb, join(dir, 'expected.xlsx'));
  }
}

// ---------------------------------------------------------------------------
// 076 - xlookup-no-match-error
//
// Concept: 3-arg XLOOKUP without fallback errors when no row matches.
// Spec section: language.md "XLOOKUP"; ADR-0013.
// ---------------------------------------------------------------------------
async function build076() {
  const dir = join(FIXTURES, '076-xlookup-no-match-error');
  await mkdir(dir, { recursive: true });

  // template.xlsx
  {
    const wb = new ExcelJS.Workbook();
    addConfig(wb, [
      ['name', 'xlookup-no-match-error'],
      ['source_sheet', 'Renewals'],
      ['source_table', '1'],
      ['output_file_pattern', 'output.xlsx'],
    ]);
    addSources(wb, [
      { name: 'Customers', sheet: 'Customers', table: '1' },
    ]);
    const sh = wb.addWorksheet('Report');
    sh.getCell('A1').value = 'Account';
    sh.getCell('B1').value = 'Tier';
    sh.getCell('A2').value = '{{ [Account] }}';
    sh.getCell('B2').value = '{{ XLOOKUP([Account], Customers[Account], Customers[Tier]) }}';
    await writeBook(wb, join(dir, 'template.xlsx'));
  }

  // data.xlsx — Gamma is in Renewals but not Customers.
  {
    const wb = new ExcelJS.Workbook();
    const ren = wb.addWorksheet('Renewals');
    ren.getCell('A1').value = 'Account';
    ren.getCell('A2').value = 'Gamma';

    const cust = wb.addWorksheet('Customers');
    cust.getCell('A1').value = 'Account';
    cust.getCell('B1').value = 'Tier';
    cust.getCell('A2').value = 'Acme';
    cust.getCell('B2').value = 'Priority';
    await writeBook(wb, join(dir, 'data.xlsx'));
  }
}

// ---------------------------------------------------------------------------
// 077 - xlookup-source-mismatch-error
//
// Concept: XLOOKUP arg 2 and arg 3 must reference the same source.
// Spec section: language.md "XLOOKUP"; ADR-0013.
// ---------------------------------------------------------------------------
async function build077() {
  const dir = join(FIXTURES, '077-xlookup-source-mismatch-error');
  await mkdir(dir, { recursive: true });

  // template.xlsx
  {
    const wb = new ExcelJS.Workbook();
    addConfig(wb, [
      ['name', 'xlookup-source-mismatch-error'],
      ['source_sheet', 'Renewals'],
      ['source_table', '1'],
      ['output_file_pattern', 'output.xlsx'],
    ]);
    addSources(wb, [
      { name: 'Customers', sheet: 'Customers', table: '1' },
      { name: 'Regions', sheet: 'Regions', table: '1' },
    ]);
    const sh = wb.addWorksheet('Report');
    sh.getCell('A1').value = 'Account';
    sh.getCell('B1').value = 'Bad';
    sh.getCell('A2').value = '{{ [Account] }}';
    // arg 2 is from Customers, arg 3 is from Regions — sources differ → error.
    sh.getCell('B2').value = '{{ XLOOKUP([Account], Customers[Account], Regions[Name]) }}';
    await writeBook(wb, join(dir, 'template.xlsx'));
  }

  // data.xlsx
  {
    const wb = new ExcelJS.Workbook();
    const ren = wb.addWorksheet('Renewals');
    ren.getCell('A1').value = 'Account';
    ren.getCell('A2').value = 'Acme';

    const cust = wb.addWorksheet('Customers');
    cust.getCell('A1').value = 'Account';
    cust.getCell('B1').value = 'Name';
    cust.getCell('A2').value = 'Acme';
    cust.getCell('B2').value = 'Acme Logistics';

    const reg = wb.addWorksheet('Regions');
    reg.getCell('A1').value = 'Code';
    reg.getCell('B1').value = 'Name';
    reg.getCell('A2').value = 'KR';
    reg.getCell('B2').value = 'South Korea';
    await writeBook(wb, join(dir, 'data.xlsx'));
  }
}

// ---------------------------------------------------------------------------
// 078 - xlookup-bare-bracket-error
//
// Concept: XLOOKUP arg 2 and arg 3 require source-prefixed bracket
// references; bare `[Column]` is an error.
// Spec section: language.md "XLOOKUP"; ADR-0013.
// ---------------------------------------------------------------------------
async function build078() {
  const dir = join(FIXTURES, '078-xlookup-bare-bracket-error');
  await mkdir(dir, { recursive: true });

  // template.xlsx
  {
    const wb = new ExcelJS.Workbook();
    addConfig(wb, [
      ['name', 'xlookup-bare-bracket-error'],
      ['source_sheet', 'Renewals'],
      ['source_table', '1'],
      ['output_file_pattern', 'output.xlsx'],
    ]);
    addSources(wb, [
      { name: 'Customers', sheet: 'Customers', table: '1' },
    ]);
    const sh = wb.addWorksheet('Report');
    sh.getCell('A1').value = 'Account';
    sh.getCell('B1').value = 'Bad';
    sh.getCell('A2').value = '{{ [Account] }}';
    // arg 2 is bare [Column], not Source[Column] → error.
    sh.getCell('B2').value = '{{ XLOOKUP([Account], [Account], Customers[Name]) }}';
    await writeBook(wb, join(dir, 'template.xlsx'));
  }

  // data.xlsx
  {
    const wb = new ExcelJS.Workbook();
    const ren = wb.addWorksheet('Renewals');
    ren.getCell('A1').value = 'Account';
    ren.getCell('A2').value = 'Acme';

    const cust = wb.addWorksheet('Customers');
    cust.getCell('A1').value = 'Account';
    cust.getCell('B1').value = 'Name';
    cust.getCell('A2').value = 'Acme';
    cust.getCell('B2').value = 'Acme Logistics';
    await writeBook(wb, join(dir, 'data.xlsx'));
  }
}

// ---------------------------------------------------------------------------
// 079 - join-basic-inner
//
// Concept: @join pairs each primary row with the first matching joined
// row. Inside the block, [Column] resolves to the primary's row and
// JoinedSource[Column] resolves to the paired joined row.
// Spec section: evaluation.md "@join directive"; ADR-0014.
// ---------------------------------------------------------------------------
async function build079() {
  const dir = join(FIXTURES, '079-join-basic-inner');
  await mkdir(dir, { recursive: true });

  // template.xlsx
  {
    const wb = new ExcelJS.Workbook();
    addConfig(wb, [
      ['name', 'join-basic-inner'],
      ['source_sheet', 'Renewals'],
      ['source_table', '1'],
      ['output_file_pattern', 'output.xlsx'],
    ]);
    addSources(wb, [
      { name: 'Customers', sheet: 'Customers', table: '1' },
    ]);
    const sh = wb.addWorksheet('Report');
    sh.getCell('A1').value = 'Account';
    sh.getCell('B1').value = 'Customer';
    sh.getCell('C1').value = 'Amount';
    sh.getCell('A2').value = '{{ @join Customers on Customers[Account] = default[Account] }}';
    sh.getCell('A3').value = '{{ [Account] }}';
    sh.getCell('B3').value = '{{ Customers[Name] }}';
    sh.getCell('C3').value = '{{ [Amount] }}';
    await writeBook(wb, join(dir, 'template.xlsx'));
  }

  // data.xlsx
  {
    const wb = new ExcelJS.Workbook();
    const ren = wb.addWorksheet('Renewals');
    ren.getCell('A1').value = 'Account';
    ren.getCell('B1').value = 'Amount';
    ren.getCell('A2').value = 'Acme';
    ren.getCell('B2').value = 100;
    ren.getCell('A3').value = 'Beta';
    ren.getCell('B3').value = 200;

    const cust = wb.addWorksheet('Customers');
    cust.getCell('A1').value = 'Account';
    cust.getCell('B1').value = 'Name';
    cust.getCell('A2').value = 'Acme';
    cust.getCell('B2').value = 'Acme Logistics';
    cust.getCell('A3').value = 'Beta';
    cust.getCell('B3').value = 'Beta Works';
    await writeBook(wb, join(dir, 'data.xlsx'));
  }

  // expected.xlsx
  {
    const wb = new ExcelJS.Workbook();
    const sh = wb.addWorksheet('Report');
    sh.getCell('A1').value = 'Account';
    sh.getCell('B1').value = 'Customer';
    sh.getCell('C1').value = 'Amount';
    sh.getCell('A2').value = 'Acme';
    sh.getCell('B2').value = 'Acme Logistics';
    sh.getCell('C2').value = 100;
    sh.getCell('A3').value = 'Beta';
    sh.getCell('B3').value = 'Beta Works';
    sh.getCell('C3').value = 200;
    await writeBook(wb, join(dir, 'expected.xlsx'));
  }
}

// ---------------------------------------------------------------------------
// 080 - join-no-match-dropped
//
// Concept: inner-join semantics drop primary rows that don't match any
// joined row.
// Spec section: evaluation.md "@join directive"; ADR-0014.
// ---------------------------------------------------------------------------
async function build080() {
  const dir = join(FIXTURES, '080-join-no-match-dropped');
  await mkdir(dir, { recursive: true });

  // template.xlsx
  {
    const wb = new ExcelJS.Workbook();
    addConfig(wb, [
      ['name', 'join-no-match-dropped'],
      ['source_sheet', 'Renewals'],
      ['source_table', '1'],
      ['output_file_pattern', 'output.xlsx'],
    ]);
    addSources(wb, [
      { name: 'Customers', sheet: 'Customers', table: '1' },
    ]);
    const sh = wb.addWorksheet('Report');
    sh.getCell('A1').value = 'Account';
    sh.getCell('B1').value = 'Customer';
    sh.getCell('A2').value = '{{ @join Customers on Customers[Account] = default[Account] }}';
    sh.getCell('A3').value = '{{ [Account] }}';
    sh.getCell('B3').value = '{{ Customers[Name] }}';
    await writeBook(wb, join(dir, 'template.xlsx'));
  }

  // data.xlsx — Gamma is in Renewals but not Customers; should be dropped.
  {
    const wb = new ExcelJS.Workbook();
    const ren = wb.addWorksheet('Renewals');
    ren.getCell('A1').value = 'Account';
    ren.getCell('A2').value = 'Acme';
    ren.getCell('A3').value = 'Gamma';
    ren.getCell('A4').value = 'Beta';

    const cust = wb.addWorksheet('Customers');
    cust.getCell('A1').value = 'Account';
    cust.getCell('B1').value = 'Name';
    cust.getCell('A2').value = 'Acme';
    cust.getCell('B2').value = 'Acme Logistics';
    cust.getCell('A3').value = 'Beta';
    cust.getCell('B3').value = 'Beta Works';
    await writeBook(wb, join(dir, 'data.xlsx'));
  }

  // expected.xlsx — only Acme + Beta survive (Gamma dropped).
  {
    const wb = new ExcelJS.Workbook();
    const sh = wb.addWorksheet('Report');
    sh.getCell('A1').value = 'Account';
    sh.getCell('B1').value = 'Customer';
    sh.getCell('A2').value = 'Acme';
    sh.getCell('B2').value = 'Acme Logistics';
    sh.getCell('A3').value = 'Beta';
    sh.getCell('B3').value = 'Beta Works';
    await writeBook(wb, join(dir, 'expected.xlsx'));
  }
}

// ---------------------------------------------------------------------------
// 081 - join-undeclared-source-error
//
// Concept: @join referencing a source not declared in __sources__ is a
// parse-time error.
// Spec section: evaluation.md "@join directive"; ADR-0014.
// ---------------------------------------------------------------------------
async function build081() {
  const dir = join(FIXTURES, '081-join-undeclared-source-error');
  await mkdir(dir, { recursive: true });

  // template.xlsx — no __sources__ for "Customers".
  {
    const wb = new ExcelJS.Workbook();
    addConfig(wb, [
      ['name', 'join-undeclared-source-error'],
      ['source_sheet', 'Renewals'],
      ['source_table', '1'],
      ['output_file_pattern', 'output.xlsx'],
    ]);
    const sh = wb.addWorksheet('Report');
    sh.getCell('A1').value = 'Account';
    sh.getCell('A2').value = '{{ @join Customers on Customers[Account] = default[Account] }}';
    sh.getCell('A3').value = '{{ [Account] }}';
    await writeBook(wb, join(dir, 'template.xlsx'));
  }

  // data.xlsx
  {
    const wb = new ExcelJS.Workbook();
    const ren = wb.addWorksheet('Renewals');
    ren.getCell('A1').value = 'Account';
    ren.getCell('A2').value = 'Acme';
    await writeBook(wb, join(dir, 'data.xlsx'));
  }
}

// ---------------------------------------------------------------------------
// 082 - join-bad-on-clause-error
//
// Concept: the @join on-clause must reference both the joined source
// and the block's primary source.
// Spec section: evaluation.md "@join directive"; ADR-0014.
// ---------------------------------------------------------------------------
async function build082() {
  const dir = join(FIXTURES, '082-join-bad-on-clause-error');
  await mkdir(dir, { recursive: true });

  // template.xlsx — on-clause references Customers and Regions, but
  // the block's primary source is `default` (Renewals).
  {
    const wb = new ExcelJS.Workbook();
    addConfig(wb, [
      ['name', 'join-bad-on-clause-error'],
      ['source_sheet', 'Renewals'],
      ['source_table', '1'],
      ['output_file_pattern', 'output.xlsx'],
    ]);
    addSources(wb, [
      { name: 'Customers', sheet: 'Customers', table: '1' },
      { name: 'Regions', sheet: 'Regions', table: '1' },
    ]);
    const sh = wb.addWorksheet('Report');
    sh.getCell('A1').value = 'Account';
    // primary side of on-clause is Regions, not the block's primary (default).
    sh.getCell('A2').value = '{{ @join Customers on Customers[Account] = Regions[Account] }}';
    sh.getCell('A3').value = '{{ [Account] }}';
    await writeBook(wb, join(dir, 'template.xlsx'));
  }

  // data.xlsx
  {
    const wb = new ExcelJS.Workbook();
    const ren = wb.addWorksheet('Renewals');
    ren.getCell('A1').value = 'Account';
    ren.getCell('A2').value = 'Acme';

    const cust = wb.addWorksheet('Customers');
    cust.getCell('A1').value = 'Account';
    cust.getCell('B1').value = 'Name';
    cust.getCell('A2').value = 'Acme';
    cust.getCell('B2').value = 'Acme Logistics';

    const reg = wb.addWorksheet('Regions');
    reg.getCell('A1').value = 'Account';
    reg.getCell('A2').value = 'KR';
    await writeBook(wb, join(dir, 'data.xlsx'));
  }
}

// ---------------------------------------------------------------------------
// 083 - sort-stable-equal-keys
//
// Concept: @sort is stable — rows whose sort key compares equal
// preserve their source order.
// Spec section: language.md "Sort"; ADR-0016.
// ---------------------------------------------------------------------------
async function build083() {
  const dir = join(FIXTURES, '083-sort-stable-equal-keys');
  await mkdir(dir, { recursive: true });

  // template.xlsx
  {
    const wb = new ExcelJS.Workbook();
    addConfig(wb, [
      ['name', 'sort-stable-equal-keys'],
      ['source_sheet', 'Data'],
      ['source_table', '1'],
      ['output_file_pattern', 'output.xlsx'],
    ]);
    const sh = wb.addWorksheet('Report');
    sh.getCell('A1').value = 'Region';
    sh.getCell('B1').value = 'Customer';
    sh.getCell('A2').value = '{{ @sort [Region] asc }}';
    sh.getCell('A3').value = '{{ [Region] }}';
    sh.getCell('B3').value = '{{ [Customer] }}';
    await writeBook(wb, join(dir, 'template.xlsx'));
  }

  // data.xlsx — multiple Seoul rows in source order Acme→Beta→Gamma;
  // multiple Busan rows in source order Delta→Echo. The stable sort
  // must keep Customer order within each Region group.
  {
    const wb = new ExcelJS.Workbook();
    const sh = wb.addWorksheet('Data');
    sh.getCell('A1').value = 'Region';
    sh.getCell('B1').value = 'Customer';
    sh.getCell('A2').value = 'Seoul';
    sh.getCell('B2').value = 'Acme';
    sh.getCell('A3').value = 'Busan';
    sh.getCell('B3').value = 'Delta';
    sh.getCell('A4').value = 'Seoul';
    sh.getCell('B4').value = 'Beta';
    sh.getCell('A5').value = 'Busan';
    sh.getCell('B5').value = 'Echo';
    sh.getCell('A6').value = 'Seoul';
    sh.getCell('B6').value = 'Gamma';
    await writeBook(wb, join(dir, 'data.xlsx'));
  }

  // expected.xlsx — Busan rows (asc < Seoul) first in source order,
  // then Seoul rows in source order.
  {
    const wb = new ExcelJS.Workbook();
    const sh = wb.addWorksheet('Report');
    sh.getCell('A1').value = 'Region';
    sh.getCell('B1').value = 'Customer';
    sh.getCell('A2').value = 'Busan';
    sh.getCell('B2').value = 'Delta';
    sh.getCell('A3').value = 'Busan';
    sh.getCell('B3').value = 'Echo';
    sh.getCell('A4').value = 'Seoul';
    sh.getCell('B4').value = 'Acme';
    sh.getCell('A5').value = 'Seoul';
    sh.getCell('B5').value = 'Beta';
    sh.getCell('A6').value = 'Seoul';
    sh.getCell('B6').value = 'Gamma';
    await writeBook(wb, join(dir, 'expected.xlsx'));
  }
}

// ---------------------------------------------------------------------------
// 084 - sort-multi-stable-priority
//
// Concept: multiple @sort directives apply in priority order; later
// sorts are stable relative to earlier ones.
// Spec section: language.md "Sort"; ADR-0016.
// ---------------------------------------------------------------------------
async function build084() {
  const dir = join(FIXTURES, '084-sort-multi-stable-priority');
  await mkdir(dir, { recursive: true });

  // template.xlsx — first @sort = primary key (Region asc), second
  // @sort = tiebreaker (Customer asc).
  {
    const wb = new ExcelJS.Workbook();
    addConfig(wb, [
      ['name', 'sort-multi-stable-priority'],
      ['source_sheet', 'Data'],
      ['source_table', '1'],
      ['output_file_pattern', 'output.xlsx'],
    ]);
    const sh = wb.addWorksheet('Report');
    sh.getCell('A1').value = 'Region';
    sh.getCell('B1').value = 'Customer';
    sh.getCell('A2').value = '{{ @sort [Region] asc }}';
    sh.getCell('A3').value = '{{ @sort [Customer] asc }}';
    sh.getCell('A4').value = '{{ [Region] }}';
    sh.getCell('B4').value = '{{ [Customer] }}';
    await writeBook(wb, join(dir, 'template.xlsx'));
  }

  // data.xlsx — mixed regions and customers.
  {
    const wb = new ExcelJS.Workbook();
    const sh = wb.addWorksheet('Data');
    sh.getCell('A1').value = 'Region';
    sh.getCell('B1').value = 'Customer';
    sh.getCell('A2').value = 'Seoul';
    sh.getCell('B2').value = 'Beta';
    sh.getCell('A3').value = 'Busan';
    sh.getCell('B3').value = 'Echo';
    sh.getCell('A4').value = 'Seoul';
    sh.getCell('B4').value = 'Acme';
    sh.getCell('A5').value = 'Busan';
    sh.getCell('B5').value = 'Delta';
    await writeBook(wb, join(dir, 'data.xlsx'));
  }

  // expected.xlsx — by Region asc primary, Customer asc secondary.
  {
    const wb = new ExcelJS.Workbook();
    const sh = wb.addWorksheet('Report');
    sh.getCell('A1').value = 'Region';
    sh.getCell('B1').value = 'Customer';
    sh.getCell('A2').value = 'Busan';
    sh.getCell('B2').value = 'Delta';
    sh.getCell('A3').value = 'Busan';
    sh.getCell('B3').value = 'Echo';
    sh.getCell('A4').value = 'Seoul';
    sh.getCell('B4').value = 'Acme';
    sh.getCell('A5').value = 'Seoul';
    sh.getCell('B5').value = 'Beta';
    await writeBook(wb, join(dir, 'expected.xlsx'));
  }
}

// ---------------------------------------------------------------------------
// 085 - file-group-first-seen-order
//
// Concept: file groups are emitted in first-seen order over the source
// rows.
// Spec section: evaluation.md "Ordering"; ADR-0016.
// ---------------------------------------------------------------------------
async function build085() {
  const dir = join(FIXTURES, '085-file-group-first-seen-order');
  await mkdir(dir, { recursive: true });

  // template.xlsx — pattern produces one file per Region.
  {
    const wb = new ExcelJS.Workbook();
    addConfig(wb, [
      ['name', 'file-group-first-seen-order'],
      ['source_sheet', 'Data'],
      ['source_table', '1'],
      ['output_file_pattern', '{{ Region }}.xlsx'],
    ]);
    const sh = wb.addWorksheet('Report');
    sh.getCell('A1').value = 'Customer';
    sh.getCell('A2').value = '{{ [Customer] }}';
    await writeBook(wb, join(dir, 'template.xlsx'));
  }

  // data.xlsx — Seoul, Busan, Daegu first appear in this order.
  // Lexicographic order would be Busan, Daegu, Seoul; first-seen
  // keeps Seoul first.
  {
    const wb = new ExcelJS.Workbook();
    const sh = wb.addWorksheet('Data');
    sh.getCell('A1').value = 'Region';
    sh.getCell('B1').value = 'Customer';
    sh.getCell('A2').value = 'Seoul';
    sh.getCell('B2').value = 'Acme';
    sh.getCell('A3').value = 'Busan';
    sh.getCell('B3').value = 'Beta';
    sh.getCell('A4').value = 'Daegu';
    sh.getCell('B4').value = 'Gamma';
    sh.getCell('A5').value = 'Seoul';
    sh.getCell('B5').value = 'Delta';
    await writeBook(wb, join(dir, 'data.xlsx'));
  }

  // expected/ — three files in first-seen order.
  {
    const expDir = join(dir, 'expected');
    await mkdir(expDir, { recursive: true });
    {
      const wb = new ExcelJS.Workbook();
      const sh = wb.addWorksheet('Report');
      sh.getCell('A1').value = 'Customer';
      sh.getCell('A2').value = 'Acme';
      sh.getCell('A3').value = 'Delta';
      await writeBook(wb, join(expDir, 'Seoul.xlsx'));
    }
    {
      const wb = new ExcelJS.Workbook();
      const sh = wb.addWorksheet('Report');
      sh.getCell('A1').value = 'Customer';
      sh.getCell('A2').value = 'Beta';
      await writeBook(wb, join(expDir, 'Busan.xlsx'));
    }
    {
      const wb = new ExcelJS.Workbook();
      const sh = wb.addWorksheet('Report');
      sh.getCell('A1').value = 'Customer';
      sh.getCell('A2').value = 'Gamma';
      await writeBook(wb, join(expDir, 'Daegu.xlsx'));
    }
  }
}

// ---------------------------------------------------------------------------
// 086 - sheet-group-first-seen-order
//
// Concept: sheet groups within a file emit in first-seen order — same
// rule as file groups.
// Spec section: evaluation.md "Ordering"; ADR-0016.
// ---------------------------------------------------------------------------
async function build086() {
  const dir = join(FIXTURES, '086-sheet-group-first-seen-order');
  await mkdir(dir, { recursive: true });

  // template.xlsx — single output file, sheet name templated by Region.
  {
    const wb = new ExcelJS.Workbook();
    addConfig(wb, [
      ['name', 'sheet-group-first-seen-order'],
      ['source_sheet', 'Data'],
      ['source_table', '1'],
      ['output_file_pattern', 'output.xlsx'],
    ]);
    const sh = wb.addWorksheet('{{ Region }}');
    sh.getCell('A1').value = 'Customer';
    sh.getCell('A2').value = '{{ [Customer] }}';
    await writeBook(wb, join(dir, 'template.xlsx'));
  }

  // data.xlsx — Seoul appears before Busan in source order.
  {
    const wb = new ExcelJS.Workbook();
    const sh = wb.addWorksheet('Data');
    sh.getCell('A1').value = 'Region';
    sh.getCell('B1').value = 'Customer';
    sh.getCell('A2').value = 'Seoul';
    sh.getCell('B2').value = 'Acme';
    sh.getCell('A3').value = 'Busan';
    sh.getCell('B3').value = 'Beta';
    sh.getCell('A4').value = 'Seoul';
    sh.getCell('B4').value = 'Gamma';
    await writeBook(wb, join(dir, 'data.xlsx'));
  }

  // expected.xlsx — Seoul sheet first, then Busan. Lexicographic
  // would produce Busan first; first-seen keeps Seoul first.
  {
    const wb = new ExcelJS.Workbook();
    const seoul = wb.addWorksheet('Seoul');
    seoul.getCell('A1').value = 'Customer';
    seoul.getCell('A2').value = 'Acme';
    seoul.getCell('A3').value = 'Gamma';
    const busan = wb.addWorksheet('Busan');
    busan.getCell('A1').value = 'Customer';
    busan.getCell('A2').value = 'Beta';
    await writeBook(wb, join(dir, 'expected.xlsx'));
  }
}

// ---------------------------------------------------------------------------
// 087 - date-canonical-string-concat
//
// Concept: a Date value in `&` concatenation produces YYYY-MM-DD when
// midnight, YYYY-MM-DDTHH:mm:ss otherwise (ADR-0017).
// Spec section: language.md "Canonical String Form"; ADR-0017.
// ---------------------------------------------------------------------------
async function build087() {
  const dir = join(FIXTURES, '087-date-canonical-string-concat');
  await mkdir(dir, { recursive: true });

  // template.xlsx
  {
    const wb = new ExcelJS.Workbook();
    addConfig(wb, [
      ['name', 'date-canonical-string-concat'],
      ['source_sheet', 'Data'],
      ['source_table', '1'],
      ['output_file_pattern', 'output.xlsx'],
    ]);
    const sh = wb.addWorksheet('Report');
    sh.getCell('A1').value = 'Customer';
    sh.getCell('B1').value = 'Summary';
    sh.getCell('A2').value = '{{ [Customer] }}';
    sh.getCell('B2').value = '{{ [Customer] & " (" & [Signup] & ")" }}';
    await writeBook(wb, join(dir, 'template.xlsx'));
  }

  // data.xlsx — Acme has midnight date, Beta has datetime.
  {
    const wb = new ExcelJS.Workbook();
    const sh = wb.addWorksheet('Data');
    sh.getCell('A1').value = 'Customer';
    sh.getCell('B1').value = 'Signup';
    sh.getCell('A2').value = 'Acme';
    sh.getCell('B2').value = new Date(Date.UTC(2026, 4, 8));          // midnight → YYYY-MM-DD
    sh.getCell('B2').numFmt = 'yyyy-mm-dd';
    sh.getCell('A3').value = 'Beta';
    sh.getCell('B3').value = new Date(Date.UTC(2026, 4, 8, 9, 30, 0)); // datetime → ISO
    sh.getCell('B3').numFmt = 'yyyy-mm-dd hh:mm:ss';
    await writeBook(wb, join(dir, 'data.xlsx'));
  }

  // expected.xlsx — Acme produces "Acme (2026-05-08)", Beta produces
  // "Beta (2026-05-08T09:30:00)".
  {
    const wb = new ExcelJS.Workbook();
    const sh = wb.addWorksheet('Report');
    sh.getCell('A1').value = 'Customer';
    sh.getCell('B1').value = 'Summary';
    sh.getCell('A2').value = 'Acme';
    sh.getCell('B2').value = 'Acme (2026-05-08)';
    sh.getCell('A3').value = 'Beta';
    sh.getCell('B3').value = 'Beta (2026-05-08T09:30:00)';
    await writeBook(wb, join(dir, 'expected.xlsx'));
  }
}

// ---------------------------------------------------------------------------
// 088 - date-comparison-equality
//
// Concept: two Date values compare by their underlying timestamp per
// ADR-0017.
// Spec section: language.md "Comparison Algorithm"; ADR-0017.
// ---------------------------------------------------------------------------
async function build088() {
  const dir = join(FIXTURES, '088-date-comparison-equality');
  await mkdir(dir, { recursive: true });

  // template.xlsx — filter rows where Signup equals 2026-05-08.
  {
    const wb = new ExcelJS.Workbook();
    addConfig(wb, [
      ['name', 'date-comparison-equality'],
      ['source_sheet', 'Data'],
      ['source_table', '1'],
      ['output_file_pattern', 'output.xlsx'],
    ]);
    const sh = wb.addWorksheet('Report');
    sh.getCell('A1').value = 'Customer';
    sh.getCell('A2').value = '{{ @filter [Signup] = "2026-05-08" }}';
    sh.getCell('A3').value = '{{ [Customer] }}';
    await writeBook(wb, join(dir, 'template.xlsx'));
  }

  // data.xlsx — Acme matches by date, Beta has different date.
  {
    const wb = new ExcelJS.Workbook();
    const sh = wb.addWorksheet('Data');
    sh.getCell('A1').value = 'Customer';
    sh.getCell('B1').value = 'Signup';
    sh.getCell('A2').value = 'Acme';
    sh.getCell('B2').value = new Date(Date.UTC(2026, 4, 8));
    sh.getCell('B2').numFmt = 'yyyy-mm-dd';
    sh.getCell('A3').value = 'Beta';
    sh.getCell('B3').value = new Date(Date.UTC(2026, 4, 9));
    sh.getCell('B3').numFmt = 'yyyy-mm-dd';
    await writeBook(wb, join(dir, 'data.xlsx'));
  }

  // expected.xlsx — only Acme survives; "2026-05-08" filter value is
  // a string but compareValues falls through to canonical-string-form
  // matching where the date renders as YYYY-MM-DD.
  {
    const wb = new ExcelJS.Workbook();
    const sh = wb.addWorksheet('Report');
    sh.getCell('A1').value = 'Customer';
    sh.getCell('A2').value = 'Acme';
    await writeBook(wb, join(dir, 'expected.xlsx'));
  }
}

// ---------------------------------------------------------------------------
// 089 - error-sentinel-empty
//
// Concept: Excel error cells (#N/A, #VALUE!, etc.) read as empty per
// ADR-0017. IFEMPTY catches them.
// Spec section: evaluation.md "Empty Values"; ADR-0017.
// ---------------------------------------------------------------------------
async function build089() {
  const dir = join(FIXTURES, '089-error-sentinel-empty');
  await mkdir(dir, { recursive: true });

  // template.xlsx
  {
    const wb = new ExcelJS.Workbook();
    addConfig(wb, [
      ['name', 'error-sentinel-empty'],
      ['source_sheet', 'Data'],
      ['source_table', '1'],
      ['output_file_pattern', 'output.xlsx'],
    ]);
    const sh = wb.addWorksheet('Report');
    sh.getCell('A1').value = 'Customer';
    sh.getCell('B1').value = 'Tier';
    sh.getCell('A2').value = '{{ [Customer] }}';
    sh.getCell('B2').value = '{{ IFEMPTY([Tier], "—") }}';
    await writeBook(wb, join(dir, 'template.xlsx'));
  }

  // data.xlsx — Acme's Tier is an error cell; Beta's Tier is normal.
  {
    const wb = new ExcelJS.Workbook();
    const sh = wb.addWorksheet('Data');
    sh.getCell('A1').value = 'Customer';
    sh.getCell('B1').value = 'Tier';
    sh.getCell('A2').value = 'Acme';
    sh.getCell('B2').value = { error: '#N/A' };
    sh.getCell('A3').value = 'Beta';
    sh.getCell('B3').value = 'Priority';
    await writeBook(wb, join(dir, 'data.xlsx'));
  }

  // expected.xlsx — Acme renders the IFEMPTY fallback "—".
  {
    const wb = new ExcelJS.Workbook();
    const sh = wb.addWorksheet('Report');
    sh.getCell('A1').value = 'Customer';
    sh.getCell('B1').value = 'Tier';
    sh.getCell('A2').value = 'Acme';
    sh.getCell('B2').value = '—';
    sh.getCell('A3').value = 'Beta';
    sh.getCell('B3').value = 'Priority';
    await writeBook(wb, join(dir, 'expected.xlsx'));
  }
}

// ---------------------------------------------------------------------------
// 090 - percentage-numeric-flow
//
// Concept: a percentage-formatted Excel cell flows as its underlying
// Number value (50% → 0.5) per ADR-0017. Templates that need
// formatted output use TEXT() or template cell number format.
// Spec section: evaluation.md "Source Value Model"; ADR-0017.
// ---------------------------------------------------------------------------
async function build090() {
  const dir = join(FIXTURES, '090-percentage-numeric-flow');
  await mkdir(dir, { recursive: true });

  // template.xlsx — render rate * 100 to confirm the underlying number.
  {
    const wb = new ExcelJS.Workbook();
    addConfig(wb, [
      ['name', 'percentage-numeric-flow'],
      ['source_sheet', 'Data'],
      ['source_table', '1'],
      ['output_file_pattern', 'output.xlsx'],
    ]);
    const sh = wb.addWorksheet('Report');
    sh.getCell('A1').value = 'Customer';
    sh.getCell('B1').value = 'RateTimes100';
    sh.getCell('A2').value = '{{ [Customer] }}';
    sh.getCell('B2').value = '{{ [Rate] * 100 }}';
    await writeBook(wb, join(dir, 'template.xlsx'));
  }

  // data.xlsx — Rate cells formatted as percent.
  {
    const wb = new ExcelJS.Workbook();
    const sh = wb.addWorksheet('Data');
    sh.getCell('A1').value = 'Customer';
    sh.getCell('B1').value = 'Rate';
    sh.getCell('A2').value = 'Acme';
    sh.getCell('B2').value = 0.5; // displays as 50% with the format
    sh.getCell('B2').numFmt = '0%';
    sh.getCell('A3').value = 'Beta';
    sh.getCell('B3').value = 0.125;
    sh.getCell('B3').numFmt = '0.0%';
    await writeBook(wb, join(dir, 'data.xlsx'));
  }

  // expected.xlsx — multiplying by 100 yields 50 / 12.5.
  {
    const wb = new ExcelJS.Workbook();
    const sh = wb.addWorksheet('Report');
    sh.getCell('A1').value = 'Customer';
    sh.getCell('B1').value = 'RateTimes100';
    sh.getCell('A2').value = 'Acme';
    sh.getCell('B2').value = 50;
    sh.getCell('A3').value = 'Beta';
    sh.getCell('B3').value = 12.5;
    await writeBook(wb, join(dir, 'expected.xlsx'));
  }
}

// ---------------------------------------------------------------------------
// 096 - canonical-number-decimal-vs-scientific-boundary (ADR-0009)
//
// Concept: ADR-0009 specifies that canonical string form uses
// scientific notation for magnitudes outside [1e-6, 1e21). A value
// like 0.00005 (= 5e-5) sits inside the decimal range and MUST
// stringify as "0.00005", not "5e-5". A value like 0.0000005
// (= 5e-7) sits outside and stringifies as "5e-7".
// Pre-rc.1 spec text incorrectly cited 1e-4; corrected per xl3-py
// issue #1.
// Spec section: language.md "Canonical String Form"; ADR-0009.
// ---------------------------------------------------------------------------
async function build096() {
  const dir = join(FIXTURES, '096-canonical-number-scientific-boundary');
  await mkdir(dir, { recursive: true });

  // template.xlsx — concatenate the cell value into a string so the
  // canonical-string form is observable. Single-expression cells
  // would preserve the number type and let Excel format it.
  {
    const wb = new ExcelJS.Workbook();
    addConfig(wb, [
      ['name', 'canonical-number-scientific-boundary'],
      ['source_sheet', 'Data'],
      ['source_table', '1'],
      ['output_file_pattern', 'output.xlsx'],
    ]);
    const sh = wb.addWorksheet('Report');
    sh.getCell('A1').value = 'Label';
    sh.getCell('B1').value = 'AsString';
    sh.getCell('A2').value = '{{ [Label] }}';
    sh.getCell('B2').value = '{{ "" & [Value] }}';
    await writeBook(wb, join(dir, 'template.xlsx'));
  }

  // data.xlsx — three values straddling the 1e-6 boundary.
  {
    const wb = new ExcelJS.Workbook();
    const sh = wb.addWorksheet('Data');
    sh.getCell('A1').value = 'Label';
    sh.getCell('B1').value = 'Value';
    sh.getCell('A2').value = 'inside-decimal';
    sh.getCell('B2').value = 0.00005;       // 5e-5, decimal range
    sh.getCell('A3').value = 'at-1e-6';
    sh.getCell('B3').value = 0.000001;      // 1e-6, decimal range (boundary)
    sh.getCell('A4').value = 'below-boundary';
    sh.getCell('B4').value = 0.0000005;     // 5e-7, scientific range
    await writeBook(wb, join(dir, 'data.xlsx'));
  }

  // expected.xlsx
  {
    const wb = new ExcelJS.Workbook();
    const sh = wb.addWorksheet('Report');
    sh.getCell('A1').value = 'Label';
    sh.getCell('B1').value = 'AsString';
    sh.getCell('A2').value = 'inside-decimal';
    sh.getCell('B2').value = '0.00005';
    sh.getCell('A3').value = 'at-1e-6';
    sh.getCell('B3').value = '0.000001';
    sh.getCell('A4').value = 'below-boundary';
    sh.getCell('B4').value = '5e-7';
    await writeBook(wb, join(dir, 'expected.xlsx'));
  }
}

// ---------------------------------------------------------------------------
// 119 - output-filename-collision-error (ADR-0031)
//
// Concept: two distinct file group keys that sanitize to the same
// filename raise xl3/filename/collision at convert time, before any
// file is rendered. Previously the engine returned two OutputFile
// entries with the same filename; host code silently overwrote the
// first when writing to disk.
// Spec section: ADR-0031.
// ---------------------------------------------------------------------------
async function build119() {
  const dir = join(FIXTURES, '119-output-filename-collision-error');
  await mkdir(dir, { recursive: true });

  {
    const wb = new ExcelJS.Workbook();
    addConfig(wb, [
      ['name', 'filename-collision'],
      ['source_sheet', 'Data'],
      ['source_table', '1'],
      ['output_file_pattern', '{{ Region }}.xlsx'],
    ]);
    const sh = wb.addWorksheet('Report');
    sh.getCell('A1').value = 'Account';
    sh.getCell('A2').value = '{{ [Account] }}';
    await writeBook(wb, join(dir, 'template.xlsx'));
  }

  // Two Region values that sanitize to the same filename:
  // "Seoul/Korea" and "Seoul:Korea" both → "Seoul_Korea.xlsx" per
  // ADR-0002. Distinct group identities, same filename → collision.
  {
    const wb = new ExcelJS.Workbook();
    const sh = wb.addWorksheet('Data');
    sh.getCell('A1').value = 'Account'; sh.getCell('B1').value = 'Region';
    sh.getCell('A2').value = 'Acme';    sh.getCell('B2').value = 'Seoul/Korea';
    sh.getCell('A3').value = 'Beta';    sh.getCell('B3').value = 'Seoul:Korea';
    sh.getCell('A4').value = 'Coreon';  sh.getCell('B4').value = 'Busan';
    await writeBook(wb, join(dir, 'data.xlsx'));
  }
}

// ---------------------------------------------------------------------------
// 118 - unicode-normalization-not-applied (ADR-0030)
//
// Concept: comparison uses raw code points with NO Unicode
// normalization applied per ADR-0030. NFC "한" (U+D55C) and NFD
// "한" (U+1112 U+1161 U+11AB) render identically but compare as
// different strings, so @filter [Name] = NFC "한" matches the NFC
// row only.
// Spec section: ADR-0030; language.md "Comparison Algorithm".
// ---------------------------------------------------------------------------
async function build118() {
  const dir = join(FIXTURES, '118-unicode-normalization-not-applied');
  await mkdir(dir, { recursive: true });

  // NFC "한" = U+D55C, NFD "한" = U+1112 U+1161 U+11AB.
  const NFC_HAN = '한';
  const NFD_HAN = '한';

  {
    const wb = new ExcelJS.Workbook();
    addConfig(wb, [
      ['name', 'unicode-normalization'],
      ['source_sheet', 'Data'],
      ['source_table', '1'],
      ['output_file_pattern', 'output.xlsx'],
    ]);
    const sh = wb.addWorksheet('Report');
    sh.getCell('A1').value = 'Name';
    sh.getCell('B1').value = 'IsNFCHan';
    // @filter against NFC form. Only NFC row should pass.
    sh.getCell('A2').value = `{{ @filter [Name] = "${NFC_HAN}" }}`;
    sh.getCell('A3').value = '{{ [Name] }}';
    sh.getCell('B3').value = `{{ IF([Name] = "${NFC_HAN}", "yes", "no") }}`;
    await writeBook(wb, join(dir, 'template.xlsx'));
  }

  {
    const wb = new ExcelJS.Workbook();
    const sh = wb.addWorksheet('Data');
    sh.getCell('A1').value = 'Name';
    sh.getCell('A2').value = NFC_HAN;     // NFC "한"
    sh.getCell('A3').value = NFD_HAN;     // NFD "한" — looks identical, compares unequal
    sh.getCell('A4').value = '다른';      // unrelated
    await writeBook(wb, join(dir, 'data.xlsx'));
  }

  // Expected: only the NFC row survives the filter. The NFD row is
  // dropped because raw code-point comparison sees them as different.
  {
    const wb = new ExcelJS.Workbook();
    const sh = wb.addWorksheet('Report');
    sh.getCell('A1').value = 'Name';
    sh.getCell('B1').value = 'IsNFCHan';
    sh.getCell('A2').value = NFC_HAN;
    sh.getCell('B2').value = 'yes';
    await writeBook(wb, join(dir, 'expected.xlsx'));
  }
}

// ---------------------------------------------------------------------------
// 114 - duplicate-source-directive-error (ADR-0029)
//
// Concept: at most one `@source` directive per data block.
// Spec section: ADR-0029 §"Composition rules".
// ---------------------------------------------------------------------------
async function build114() {
  const dir = join(FIXTURES, '114-duplicate-source-directive-error');
  await mkdir(dir, { recursive: true });

  {
    const wb = new ExcelJS.Workbook();
    addConfig(wb, [
      ['name', 'duplicate-source'],
      ['source_sheet', 'Data'],
      ['source_table', '1'],
      ['output_file_pattern', 'output.xlsx'],
    ]);
    addSources(wb, [
      { name: 'A', sheet: 'A', table: '1' },
      { name: 'B', sheet: 'B', table: '1' },
    ]);
    const sh = wb.addWorksheet('Report');
    sh.getCell('A1').value = 'V';
    sh.getCell('A2').value = '{{ @source A }}';
    sh.getCell('A3').value = '{{ @source B }}';
    sh.getCell('A4').value = '{{ [v] }}';
    await writeBook(wb, join(dir, 'template.xlsx'));
  }

  {
    const wb = new ExcelJS.Workbook();
    const dd = wb.addWorksheet('Data'); dd.getCell('A1').value = 'V'; dd.getCell('A2').value = 'd';
    const da = wb.addWorksheet('A'); da.getCell('A1').value = 'v'; da.getCell('A2').value = 'a';
    const db = wb.addWorksheet('B'); db.getCell('A1').value = 'v'; db.getCell('A2').value = 'b';
    await writeBook(wb, join(dir, 'data.xlsx'));
  }
}

// ---------------------------------------------------------------------------
// 115 - self-join-error (ADR-0029)
//
// Concept: `@join` cannot reference the same source as the active
// `@source`. Self-joins are out of scope per ADR-0014/0029.
// Spec section: ADR-0029 §"Composition rules".
// ---------------------------------------------------------------------------
async function build115() {
  const dir = join(FIXTURES, '115-self-join-error');
  await mkdir(dir, { recursive: true });

  {
    const wb = new ExcelJS.Workbook();
    addConfig(wb, [
      ['name', 'self-join'],
      ['source_sheet', 'Data'],
      ['source_table', '1'],
      ['output_file_pattern', 'output.xlsx'],
    ]);
    addSources(wb, [
      { name: 'S', sheet: 'S', table: '1' },
    ]);
    const sh = wb.addWorksheet('Report');
    sh.getCell('A1').value = 'X';
    sh.getCell('A2').value = '{{ @source S }}';
    sh.getCell('A3').value = '{{ @join S on S[parent] = S[id] }}';
    sh.getCell('A4').value = '{{ [id] }}';
    await writeBook(wb, join(dir, 'template.xlsx'));
  }

  {
    const wb = new ExcelJS.Workbook();
    const dd = wb.addWorksheet('Data'); dd.getCell('A1').value = 'X'; dd.getCell('A2').value = 'd';
    const ds = wb.addWorksheet('S');
    ds.getCell('A1').value = 'id'; ds.getCell('B1').value = 'parent';
    ds.getCell('A2').value = 1; ds.getCell('B2').value = 2;
    await writeBook(wb, join(dir, 'data.xlsx'));
  }
}

// ---------------------------------------------------------------------------
// 116 - function-name-case-insensitive (ADR-0029)
//
// Concept: function names are case-insensitive. `if`, `If`, `IF`,
// and `iF` all resolve to the IF function.
// Spec section: ADR-0029 §"Function name case-insensitivity";
// language.md "Functions".
// ---------------------------------------------------------------------------
async function build116() {
  const dir = join(FIXTURES, '116-function-name-case-insensitive');
  await mkdir(dir, { recursive: true });

  {
    const wb = new ExcelJS.Workbook();
    addConfig(wb, [
      ['name', 'fn-case-insensitive'],
      ['source_sheet', 'Data'],
      ['source_table', '1'],
      ['output_file_pattern', 'output.xlsx'],
    ]);
    const sh = wb.addWorksheet('Report');
    sh.getCell('A1').value = 'Upper';
    sh.getCell('B1').value = 'Lower';
    sh.getCell('C1').value = 'Mixed';
    sh.getCell('A2').value = '{{ IF([X] > 0, "pos", "neg") }}';
    sh.getCell('B2').value = '{{ if([X] > 0, "pos", "neg") }}';
    sh.getCell('C2').value = '{{ If([X] > 0, "pos", "neg") }}';
    await writeBook(wb, join(dir, 'template.xlsx'));
  }

  {
    const wb = new ExcelJS.Workbook();
    const sh = wb.addWorksheet('Data');
    sh.getCell('A1').value = 'X';
    sh.getCell('A2').value = 5;
    await writeBook(wb, join(dir, 'data.xlsx'));
  }

  {
    const wb = new ExcelJS.Workbook();
    const sh = wb.addWorksheet('Report');
    sh.getCell('A1').value = 'Upper';
    sh.getCell('B1').value = 'Lower';
    sh.getCell('C1').value = 'Mixed';
    sh.getCell('A2').value = 'pos';
    sh.getCell('B2').value = 'pos';
    sh.getCell('C2').value = 'pos';
    await writeBook(wb, join(dir, 'expected.xlsx'));
  }
}

// ---------------------------------------------------------------------------
// 117 - hidden-source-rows-included (ADR-0029)
//
// Concept: source rows with `hidden=true` are included in iteration
// per ADR-0029 §"Hidden rows in source". Authors filter explicitly
// via `@filter` if visibility-aware filtering is desired.
// Spec section: ADR-0029 §"Hidden rows in source".
// ---------------------------------------------------------------------------
async function build117() {
  const dir = join(FIXTURES, '117-hidden-source-rows-included');
  await mkdir(dir, { recursive: true });

  {
    const wb = new ExcelJS.Workbook();
    addConfig(wb, [
      ['name', 'hidden-rows-included'],
      ['source_sheet', 'Data'],
      ['source_table', '1'],
      ['output_file_pattern', 'output.xlsx'],
    ]);
    const sh = wb.addWorksheet('Report');
    sh.getCell('A1').value = 'V';
    sh.getCell('A2').value = '{{ [V] }}';
    await writeBook(wb, join(dir, 'template.xlsx'));
  }

  {
    const wb = new ExcelJS.Workbook();
    const sh = wb.addWorksheet('Data');
    sh.getCell('A1').value = 'V';
    sh.getCell('A2').value = 'r1';
    sh.getCell('A3').value = 'r2-hidden';
    sh.getCell('A4').value = 'r3';
    sh.getRow(3).hidden = true;
    await writeBook(wb, join(dir, 'data.xlsx'));
  }

  {
    const wb = new ExcelJS.Workbook();
    const sh = wb.addWorksheet('Report');
    sh.getCell('A1').value = 'V';
    sh.getCell('A2').value = 'r1';
    sh.getCell('A3').value = 'r2-hidden';
    sh.getCell('A4').value = 'r3';
    await writeBook(wb, join(dir, 'expected.xlsx'));
  }
}

// ---------------------------------------------------------------------------
// 112 - literal-signed-number (ADR-0028)
//
// Concept: a signed number literal `-N` is valid at parse position
// per ADR-0028. Verifies the supported case so a future change
// doesn't break it.
// Spec section: ADR-0028 §"Number literal constraints".
// ---------------------------------------------------------------------------
async function build112() {
  const dir = join(FIXTURES, '112-literal-signed-number');
  await mkdir(dir, { recursive: true });

  {
    const wb = new ExcelJS.Workbook();
    addConfig(wb, [
      ['name', 'literal-signed-number'],
      ['source_sheet', 'Data'],
      ['source_table', '1'],
      ['output_file_pattern', 'output.xlsx'],
    ]);
    const sh = wb.addWorksheet('Report');
    sh.getCell('A1').value = 'Plain';
    sh.getCell('B1').value = 'Negative';
    sh.getCell('C1').value = 'Decimal';
    sh.getCell('A2').value = '{{ 5 }}';
    sh.getCell('B2').value = '{{ -5 }}';
    sh.getCell('C2').value = '{{ -3.14 }}';
    await writeBook(wb, join(dir, 'template.xlsx'));
  }

  {
    const wb = new ExcelJS.Workbook();
    const sh = wb.addWorksheet('Data');
    sh.getCell('A1').value = 'X';
    sh.getCell('A2').value = 1;
    await writeBook(wb, join(dir, 'data.xlsx'));
  }

  {
    const wb = new ExcelJS.Workbook();
    const sh = wb.addWorksheet('Report');
    sh.getCell('A1').value = 'Plain';
    sh.getCell('B1').value = 'Negative';
    sh.getCell('C1').value = 'Decimal';
    sh.getCell('A2').value = 5;
    sh.getCell('B2').value = -5;
    sh.getCell('C2').value = -3.14;
    await writeBook(wb, join(dir, 'expected.xlsx'));
  }
}

// ---------------------------------------------------------------------------
// 113 - unsupported-unary-on-column-ref-error (ADR-0028)
//
// Concept: unary minus on a column reference (`-[X]`) is NOT
// supported in XTL 0.x per ADR-0028 and raises
// xl3/eval/unsupported-syntax. Replaces the previous silent
// fallthrough that output the literal string `"-[X]"`.
// Spec section: ADR-0028 §"Number literal constraints".
// ---------------------------------------------------------------------------
async function build113() {
  const dir = join(FIXTURES, '113-unsupported-unary-on-column-ref-error');
  await mkdir(dir, { recursive: true });

  {
    const wb = new ExcelJS.Workbook();
    addConfig(wb, [
      ['name', 'unsupported-unary'],
      ['source_sheet', 'Data'],
      ['source_table', '1'],
      ['output_file_pattern', 'output.xlsx'],
    ]);
    const sh = wb.addWorksheet('Report');
    sh.getCell('A1').value = 'Negated';
    sh.getCell('A2').value = '{{ -[Amount] }}';
    await writeBook(wb, join(dir, 'template.xlsx'));
  }

  {
    const wb = new ExcelJS.Workbook();
    const sh = wb.addWorksheet('Data');
    sh.getCell('A1').value = 'Amount';
    sh.getCell('A2').value = 100;
    await writeBook(wb, join(dir, 'data.xlsx'));
  }
}

// ---------------------------------------------------------------------------
// 109 - source-column-reserved-name-error (ADR-0027)
//
// Concept: a source column named `Rows` collides with the renderer's
// internal `Rows` ctx key. ADR-0027 rejects this at parse time with
// xl3/source/reserved-column-name.
// Spec section: ADR-0027 §"Reserved column names".
// ---------------------------------------------------------------------------
async function build109() {
  const dir = join(FIXTURES, '109-source-column-reserved-name-error');
  await mkdir(dir, { recursive: true });

  {
    const wb = new ExcelJS.Workbook();
    addConfig(wb, [
      ['name', 'reserved-column-name'],
      ['source_sheet', 'Data'],
      ['source_table', '1'],
      ['output_file_pattern', 'output.xlsx'],
    ]);
    const sh = wb.addWorksheet('Report');
    sh.getCell('A1').value = '{{ [Rows] }}';
    await writeBook(wb, join(dir, 'template.xlsx'));
  }

  {
    const wb = new ExcelJS.Workbook();
    const sh = wb.addWorksheet('Data');
    sh.getCell('A1').value = 'Rows'; // ← reserved name
    sh.getCell('A2').value = 'value';
    await writeBook(wb, join(dir, 'data.xlsx'));
  }
}

// ---------------------------------------------------------------------------
// 110 - directive-empty-filter-error (ADR-0027)
//
// Concept: `{{ @filter }}` (no body) raises xl3/directive/invalid-syntax
// instead of silently no-opping per ADR-0027.
// Spec section: ADR-0027 §"Directive validation".
// ---------------------------------------------------------------------------
async function build110() {
  const dir = join(FIXTURES, '110-directive-empty-filter-error');
  await mkdir(dir, { recursive: true });

  {
    const wb = new ExcelJS.Workbook();
    addConfig(wb, [
      ['name', 'directive-empty-filter'],
      ['source_sheet', 'Data'],
      ['source_table', '1'],
      ['output_file_pattern', 'output.xlsx'],
    ]);
    const sh = wb.addWorksheet('Report');
    sh.getCell('A1').value = 'Account';
    sh.getCell('A2').value = '{{ @filter }}';
    sh.getCell('A3').value = '{{ [Account] }}';
    await writeBook(wb, join(dir, 'template.xlsx'));
  }

  {
    const wb = new ExcelJS.Workbook();
    const sh = wb.addWorksheet('Data');
    sh.getCell('A1').value = 'Account';
    sh.getCell('A2').value = 'Acme';
    await writeBook(wb, join(dir, 'data.xlsx'));
  }
}

// ---------------------------------------------------------------------------
// 111 - directive-empty-source-error (ADR-0027)
//
// Concept: `{{ @source }}` (no source name) raises
// xl3/directive/invalid-syntax. Previously silently fell back to the
// implicit `default` source.
// Spec section: ADR-0027 §"Directive validation".
// ---------------------------------------------------------------------------
async function build111() {
  const dir = join(FIXTURES, '111-directive-empty-source-error');
  await mkdir(dir, { recursive: true });

  {
    const wb = new ExcelJS.Workbook();
    addConfig(wb, [
      ['name', 'directive-empty-source'],
      ['source_sheet', 'Data'],
      ['source_table', '1'],
      ['output_file_pattern', 'output.xlsx'],
    ]);
    const sh = wb.addWorksheet('Report');
    sh.getCell('A1').value = 'Account';
    sh.getCell('A2').value = '{{ @source }}';
    sh.getCell('A3').value = '{{ [Account] }}';
    await writeBook(wb, join(dir, 'template.xlsx'));
  }

  {
    const wb = new ExcelJS.Workbook();
    const sh = wb.addWorksheet('Data');
    sh.getCell('A1').value = 'Account';
    sh.getCell('A2').value = 'Acme';
    await writeBook(wb, join(dir, 'data.xlsx'));
  }
}

// ---------------------------------------------------------------------------
// 107 - group-key-empty-becomes-blank-placeholder-file (ADR-0026)
//
// Concept: a file-level group key whose value is empty per ADR-0007
// substitutes the literal token "(blank)" before filename
// interpolation per ADR-0026. The conversion does not halt; rows
// with empty group keys land in a "(blank).xlsx" bucket.
// Spec section: ADR-0026 §"Group key value evaluating to empty".
// ---------------------------------------------------------------------------
async function build107() {
  const dir = join(FIXTURES, '107-group-key-empty-blank-placeholder-file');
  await mkdir(dir, { recursive: true });

  {
    const wb = new ExcelJS.Workbook();
    addConfig(wb, [
      ['name', 'group-key-blank-file'],
      ['source_sheet', 'Data'],
      ['source_table', '1'],
      ['output_file_pattern', '{{ [Region] }}.xlsx'],
    ]);
    const sh = wb.addWorksheet('Report');
    sh.getCell('A1').value = 'Account';
    sh.getCell('A2').value = '{{ [Account] }}';
    await writeBook(wb, join(dir, 'template.xlsx'));
  }

  {
    const wb = new ExcelJS.Workbook();
    const sh = wb.addWorksheet('Data');
    sh.getCell('A1').value = 'Account'; sh.getCell('B1').value = 'Region';
    sh.getCell('A2').value = 'Acme';   sh.getCell('B2').value = 'Seoul';
    sh.getCell('A3').value = 'Beta';   sh.getCell('B3').value = '';     // empty Region
    sh.getCell('A4').value = 'Coreon'; sh.getCell('B4').value = 'Busan';
    await writeBook(wb, join(dir, 'data.xlsx'));
  }

  // Multi-file expected: files live in `expected/` subdirectory.
  // The conformance runner detects multi-file mode by the directory.
  await mkdir(join(dir, 'expected'), { recursive: true });
  {
    const wb = new ExcelJS.Workbook();
    const sh = wb.addWorksheet('Report');
    sh.getCell('A1').value = 'Account';
    sh.getCell('A2').value = 'Acme';
    await writeBook(wb, join(dir, 'expected', 'Seoul.xlsx'));
  }
  {
    const wb = new ExcelJS.Workbook();
    const sh = wb.addWorksheet('Report');
    sh.getCell('A1').value = 'Account';
    sh.getCell('A2').value = 'Beta';
    await writeBook(wb, join(dir, 'expected', '(blank).xlsx'));
  }
  {
    const wb = new ExcelJS.Workbook();
    const sh = wb.addWorksheet('Report');
    sh.getCell('A1').value = 'Account';
    sh.getCell('A2').value = 'Coreon';
    await writeBook(wb, join(dir, 'expected', 'Busan.xlsx'));
  }
}

// ---------------------------------------------------------------------------
// 108 - group-key-empty-becomes-blank-placeholder-sheet (ADR-0026)
//
// Concept: a sheet-level group key whose value is empty substitutes
// "(blank)" before sheet-name interpolation per ADR-0026. Replaces
// the previous "Sheet" fallback for this case.
// Spec section: ADR-0026 §"Group key value evaluating to empty".
// ---------------------------------------------------------------------------
async function build108() {
  const dir = join(FIXTURES, '108-group-key-empty-blank-placeholder-sheet');
  await mkdir(dir, { recursive: true });

  {
    const wb = new ExcelJS.Workbook();
    addConfig(wb, [
      ['name', 'group-key-blank-sheet'],
      ['source_sheet', 'Data'],
      ['source_table', '1'],
      ['output_file_pattern', 'output.xlsx'],
    ]);
    const sh = wb.addWorksheet('{{ Region }}');
    sh.getCell('A1').value = 'Account';
    sh.getCell('A2').value = '{{ [Account] }}';
    await writeBook(wb, join(dir, 'template.xlsx'));
  }

  {
    const wb = new ExcelJS.Workbook();
    const sh = wb.addWorksheet('Data');
    sh.getCell('A1').value = 'Account'; sh.getCell('B1').value = 'Region';
    sh.getCell('A2').value = 'Acme';   sh.getCell('B2').value = 'Seoul';
    sh.getCell('A3').value = 'Beta';   sh.getCell('B3').value = '';
    sh.getCell('A4').value = 'Coreon'; sh.getCell('B4').value = 'Busan';
    await writeBook(wb, join(dir, 'data.xlsx'));
  }

  // expected: 3 sheets — Seoul, (blank), Busan
  {
    const wb = new ExcelJS.Workbook();
    const seoul = wb.addWorksheet('Seoul');
    seoul.getCell('A1').value = 'Account';
    seoul.getCell('A2').value = 'Acme';
    const blank = wb.addWorksheet('(blank)');
    blank.getCell('A1').value = 'Account';
    blank.getCell('A2').value = 'Beta';
    const busan = wb.addWorksheet('Busan');
    busan.getCell('A1').value = 'Account';
    busan.getCell('A2').value = 'Coreon';
    await writeBook(wb, join(dir, 'expected.xlsx'));
  }
}

// ---------------------------------------------------------------------------
// 104 - multiple-filter-directives-compose-with-and (ADR-0023 / ADR-0025 era)
//
// Concept: two `@filter` directives in the same data block compose
// with AND semantics per language.md "Filter". A row passes only
// when both predicates hold.
// Spec section: language.md "Filter".
// ---------------------------------------------------------------------------
async function build104() {
  const dir = join(FIXTURES, '104-multiple-filter-directives-and');
  await mkdir(dir, { recursive: true });

  {
    const wb = new ExcelJS.Workbook();
    addConfig(wb, [
      ['name', 'multiple-filter-and'],
      ['source_sheet', 'Data'],
      ['source_table', '1'],
      ['output_file_pattern', 'output.xlsx'],
    ]);
    const sh = wb.addWorksheet('Report');
    sh.getCell('A1').value = 'Account';
    sh.getCell('B1').value = 'Region';
    sh.getCell('C1').value = 'Amount';
    sh.getCell('A2').value = '{{ @filter [Region] = "Seoul" }}';
    sh.getCell('A3').value = '{{ @filter [Amount] > 10000 }}';
    sh.getCell('A4').value = '{{ [Account] }}';
    sh.getCell('B4').value = '{{ [Region] }}';
    sh.getCell('C4').value = '{{ [Amount] }}';
    await writeBook(wb, join(dir, 'template.xlsx'));
  }

  {
    const wb = new ExcelJS.Workbook();
    const sh = wb.addWorksheet('Data');
    sh.getCell('A1').value = 'Account'; sh.getCell('B1').value = 'Region'; sh.getCell('C1').value = 'Amount';
    sh.getCell('A2').value = 'Acme';   sh.getCell('B2').value = 'Seoul';  sh.getCell('C2').value = 18400;  // pass: Seoul + > 10000
    sh.getCell('A3').value = 'Beta';   sh.getCell('B3').value = 'Busan';  sh.getCell('C3').value = 22500;  // fail: Busan
    sh.getCell('A4').value = 'Coreon'; sh.getCell('B4').value = 'Seoul';  sh.getCell('C4').value = 5000;   // fail: <= 10000
    sh.getCell('A5').value = 'Delta';  sh.getCell('B5').value = 'Seoul';  sh.getCell('C5').value = 25000;  // pass
    await writeBook(wb, join(dir, 'data.xlsx'));
  }

  {
    const wb = new ExcelJS.Workbook();
    const sh = wb.addWorksheet('Report');
    sh.getCell('A1').value = 'Account'; sh.getCell('B1').value = 'Region'; sh.getCell('C1').value = 'Amount';
    sh.getCell('A2').value = 'Acme';   sh.getCell('B2').value = 'Seoul';  sh.getCell('C2').value = 18400;
    sh.getCell('A3').value = 'Delta';  sh.getCell('B3').value = 'Seoul';  sh.getCell('C3').value = 25000;
    await writeBook(wb, join(dir, 'expected.xlsx'));
  }
}

// ---------------------------------------------------------------------------
// 105 - template-block-whitespace-insignificant (language.md "Template Blocks")
//
// Concept: whitespace immediately inside `{{` and `}}` is
// insignificant. `{{ [name] }}`, `{{[name]}}`, and `{{    [name]    }}`
// all evaluate identically. Inner string-literal whitespace is
// preserved.
// Spec section: language.md "Template Blocks".
// ---------------------------------------------------------------------------
async function build105() {
  const dir = join(FIXTURES, '105-template-block-whitespace-insignificant');
  await mkdir(dir, { recursive: true });

  {
    const wb = new ExcelJS.Workbook();
    addConfig(wb, [
      ['name', 'whitespace-insignificant'],
      ['source_sheet', 'Data'],
      ['source_table', '1'],
      ['output_file_pattern', 'output.xlsx'],
    ]);
    const sh = wb.addWorksheet('Report');
    sh.getCell('A1').value = 'Spaced';
    sh.getCell('B1').value = 'NoSpace';
    sh.getCell('C1').value = 'ExtraSpace';
    sh.getCell('D1').value = 'StringPreserved';
    sh.getCell('A2').value = '{{ [Account] }}';
    sh.getCell('B2').value = '{{[Account]}}';
    sh.getCell('C2').value = '{{    [Account]    }}';
    sh.getCell('D2').value = '{{ "hello world" }}';
    await writeBook(wb, join(dir, 'template.xlsx'));
  }

  {
    const wb = new ExcelJS.Workbook();
    const sh = wb.addWorksheet('Data');
    sh.getCell('A1').value = 'Account';
    sh.getCell('A2').value = 'Acme';
    await writeBook(wb, join(dir, 'data.xlsx'));
  }

  {
    const wb = new ExcelJS.Workbook();
    const sh = wb.addWorksheet('Report');
    sh.getCell('A1').value = 'Spaced';
    sh.getCell('B1').value = 'NoSpace';
    sh.getCell('C1').value = 'ExtraSpace';
    sh.getCell('D1').value = 'StringPreserved';
    sh.getCell('A2').value = 'Acme';
    sh.getCell('B2').value = 'Acme';
    sh.getCell('C2').value = 'Acme';
    sh.getCell('D2').value = 'hello world';
    await writeBook(wb, join(dir, 'expected.xlsx'));
  }
}

// ---------------------------------------------------------------------------
// 106 - division-by-zero-produces-error-cell (ADR-0025)
//
// Concept: division by zero produces an Excel `#DIV/0!` error cell.
// The conformance runner's `comparable()` extracts the error code
// from error cells so Stage 1 can pin the exact error.
// Spec section: ADR-0025.
// ---------------------------------------------------------------------------
async function build106() {
  const dir = join(FIXTURES, '106-division-by-zero-produces-error-cell');
  await mkdir(dir, { recursive: true });

  {
    const wb = new ExcelJS.Workbook();
    addConfig(wb, [
      ['name', 'division-by-zero-error-cell'],
      ['source_sheet', 'Data'],
      ['source_table', '1'],
      ['output_file_pattern', 'output.xlsx'],
    ]);
    const sh = wb.addWorksheet('Report');
    sh.getCell('A1').value = 'Account';
    sh.getCell('B1').value = 'Ratio';
    sh.getCell('A2').value = '{{ [Account] }}';
    sh.getCell('B2').value = '{{ [Numerator] / [Denominator] }}';
    await writeBook(wb, join(dir, 'template.xlsx'));
  }

  {
    const wb = new ExcelJS.Workbook();
    const sh = wb.addWorksheet('Data');
    sh.getCell('A1').value = 'Account';
    sh.getCell('B1').value = 'Numerator';
    sh.getCell('C1').value = 'Denominator';
    sh.getCell('A2').value = 'Acme';   sh.getCell('B2').value = 10; sh.getCell('C2').value = 2;
    sh.getCell('A3').value = 'Beta';   sh.getCell('B3').value = 5;  sh.getCell('C3').value = 0;
    sh.getCell('A4').value = 'Coreon'; sh.getCell('B4').value = 1;  sh.getCell('C4').value = 4;
    await writeBook(wb, join(dir, 'data.xlsx'));
  }

  {
    const wb = new ExcelJS.Workbook();
    const sh = wb.addWorksheet('Report');
    sh.getCell('A1').value = 'Account';
    sh.getCell('B1').value = 'Ratio';
    sh.getCell('A2').value = 'Acme';
    sh.getCell('B2').value = 5;
    sh.getCell('A3').value = 'Beta';
    sh.getCell('B3').value = { error: '#DIV/0!' };
    sh.getCell('A4').value = 'Coreon';
    sh.getCell('B4').value = 0.25;
    await writeBook(wb, join(dir, 'expected.xlsx'));
  }
}

// ---------------------------------------------------------------------------
// 102 - function-arity-round-missing-arg (ADR-0024)
//
// Concept: ROUND requires 2 args (value, places). Calling it with 1
// raises xl3/eval/arity-mismatch at normalize time per ADR-0024.
// Spec section: language.md "Functions" arity table; ADR-0024.
// ---------------------------------------------------------------------------
async function build102() {
  const dir = join(FIXTURES, '102-function-arity-round-missing-arg');
  await mkdir(dir, { recursive: true });

  {
    const wb = new ExcelJS.Workbook();
    addConfig(wb, [
      ['name', 'function-arity-round'],
      ['source_sheet', 'Data'],
      ['source_table', '1'],
      ['output_file_pattern', 'output.xlsx'],
    ]);
    const sh = wb.addWorksheet('Report');
    sh.getCell('A1').value = 'Result';
    sh.getCell('A2').value = '{{ ROUND([Amount]) }}';
    await writeBook(wb, join(dir, 'template.xlsx'));
  }

  {
    const wb = new ExcelJS.Workbook();
    const sh = wb.addWorksheet('Data');
    sh.getCell('A1').value = 'Amount';
    sh.getCell('A2').value = 1.234;
    await writeBook(wb, join(dir, 'data.xlsx'));
  }
}

// ---------------------------------------------------------------------------
// 103 - function-arity-xlookup-too-few-args (ADR-0024)
//
// Concept: XLOOKUP requires 3 or 4 args. With 2 args it raises
// xl3/eval/arity-mismatch.
// Spec section: ADR-0024.
// ---------------------------------------------------------------------------
async function build103() {
  const dir = join(FIXTURES, '103-function-arity-xlookup-too-few-args');
  await mkdir(dir, { recursive: true });

  {
    const wb = new ExcelJS.Workbook();
    addConfig(wb, [
      ['name', 'function-arity-xlookup'],
      ['source_sheet', 'Customers'],
      ['source_table', '1'],
      ['output_file_pattern', 'output.xlsx'],
    ]);
    const sh = wb.addWorksheet('Report');
    sh.getCell('A1').value = 'Result';
    sh.getCell('A2').value = '{{ XLOOKUP("Acme", Customers[Account]) }}';
    await writeBook(wb, join(dir, 'template.xlsx'));
  }

  {
    const wb = new ExcelJS.Workbook();
    const sh = wb.addWorksheet('Customers');
    sh.getCell('A1').value = 'Account';
    sh.getCell('A2').value = 'Acme';
    await writeBook(wb, join(dir, 'data.xlsx'));
  }
}

// ---------------------------------------------------------------------------
// 100 - arithmetic-string-coerces-to-number (ADR-0023)
//
// Concept: arithmetic operators coerce numeric-like strings per ADR-
// 0023's coercion table. `"10" + 5 = 15`, `"1,234" + 1 = 1235`,
// empty cells coerce to 0.
// Spec section: language.md "Arithmetic"; ADR-0023.
// ---------------------------------------------------------------------------
async function build100() {
  const dir = join(FIXTURES, '100-arithmetic-string-coerces-to-number');
  await mkdir(dir, { recursive: true });

  {
    const wb = new ExcelJS.Workbook();
    addConfig(wb, [
      ['name', 'arithmetic-string-coerces'],
      ['source_sheet', 'Data'],
      ['source_table', '1'],
      ['output_file_pattern', 'output.xlsx'],
    ]);
    const sh = wb.addWorksheet('Report');
    sh.getCell('A1').value = 'Label';
    sh.getCell('B1').value = 'Result';
    sh.getCell('A2').value = '{{ [Label] }}';
    sh.getCell('B2').value = '{{ [A] + [B] }}';
    await writeBook(wb, join(dir, 'template.xlsx'));
  }

  {
    const wb = new ExcelJS.Workbook();
    const sh = wb.addWorksheet('Data');
    sh.getCell('A1').value = 'Label';
    sh.getCell('B1').value = 'A';
    sh.getCell('C1').value = 'B';
    sh.getCell('A2').value = 'numbers';        sh.getCell('B2').value = 1;       sh.getCell('C2').value = 2;
    sh.getCell('A3').value = 'string-numeric'; sh.getCell('B3').value = '10';    sh.getCell('C3').value = 5;
    sh.getCell('A4').value = 'thousands-sep';  sh.getCell('B4').value = '1,234'; sh.getCell('C4').value = 1;
    sh.getCell('A5').value = 'empty-coerces';  sh.getCell('B5').value = '';      sh.getCell('C5').value = 5;
    await writeBook(wb, join(dir, 'data.xlsx'));
  }

  {
    const wb = new ExcelJS.Workbook();
    const sh = wb.addWorksheet('Report');
    sh.getCell('A1').value = 'Label';
    sh.getCell('B1').value = 'Result';
    sh.getCell('A2').value = 'numbers';        sh.getCell('B2').value = 3;
    sh.getCell('A3').value = 'string-numeric'; sh.getCell('B3').value = 15;
    sh.getCell('A4').value = 'thousands-sep';  sh.getCell('B4').value = 1235;
    sh.getCell('A5').value = 'empty-coerces';  sh.getCell('B5').value = 5;
    await writeBook(wb, join(dir, 'expected.xlsx'));
  }
}

// ---------------------------------------------------------------------------
// 101 - arithmetic-non-numeric-string-error (ADR-0023)
//
// Concept: an operand that does not coerce to a finite number raises
// xl3/eval/operand-coercion at eval time. Replaces the previous
// silent-zero behavior.
// Spec section: language.md "Arithmetic"; ADR-0023.
// ---------------------------------------------------------------------------
async function build101() {
  const dir = join(FIXTURES, '101-arithmetic-non-numeric-string-error');
  await mkdir(dir, { recursive: true });

  {
    const wb = new ExcelJS.Workbook();
    addConfig(wb, [
      ['name', 'arithmetic-non-numeric-error'],
      ['source_sheet', 'Data'],
      ['source_table', '1'],
      ['output_file_pattern', 'output.xlsx'],
    ]);
    const sh = wb.addWorksheet('Report');
    sh.getCell('A1').value = 'Result';
    sh.getCell('A2').value = '{{ [A] + [B] }}';
    await writeBook(wb, join(dir, 'template.xlsx'));
  }

  {
    const wb = new ExcelJS.Workbook();
    const sh = wb.addWorksheet('Data');
    sh.getCell('A1').value = 'A';
    sh.getCell('B1').value = 'B';
    sh.getCell('A2').value = 'abc';
    sh.getCell('B2').value = 5;
    await writeBook(wb, join(dir, 'data.xlsx'));
  }

  // No expected.xlsx — meta.yaml asserts expected_error.
}

// ---------------------------------------------------------------------------
// 099 - empty-template-block-error (ADR-0021)
//
// Concept: an empty `{{ }}` template block (whitespace-only between
// the delimiters) is a parse error per ADR-0021 "Empty template
// block". Implementations SHOULD raise `xl3/parser/empty-block`.
// Spec section: ADR-0021 "Empty template block".
// ---------------------------------------------------------------------------
async function build099() {
  const dir = join(FIXTURES, '099-empty-template-block-error');
  await mkdir(dir, { recursive: true });

  // template.xlsx — B2 has an empty template block.
  {
    const wb = new ExcelJS.Workbook();
    addConfig(wb, [
      ['name', 'empty-template-block-error'],
      ['source_sheet', 'Data'],
      ['source_table', '1'],
      ['output_file_pattern', 'output.xlsx'],
    ]);
    const sh = wb.addWorksheet('Report');
    sh.getCell('A1').value = 'Account';
    sh.getCell('A2').value = '{{ [Account] }}';
    sh.getCell('B2').value = '{{   }}';
    await writeBook(wb, join(dir, 'template.xlsx'));
  }

  // data.xlsx
  {
    const wb = new ExcelJS.Workbook();
    const sh = wb.addWorksheet('Data');
    sh.getCell('A1').value = 'Account';
    sh.getCell('A2').value = 'Acme';
    await writeBook(wb, join(dir, 'data.xlsx'));
  }

  // No expected.xlsx — meta.yaml asserts expected_error.
}

// ---------------------------------------------------------------------------
// 097 - native-formula-static-cell-preserved (ADR-0021)
//
// Concept: a native Excel formula in a STATIC template cell (not
// inside a data block) is preserved verbatim per ADR-0021 "Native
// Excel formulas in template cells". The cached result must
// round-trip through Stage 1 comparison (which extracts result
// from formula cells via `comparable`).
//
// What this fixture does NOT pin: native formulas INSIDE a data
// block template row. That behavior is intentionally left
// implementation-defined by ADR-0021.
// Spec section: ADR-0021 "Native Excel formulas in template cells".
// ---------------------------------------------------------------------------
async function build097() {
  const dir = join(FIXTURES, '097-native-formula-static-cell-preserved');
  await mkdir(dir, { recursive: true });

  // template.xlsx — header row has a native formula (`=UPPER(A1)`)
  // referencing a fixed cell outside the data block. After data
  // block expansion the formula's range stays unchanged, but the
  // cached result still reads back correctly via comparable().
  {
    const wb = new ExcelJS.Workbook();
    addConfig(wb, [
      ['name', 'native-formula-static-cell-preserved'],
      ['source_sheet', 'Data'],
      ['source_table', '1'],
      ['output_file_pattern', 'output.xlsx'],
    ]);
    const sh = wb.addWorksheet('Report');
    sh.getCell('A1').value = 'header';
    sh.getCell('B1').value = { formula: 'UPPER(A1)', result: 'HEADER' };
    sh.getCell('A2').value = '{{ [Account] }}';
    sh.getCell('A4').value = 'footer';
    sh.getCell('B4').value = { formula: 'LOWER(A4)', result: 'footer' };
    await writeBook(wb, join(dir, 'template.xlsx'));
  }

  // data.xlsx — 2 rows so the data block expands by one (changing
  // row positions for static cells below the block).
  {
    const wb = new ExcelJS.Workbook();
    const sh = wb.addWorksheet('Data');
    sh.getCell('A1').value = 'Account';
    sh.getCell('A2').value = 'Acme';
    sh.getCell('A3').value = 'Beta';
    await writeBook(wb, join(dir, 'data.xlsx'));
  }

  // expected.xlsx — row 1 unchanged. Data rows at row 2-3. Original
  // row 4 footer shifts to row 5. Both formulas preserve their
  // cached results (Stage 1 compares those).
  {
    const wb = new ExcelJS.Workbook();
    const sh = wb.addWorksheet('Report');
    sh.getCell('A1').value = 'header';
    sh.getCell('B1').value = { formula: 'UPPER(A1)', result: 'HEADER' };
    sh.getCell('A2').value = 'Acme';
    sh.getCell('A3').value = 'Beta';
    sh.getCell('A5').value = 'footer';
    sh.getCell('B5').value = { formula: 'LOWER(A4)', result: 'footer' };
    await writeBook(wb, join(dir, 'expected.xlsx'));
  }
}

// ---------------------------------------------------------------------------
// 095 - empty-fefff-not-whitespace (ADR-0007 amendment)
//
// Concept: U+FEFF (zero-width no-break space / BOM) is NOT whitespace
// per ADR-0007. A cell whose value is a single U+FEFF is therefore
// NON-empty; it survives `@filter [field] != ""` and IFEMPTY's
// fallback. ECMAScript's native String.prototype.trim DOES strip
// U+FEFF, so a host-naive trim diverges from the ADR — this fixture
// pins the spec-correct behavior.
// Spec section: ADR-0007 amendment.
// ---------------------------------------------------------------------------
async function build095() {
  const dir = join(FIXTURES, '095-empty-fefff-not-whitespace');
  await mkdir(dir, { recursive: true });

  // template.xlsx — IFEMPTY([Name], "missing"). If U+FEFF is treated
  // as content (per ADR), Acme's row keeps the FEFF; if treated as
  // whitespace (impl bug), it becomes "missing".
  {
    const wb = new ExcelJS.Workbook();
    addConfig(wb, [
      ['name', 'empty-fefff-not-whitespace'],
      ['source_sheet', 'Data'],
      ['source_table', '1'],
      ['output_file_pattern', 'output.xlsx'],
    ]);
    const sh = wb.addWorksheet('Report');
    sh.getCell('A1').value = 'Account';
    sh.getCell('B1').value = 'Resolved';
    sh.getCell('A2').value = '{{ [Account] }}';
    sh.getCell('B2').value = '{{ IFEMPTY([Name], "missing") }}';
    await writeBook(wb, join(dir, 'template.xlsx'));
  }

  // data.xlsx — Acme's Name is U+FEFF; Beta's Name is empty string;
  // Coreon's Name is normal.
  {
    const wb = new ExcelJS.Workbook();
    const sh = wb.addWorksheet('Data');
    sh.getCell('A1').value = 'Account';
    sh.getCell('B1').value = 'Name';
    sh.getCell('A2').value = 'Acme';
    sh.getCell('B2').value = '﻿';
    sh.getCell('A3').value = 'Beta';
    sh.getCell('B3').value = '';
    sh.getCell('A4').value = 'Coreon';
    sh.getCell('B4').value = 'Hana';
    await writeBook(wb, join(dir, 'data.xlsx'));
  }

  // expected.xlsx — Acme keeps the FEFF (NOT empty), Beta gets the
  // fallback "missing", Coreon keeps "Hana".
  {
    const wb = new ExcelJS.Workbook();
    const sh = wb.addWorksheet('Report');
    sh.getCell('A1').value = 'Account';
    sh.getCell('B1').value = 'Resolved';
    sh.getCell('A2').value = 'Acme';
    sh.getCell('B2').value = '﻿';
    sh.getCell('A3').value = 'Beta';
    sh.getCell('B3').value = 'missing';
    sh.getCell('A4').value = 'Coreon';
    sh.getCell('B4').value = 'Hana';
    await writeBook(wb, join(dir, 'expected.xlsx'));
  }
}

// ---------------------------------------------------------------------------
// 094 - reserved-sheet-name-error (ADR-0011)
//
// Concept: an author-created sheet whose name matches the reserved
// dunder pattern `^__[a-z]+__$` (other than the four declared ones)
// is rejected at parse time per ADR-0011.
// Spec section: ADR-0011.
// ---------------------------------------------------------------------------
async function build094() {
  const dir = join(FIXTURES, '094-reserved-sheet-name-error');
  await mkdir(dir, { recursive: true });

  // template.xlsx — author defines a `__custom__` sheet which is
  // reserved by the dunder pattern but not one of the four real
  // reserved sheets.
  {
    const wb = new ExcelJS.Workbook();
    addConfig(wb, [
      ['name', 'reserved-sheet-name-error'],
      ['source_sheet', 'Data'],
      ['source_table', '1'],
      ['output_file_pattern', 'output.xlsx'],
    ]);
    const aux = wb.addWorksheet('__custom__');
    aux.getCell('A1').value = 'should-not-be-allowed';
    const sh = wb.addWorksheet('Report');
    sh.getCell('A1').value = '{{ [Customer] }}';
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

  // No expected.xlsx — meta.yaml asserts expected_error.
}

// ---------------------------------------------------------------------------
// 092 - composed-shape (multi-source + @join + @filter + @sort + XLOOKUP)
//
// Concept: a single fixture exercising the combination shape that
// real reports use — one source iterated, another joined, the active
// block filtered + sorted, plus a separate XLOOKUP and a SUM
// aggregate over the full source row set. Catches regressions where
// individual rules are correct but interact incorrectly.
// Spec section: composes ADR-0012/0013/0014/0016/0017.
// ---------------------------------------------------------------------------
async function build092() {
  const dir = join(FIXTURES, '092-composed-multi-source-join-filter-sort');
  await mkdir(dir, { recursive: true });

  // template.xlsx
  {
    const wb = new ExcelJS.Workbook();
    addConfig(wb, [
      ['name', 'composed-multi-source'],
      ['source_sheet', 'Renewals'],
      ['source_table', '1'],
      ['output_file_pattern', 'composed.xlsx'],
    ]);
    addSources(wb, [
      { name: 'Renewals', sheet: 'Renewals', table: '1' },
      { name: 'Customers', sheet: 'Customers', table: '1' },
    ]);
    const sh = wb.addWorksheet('Report');
    // Static header row also carries a static-cell XLOOKUP and a
    // cross-source SUM, so the fixture exercises both row-context
    // joined references AND static-context cross-source aggregates
    // and lookups in one template.
    sh.getCell('A1').value = 'Account';
    sh.getCell('B1').value = 'Owner';
    sh.getCell('C1').value = 'Region';
    sh.getCell('D1').value = 'Amount';
    sh.getCell('E1').value = 'Tier';
    sh.getCell('F1').value = '{{ SUM(Renewals[Amount]) }}';
    sh.getCell('G1').value = '{{ XLOOKUP("Coreon", Customers[Account], Customers[Owner], "(unknown)") }}';
    sh.getCell('A2').value = '{{ @source Renewals }}';
    sh.getCell('A3').value = '{{ @join Customers on Customers[Account] = Renewals[Account] }}';
    sh.getCell('A4').value = '{{ @filter [Amount] > 5000 }}';
    sh.getCell('A5').value = '{{ @sort [Amount] desc }}';
    sh.getCell('A6').value = '{{ Renewals[Account] }}';
    sh.getCell('B6').value = '{{ Customers[Owner] }}';
    sh.getCell('C6').value = '{{ Customers[Region] }}';
    sh.getCell('D6').value = '{{ Renewals[Amount] }}';
    sh.getCell('E6').value = '{{ IF(Renewals[Amount] > 15000, "Priority", "Standard") }}';
    await writeBook(wb, join(dir, 'template.xlsx'));
  }

  // data.xlsx
  {
    const wb = new ExcelJS.Workbook();
    const cust = wb.addWorksheet('Customers');
    cust.getCell('A1').value = 'Account';
    cust.getCell('B1').value = 'Owner';
    cust.getCell('C1').value = 'Region';
    [
      ['Acme', 'Mina', 'Seoul'],
      ['Beta', 'Joon', 'Busan'],
      ['Coreon', 'Hana', 'Seoul'],
      ['Delta', 'Sora', 'Daegu'],
    ].forEach(([a, o, r], i) => {
      cust.getCell(`A${i + 2}`).value = a;
      cust.getCell(`B${i + 2}`).value = o;
      cust.getCell(`C${i + 2}`).value = r;
    });

    const ren = wb.addWorksheet('Renewals');
    ren.getCell('A1').value = 'Account';
    ren.getCell('B1').value = 'Amount';
    [
      ['Acme', 18400],
      ['Beta', 7200],
      ['Coreon', 22500],
      ['Delta', 4900],     // filtered out by Amount > 5000
      ['Foxtrot', 9000],   // dropped by inner join (no Foxtrot in Customers)
    ].forEach(([a, am], i) => {
      ren.getCell(`A${i + 2}`).value = a;
      ren.getCell(`B${i + 2}`).value = am;
    });

    await writeBook(wb, join(dir, 'data.xlsx'));
  }

  // expected.xlsx — after @join (drops Foxtrot) + @filter (drops
  // Delta) + @sort desc: Coreon 22500, Acme 18400, Beta 7200.
  // SUM(Renewals[Amount]) at F1 = 18400+7200+22500+4900+9000 = 62000
  // XLOOKUP("Coreon", …) at G1 = "Hana"
  {
    const wb = new ExcelJS.Workbook();
    const sh = wb.addWorksheet('Report');
    sh.getCell('A1').value = 'Account';
    sh.getCell('B1').value = 'Owner';
    sh.getCell('C1').value = 'Region';
    sh.getCell('D1').value = 'Amount';
    sh.getCell('E1').value = 'Tier';
    sh.getCell('F1').value = 62000;
    sh.getCell('G1').value = 'Hana';
    sh.getCell('A2').value = 'Coreon';
    sh.getCell('B2').value = 'Hana';
    sh.getCell('C2').value = 'Seoul';
    sh.getCell('D2').value = 22500;
    sh.getCell('E2').value = 'Priority';
    sh.getCell('A3').value = 'Acme';
    sh.getCell('B3').value = 'Mina';
    sh.getCell('C3').value = 'Seoul';
    sh.getCell('D3').value = 18400;
    sh.getCell('E3').value = 'Priority';
    sh.getCell('A4').value = 'Beta';
    sh.getCell('B4').value = 'Joon';
    sh.getCell('C4').value = 'Busan';
    sh.getCell('D4').value = 7200;
    sh.getCell('E4').value = 'Standard';
    await writeBook(wb, join(dir, 'expected.xlsx'));
  }
}

// ---------------------------------------------------------------------------
// 091 - source-unknown-column-error
//
// Concept: a Source[Column] reference where the column is not declared
// in that source's headers is an error per ADR-0017. Catches typos like
// `Renewals[Amout]` instead of silently aggregating to 0 / blank.
// Spec section: evaluation.md "External Data Sources"; ADR-0012/0017.
// ---------------------------------------------------------------------------
async function build091() {
  const dir = join(FIXTURES, '091-source-unknown-column-error');
  await mkdir(dir, { recursive: true });

  // template.xlsx — `Renewals[Amout]` (typo) inside SUM aggregate.
  {
    const wb = new ExcelJS.Workbook();
    addConfig(wb, [
      ['name', 'source-unknown-column-error'],
      ['source_sheet', 'Customers'],
      ['source_table', '1'],
      ['output_file_pattern', 'output.xlsx'],
    ]);
    addSources(wb, [
      { name: 'Renewals', sheet: 'Renewals', table: '1' },
    ]);
    const sh = wb.addWorksheet('Report');
    sh.getCell('A1').value = 'Total';
    sh.getCell('A2').value = '{{ SUM(Renewals[Amout]) }}';
    await writeBook(wb, join(dir, 'template.xlsx'));
  }

  // data.xlsx — Renewals has Account/Amount, NOT Amout.
  {
    const wb = new ExcelJS.Workbook();
    const cust = wb.addWorksheet('Customers');
    cust.getCell('A1').value = 'Customer';
    cust.getCell('A2').value = 'Acme';
    const ren = wb.addWorksheet('Renewals');
    ren.getCell('A1').value = 'Account';
    ren.getCell('B1').value = 'Amount';
    ren.getCell('A2').value = 'Acme';
    ren.getCell('B2').value = 100;
    await writeBook(wb, join(dir, 'data.xlsx'));
  }

  // No expected.xlsx — meta.yaml asserts expected_error.
}

// ---------------------------------------------------------------------------
// 093 - stage2-excel-authored-expected (scaffold; pending)
//
// Concept: Stage 2 canonicalization is meant to compare semantically
// equivalent OOXML across writers (ExcelJS, Microsoft Excel,
// LibreOffice). Today every Stage 2 fixture's `expected.xlsx` is
// also written by ExcelJS, so the cross-writer claim is not actually
// tested. This fixture scaffolds the workflow:
//
//   1. The build script produces `template.xlsx` and `data.xlsx`.
//   2. It runs the engine and writes the engine's output as
//      `expected-engine.xlsx` (committed as a transparent baseline).
//   3. To upgrade this to a true cross-writer test, a maintainer
//      opens `expected-engine.xlsx` in Microsoft Excel (or
//      LibreOffice) and saves it as `expected.xlsx`. Then the
//      `skip_reason` is removed from meta.yaml.
//
// Until step 3 lands, the fixture is skipped by the runner; running
// it is non-fatal but produces no signal. ADR-0006 amendment lists
// the gap items (default-attribute equivalence, color hex case,
// namespace prefix bindings) that this fixture is expected to
// surface once exercised.
// ---------------------------------------------------------------------------
async function build093() {
  const dir = join(FIXTURES, '093-stage2-excel-authored-expected');
  await mkdir(dir, { recursive: true });

  // template.xlsx — exercises styles + merges + a numFmt-formatted
  // numeric cell so cross-writer drift has surface area to hit.
  {
    const wb = new ExcelJS.Workbook();
    addConfig(wb, [
      ['name', 'stage2-excel-authored-expected'],
      ['source_sheet', 'Data'],
      ['source_table', '1'],
      ['output_file_pattern', 'output.xlsx'],
    ]);
    const sh = wb.addWorksheet('Report');
    sh.getCell('A1').value = 'Quarterly summary';
    sh.mergeCells('A1:C1');
    sh.getCell('A1').font = { bold: true, size: 14 };
    sh.getCell('A1').alignment = { horizontal: 'center' };
    sh.getCell('A3').value = 'Account';
    sh.getCell('B3').value = 'Amount';
    sh.getCell('C3').value = 'Tier';
    sh.getRow(3).font = { bold: true };
    sh.getCell('A4').value = '{{ [Account] }}';
    sh.getCell('B4').value = '{{ [Amount] }}';
    sh.getCell('B4').numFmt = '#,##0';
    sh.getCell('C4').value = '{{ IF([Amount] > 10000, "Priority", "Standard") }}';
    await writeBook(wb, join(dir, 'template.xlsx'));
  }

  // data.xlsx
  {
    const wb = new ExcelJS.Workbook();
    const sh = wb.addWorksheet('Data');
    sh.getCell('A1').value = 'Account';
    sh.getCell('B1').value = 'Amount';
    [
      ['Acme', 18400],
      ['Beta', 7200],
      ['Coreon', 22500],
    ].forEach(([a, am], i) => {
      sh.getCell(`A${i + 2}`).value = a;
      sh.getCell(`B${i + 2}`).value = am;
    });
    await writeBook(wb, join(dir, 'data.xlsx'));
  }

  // The fixture's expected.xlsx is intentionally NOT generated here.
  // A maintainer supplies a real Excel-authored file (see README in
  // the fixture directory). The build script does not overwrite it.
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
  ['028', build028],
  ['029', build029],
  ['030', build030],
  ['031', build031],
  ['032', build032],
  ['033', build033],
  ['034', build034],
  ['035', build035],
  ['036', build036],
  ['037', build037],
  ['038', build038],
  ['039', build039],
  ['040', build040],
  ['041', build041],
  ['042', build042],
  ['043', build043],
  ['044', build044],
  ['045', build045],
  ['046', build046],
  ['047', build047],
  ['048', build048],
  ['049', build049],
  ['050', build050],
  ['051', build051],
  ['052', build052],
  ['053', build053],
  ['054', build054],
  ['055', build055],
  ['056', build056],
  ['057', build057],
  ['058', build058],
  ['059', build059],
  ['060', build060],
  ['061', build061],
  ['062', build062],
  ['063', build063],
  ['064', build064],
  ['065', build065],
  ['066', build066],
  ['067', build067],
  ['068', build068],
  ['069', build069],
  ['070', build070],
  ['071', build071],
  ['072', build072],
  ['073', build073],
  ['074', build074],
  ['075', build075],
  ['076', build076],
  ['077', build077],
  ['078', build078],
  ['079', build079],
  ['080', build080],
  ['081', build081],
  ['082', build082],
  ['083', build083],
  ['084', build084],
  ['085', build085],
  ['086', build086],
  ['087', build087],
  ['088', build088],
  ['089', build089],
  ['090', build090],
  ['091', build091],
  ['092', build092],
  ['093', build093],
  ['094', build094],
  ['095', build095],
  ['096', build096],
  ['097', build097],
  ['099', build099],
  ['100', build100],
  ['101', build101],
  ['102', build102],
  ['103', build103],
  ['104', build104],
  ['105', build105],
  ['106', build106],
  ['107', build107],
  ['108', build108],
  ['109', build109],
  ['110', build110],
  ['111', build111],
  ['112', build112],
  ['113', build113],
  ['114', build114],
  ['115', build115],
  ['116', build116],
  ['117', build117],
  ['118', build118],
  ['119', build119],
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
