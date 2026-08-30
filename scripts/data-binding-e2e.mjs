#!/usr/bin/env node

// 1.0 core workflow: application-owned JavaScript data -> Excel template ->
// downloadable .xlsx. Exercise the exact same object input in Node and a real
// Chromium page, then reopen both generated workbooks and assert their values.

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import ExcelJS from 'exceljs';
import { chromium } from 'playwright';
import { convertJson } from '../impl/js/dist/index.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..');
const TEMPLATE = join(REPO, 'conformance', 'fixtures', '001-bracket-substitution', 'template.xlsx');
const BUNDLE = join(REPO, 'impl', 'js', 'dist', 'xl3.bundle.iife.min.js');

const source = {
  version: 'xl3-source-json/0.1',
  sources: {
    default: {
      headers: ['Customer'],
      rows: [['Acme'], ['Beta']],
    },
  },
};

function toArrayBuffer(buffer) {
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
}

async function assertWorkbook(data, label) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(data);
  const sheet = workbook.getWorksheet('Report');
  assert.ok(sheet, `${label}: Report sheet is missing`);
  assert.equal(sheet.getCell('A1').value, 'Customer', `${label}: header changed`);
  assert.equal(sheet.getCell('A2').value, 'Acme', `${label}: first row was not bound`);
  assert.equal(sheet.getCell('A3').value, 'Beta', `${label}: second row was not bound`);
}

const templateBytes = await readFile(TEMPLATE);
const template = toArrayBuffer(templateBytes);

const nodeOutputs = await convertJson(template.slice(0), source);
assert.equal(nodeOutputs.length, 1, 'Node: expected exactly one output workbook');
assert.equal(nodeOutputs[0].filename, 'output.xlsx', 'Node: output filename changed');
assert.ok(nodeOutputs[0].data instanceof Uint8Array, 'Node: output is not a Uint8Array');
await assertWorkbook(nodeOutputs[0].data, 'Node');
console.log('PASS Node object data -> template -> .xlsx Uint8Array');

const browser = await chromium.launch();
try {
  const context = await browser.newContext({ acceptDownloads: true });
  const page = await context.newPage();
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(String(error)));

  await page.setContent('<!doctype html><button id="export">Export workbook</button>');
  await page.addScriptTag({ path: BUNDLE });
  await page.evaluate(
    ({ templateArray, objectSource }) => {
      const button = globalThis.document.querySelector('#export');
      button.addEventListener('click', async () => {
        const templateBuffer = new Uint8Array(templateArray).buffer;
        const outputs = await globalThis.xl3.convertJson(templateBuffer, objectSource);
        const output = outputs[0];
        globalThis.__xl3DataBindingResult = {
          count: outputs.length,
          filename: output.filename,
          isUint8Array: output.data instanceof Uint8Array,
        };

        const blob = new Blob([output.data], {
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        });
        const url = URL.createObjectURL(blob);
        const link = globalThis.document.createElement('a');
        link.href = url;
        link.download = output.filename;
        globalThis.document.body.append(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
      });
    },
    { templateArray: [...templateBytes], objectSource: source },
  );

  const downloadPromise = page.waitForEvent('download');
  await page.locator('#export').click();
  const download = await downloadPromise;
  const result = await page.evaluate(() => globalThis.__xl3DataBindingResult);
  assert.deepEqual(result, {
    count: 1,
    filename: 'output.xlsx',
    isUint8Array: true,
  });
  assert.equal(download.suggestedFilename(), 'output.xlsx');

  const downloadPath = await download.path();
  assert.ok(downloadPath, 'Chromium: download has no local path');
  const downloaded = await readFile(downloadPath);
  assert.equal(downloaded[0], 0x50, 'Chromium: output is not an xlsx zip');
  assert.equal(downloaded[1], 0x4b, 'Chromium: output is not an xlsx zip');
  await assertWorkbook(toArrayBuffer(downloaded), 'Chromium');
  assert.deepEqual(pageErrors, [], `Chromium page errors: ${pageErrors.join(' | ')}`);
  await context.close();
  console.log('PASS Chromium object data -> template -> downloaded .xlsx');
} finally {
  await browser.close();
}
