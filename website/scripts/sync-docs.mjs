#!/usr/bin/env node
// Sync the repo's markdown trees into `website/docs/` so Docusaurus can
// serve them. This is a build-time copy, not a runtime mirror — runs
// before `docusaurus build` / `docusaurus start`.
//
// Sources kept canonical at the repo root (guides in docs/guides,
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
  ['docs/guides', 'guides'],
  ['docs/api', 'api'],
  ['spec', 'spec'],
  ['conformance', 'conformance'],
  ['PORTERS_GUIDE.md', 'PORTERS_GUIDE.md'],
  ['IMPLEMENTATIONS.md', 'IMPLEMENTATIONS.md'],
  ['CONTRIBUTING.md', 'CONTRIBUTING.md'],
  ['GOVERNANCE.md', 'GOVERNANCE.md'],
  ['ROADMAP.md', 'ROADMAP.md'],
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

  // Guides README → index (prefer index.md, drop README.md to avoid
  // two docs claiming the same route).
  await preferIndexOverReadme(join(TARGET, 'guides'));

  // Spec already ships an index.md; drop README.md to avoid a route
  // collision with `/spec/`.
  await preferIndexOverReadme(join(TARGET, 'spec'));

  // TypeDoc emits an `api/README.md` overview; rename to index.md so
  // `/api` resolves.
  await preferIndexOverReadme(join(TARGET, 'api'));

  // Strip the "Function: " / "Interface: " / "Type Alias: " prefix from
  // typedoc's H1. The kind is already conveyed by the sidebar category
  // and the URL segment (/api/functions/...), so repeating it on every
  // page title and sidebar entry is redundant.
  await stripApiKindPrefixes(join(TARGET, 'api'));

  // Conformance has README.md (overview) + DASHBOARD.md (live status).
  // Promote README → index so the /conformance URL serves the overview;
  // DASHBOARD stays as a sibling at /conformance/dashboard (via slug).
  await preferIndexOverReadme(join(TARGET, 'conformance'));

  // Inject `slug` frontmatter so user-facing URLs are all lowercase /
  // kebab-case, even though the canonical repo files keep the GitHub
  // UPPERCASE.md convention (README, CONTRIBUTING, GOVERNANCE, etc.
  // get auto-linking in GitHub's UI by exact filename). Synced files
  // keep their original names so repo-style relative links
  // (`[GOVERNANCE.md](./GOVERNANCE.md)`) still resolve.
  await injectSlugs(TARGET, LOWERCASE_SLUGS);

  // Canonical repo paths use relative links that target GitHub's file
  // layout (`../../spec/language.md` from a cookbook recipe). Once the
  // file is copied into `website/docs/`, the depth changes and most
  // relative paths drift. Fix the common patterns up front so the
  // build doesn't warn on every recipe.
  await rewriteRelativePaths(TARGET);

  // Rewrite repo-tree-only links. The canonical markdown files at the
  // repo root reference paths that exist on GitHub but not in the
  // synced docs/ tree (examples/, LICENSE, conformance/fixtures, …).
  // Without this rewrite they 404 on xl3.io.
  await rewriteDeadLinks([
    join(TARGET, 'PORTERS_GUIDE.md'),
    join(TARGET, 'IMPLEMENTATIONS.md'),
    join(TARGET, 'CONTRIBUTING.md'),
    join(TARGET, 'GOVERNANCE.md'),
    join(TARGET, 'ROADMAP.md'),
    join(TARGET, 'README.md'),
    join(TARGET, 'guides', 'index.md'),
  ]);

  console.log('synced markdown into', TARGET);
}

const GH_BLOB = 'https://github.com/jinyoung4478/xl3/blob/main';
const GH_TREE = 'https://github.com/jinyoung4478/xl3/tree/main';

// Paths that 404 on the site (excluded from the synced docs/ tree or
// never copied). Each entry maps a relative link target to an absolute
// GitHub URL or an absolute site path. Tree = repo directory, blob =
// repo file, site = page on the deployed site.
const DEAD_LINK_PREFIXES = [
  { prefix: 'conformance/fixtures/', kind: 'tree' },
  { prefix: 'conformance/reports/', kind: 'tree' },
  { prefix: 'examples/', kind: 'tree' },
  { prefix: 'src/', kind: 'blob' },
];

const DEAD_LINK_EXACT = {
  'spec/decisions/': { kind: 'tree' },
  'spec/decisions': { kind: 'tree', target: 'spec/decisions/' },
  'examples': { kind: 'tree', target: 'examples/' },
  'examples/': { kind: 'tree' },
  'LICENSE': { kind: 'blob' },
  'spec/LICENSE': { kind: 'blob' },
  // Repo-level dirs/files that have a live site equivalent.
  'docs/guides/': { kind: 'site', target: '/guides/' },
  'docs/guides': { kind: 'site', target: '/guides' },
};

