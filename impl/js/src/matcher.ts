import type { TemplateMeta } from './types.js';

export interface MatchResult {
  filename: string;
  templateId: string;
  matchedBy: string;
}

/**
 * Match source filenames to templates by `match_pattern`.
 *
 * @stable Frozen at 1.0 per `spec/STABILITY.md` "Public API surface".
 *
 * @example
 * ```ts
 * const result = batchMatch(
 *   ['2026-05_거래처A.xlsx'],
 *   [{ id: 'invoice', meta: { match_pattern: '*_거래처*' } as TemplateMeta }],
 * );
 * // result[0].templateId === 'invoice', result[0].matchedBy === 'pattern'
 * ```
 */
export function batchMatch(
  filenames: string[],
  templates: { id: string; meta: TemplateMeta }[],
): MatchResult[] {
  return filenames.map((filename) => {
    const baseName = filename.replace(/\.[^.]+$/, '');
    const nfcBase = baseName.normalize('NFC');

    // Pattern matching
    for (const t of templates) {
      const pattern = t.meta.match_pattern?.normalize('NFC');
      if (!pattern) continue;

      if (globMatch(pattern, nfcBase) || globMatch(pattern, filename.normalize('NFC'))) {
        return { filename, templateId: t.id, matchedBy: 'pattern' };
      }

      const patternBase = pattern.replace(/[*?]/g, '');
      if (patternBase && nfcBase.includes(patternBase)) {
        return { filename, templateId: t.id, matchedBy: 'pattern' };
      }
    }

    // Name similarity fallback
    for (const t of templates) {
      if (!t.meta.name) continue;
      const nfcName = t.meta.name.normalize('NFC');
      if (nfcBase.includes(nfcName) || nfcName.includes(nfcBase)) {
        return { filename, templateId: t.id, matchedBy: 'name' };
      }
    }

    return { filename, templateId: '', matchedBy: '' };
  });
}

/** Simple glob matching supporting * and ?. */
function globMatch(pattern: string, str: string): boolean {
  const regex = new RegExp(
    '^' +
      pattern
        .replace(/[.+^${}()|[\]\\]/g, '\\$&')
        .replace(/\*/g, '.*')
        .replace(/\?/g, '.') +
      '$',
  );
  return regex.test(str);
}
