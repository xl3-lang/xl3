# 093 — cross-writer Stage 2

This fixture exists to verify the Stage 2 canonicalizer treats
semantically equivalent OOXML produced by **different writers** as
equal. Today every other Stage 2 fixture has its `expected.xlsx`
written by ExcelJS, the same library that produces the actual
output, so the cross-writer claim is asserted but not exercised.

ADR-0006 amendment lists the gap items this fixture is expected to
surface once exercised:

- Default attribute equivalence (`applyFont="0"` vs omitted)
- Color hex case (`FF000000` vs `ff000000`)
- Namespace prefix bindings

## Why this fixture is currently skipped

`expected.xlsx` is missing — the fixture's `meta.yaml` carries a
`skip_reason` so the runner reports it as `skip` rather than
`fail`. Once a maintainer supplies an Excel-authored expected file
(see workflow below), the `skip_reason` is removed and the fixture
joins the regular Stage 2 corpus.

## Workflow to upgrade the fixture

1. Run `node conformance/scripts/build-fixtures.mjs 093` to produce
   `template.xlsx` and `data.xlsx`.
2. Convert the pair through the engine and capture the output:

   ```bash
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
   ```

3. Open `expected-engine.xlsx` in **Microsoft Excel** (or
   LibreOffice / Numbers).
4. Save it back to disk as `expected.xlsx` (use "Save As" so Excel's
   serializer rewrites the OOXML; do not `Save` over the engine
   file, which would keep the existing bytes).
5. Remove the `skip_reason` line from `meta.yaml`.
6. Run `npm run conformance -- --comparison-stage=2`. The fixture
   either passes (canonicalizer accepts both writers' output as
   equivalent) or fails with a concrete diff — that diff is the gap
   item to extend the canonicalizer with.

## What "passing" means here

Stage 1 passes if cell values match. Stage 2 passes if every part
in the canonicalized OOXML package matches byte-for-byte. A new gap
item exposed by this fixture should drive a paired update to:

- The canonicalizer in `src/conformance-runner.ts`.
- The "Stage 2 output comparison" rules in
  `conformance/runner-protocol.md`.
- The ADR-0006 amendment, removing the gap item from the
  "treated as differences" list.
