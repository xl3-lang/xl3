#!/usr/bin/env node
// Run convert() against every production-shaped example and verify its
// declared output contract. Conformance fixtures isolate individual rules;
// this operational corpus pins composed workbook behavior: filenames, sheet
// structure, merges, ordering, derived values, and totals.

import { readFile } from 'node:fs/promises';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { convert, preview, validateSource } from '@xl3-lang/xl3';
import ExcelJS from 'exceljs';

const HERE = dirname(fileURLToPath(import.meta.url));
if (process.argv.length > 3) {
  throw new Error('usage: run-all.mjs [corpus-directory]');
}
const ROOT = process.argv[2] ? resolve(process.argv[2]) : join(HERE, '..');
const manifest = JSON.parse(await readFile(join(ROOT, 'expected-output.json'), 'utf8'));

if (manifest.version !== 'xl3-operational-regression/0.1') {
  throw new Error(`unsupported operational manifest version: ${String(manifest.version)}`);
}

const failures = [];
const successes = [];
const discovered = readdirSync(ROOT)
  .filter((entry) => {
    const dir = join(ROOT, entry);
    return (
      statSync(dir).isDirectory() &&
      entry !== 'scripts' &&
      existsSync(join(dir, 'template.xlsx')) &&
      existsSync(join(dir, 'data.xlsx'))
    );
  })
  .sort();
const declared = Object.keys(manifest.cases).sort();

if (JSON.stringify(discovered) !== JSON.stringify(declared)) {
  failures.push(
    `manifest coverage: discovered ${JSON.stringify(discovered)}, declared ${JSON.stringify(declared)}`,
  );
}

for (const entry of declared) {
  const dir = join(ROOT, entry);
  const tpl = join(dir, 'template.xlsx');
  const data = join(dir, 'data.xlsx');
  const expected = manifest.cases[entry];

  try {
    const tplBuf = await readFile(tpl);
    const dataBuf = await readFile(data);
    const options = expected.inputs ? { inputs: expected.inputs } : undefined;
    // Keep these sequential: a private production corpus can contain large
    // workbooks, and parsing four copies concurrently would multiply peak RSS.
    const schemaValidation = await validateSource(toAB(tplBuf), toAB(dataBuf), {
      depth: 'schema',
    });
    const fullValidation = await validateSource(toAB(tplBuf), toAB(dataBuf), { depth: 'full' });
    const planned = await preview(toAB(tplBuf), toAB(dataBuf), options);
    const out = await convert(toAB(tplBuf), toAB(dataBuf), options);
    assertValidation(schemaValidation, `${entry}: schema preflight`);
    assertValidation(fullValidation, `${entry}: full preflight`);
    assertEqual(planned.files.length, expected.outputs.length, `${entry}: preview file count`);
    assertEqual(out.length, expected.outputs.length, `${entry}: output file count`);

    let assertedCells = 0;
    let assertedSheets = 0;
    for (let i = 0; i < expected.outputs.length; i++) {
      const expectedOutput = expected.outputs[i];
      const actualOutput = out[i];
      const previewOutput = planned.files[i];
      assertFilename(actualOutput.filename, expectedOutput, `${entry}: output ${i + 1}`);
      assertFilename(previewOutput.filename, expectedOutput, `${entry}: preview ${i + 1}`);
      assertEqual(
        previewOutput.sheets.map((sheet) => sheet.name),
        expectedOutput.sheets.map((sheet) => sheet.name),
        `${entry}: preview sheet names`,
      );

      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(actualOutput.data);
      const actualSheetNames = workbook.worksheets.map((sheet) => sheet.name);
      const expectedSheetNames = expectedOutput.sheets.map((sheet) => sheet.name);
      assertEqual(actualSheetNames, expectedSheetNames, `${entry}: sheet names`);

      for (const expectedSheet of expectedOutput.sheets) {
        const sheet = workbook.getWorksheet(expectedSheet.name);
        if (!sheet) throw new Error(`${entry}: missing sheet ${expectedSheet.name}`);
        assertEqual(sheet.rowCount, expectedSheet.rowCount, `${entry}/${sheet.name}: row count`);
        assertEqual(
          [...sheet.model.merges].sort(),
          [...expectedSheet.merges].sort(),
          `${entry}/${sheet.name}: merges`,
        );

        for (const [address, expectedValue] of Object.entries(expectedSheet.cells)) {
          const actualValue = comparableCellValue(sheet.getCell(address).value);
          assertEqual(actualValue, expectedValue, `${entry}/${sheet.name}!${address}`);
          assertedCells += 1;
        }
        assertedSheets += 1;
      }
    }

    successes.push(
      `${entry}: schema/full/preview/convert, ${out.length} file(s), ${assertedSheets} sheet(s), ${assertedCells} cell assertion(s)`,
    );
  } catch (e) {
    failures.push(`${entry}: ${e.code ?? '(no code)'} ${e.message}`);
  }
}

for (const line of successes) console.log('  PASS  ' + line);
for (const line of failures) console.log('  FAIL  ' + line);
console.log(`${successes.length}/${declared.length} operational workbook cases passed`);
if (failures.length > 0) process.exit(1);

function toAB(buf) {
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
}

function assertFilename(actual, expected, label) {
  if (expected.filename !== undefined) {
    assertEqual(actual, expected.filename, `${label}: filename`);
    return;
  }
  if (expected.filenamePattern === undefined) {
    throw new Error(`${label}: expected filename or filenamePattern`);
  }
  if (!new RegExp(expected.filenamePattern).test(actual)) {
    throw new Error(
      `${label}: filename expected /${expected.filenamePattern}/, received ${JSON.stringify(actual)}`,
    );
  }
}

function assertValidation(report, label) {
  if (!report.ok) {
    throw new Error(`${label}: ${JSON.stringify(report.diagnostics)}`);
  }
}

function comparableCellValue(value) {
  if (value instanceof Date) return value.toISOString();
  if (value && typeof value === 'object') {
    if ('result' in value) return comparableCellValue(value.result);
    if ('richText' in value) return value.richText.map((part) => part.text).join('');
    if ('text' in value) return value.text;
  }
  return value;
}

function assertEqual(actual, expected, label) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      `${label}: expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`,
    );
  }
}
