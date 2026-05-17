# Authoring xl3 templates with an LLM

**Audience:** you are an LLM (Claude, GPT, Gemini, Codex, Cursor, etc.)
tasked with converting an existing `.xlsx` (a finished report) into an
**xl3 template** — the workflow contract that, paired with raw data,
re-renders that report. Read this file end-to-end before producing any
template.

xl3 is "Excel conversion, inside Excel, in Excel syntax." The template
is itself an `.xlsx`. You are editing a workbook, not generating code.

---

## TL;DR — the one mistake to avoid

xl3 expands a **data block** by repeating **one** template row, once
per source row, inheriting that row's styling. Every row **below** the
data-block row is preserved verbatim in the output as a **footer**
(totals, signatures, notes).

If you start from a finished report that already contains N styled
data rows and you only rewrite the first row with `{{ [Col] }}`
expressions, **the remaining N−1 rows survive as styled footer rows in
every output**. They keep their fills, borders, and stale sample text
or — worse — appear as empty styled bands that pollute every render.

**Fix: delete those rows.** Use *Delete Row*, not *Clear Contents*.
The data block must consist of exactly **one** template row.

---

## Mental model (4 lines)

1. The template is a `.xlsx`. Open it in Excel; edit cells; save.
2. A **data block** is one row containing `{{ [Column] }}` expressions.
   xl3 expands it to N rows for N source rows, copying the row's
   styling onto each.
3. Rows **above** the data block = headers, preserved verbatim. Rows
   **below** = footers, preserved verbatim and shifted down by N−1.
4. There is no end-of-block marker. The block ends at the first row
   with no template expressions. Anything past that point ships.

See [`spec/language.md`](../spec/language.md) "Template Blocks" and
[`spec/evaluation.md`](../spec/evaluation.md) for the normative
definition.

---

## The styling-leak anti-pattern

### Original finished report (`finished-report.xlsx`)

| Row | A         | B       | C        |
|-----|-----------|---------|----------|
| 1   | Account   | Region  | Renewal  |
| 2   | Acme      | Seoul   | 18400    | ← styled (alt-row fill)
| 3   | Beta      | Busan   | 7200     | ← styled
| 4   | Coreon    | Seoul   | 25100    | ← styled
| 5   | Total     |         | 50700    | ← bold + top border

### Wrong template (typical LLM output)

| Row | A                  | B                 | C                       |
|-----|--------------------|-------------------|-------------------------|
| 1   | Account            | Region            | Renewal                 |
| 2   | `{{ [Account] }}`  | `{{ [Region] }}`  | `{{ [Renewal] }}`       | ← directive row
| 3   | *(blank, styled)*  | *(blank, styled)* | *(blank, styled)*       | ← LEFTOVER
| 4   | *(blank, styled)*  | *(blank, styled)* | *(blank, styled)*       | ← LEFTOVER
| 5   | Total              |                   | `{{ SUM([Renewal]) }}`  |

For 50 source rows you produce: 50 expanded rows + **2 empty styled
bands** + the Total. The two empty bands sit between the data and the
Total in every output. Users see "weird gap rows" they cannot explain.

### Right template

| Row | A                  | B                 | C                       |
|-----|--------------------|-------------------|-------------------------|
| 1   | Account            | Region            | Renewal                 |
| 2   | `{{ [Account] }}`  | `{{ [Region] }}`  | `{{ [Renewal] }}`       |
| 3   | Total              |                   | `{{ SUM([Renewal]) }}`  |

Rows 3 and 4 of the original were removed with **Delete Row** before
the template was saved. Row 5's Total was kept on purpose — it is an
intentional footer that aggregates the expanded block (see
[`docs/guides/03-aggregates.md`](./guides/03-aggregates.md)).

---

## DO

- **Edit the workbook.** Open the source `.xlsx` in Excel (or
  programmatically via a library that preserves styles, e.g.
  `exceljs`). Do not hand-write OOXML.
- **Exactly one directive row per data block.** Pick the row whose
  styling you want every output row to inherit. Put all
  `{{ [Column] }}` expressions on that row. Delete every other sample
  data row in the block range.
- **Delete Row, not Clear Contents.** A cleared cell keeps its
  fill, border, font, and number format. Only Delete Row removes the
  cell entirely.
- **Treat sub-data rows as intentional footers.** A row below the data
  block ships verbatim. If it should be a total, write the aggregate:
  `{{ SUM([Amount]) }}`. If it shouldn't exist, Delete Row.
- **Set `__config__`.** Minimum:
  - `source_sheet` — the raw-data sheet name (or `*` pattern).
  - `source_table` — the header row number, e.g. `1`, or a range form
    like `A1:D`. The first selected row contains column names; data is
    *below* it.
  - `output_file_pattern` — output filename.
- **Reference columns by header text.** `{{ [Account] }}` where
  `Account` is the exact text of the header cell on the source sheet.
  Trim only leading/trailing whitespace; the parser does the rest.

---

## DON'T

- **Don't keep multiple sample data rows** "for formatting variety."
  xl3 already copies the directive row's styling onto every expanded
  row.
- **Don't clear cells you mean to remove.** Blank-but-styled cells
  ship.
- **Don't hide rows.** Hidden rows still render; many viewers
  show them anyway.
- **Don't add an end-of-block sentinel.** xl3 detects block end by row
  shape. A sentinel row is just a footer.
