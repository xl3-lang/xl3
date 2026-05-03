// Authoring-time verifier (NOT the conformance runner).
//
// For each fixture, runs the reference impl on (template.xlsx, data.xlsx)
// and compares the resulting output against expected.xlsx using cell-value
// equality (not byte-equality; canonical OOXML comparison is the runner's job).
//
// Per AUTHORING.md step 4: if the impl disagrees with the hand-authored
// expected, do NOT change the expected. Investigate.

import ExcelJS from 'exceljs';
import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { convert } from '../../dist/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(__dirname, '..', 'fixtures');

const entries = await readdir(FIXTURES, { withFileTypes: true });
const cases = entries
  .filter((e) => e.isDirectory())
  .map((e) => e.name)
  .sort();

function cellValToComparable(v) {
  if (v === null || v === undefined) return null;
  if (typeof v === 'object' && 'richText' in v) {
    return v.richText.map((r) => r.text).join('');
  }
  if (typeof v === 'object' && 'result' in v) return v.result ?? null;
  if (v instanceof Date) return v.toISOString();
  return v;
}

async function loadCells(buf) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf);
  const sheets = {};
  for (const ws of wb.worksheets) {
    if (ws.name === '_config') continue;
    if (ws.name.startsWith('_')) continue;
    const cells = {};
    ws.eachRow({ includeEmpty: false }, (row, r) => {
      row.eachCell({ includeEmpty: false }, (cell, c) => {
        cells[`${ws.name}!${r},${c}`] = cellValToComparable(cell.value);
      });
    });
    sheets[ws.name] = cells;
  }
  return sheets;
}

let pass = 0, fail = 0;
for (const name of cases) {
  const dir = join(FIXTURES, name);
  const tmpl = await readFile(join(dir, 'template.xlsx'));
  const data = await readFile(join(dir, 'data.xlsx'));
  const expected = await readFile(join(dir, 'expected.xlsx'));

  const out = await convert(tmpl.buffer, data.buffer);
  if (out.length !== 1) {
    console.error(`${name}: expected single output, got ${out.length}`);
    fail++;
    continue;
  }

  const actualCells = await loadCells(out[0].data);
  const expectedCells = await loadCells(expected);

  const diffs = [];
  const allKeys = new Set([
    ...Object.keys(actualCells),
    ...Object.keys(expectedCells),
  ]);
  for (const sheet of allKeys) {
    const a = actualCells[sheet] ?? {};
    const e = expectedCells[sheet] ?? {};
    const cellKeys = new Set([...Object.keys(a), ...Object.keys(e)]);
    for (const k of cellKeys) {
      if (a[k] !== e[k]) {
        diffs.push(`${k}: actual=${JSON.stringify(a[k])}, expected=${JSON.stringify(e[k])}`);
      }
    }
  }

  if (diffs.length === 0) {
    console.log(`PASS  ${name}`);
    pass++;
  } else {
    console.log(`FAIL  ${name}`);
    for (const d of diffs) console.log('       ' + d);
    fail++;
  }
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
