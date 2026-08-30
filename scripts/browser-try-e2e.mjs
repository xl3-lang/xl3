#!/usr/bin/env node

// End-to-end coverage for the actual /try page. browser-smoke.mjs exercises
// the standalone IIFE bundle; this script serves the built Docusaurus site,
// drives the React form, verifies a real download, and checks that an initial
// sample with __inputs__ declarations is loaded before the user picks a file.

import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { dirname, extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..');
const BUILD = join(REPO, 'website', 'build');
const INPUT_FIXTURE = join(REPO, 'conformance', 'fixtures', '065-input-text-default-applied');

const MIME = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

let useInputFixtureAsSample = false;

async function staticFileFor(pathname) {
  if (useInputFixtureAsSample) {
    if (pathname === '/playground-samples/sample-template.xlsx') {
      return join(INPUT_FIXTURE, 'template.xlsx');
    }
    if (pathname === '/playground-samples/sample-raw.xlsx') {
      return join(INPUT_FIXTURE, 'data.xlsx');
    }
  }

  const candidate = resolve(BUILD, `.${pathname}`);
  if (candidate !== BUILD && !candidate.startsWith(`${BUILD}${sep}`)) return null;

  try {
    const info = await stat(candidate);
    if (info.isDirectory()) return join(candidate, 'index.html');
    return candidate;
  } catch {
    if (!extname(candidate)) {
      try {
        await stat(`${candidate}.html`);
        return `${candidate}.html`;
      } catch {
        return null;
      }
    }
    return null;
  }
}

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url ?? '/', 'http://127.0.0.1');
    const file = await staticFileFor(decodeURIComponent(url.pathname));
    if (!file) {
      response.writeHead(404).end('not found');
      return;
    }
    const body = await readFile(file);
    response.writeHead(200, {
      'cache-control': 'no-store',
      'content-type': MIME[extname(file)] ?? 'application/octet-stream',
    });
    response.end(body);
  } catch (error) {
    response.writeHead(500).end(String(error));
  }
});

await new Promise((resolveListen, reject) => {
  server.once('error', reject);
  server.listen(0, '127.0.0.1', resolveListen);
});

const address = server.address();
if (!address || typeof address === 'string') throw new Error('could not bind test server');
const baseUrl = `http://127.0.0.1:${address.port}`;
const browser = await chromium.launch();

try {
  const context = await browser.newContext({ acceptDownloads: true });
  const page = await context.newPage();
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(String(error)));

  await page.goto(`${baseUrl}/try`, { waitUntil: 'networkidle' });
  const submit = page.getByRole('button', { name: 'Run and download' });
  await submit.waitFor({ state: 'visible' });

  const downloadPromise = page.waitForEvent('download');
  await submit.click();
  const download = await downloadPromise;
  const downloadPath = await download.path();
  if (!downloadPath) throw new Error('sample conversion download has no local path');
  const bytes = await readFile(downloadPath);
  if (download.suggestedFilename() !== 'customer-renewal-report.xlsx') {
    throw new Error(`unexpected sample filename: ${download.suggestedFilename()}`);
  }
  if (bytes[0] !== 0x50 || bytes[1] !== 0x4b) {
    throw new Error('sample conversion output is not an xlsx zip');
  }
  await page.getByText('customer-renewal-report.xlsx', { exact: true }).waitFor();
  await context.close();

  // Test the initial-sample path, not only the file-upload path. The server
  // overlays fixture 065 at the sample URLs so the page must discover its
  // declared input while templateFile is still null.
  useInputFixtureAsSample = true;
  const inputContext = await browser.newContext();
  const inputPage = await inputContext.newPage();
  inputPage.on('pageerror', (error) => pageErrors.push(String(error)));
  await inputPage.goto(`${baseUrl}/try`, { waitUntil: 'networkidle' });
  const month = inputPage.locator('#xl3-input-month');
  await month.waitFor({ state: 'visible' });
  if ((await month.inputValue()) !== '2026-05') {
    throw new Error(`sample input default was not loaded: ${await month.inputValue()}`);
  }
  await inputContext.close();

  if (pageErrors.length > 0) {
    throw new Error(`page errors: ${pageErrors.join(' | ')}`);
  }
  console.log('PASS /try sample conversion downloads a valid workbook');
  console.log('PASS /try initial sample loads __inputs__ defaults');
} finally {
  await browser.close();
  await new Promise((resolveClose, reject) => {
    server.close((error) => (error ? reject(error) : resolveClose()));
  });
}
