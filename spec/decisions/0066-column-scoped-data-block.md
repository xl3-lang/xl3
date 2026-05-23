# ADR 0066 — Column-scoped data block

- **Status:** accepted
- **Date:** 2026-05-23
- **Spec target:** XTL 0.1
- **Affects:** language.md (Data Blocks section, new); evaluation.md (Render Phases); impl (parser, renderer); new error code

## Context

Up through 0.7.0 the engine treats the **entire width of the data-row
range** as part of a single data block. `renderer.ts` captures every
cell of the block's template rows via `row.eachCell({ includeEmpty:
true })` regardless of which column the cell sits in, and clones the
captured cells into every expanded row. Rows below the data block
shift down by the splice-insert count across all columns.

This row-wide assumption is not normative — spec/language.md defines
"data block" only in row terms (the rows containing `{{[col]}}`
expressions). The column scope of a block has been implementation-
defined since 0.1.

The row-wide assumption is a latent bug factory for templates with
content beside the data block on the same sheet — the "side summary
table" pattern that's common in invoice / 거래명세서 / 정산서
workflows:

```
row 3:  헤더A  헤더B  헤더C  ...  헤더N  |  요약 헤더  값
row 4:  {{[a]}} {{[b]}} {{[c]}} ... {{[n]}} |  링키지랩 A  =SUMIF(...)
row 5:  합계   {{SUM([b])}}                |  링키지랩 B  =SUMIF(...)
row 6:                                     |  합계        =SUM(Q4:Q5)
```

Concrete failure modes observed at 0.7.0:

- **Issue #46 — silent data loss.** OOXML shared-formula owner cells
  in P4–S4 (outside the apparent "data" columns A–N) are cloned into
  all 858 expanded rows verbatim, producing 858 duplicate owners of
  the same `ref` range. Excel sees this as corrupt and either drops
  cells or surfaces a repair dialog. Worked around in 0.7.x with
  `unshareFormula` (commit `bcbe239`), but the root cause is that
  outside cells were captured-and-cloned at all.
- **Issue #47 — formula ref staleness.** Cells below the data block
  but in non-block columns (P5:S14 in the example) get row-wide
  shifted by `spliceRowsPreservingMerges`. The formula text in those
  cells (e.g., `=SUM(Q12:Q13)`) is preserved verbatim by ExcelJS, so
  after shift the row references no longer match the cells' new
  positions. xl3 makes no attempt to rewrite formula refs.
- **Replication noise.** Static side cells (e.g., P4 = '링키지랩 A')
  get cloned into all expanded rows, producing N identical copies
  alongside the data — almost never the author's intent.

Two corrective design directions were considered: per-cell formula
ref rewriting (matching Excel's "Insert Rows" behavior) or column-
scoping the data block. Column-scoping is the simpler, more durable
fix — it aligns with Excel's natural intuition (typing in column A
doesn't affect column P) and removes the row shift for outside
columns entirely, so the ref-staleness problem doesn't arise.

## Considered Options

**A. Column-scope the data block (this ADR).** The block's column
range is the bracket-expression hull. Cells outside that range are
preserved at their original row positions; the splice's row shift
applies only to cells inside the block's column range. Single block
per sheet (multi-block deferred to future ADR).

**B. Row-wide block + post-splice formula ref rewrite.** Keep the
current row-wide capture. After splicing, walk shifted cells, parse
formula text, adjust row digits in cell references. Matches Excel's
Insert Rows semantics literally.

Pros of A: simpler impl; no formula parser needed; no risk of
mis-adjusting refs (false positives from string literals, function
names, etc.); outside cells never shift so #47 disappears by
construction; aligns with the user mental model that the data block
"belongs to" specific columns.

Pros of B: matches Excel UI behavior for "Insert Rows" 1:1; lets
authors put any content in any column without worrying about scope.

Cons of A: behavior change for templates that put static text or
formulas inside data-block rows in non-bracket columns expecting it
to replicate — those cells now stay at the original row only (the
user-helpful direction for almost all real-world cases).

Cons of B: formula parsing is fragile (cross-sheet refs, quoted
sheet names, string literals containing cell-like patterns, named
ranges); risk of incorrect ref adjustment is itself a silent-data-
loss path; doesn't solve the "static text replicated 858 times"
noise.

**Option A chosen.** Aligns with xl3's philosophy of small, predictable
surface (ADR-0043, ADR-0048); avoids introducing a formula parser
into xl3's scope; eliminates an entire class of latent bug
(shared-formula corruption, ref staleness) by construction rather
than by patching.

## Decision

The following becomes normative spec text in `language.md`'s new
**Data Blocks** section:

> A *data block* on a sheet is the maximal rectangle `[r_start..r_end]
> × [c_start..c_end]` such that:
>
> - Every row in `[r_start..r_end]` contains at least one cell whose
>   `{{ ... }}` body references at least one `[Column]` outside an
>   aggregate function (a *data-row cell*).
> - `c_start` is the minimum column of any cell with a `{{ ... }}`
>   expression body (data-row cell or aggregate cell — `{{ COUNT() }}`,
>   `{{ SUM([col]) }}`, etc.) in the row range; `c_end` is the
>   maximum. Aggregate expression cells in a data-block row are
>   inside the block because authors place them alongside data cells
>   to render per-row context (e.g., a customer name with a count
>   total in the same row, replicated per customer).
> - The row range is the maximal run of consecutive rows satisfying
>   the first condition.
>
> Cells inside the rectangle are *block cells*. Cells outside the
> rectangle but on the same sheet are *outside cells*.
>
> **Block expansion.** When the engine expands the data block to `N`
> records (after `@filter` / `@sort` / `@top` / `@group` /
> `@repeat right` apply), the block's row range expands from
> `r_end - r_start + 1` template rows to `N × (r_end - r_start + 1)`
> output rows. The expansion affects only `[c_start..c_end]` columns:
>
> - Block cells are cloned into the expanded rows (one record per
>   `r_end - r_start + 1` rows).
> - Outside cells with row `r < r_start` remain at their original
>   `(r, c)` position.
> - Outside cells with row `r ≥ r_start` are preserved at their
>   original row `r` position; they do **NOT** shift downward with
>   the expansion. Their formula references (if any) are preserved
>   verbatim.
> - Cells inside the column range but in rows `r > r_end` (i.e.,
>   below the data block, in block columns) ARE shifted down by
>   `(N - 1) × (r_end - r_start + 1)` to make room for the expansion.
>
> A `{{[Column]}}` reference in an outside cell raises
> `xl3/expression/bracket-outside-block` at parse time (no implicit
> single-block fallback — outside cells must not reference data
> columns, since the cell does not iterate with the block).

For 0.7.x compatibility, the engine continues to assume **a single
data block per sheet**; multi-block detection and the optional
`@block` directive for explicit boundaries are deferred to a future
ADR.

Add to `evaluation.md` "Render Phases":

> Per-column shift on splice. The render phase that inserts rows for
> block expansion (`renderDataRows`) MUST apply the row shift to
> cells in `[c_start..c_end]` only. Cells in columns outside that
> range MUST appear at their original row positions in the output,
> regardless of expansion factor.

## Consequences

**Behavioral change for templates with outside-column content.**
Templates that placed static text or formulas in non-bracket columns
of the data-row range previously had that content replicated into
every expanded row. After this ADR they appear at the original row
only. This is user-helpful in all observed cases (issue #46 and
similar replication-noise reports). No production user has reported
intentional use of the row-wide cloning behavior.

**Backward compatibility — narrow break.** Templates without any
outside-column content are unaffected. Templates with outside-column
content render differently but the new rendering matches author
intent. Migration notes added to `CHANGELOG.md` and the
0.7 → 0.8 section of `docs/migration-0.x-to-1.0.md` (when that
guide is created per ROADMAP G19).

**New error code.** `xl3/expression/bracket-outside-block` added to
the catalog. Raises at parse time when a `[Column]` reference (i.e.,
a data-row marker) appears in a cell that is not inside any data
block's rectangle. G3's 30-day catalog-frozen clock (ROADMAP)
resets along with the existing 0.7.0 additions; the engine's first
new-code-free 30-day window starts from the latest of these
additions.

**Issue #46 resolution path.** The `unshareFormula` workaround
(`src/renderer.ts`, commit `bcbe239`) becomes redundant for the
outside-column path. It is retained for defense against any future
case where a shared-formula owner appears legitimately inside a
data block's column range — a narrower scenario that was not the
root cause of the reported failures.

**Issue #47 resolution.** Outside cells do not shift, so their
formula references are not subject to row-number staleness. No
formula parser or ref-rewriter needed.

**Conformance corpus.** Fixtures added:

- `141-block-column-scoped-side-cells` — side cells preserved at
  original positions across expansion
- `142-block-column-scoped-side-formulas` — formula cells with row
  refs in side area remain valid (#47 regression)
- `143-block-shared-formula-side-cells` — shared-formula owners in
  side area not duplicated (#46 regression)
- `144-block-side-cells-after-block` — distinction between in-block
  rows shifted (e.g., footer cells in block columns) and outside-
  block rows preserved (side rows)
- `145-block-bracket-outside-error` — `[col]` reference in outside
  cell raises `xl3/expression/bracket-outside-block`

These fixtures contribute to ROADMAP G1 (≥ 140 conformance
fixtures); five new entries bring the corpus from 139 to 144 at
0.7.1 cut.

**Multi-block deferral.** Multi-block per sheet, the `@block`
directive (with range-spec forms), and per-block directive scoping
are explicitly deferred. They remain candidates for a future ADR
once concrete multi-block use cases emerge. The current ADR sketches
the column-scoping primitive that any future multi-block design will
build on; that future ADR will need to address detection algorithm
(strict explicit vs implicit cluster), directive scoping rules, and
their interaction with `@source` / `@repeat right`.

## References

- Issue #46 — duplicate shared-formula owners producing corrupt OOXML
  (silent data loss).
- Issue #47 — formula references in shifted outside cells become
  stale.
- Commit `bcbe239` — `unshareFormula` helper introduced as a
  defensive fix for the inside-column case of #46; remains relevant
  for the narrow scenario where a shared-formula owner appears
  inside the block's column range.
- ADR-0043 — Excel-native preference principle; this decision
  follows the "small predictable surface" preference over the
  larger "Excel-fidelity formula rewriter" alternative.
- ADR-0046 — Cell formula preservation contract; this ADR is
  consistent (still no formula rewriting; outside cells stay where
  they are, so their refs need no rewriting either).
- ROADMAP G1 — conformance corpus ≥ 140; this ADR's fixtures
  contribute.
- ROADMAP G24 — silent data loss is a critical-bug category; #46
  and #47 both fall under it. This ADR closes the structural cause.
