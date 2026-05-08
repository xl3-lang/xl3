#!/usr/bin/env node
// Run convert() against every example template+data pair and report
// the result. Used by `npm run examples:run` and the corresponding
// vitest test so a regression in any composed shape fails CI.

import { readFile } from 'node:fs/promises';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { convert } from '../../dist/index.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');

// 03 declares an `__inputs__` requirement; supply a default for it.
const INPUTS_BY_EXAMPLE = {
  '03-multi-source-join': { month: '2026-05' },
};

const failures = [];
const successes = [];

for (const entry of readdirSync(ROOT).sort()) {
  const dir = join(ROOT, entry);
  if (!statSync(dir).isDirectory()) continue;
  if (entry === 'scripts') continue;
  const tpl = join(dir, 'template.xlsx');
  const data = join(dir, 'data.xlsx');
  if (!existsSync(tpl) || !existsSync(data)) continue;

  try {
    const tplBuf = await readFile(tpl);
    const dataBuf = await readFile(data);
    const inputs = INPUTS_BY_EXAMPLE[entry];
    const out = await convert(toAB(tplBuf), toAB(dataBuf), inputs ? { inputs } : undefined);
    if (out.length === 0) {
      failures.push(`${entry}: produced 0 output files`);
    } else {
      successes.push(`${entry}: ${out.length} file(s) — ${out.map((f) => f.filename).join(', ')}`);
    }
  } catch (e) {
    failures.push(`${entry}: ${e.code ?? '(no code)'} ${e.message}`);
  }
}

for (const line of successes) console.log('  PASS  ' + line);
for (const line of failures) console.log('  FAIL  ' + line);
console.log(`${successes.length}/${successes.length + failures.length} examples ran`);
if (failures.length > 0) process.exit(1);

function toAB(buf) {
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
}
