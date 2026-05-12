#!/usr/bin/env node
// Sync the repo's markdown trees into `website/docs/` so Docusaurus can
// serve them. This is a build-time copy, not a runtime mirror — runs
// before `docusaurus build` / `docusaurus start`.
//
// Sources kept canonical at the repo root (cookbook in docs/cookbook,
// spec in spec/, conformance docs in conformance/, top-level reference
// docs at the root). Docusaurus only sees `website/docs/`.

import { cp, mkdir, readFile, rm, unlink, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEBSITE = join(HERE, '..');
const REPO = join(WEBSITE, '..');
const TARGET = join(WEBSITE, 'docs');

const COPIES = [
  // [src absolute, dest relative to TARGET]
  ['docs/cookbook', 'cookbook'],
  ['spec', 'spec'],
  ['conformance', 'conformance'],
  ['PORTERS_GUIDE.md', 'PORTERS_GUIDE.md'],
  ['IMPLEMENTATIONS.md', 'IMPLEMENTATIONS.md'],
  ['CONTRIBUTING.md', 'CONTRIBUTING.md'],
  ['RELEASING.md', 'RELEASING.md'],
  ['README.md', 'README.md'],
];

// Files in the conformance/ tree we don't want to surface.
const CONFORMANCE_EXCLUDE = new Set(['fixtures', 'scripts', 'reports']);

async function main() {
  await rm(TARGET, { recursive: true, force: true });
  await mkdir(TARGET, { recursive: true });

  for (const [src, dest] of COPIES) {
    const absSrc = join(REPO, src);
    const absDest = join(TARGET, dest);
    if (!existsSync(absSrc)) {
      console.warn(`skip missing: ${src}`);
      continue;
    }
    if (src === 'conformance') {
      await mkdir(absDest, { recursive: true });
      const { readdir } = await import('node:fs/promises');
      const entries = await readdir(absSrc, { withFileTypes: true });
      for (const e of entries) {
        if (CONFORMANCE_EXCLUDE.has(e.name)) continue;
        if (e.isDirectory()) {
          await cp(join(absSrc, e.name), join(absDest, e.name), { recursive: true });
        } else if (e.name.endsWith('.md')) {
          await cp(join(absSrc, e.name), join(absDest, e.name));
        }
      }
      continue;
    }
    await cp(absSrc, absDest, { recursive: true });
  }

  // The spec/ tree has a `decisions/` subfolder with 32 ADRs. They use
  // literal `{{ }}` in examples which is fine for Docusaurus `.md` (no
  // MDX), but `decisions/0018-reserved.md` is just a placeholder. We
  // keep them all for completeness — Docusaurus auto-pages them.

  // Cookbook README → index (prefer index.md, drop README.md to avoid
  // two docs claiming the same route).
  await preferIndexOverReadme(join(TARGET, 'cookbook'));

  // Spec already ships an index.md; drop README.md to avoid a route
  // collision with `/spec/`.
  await preferIndexOverReadme(join(TARGET, 'spec'));

  // Conformance has both README.md (overview) and DASHBOARD.md.
  // README.md is fine as a separate doc here — no route collision since
  // there is no conformance/index.md.

  console.log('synced markdown into', TARGET);
}

async function preferIndexOverReadme(dir) {
  const readme = join(dir, 'README.md');
  const index = join(dir, 'index.md');
  if (!existsSync(readme)) return;
  if (!existsSync(index)) {
    const body = await readFile(readme, 'utf8');
    await writeFile(index, body);
  }
  await unlink(readme);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
