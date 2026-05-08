import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { convert } from '../index.js';

// 1.0 readiness: every example template+data pair under
// `examples/` must run cleanly through convert(). Examples cover
// composed shapes (multi-source + @join + filter + sort, sheet
// per group key, …) that the unit-fixture corpus tests in
// isolation; together with the conformance suite they pin the
// composed surface.

const REPO_ROOT = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const EXAMPLES = join(REPO_ROOT, 'examples');

const INPUTS_BY_EXAMPLE: Record<string, Record<string, string>> = {
  '03-multi-source-join': { month: '2026-05' },
};

describe('examples/ end-to-end', () => {
  const dirs = readdirSync(EXAMPLES)
    .filter((entry) => statSync(join(EXAMPLES, entry)).isDirectory())
    .filter((entry) => entry !== 'scripts')
    .sort();

  for (const entry of dirs) {
    it(`${entry} converts without error`, async () => {
      const dir = join(EXAMPLES, entry);
      const tplPath = join(dir, 'template.xlsx');
      const dataPath = join(dir, 'data.xlsx');
      expect(existsSync(tplPath), `${tplPath} missing`).toBe(true);
      expect(existsSync(dataPath), `${dataPath} missing`).toBe(true);

      const tpl = toAB(readFileSync(tplPath));
      const data = toAB(readFileSync(dataPath));
      const inputs = INPUTS_BY_EXAMPLE[entry];
      const out = await convert(tpl, data, inputs ? { inputs } : undefined);
      expect(out.length).toBeGreaterThan(0);
    });
  }
});

function toAB(buf: Buffer): ArrayBuffer {
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
}
