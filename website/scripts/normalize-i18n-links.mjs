#!/usr/bin/env node
// Normalize stale internal links inside the git-tracked i18n translations
// (`website/i18n/<locale>/docusaurus-plugin-content-docs/current/**/*.md`).
//
// Why this exists (issue #67): `sync-docs.mjs` rewrites links only in the
// DEFAULT-locale synced tree (`website/docs/`). The committed translations
// are static snapshots that drift from the current routes when the English
// docs are re-slugged or re-linked — producing hundreds of broken-locale
// links at build time. This pass brings the translations' internal links
// back in line with the live routes, without touching the translated prose.
//
// Idempotent: safe to re-run whenever translations are refreshed.
//
// Usage: node website/scripts/normalize-i18n-links.mjs
import { readFile, writeFile, readdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';

const HERE = dirname(fileURLToPath(import.meta.url));
const I18N = join(HERE, '..', 'i18n');
const GH_BLOB = 'https://github.com/jinyoung4478/xl3/blob/main';
const GH_TREE = 'https://github.com/jinyoung4478/xl3/tree/main';

// Slug frontmatter that `sync-docs.mjs` injects into the DEFAULT-locale docs
// (LOWERCASE_SLUGS there). A translated doc file overrides frontmatter for
// its locale, so a translation WITHOUT `slug` renders at the id-based route
// (/ja/ROADMAP) instead of the lowercase route the navbar/links target
// (/ja/roadmap) — a 404. Re-inject the same slug so translated pages resolve
// at the same route as English. Keyed by path relative to `current/`.
const SLUGS = {
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
};

// Rewrites applied in order. Each is [RegExp, replacement].
const REWRITES = [
  // ADR decision links carry a numeric prefix that Docusaurus's
  // numberPrefixParser strips from the route (0038-group-and-subtotal →
  // group-and-subtotal). Strip it wherever it appears (any/no locale prefix).
  [/(\/spec\/decisions\/)\d{4}-/g, '$1'],
  // Relative numbered sibling guide links (./03-aggregates.md) break under a
  // locale prefix when the target guide isn't translated in that locale.
  // Point them at the absolute guide route (number + .md dropped); Docusaurus
  // localizes the absolute path and falls back to English when untranslated.
  [/\]\(\.\/\d{2}-([a-z0-9-]+)\.md(#[^)]*)?\)/g, '](/guides/$1$2)'],
  // Spec siblings referenced up a level from ADRs (../spec/language.md).
  [/\]\(\.\.?\/spec\/([a-z-]+)\.md(#[^)]*)?\)/g, '](/spec/$1$2)'],
  // grammar.ebnf is not a markdown route — send it to the repo file.
  [/\]\((?:\.\.?\/)*(?:spec\/)?grammar\.ebnf(#[^)]*)?\)/g, `](${GH_BLOB}/spec/grammar.ebnf)`],
  // Repo directories excluded from the site → GitHub tree.
  [/\]\((?:\.\.?\/)*conformance\/fixtures\/?(#[^)]*)?\)/g, `](${GH_TREE}/conformance/fixtures)`],
  [/\]\((?:\.\.?\/)*conformance\/reports\/?(#[^)]*)?\)/g, `](${GH_TREE}/conformance/reports)`],
  [/\]\((?:\.\.?\/)*spec\/decisions\/?(#[^)]*)?\)/g, `](${GH_TREE}/spec/decisions)`],
  // docs/guides dir → the guides overview route.
  [/\]\((?:\.\.?\/)*docs\/guides\/?(#[^)]*)?\)/g, '](/guides)'],
];

// Explicit heading anchors for translated pages. Docusaurus derives a
// heading's anchor id from its (translated) text, so links that target the
// English anchor id (`#comparison-algorithm`) break on translated pages.
// Pin the English id onto the corresponding translated heading with an
// explicit `{#id}` marker. Keyed by locale → [relative path, exact heading
// line, English anchor id]. Heading text is matched exactly (whole line).
const HEADING_IDS = {
  ja: [
    ['spec/language.md', '## 比較と文字列強制変換', 'comparison-and-string-coercion'],
    ['spec/language.md', '### 比較アルゴリズム', 'comparison-algorithm'],
    ['spec/evaluation.md', '## 外部データソース', 'external-data-sources'],
    ['spec/evaluation.md', '## 空値', 'empty-values'],
    ['spec/evaluation.md', '## ディレクティブ', 'directives'],
    ['conformance/runner-protocol.md', '## ステージ 2 出力比較', 'stage-2-output-comparison'],
  ],
  'zh-CN': [
    ['spec/language.md', '## 比较与字符串强制转换', 'comparison-and-string-coercion'],
    ['spec/language.md', '### 比较算法', 'comparison-algorithm'],
    ['spec/evaluation.md', '## 外部数据源（External Data Sources）', 'external-data-sources'],
    ['spec/evaluation.md', '## 空值（Empty Values）', 'empty-values'],
    ['spec/evaluation.md', '## 指令（Directives）', 'directives'],
    ['conformance/runner-protocol.md', '## 阶段 2 输出比较', 'stage-2-output-comparison'],
  ],
};

// Intra-/cross-page anchor LINKS in the translations point at the old
// auto-generated (CJK-derived) heading ids. Now that the headings carry an
// explicit English `{#id}` (HEADING_IDS above), rewrite those links to the
// same English id so both ends agree. Keyed by locale → [old anchor
// fragment, English id]. Matched as `](#<old>)`.
const ANCHOR_LINK_IDS = {
  ja: [
    ['比較アルゴリズム', 'comparison-algorithm'],
    ['比較と文字列強制変換', 'comparison-and-string-coercion'],
    ['空値', 'empty-values'],
    ['外部データソース', 'external-data-sources'],
    ['ディレクティブ', 'directives'],
  ],
  'zh-CN': [
    ['比较算法', 'comparison-algorithm'],
    ['比较与字符串强制转换', 'comparison-and-string-coercion'],
    ['空值empty-values', 'empty-values'],
    ['外部数据源external-data-sources', 'external-data-sources'],
    ['指令directives', 'directives'],
  ],
};

async function walk(dir, out = []) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const abs = join(dir, e.name);
    if (e.isDirectory()) await walk(abs, out);
    else if (e.name.endsWith('.md')) out.push(abs);
  }
  return out;
}

async function main() {
  const locales = existsSync(I18N)
    ? (await readdir(I18N, { withFileTypes: true })).filter((e) => e.isDirectory()).map((e) => e.name)
    : [];
  let changedFiles = 0;
  for (const loc of locales) {
    const docsDir = join(I18N, loc, 'docusaurus-plugin-content-docs', 'current');
    if (!existsSync(docsDir)) continue;
    // Slug injection for translated copies of slug-mapped docs.
    for (const [rel, slug] of Object.entries(SLUGS)) {
      const file = join(docsDir, rel);
      if (!existsSync(file)) continue;
      const body = await readFile(file, 'utf8');
      let next;
      if (body.startsWith('---\n')) {
        const end = body.indexOf('\n---\n', 4);
        if (end === -1 || /^slug:\s*/m.test(body.slice(0, end))) continue;
        next = body.slice(0, end) + `\nslug: ${slug}` + body.slice(end);
      } else {
        next = `---\nslug: ${slug}\n---\n\n${body}`;
      }
      if (next !== body) {
        await writeFile(file, next);
        changedFiles++;
      }
    }
    // Explicit heading anchors so English-id links resolve on translated pages.
    for (const [rel, heading, id] of HEADING_IDS[loc] ?? []) {
      const file = join(docsDir, rel);
      if (!existsSync(file)) continue;
      const body = await readFile(file, 'utf8');
      const lines = body.split('\n');
      let hit = false;
      for (let i = 0; i < lines.length; i++) {
        if (lines[i] === heading) {
          lines[i] = `${heading} {#${id}}`;
          hit = true;
          break;
        }
      }
      if (hit) {
        await writeFile(file, lines.join('\n'));
        changedFiles++;
      } else if (!body.includes(`{#${id}}`)) {
        console.warn(`  heading not found (check translation drift): ${loc}/${rel} :: ${heading}`);
      }
    }
    // Anchor-link id alignment (must match the explicit heading ids above).
    const anchorPairs = ANCHOR_LINK_IDS[loc] ?? [];
    // Link normalization across every translated markdown file.
    for (const file of await walk(docsDir)) {
      const body = await readFile(file, 'utf8');
      let next = body;
      for (const [re, rep] of REWRITES) next = next.replace(re, rep);
      // Match the anchor fragment + closing paren so both intra-page
      // (`](#frag)`) and cross-page (`](/loc/spec/evaluation#frag)`) links
      // are aligned to the explicit English heading id.
      for (const [oldFrag, id] of anchorPairs) {
        next = next.split(`#${oldFrag})`).join(`#${id})`);
      }
      if (next !== body) {
        await writeFile(file, next);
        changedFiles++;
      }
    }
  }
  console.log(`normalized i18n links + slugs: ${changedFiles} file-passes`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
