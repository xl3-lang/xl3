#!/usr/bin/env node

// Verify the artifact users actually install, not the workspace source tree.
// Packs the npm workspace, installs the tarball into an isolated temporary
// consumer, type-checks its public declarations, imports it, and renders an
// .xlsx from an in-memory JavaScript object.

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..');
const TEMPLATE = join(REPO, 'conformance', 'fixtures', '001-bracket-substitution', 'template.xlsx');
const temp = await mkdtemp(join(tmpdir(), 'xl3-package-smoke-'));

function run(command, args, cwd) {
  return execFileSync(command, args, {
    cwd,
    env: { ...process.env, npm_config_cache: join(temp, '.npm-cache') },
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

try {
  const packed = JSON.parse(
    run(
      'npm',
      ['pack', '--workspace', '@xl3-lang/xl3', '--json', '--pack-destination', temp],
      REPO,
    ),
  )[0];
  assert.ok(packed?.filename, 'npm pack did not report a tarball');

  const included = new Set(packed.files.map((file) => file.path));
  for (const required of [
    'package.json',
    'README.md',
    'LICENSE',
    'dist/index.js',
    'dist/index.d.ts',
    'dist/bin/xl3.js',
    'dist/bin/conformance.js',
    'dist/xl3.bundle.iife.min.js',
  ]) {
    assert.ok(included.has(required), `packed artifact is missing ${required}`);
  }
  for (const path of included) {
    assert.ok(!path.includes('/__tests__/'), `packed artifact leaked a test: ${path}`);
    assert.ok(!path.startsWith('src/'), `packed artifact leaked source: ${path}`);
    assert.ok(!path.endsWith('.map'), `packed artifact leaked a source map: ${path}`);
  }

  const consumer = join(temp, 'consumer');
  await mkdir(consumer);
  await writeFile(
    join(consumer, 'package.json'),
    `${JSON.stringify({ name: 'xl3-package-smoke-consumer', private: true, type: 'module' }, null, 2)}\n`,
  );
  const tarball = join(temp, packed.filename);
  run(
    'npm',
    [
      'install',
      '--ignore-scripts',
      '--no-audit',
      '--no-fund',
      '--no-package-lock',
      tarball,
      '@types/node@^24.0.0',
    ],
    consumer,
  );

  await writeFile(
    join(consumer, 'consumer.ts'),
    `import { convertJson, type OutputFile, type Xl3SourceJson } from '@xl3-lang/xl3';

declare const template: ArrayBuffer;
const source: Xl3SourceJson = {
  version: 'xl3-source-json/0.1',
  sources: { default: { headers: ['Customer'], rows: [['Acme']] } },
};
const outputs: OutputFile[] = await convertJson(template, source);
const outputBytes: Uint8Array = outputs[0].data;
const browserDownload = new Blob([outputs[0].data]);
void browserDownload;
void outputBytes;
void outputs;
`,
  );
  await writeFile(
    join(consumer, 'tsconfig.json'),
    `${JSON.stringify(
      {
        compilerOptions: {
          target: 'ES2022',
          module: 'NodeNext',
          moduleResolution: 'NodeNext',
          strict: true,
          noEmit: true,
          lib: ['ES2022', 'DOM'],
          types: ['node'],
        },
        include: ['consumer.ts'],
      },
      null,
      2,
    )}\n`,
  );
  run(join(REPO, 'node_modules', '.bin', 'tsc'), ['-p', 'tsconfig.json'], consumer);

  await writeFile(
    join(consumer, 'consumer.mjs'),
    `import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { VERSION, convertJson } from '@xl3-lang/xl3';

const bytes = await readFile(process.argv[2]);
const template = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
const outputs = await convertJson(template, {
  version: 'xl3-source-json/0.1',
  sources: {
    default: { headers: ['Customer'], rows: [['Acme'], ['Beta']] },
  },
});
assert.equal(outputs.length, 1);
assert.equal(outputs[0].filename, 'output.xlsx');
assert.ok(outputs[0].data instanceof Uint8Array);
const output = outputs[0].data;
assert.equal(output[0], 0x50);
assert.equal(output[1], 0x4b);
await writeFile(outputs[0].filename, output);
console.log(JSON.stringify({ version: VERSION, filename: outputs[0].filename, bytes: output.length }));
`,
  );
  const result = JSON.parse(run(process.execPath, ['consumer.mjs', TEMPLATE], consumer).trim());
  const manifest = JSON.parse(await readFile(join(REPO, 'impl', 'js', 'package.json'), 'utf8'));
  assert.equal(result.version, manifest.version, 'installed VERSION differs from package.json');
  assert.equal(result.filename, 'output.xlsx');
  assert.ok(result.bytes > 1000, 'installed package produced an implausibly small workbook');

  console.log(
    `PASS npm package ${packed.filename} installs, type-checks, imports, and exports .xlsx`,
  );
} finally {
  await rm(temp, { recursive: true, force: true });
}