async function rewriteDeadLinks(files) {
  // Match `]([./|../[…]]path)` — any number of leading `..` segments.
  const linkRe = /\]\(((?:\.\.?\/)+)([^)#]+)(#[^)]*)?\)/g;
  for (const file of files) {
    if (!existsSync(file)) continue;
    const body = await readFile(file, 'utf8');
    const rewritten = body.replace(linkRe, (match, _prefix, target, frag = '') => {
      const exact = DEAD_LINK_EXACT[target];
      if (exact) {
        if (exact.kind === 'site') return `](${exact.target}${frag})`;
        const base = exact.kind === 'tree' ? GH_TREE : GH_BLOB;
        return `](${base}/${exact.target ?? target}${frag})`;
      }
      for (const { prefix, kind } of DEAD_LINK_PREFIXES) {
        if (target.startsWith(prefix)) {
          const base = kind === 'tree' ? GH_TREE : GH_BLOB;
          return `](${base}/${target}${frag})`;
        }
      }
      return match;
    });
    if (rewritten !== body) {
      await writeFile(file, rewritten);
    }
  }
}

const API_PREFIX_DIRS = ['functions', 'interfaces', 'type-aliases'];
const API_PREFIX_RE = /^# (?:Function|Interface|Type Alias):\s+/;

async function stripApiKindPrefixes(apiDir) {
  const { readdir } = await import('node:fs/promises');
  for (const sub of API_PREFIX_DIRS) {
    const dir = join(apiDir, sub);
    if (!existsSync(dir)) continue;
    const entries = await readdir(dir, { withFileTypes: true });
    for (const e of entries) {
      if (!e.isFile() || !e.name.endsWith('.md')) continue;
      const file = join(dir, e.name);
      const body = await readFile(file, 'utf8');
      const rewritten = body.replace(API_PREFIX_RE, '# ');
      if (rewritten !== body) await writeFile(file, rewritten);
    }
  }
}

async function rewriteRelativePaths(target) {
  const { readdir } = await import('node:fs/promises');

  // Guides: canonical is `docs/guides/`, synced is `website/docs/guides/`.
  // GitHub-style `../../spec/X.md` and `../../README.md` both lose one
  // segment after the sync drop.
  for (const entry of await readdir(join(target, 'guides'), { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.md')) continue;
    const file = join(target, 'guides', entry.name);
    let body = await readFile(file, 'utf8');
    let changed = false;
    const next = body
      .replace(/\]\(\.\.\/\.\.\/spec\/([\w.-]+)\.md(#[^)]*)?\)/g, (_, name, frag = '') => {
        changed = true;
        return `](../spec/${name}.md${frag})`;
      })
      .replace(/\]\(\.\.\/\.\.\/README\.md(#[^)]*)?\)/g, (_, frag = '') => {
        changed = true;
        // /readme is the synced top-level README; preserve anchors so
        // links to specific sections (#usage etc.) keep working.
        return `](/readme${frag})`;
      });
    if (changed) await writeFile(file, next);
  }

  // Spec/STABILITY links to `./README.md`; we promoted it to index.md.
  const stab = join(target, 'spec', 'STABILITY.md');
  if (existsSync(stab)) {
    const body = await readFile(stab, 'utf8');
    const next = body.replace(/\]\(\.\/README\.md(#[^)]*)?\)/g, '](./index.md$1)');
    if (next !== body) await writeFile(stab, next);
  }

  // Conformance overview (was README.md, now index.md) links to
  // `../spec/README.md` — that file no longer exists (promoted to
  // spec/index.md by preferIndexOverReadme).
  const conf = join(target, 'conformance', 'index.md');
  if (existsSync(conf)) {
    const body = await readFile(conf, 'utf8');
    const next = body.replace(/\]\(\.\.\/spec\/README\.md(#[^)]*)?\)/g, '](../spec/index.md$1)');
    if (next !== body) await writeFile(conf, next);
  }

  // Top-level README.md → `./README.ko.md`: the Korean README is not
  // synced into the site. Send the link out to GitHub instead.
  const readme = join(target, 'README.md');
  if (existsSync(readme)) {
    const body = await readFile(readme, 'utf8');
    const next = body.replace(/\]\(\.\/README\.ko\.md(#[^)]*)?\)/g, `](${GH_BLOB}/README.ko.md$1)`);
    if (next !== body) await writeFile(readme, next);
  }
}

// Map: synced-file path (relative to TARGET) → final user-facing URL.
// Files keep their original UPPERCASE names; only the URL slug changes.
// Index docs are also pinned so `/api`, `/guides`, `/spec`, `/conformance`
// land on the overview without a trailing slash.
const LOWERCASE_SLUGS = {
  'PORTERS_GUIDE.md': '/porters-guide',
  'IMPLEMENTATIONS.md': '/implementations',
  'CONTRIBUTING.md': '/contributing',
  'GOVERNANCE.md': '/governance',
  'ROADMAP.md': '/roadmap',
  'RELEASING.md': '/releasing',
  'README.md': '/readme',
  'spec/STABILITY.md': '/spec/stability',
  'conformance/DASHBOARD.md': '/conformance/dashboard',
  'conformance/AUTHORING.md': '/conformance/authoring',
  'api/index.md': '/api',
  'guides/index.md': '/guides',
  'spec/index.md': '/spec',
  'conformance/index.md': '/conformance',
};

async function injectSlugs(target, map) {
  for (const [rel, slug] of Object.entries(map)) {
    const file = join(target, rel);
    if (!existsSync(file)) continue;
    const body = await readFile(file, 'utf8');
    if (body.startsWith('---\n')) {
      const end = body.indexOf('\n---\n', 4);
      if (end !== -1 && !/^slug:\s*/m.test(body.slice(0, end))) {
        await writeFile(file, body.slice(0, end) + `\nslug: ${slug}` + body.slice(end));
      }
    } else {
      await writeFile(file, `---\nslug: ${slug}\n---\n\n${body}`);
    }
  }
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
