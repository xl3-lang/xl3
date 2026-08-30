import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const REPO_ROOT = resolve(fileURLToPath(new URL('../../../..', import.meta.url)));

function read(relativePath: string): string {
  return readFileSync(resolve(REPO_ROOT, relativePath), 'utf8');
}

describe('published behavior contracts', () => {
  it('documents ADR-0040 range extension in the English contract', () => {
    const support = read('docs/support-matrix.md');
    const stability = read('spec/STABILITY.md');

    expect(support).toContain('| Conditional formatting | **Preserved and extended** |');
    expect(support).toContain(
      '| Data validation (dropdowns, constraints) | **Preserved and extended** |',
    );
    expect(support).toContain('`171-cf-dv-range-extension`');
    expect(stability).toContain('range extension shipped; fixtures 171 and 172');
    expect(stability).not.toContain('CF/DV range PE pending');
  });

  it('keeps localized support contracts aligned', () => {
    const localized = [
      [
        'website/i18n/ko/docusaurus-plugin-content-docs/current/support-matrix.md',
        '| 조건부 서식 | **보존하고 확장** |',
      ],
      [
        'website/i18n/ja/docusaurus-plugin-content-docs/current/support-matrix.md',
        '| 条件付き書式 | **保持して拡張** |',
      ],
      [
        'website/i18n/zh-CN/docusaurus-plugin-content-docs/current/support-matrix.md',
        '| 条件格式 | **保留并扩展** |',
      ],
    ] as const;

    for (const [file, claim] of localized) {
      const body = read(file);
      expect(body, `${file} must describe CF range extension`).toContain(claim);
      expect(body, `${file} must cite the Stage 2 guard`).toContain('`171-cf-dv-range-extension`');
    }
  });

  it('keeps the roadmap summary consistent with the gate table', () => {
    const roadmap = read('ROADMAP.md');
    const [blocking, adoption] = roadmap.split('## 1.x adoption track (non-blocking for 1.0)');

    expect(blocking).toContain('## 1.0 blocking gate table');
    expect(blocking).toContain('| G24 | Technical stability window |');
    for (const id of ['G13', 'G14', 'G15', 'G18']) {
      expect(blocking, `${id} must not remain in the blocking table`).not.toContain(`| ${id} |`);
      expect(adoption, `${id} must remain visible in the adoption track`).toContain(`| ${id} |`);
    }
    expect(roadmap).toContain('**0 blocking prerequisites are open; G24 is in progress.**');
    expect(roadmap).toContain('window **2026-08-16 → 2026-11-14**');
    expect(read('spec/decisions/0079-technical-1.0-and-adoption-track.md')).toContain(
      'G13, G14, G15, and G18 move',
    );
    expect(roadmap).not.toContain('data-loss/` group, which does\n> not exist yet');
  });

  it('derives structured metadata from the package contract', () => {
    const config = read('website/docusaurus.config.ts');
    expect(config).toContain('softwareVersion: xl3Package.version');
    expect(config).toContain('Node.js ${xl3Package.engines.node}, Browser (ESM)');
    expect(config).not.toContain("softwareVersion: '0.9.0'");
    expect(config).not.toContain("operatingSystem: 'Node.js 18+");
  });
});