- **Don't merge cells across the data-block boundary.** Vertical
  merges that cross top/bottom of the data block are
  implementation-defined (per ADR-0021). Horizontal merges *within*
  the directive row are fine and propagate per
  [`docs/guides/10-styling-and-branding.md`](./guides/10-styling-and-branding.md).
- **Don't write Excel `=FORMULA()`s into the data block.** Use XTL
  expressions inside `{{ … }}`. Native formulas inside data blocks
  have ill-defined recalculation semantics across implementations.
- **Don't invent directives.** The full directive list is in
  [`spec/language.md`](../spec/language.md) §Directives: `@source`,
  `@join`, `@filter`, `@sort`, `@top`, `@repeat right`. Nothing else
  exists in XTL 0.x.

---

## Self-check (run through cell by cell before declaring done)

1. **Directive-row count.** For each data block, count rows that
   contain at least one `{{ }}` template expression. Must be exactly
   **1**.
2. **Footer audit.** For each row strictly below a data block (down to
   the next header or sheet end): is it an *intentional* footer
   (total, signature, note)? If no, **Delete Row**.
3. **Used-range audit.** Select the entire used range of every sheet.
   Look for rows whose cells are blank but show fill, borders, or
   non-default number formats. **Delete those rows.**
4. **`source_table` points at the header row,** not at a data row.
5. **Column-name match.** Every `[Column]` in the template matches a
   header cell text in the source sheet exactly (after whitespace
   trim). Mismatches raise `xl3/source/unknown-column` at render time.
6. **No reserved-sheet collisions.** Author sheets matching
   `^__[a-z]+__$` other than `__config__`, `__inputs__`, `__sources__`,
   `__lists__` are rejected at parse time.
7. **One template block per cell.** A cell can contain literal text
   plus one or more `{{ … }}` blocks, but each `{{ … }}` must hold a
   single complete expression (no `{{ }}` nesting, no empty bodies).

---

## Verification: render and inspect

Always render with a small realistic sample before handing the
template off. The published package is `@jinyoung4478/xl3`.

```js
// verify.mjs
import { convert } from '@jinyoung4478/xl3';
import { readFile, writeFile } from 'node:fs/promises';

const tpl  = await readFile('template.xlsx');
const data = await readFile('sample-source.xlsx');
const outs = await convert(tpl.buffer, data.buffer);

for (const o of outs) {
  await writeFile(o.filename, Buffer.from(o.buffer));
  console.log('wrote', o.filename);
}
```

Then inspect the output workbook and confirm:

- **Row count matches.** Output row count == header rows + N source
  rows expanded + intentional footer rows. Nothing extra.
- **Used range ends at the last intentional footer.** No trailing
  rows with fill/borders past the last meaningful content.
- **Styling parity.** A spot-checked expanded row has identical
  fill/border/font/number-format to the directive row.
- **Footers shifted, not duplicated.** A footer present in the
  template appears exactly once, after the expanded block, with its
  styling intact.

If you see extra styled rows at the bottom of the output: the template
still has leftover rows below the data block. Reopen, Delete Row, save,
re-render.

---

## When `@filter`, `@sort`, `@top`, `@source`, `@join` enter

These are written as full-row template expressions placed in the rows
**immediately above** the data block. They are *part* of the block's
control surface; they are not separate "header rows." Keep them on
their own row(s), and keep the directive data row exactly one row
below them.

Per [`spec/evaluation.md`](../spec/evaluation.md) the application
order is `filter → sort → top`. `@source` MUST appear before
`@filter`/`@sort`/`@top` of the same block. `@join` immediately follows
`@source`.

If you don't need them, don't add them. Empty/decorative directives
do not exist in XTL.

---

## Where to dig deeper

Primary spec (normative):
- [`spec/language.md`](../spec/language.md) — Template Blocks, Source
  Columns, Operators, Functions, Directives.
- [`spec/evaluation.md`](../spec/evaluation.md) — block expansion,
  source value model, error model.
- [`spec/glossary.md`](../spec/glossary.md) — exact term definitions.

Concrete recipes:
- [`docs/guides/01-getting-started.md`](./guides/01-getting-started.md)
  — the minimum complete example.
- [`docs/guides/03-aggregates.md`](./guides/03-aggregates.md) — footer
  totals over a data block.
- [`docs/guides/10-styling-and-branding.md`](./guides/10-styling-and-branding.md)
  — how styling propagates; merged-header rules.
- [`docs/guides/15-directive-composition.md`](./guides/15-directive-composition.md)
  — when multiple directives stack on one block.

Behavior preservation matrix:
- [`spec/decisions/0036-feature-preservation-matrix.md`](../spec/decisions/0036-feature-preservation-matrix.md)
  — what else flows from template to output verbatim (images,
  conditional formatting, named ranges, freeze pane, validation,
  comments).

Live examples to study:
- [`examples/01-basic-renewal-report/`](../examples/01-basic-renewal-report)
- [`examples/02-sheet-per-region/`](../examples/02-sheet-per-region)
- [`examples/03-multi-source-join/`](../examples/03-multi-source-join)

---

## One-paragraph summary you can paste back into your own context

> An xl3 template is itself an `.xlsx`. A *data block* is exactly one
> row of `{{ [Column] }}` expressions; xl3 repeats that row once per
> source row, copying its styling. Every row below the data block is a
> *footer* that ships verbatim. The common LLM mistake is leaving
> leftover sample-data rows below the directive row — they survive as
> blank styled bands in every output. Fix: Delete Row (not Clear) on
> every non-directive, non-intentional-footer row. Verify by rendering
> with a small sample and checking the output's used range ends at the
> last intentional footer.
