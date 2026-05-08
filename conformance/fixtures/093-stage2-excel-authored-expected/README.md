# 093 — synthetic cross-writer Stage 2

This fixture verifies the Stage 2 canonicalizer normalizes a set of
semantically equivalent OOXML serialization differences. Today every
other Stage 2 fixture has its `expected.xlsx` written by ExcelJS,
the same library that produces the actual output, so the
cross-writer claim is asserted but not exercised. This fixture
inserts a small adversarial step:

1. The build script writes `template.xlsx` and `data.xlsx`.
2. The maintainer captures the engine's output as
   `expected-engine.xlsx`.
3. `conformance/scripts/perturb-xlsx.mjs` rewrites that file,
   producing `expected.xlsx` whose OOXML differs byte-for-byte from
   the engine's output but is semantically identical.

Stage 2 passing means the canonicalizer normalizes every difference
the perturbation introduces.

## What the perturbation exercises

Per `conformance/runner-protocol.md` "Stage 2 output comparison":

- **Rule 1** — file order within the zip is reversed.
- **Rule 3** — attributes within each XML element are reverse-sorted
  (vs. canonicalizer's alphabetical sort), and quote style is
  flipped between `"` and `'` on alternating attributes.

A regression in any of these canonicalizer rules will fail this
fixture loudly under `npm run conformance -- --comparison-stage=2`.

## What this fixture does NOT exercise

ADR-0006 amendment lists three gap items the canonicalizer does not
yet normalize. A real Microsoft Excel save would expose them; the
synthetic perturbation does not generate any of these because the
engine's output never contains them in the first place:

- Default attribute equivalence (`applyFont="0"` vs omitted).
- Color hex case (`FF000000` vs `ff000000`).
- Namespace prefix bindings.

To upgrade this fixture into a true cross-writer test:

1. Install LibreOffice or open `expected-engine.xlsx` in Microsoft
   Excel.
2. Save As `expected.xlsx` (do NOT overwrite — Excel must rewrite
   the OOXML through its own serializer).
3. Re-run `npm run conformance -- --comparison-stage=2`. Either:
   - It passes → cross-writer parity confirmed for this template;
     update meta.yaml to drop `verified_by: [synthetic-perturbation]`
     in favor of `verified_by: [excel-saved]`.
   - It fails with a concrete diff → the diff is the gap item to
     extend the canonicalizer with. Pair the fix with an update to
     the ADR-0006 amendment list and the runner protocol's rules.

## Regenerating the perturbation

```bash
# (after a build script change that affects 093 template/data)
node conformance/scripts/build-fixtures.mjs 093

# Capture the engine output:
node -e "
import('./dist/index.js').then(async (m) => {
  const fs = await import('node:fs/promises');
  const dir = 'conformance/fixtures/093-stage2-excel-authored-expected';
  const tpl = await fs.readFile(\`\${dir}/template.xlsx\`);
  const data = await fs.readFile(\`\${dir}/data.xlsx\`);
  const out = await m.convert(tpl, data);
  await fs.writeFile(\`\${dir}/expected-engine.xlsx\`, Buffer.from(out[0].data));
});
"

# Apply the perturbation:
node conformance/scripts/perturb-xlsx.mjs \
  conformance/fixtures/093-stage2-excel-authored-expected/expected-engine.xlsx \
  conformance/fixtures/093-stage2-excel-authored-expected/expected.xlsx
```
