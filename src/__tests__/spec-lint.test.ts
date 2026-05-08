import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// 1.0 readiness: keep the spec corpus internally consistent. Two
// concrete failure modes this guards against:
//
// 1. An ADR is added but never referenced from `STABILITY.md`,
//    `CHANGELOG.md`, `README.md`, or another ADR — so porters
//    reading top-down miss it entirely.
// 2. A markdown link inside the spec / decisions points at a path
//    that no longer exists (rename, deletion, typo).
//
// The lint runs against the live filesystem, not a snapshot, so it
// also fails when an ADR is removed without a corresponding update
// to the references that name it.

const REPO_ROOT = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const ADR_DIR = join(REPO_ROOT, 'spec', 'decisions');

describe('spec corpus lint', () => {
  it('every ADR is referenced from at least one canonical doc', () => {
    const adrs = readdirSync(ADR_DIR)
      .filter((f) => /^\d{4}-.+\.md$/.test(f))
      .filter((f) => f !== '0000-template.md');

    const canonicalDocs = [
      join(REPO_ROOT, 'README.md'),
      join(REPO_ROOT, 'CHANGELOG.md'),
      join(REPO_ROOT, 'spec', 'STABILITY.md'),
      join(REPO_ROOT, 'spec', 'README.md'),
      join(REPO_ROOT, 'spec', 'language.md'),
      join(REPO_ROOT, 'spec', 'evaluation.md'),
    ];
    // Plus every other ADR — cross-references between ADRs count.
    for (const f of adrs) canonicalDocs.push(join(ADR_DIR, f));

    const haystack = canonicalDocs
      .filter((p) => existsSync(p))
      .map((p) => readFileSync(p, 'utf8'))
      .join('\n');

    const orphans: string[] = [];
    for (const f of adrs) {
      const id = f.match(/^(\d{4})/)![1];
      // Match either `ADR-0007` (any case) or the file path form.
      const re = new RegExp(`(?:ADR[-\\s]?${id}\\b|decisions/${id}-)`, 'i');
      if (!re.test(haystack)) orphans.push(f);
    }
    expect(orphans).toEqual([]);
  });

  it('markdown links in spec/ resolve to existing files', () => {
    const specRoot = join(REPO_ROOT, 'spec');
    const mdFiles = collectMarkdownFiles(specRoot);
    const broken: string[] = [];

    for (const file of mdFiles) {
      const content = readFileSync(file, 'utf8');
      const linkRe = /\[[^\]]+\]\(([^)\s#]+)(?:#[^)]*)?\)/g;
      let m: RegExpExecArray | null;
      while ((m = linkRe.exec(content)) !== null) {
        const target = m[1]!;
        // Skip absolute URLs and pure anchors.
        if (/^[a-z]+:\/\//i.test(target)) continue;
        if (target.startsWith('mailto:')) continue;
        if (target === '') continue;
        const resolved = resolve(dirname(file), target);
        if (!existsSync(resolved)) {
          broken.push(`${relativeTo(file, REPO_ROOT)} → ${target}`);
        }
      }
    }

    expect(broken).toEqual([]);
  });

  it('every ADR file declares Status, Date, and Spec target', () => {
    const adrs = readdirSync(ADR_DIR)
      .filter((f) => /^\d{4}-.+\.md$/.test(f))
      .filter((f) => f !== '0000-template.md');

    const missing: string[] = [];
    for (const f of adrs) {
      const text = readFileSync(join(ADR_DIR, f), 'utf8');
      const head = text.split(/\n## /)[0]!;
      if (!/\*\*Status:\*\*/.test(head)) missing.push(`${f}: Status`);
      if (!/\*\*Date:\*\*/.test(head)) missing.push(`${f}: Date`);
      if (!/\*\*Spec target:\*\*/.test(head)) missing.push(`${f}: Spec target`);
    }
    expect(missing).toEqual([]);
  });
});

function collectMarkdownFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const s = statSync(full);
    if (s.isDirectory()) out.push(...collectMarkdownFiles(full));
    else if (entry.endsWith('.md')) out.push(full);
  }
  return out;
}

function relativeTo(absPath: string, base: string): string {
  return absPath.startsWith(base + '/') ? absPath.slice(base.length + 1) : absPath;
}
