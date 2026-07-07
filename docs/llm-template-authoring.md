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
  expressions inside `{{ … }}`. The renderer copies a directive
  row's formula verbatim onto every expanded row without adjusting
  relative references, so `=A2+B2` stays `=A2+B2` on rows 3, 4, … —
  not what you want. (Footer rows are different — see
  [Footer escape hatch](#footer-escape-hatch-when-xtl-cant-express-the-total)
  below.)
- **Don't invent directives.** The full directive list is in
  [`spec/language.md`](../spec/language.md) §Directives: `@source`,
  `@join`, `@filter`, `@sort`, `@top`, `@group`, `@subtotal`,
  `@repeat right`. Nothing else exists in XTL 0.x.
- **Don't re-save a finished template from Excel/LibreOffice right
  before shipping it** if the template contains native `=…` formulas.
  Recalculation bakes results into formula caches, and a save can
  consolidate identical formulas into shared formulas — both corrupt
  how the engine reads the template. Details and safe workflows in
  [Excel round-trips, formula caches, and programmatic
  editing](#excel-round-trips-formula-caches-and-programmatic-editing).

---

## Footer escape hatch — when XTL can't express the total

**Before reaching for a native Excel formula**, check whether the
footer is per-group or a grand-total. If yes, prefer `@group` +
`@subtotal` (ADR-0038) over a hand-written `SUMIF` — it composes with
`@filter`/`@sort`, evaluates against the rendered row set (no
overshoot-range guessing), and is the XTL-native expression for the
interleaved-subtotal Korean B2B pattern. See
[`docs/guides/18-group-and-subtotal.md`](./guides/18-group-and-subtotal.md).

The grand-total special case: with a single `@group [Key]` plus one
`@subtotal` row, the subtotal emits once at the end — a clean
"grand-total via outermost subtotal" pattern that works even when the
key takes only one distinct value (degenerate single-group case is
explicitly supported by ADR-0038).

XTL aggregates — `SUM`, `COUNT`, `AVERAGE`, `MIN`, `MAX` — compose
cleanly **only** as the entire expression in a footer cell, OR as
the body of a `@subtotal` row:

```text
{{ SUM([Amount]) }}              # ✓ block-level footer
{{ AVERAGE([Margin]) }}          # ✓
{{ @subtotal SUM([Amount]) }}    # ✓ per-group emission (ADR-0038)
```

In xl3 0.7+ they do **not** compose with arithmetic operators or
appear as the LHS of a comparison. `@subtotal` has the same restriction
(per ADR-0038, composite-expression bodies raise
`xl3/subtotal/bad-aggregate` and are deferred). Per-row arithmetic /
literals / function calls **inside** the aggregate argument raise
`xl3/eval/bad-aggregate-arg` at parse time (ADR-0059); arithmetic
*around* the aggregate result raises `xl3/eval/operand-coercion`-class
errors or silently mis-evaluates:

```text
{{ SUM([Qty] * [Price]) }}                               # ✗ — bad-aggregate-arg (ADR-0059)
{{ SUM([A] + [B]) }}                                     # ✗ — bad-aggregate-arg (ADR-0059)
{{ AVERAGE(IF([Region]="Seoul", [Amount], 0)) }}         # ✗ — bad-aggregate-arg (ADR-0059)
{{ SUM([Amount]) / 1.1 }}                                # ✗ — operand-coercion
{{ SUM([Net]) - SUM([Cost]) }}                           # ✗ — operand-coercion
{{ IF([Qty] * [Price] >= 80000, "Top", "Std") }}         # ✗ — comparison LHS is arithmetic
```

(The IF case also bites in data-block cells, not just footers.)

Two safe paths:

1. **Pre-compute the column upstream** so XTL only sees a simple column.
   If raw has a `Sales` column equal to `Qty × Price`, then
   `{{ SUM([Sales]) }}` and `{{ IF([Sales] >= 80000, …) }}` both work.
2. **Drop down to a native Excel formula in the footer cell.** xl3
   preserves cell formulas verbatim (ADR-0046); Excel computes them
   when the workbook opens.

If you choose (2), avoid the next two pitfalls.

### Footer pitfall #1 — Self-column SUM raises 순환 참조 (circular reference)

A footer cell sitting in column G that contains `=SUM(G:G)` or
`=SUM(G5:G10000)` references its own cell. Excel opens the workbook and
shows a **순환 참조** warning; the cell evaluates to 0.

✗ Wrong (footer is in G, references G):

```text
G_footer = =SUM(G5:G10000)
```

✓ Right — reference *other* columns instead:

```text
G_footer = =SUMPRODUCT(E5:E10000, F5:F10000)    # qty × price; no G refs
```

`SUMPRODUCT(A_range, B_range)` is the go-to for "sum of A × B" totals.
For other shapes use `SUMIF` (see pitfall #2).

### Footer pitfall #2 — Overshoot range silently double-counts

A footer at row N with `=SUM(H2:H10000)` includes H_N — which is itself
the XTL `{{ SUM([…]) }}` aggregate for that column. The data total
gets added twice.

```text
H_footer = {{ SUM([Amount]) }}                        # already the data total
G_footer = =SUM(H2:H10000) / 1.1                      # = (total + total)/1.1 ✗ 2× wrong
```

Fix: filter out the footer row by its label column.

```text
A_footer = "합계"
G_footer = =SUMIF(A2:A10000, "<>합계", H2:H10000) / 1.1                # ✓
I_footer = =SUMIF(A2:A10000, "<>합계", H2:H10000)
         - SUMIF(A2:A10000, "<>합계", F2:F10000)                       # ✓
```

The label column never contains the footer's text in real data rows, so
`<>합계` (or `<>Total`, `<>Grand Total`, etc.) cleanly removes only the
footer. Pick a label that no data row uses.

### Footer formulas: range bounds

Because the footer's actual rendered row number is unknown at template
authoring time (it depends on source-row count), write **overshoot
ranges** like `…2:…10000` rather than guessing the exact end. `SUM` /
`SUMIF` / `SUMPRODUCT` ignore empty cells, so the overshoot is harmless
as long as you have ruled out pitfalls #1 and #2.

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
8. **Footer formula audit** (only if any footer cell uses a native
   `=…` formula). For each such cell:
   (a) Does the formula reference its own column range? If yes →
   circular reference. Re-author with `SUMPRODUCT` over different
   columns.
   (b) Does the formula's range overlap a same-row XTL `{{ SUM(…) }}`
   footer cell? If yes → double-counts. Re-author with
   `SUMIF(label_col, "<>footer_label", …)`.
   See [Footer escape hatch](#footer-escape-hatch-when-xtl-cant-express-the-total)
   for the safe patterns.

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

### Diff against a known-good output when one exists

If the user hands you a finished report the template is supposed to
reproduce (a "golden" file), don't stop at eyeballing: load both
workbooks and compare **cell by cell** — values, not formatting —
until the mismatch count is zero. Every unexplained mismatch is either
a template bug or a real difference in the source data; chase each one
to its origin before declaring the template done. A rule that happens
to hold for one month's data often breaks on the next — when you have
two periods of data, verify against both.

### Formula cells cannot be verified by reading the file

Engine-written cells hold literal values and are directly checkable.
Native `=…` formula cells are **not**: the engine re-emits template
cell values verbatim (ADR-0046) and never computes a fresh cache — a
formula you authored cache-less stays cache-less, and converted
outputs carry no full-recalc flag — so a library like `exceljs` reads
`{ formula, result: undefined }`. To verify such cells, force a
recalculation — open the output in Excel, or headlessly:

```bash
soffice --headless --convert-to xlsx --outdir recalc out.xlsx
```

then re-read the recalculated copy. Know what this does and doesn't
do: a plain `--convert-to` does **not** force a full recalculation —
LibreOffice recomputes cache-less formula cells and volatile chains on
load, which is exactly enough for engine-written formulas (cache-less,
see above). A cell carrying a *stale* cached value keeps it; for a
guaranteed full recalc, strip the cached `<v>` elements at the zip
level first, or drive a real open→recalculate→save via a UNO script.
Corollary: **where verifiability matters, prefer engine-evaluated XTL
cells over native formulas** — they render as plain values you can
assert against.

### Probe unfamiliar behavior before committing to it

Several failure modes in this document are *silent* — the render
succeeds and the output is quietly wrong. Before you rely on a
directive combination or formula pattern you have not used before,
build a 10-cell scratch template and run `convert()` on tiny synthetic
data to confirm the behavior, then apply it to the real template.

---

## Excel round-trips, formula caches, and programmatic editing

An xl3 template is a build artifact: the exact bytes matter. Two
Excel/LibreOffice behaviors — both invisible in the UI — can corrupt
a template that contains native `=…` formulas, and two common library
bugs can corrupt one you build programmatically.

### Hazard 1 — recalculated caches become phantom template text

The parser reads a formula cell's **cached result string** as that
cell's template text (a cell value of `{ formula, result }` is read as
`String(result)`). When Excel/LO opens a template it recalculates
(volatile functions always; everything on some calc settings) and the
save writes those results into the file. At template time a formula
that references a marker cell evaluates to marker *text* — so after an
innocent open-and-save, a cell can cache a string like
`{{ [Key] }} / Subtotal`, and on the next render the parser treats it
as a real `[Key]` marker. The classic symptom: a `@subtotal` row is
silently reclassified as a second data row, so the "subtotal band"
repeats after every data row carrying block-level grand totals.

Defenses, in order of preference:

1. **Don't open-and-save the shipped file.** Inspect a copy; upload
   the generated file byte-for-byte.
2. **Author formulas so their template-time value is harmless.** Wrap
   numeric formulas in `IFERROR(…, 0)`. For text formulas that read
   marker cells, guard on the marker prefix — and build the `{{`
   literal as `"{"&"{"` so the formula body itself never contains a
   marker-shaped substring:

   ```text
   =IF(LEFT(INDIRECT("W"&(ROW()-1)),2)="{"&"{", "",
       INDIRECT("W"&(ROW()-1))) & " / Subtotal"
   ```

3. **Strip formula caches when packaging.** Remove `<v>` children of
   `<f>`-bearing cells at the zip level; Excel and LibreOffice
   recompute cache-less cells on load.

### Hazard 2 — shared-formula consolidation

Excel and LibreOffice consolidate identical (R1C1-equivalent) formulas
into OOXML *shared formulas* on save. The engine normalizes these
before cloning (`unshareFormula`, ADR-0066 / issue #46): the owner
cell keeps its formula text, and each member cell resolves to the
**owner's formula text verbatim** — references are *not* re-adjusted
to the member's position. So a group Excel abbreviated (e.g. block
cells `H8:P8` holding `…*H$6`, `…*I$6`, … — identical in R1C1)
round-trips as N copies of the owner's A1 text: every member computes
the owner column's formula, the "one column's formula smeared across
the row" symptom. Row/column-agnostic formulas (the
`INDIRECT(…&ROW())` style from the guides) survive this;
position-dependent ones silently don't — that asymmetry is the second
reason for the open-and-save ban above. When *building* a template
with `exceljs`, clear pre-existing data-area formulas before rewriting
rows ("Shared Formula master" errors at build time are this same
mechanism surfacing in the library).

### Hazard 3 — library serialization bugs (programmatic editing)

- **Don't use `openpyxl`** on templates containing images or drawings
  — it duplicates/corrupts drawing parts. Use an `exceljs`
  load→modify→save round-trip.
- **`exceljs` writes `<sheetPr>` children in a non-schema order**
  (`pageSetUpPr` before `outlinePr`; CT_SheetPr requires
  `tabColor → outlinePr → pageSetUpPr`). It only manifests when a
  sheet has both fit-to-page and outline properties — and Excel then
  shows the "repair this workbook?" dialog. Swap the two elements at
  the zip level after saving.
- **`exceljs` can write image anchors with `<a:ext cx="0" cy="0"/>`**
  (zero-size images; Excel may also flag the file). Patch the real
  EMU extents back in after saving.

### Diagnosing the Excel repair dialog

If Excel offers to repair a file you produced, the usual cause is XML
**element order** (an `xsd:sequence` violation), not malformed XML —
`xmllint` will pass. Fastest diagnosis: let Excel repair and save a
copy, then diff the repaired part against yours — Excel deletes
exactly the offending element, pointing you at the violation.

---

## `__inputs__` defaults can be computed (ADR-0050)

The `default`, `label`, `description`, and `options` cells of the
`__inputs__` sheet are themselves XTL templates — they are evaluated
once, at `readTemplateInputs()` time, before the host UI ever shows
them to the operator. You no longer have to choose between a literal
placeholder string and "force the host to compute the default."

```text
| name        | type   | default                                | label             |
|-------------|--------|----------------------------------------|-------------------|
| report_date | date   | {{ TODAY() }}                          | Report date       |
| filename    | text   | {{ TEXT(TODAY(), "YYYY-MM") }}-report  | Output filename   |
| title       | text   | {{ __config__[region] }} 거래명세서    | Title             |
```

The evaluation context is **constrained**:

- ✓ Available: `__config__[key]`, `TODAY()`, `DATE(y,m,d)`, `IF`,
  `IFEMPTY`, `IFS`, `IFERROR`, `UPPER`, `LOWER`, `TRIM`, `TEXT`,
  `YEAR`, `MONTH`, `DAY`, `EOMONTH`, `EDATE`, `DATEDIF`, `ROUND`,
  `ABS`.
- ✗ Forbidden — raises `xl3/inputs/forward-reference`:
  `[Column]`, `Source[Column]`, `__sources__[…]`, `__inputs__[name]`
  (no input-to-input refs), `ROW()`, and any aggregate / lookup
  (`SUM`, `COUNT`, `AVERAGE`, `MIN`, `MAX`, `XLOOKUP`) — these need
  data the renderer has not loaded yet.

What this rules out:

- **`=TODAY()` as the cell formula in the default column.** xl3
  reads the cell's *string* value, not Excel's recalculated date.
  Use `{{ TODAY() }}` (the XTL form) instead — it is evaluated
  *every* time `readTemplateInputs()` runs, so the default is
  always "right now," not "last save."
- **Defaults that look up source data.** They cannot. Default
  values are static at input-read time. If the value must come
  from the data file, expose it as an `__inputs__` row the host
  supplies, not as a derived default.

See [`docs/guides/06-runtime-inputs.md`](./guides/06-runtime-inputs.md)
§"Computed defaults and labels" for the full recipe.

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
- [`docs/guides/06-runtime-inputs.md`](./guides/06-runtime-inputs.md)
  — `__inputs__` declarations and computed defaults (ADR-0050).
- [`docs/guides/10-styling-and-branding.md`](./guides/10-styling-and-branding.md)
  — how styling propagates; merged-header rules.
- [`docs/guides/15-directive-composition.md`](./guides/15-directive-composition.md)
  — when multiple directives stack on one block.
- [`docs/guides/16-xtl-vs-excel-formula.md`](./guides/16-xtl-vs-excel-formula.md)
  — the render-time boundary; when XTL is required vs when a cell
  formula is the right answer.
- [`docs/guides/18-group-and-subtotal.md`](./guides/18-group-and-subtotal.md)
  — `@group` / `@subtotal` for interleaved per-customer / per-month
  subtotals (the Korean B2B invoice / settlement pattern).

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
> last intentional footer. For per-group or grand-total footers reach
> first for `@group` + `@subtotal` (ADR-0038, xl3 0.6). When a derived
> total can't be written as a single-column XTL aggregate
> (`SUM([col]) / 1.1` and `SUM([A]) - SUM([B])` are both rejected),
> drop down to a native Excel formula in the footer — but never
> reference the formula cell's own column, and use
> `SUMIF(label_col, "<>footer_label", …)` to exclude the footer row
> from the sum. `__inputs__` defaults can themselves be XTL
> (`{{ TODAY() }}`, `{{ __config__[region] }}`) — evaluated once per
> `readTemplateInputs()` call (ADR-0050), so date defaults stay
> current without host-side computation.
