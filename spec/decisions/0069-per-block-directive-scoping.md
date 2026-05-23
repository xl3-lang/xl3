# ADR 0069 — Per-block directive scoping

- **Status:** accepted
- **Date:** 2026-05-24
- **Spec target:** XTL 0.1
- **Affects:** language.md (Directives); impl (parser); 1 new error code

## Context

Through XTL 0.1 up to 0.7.x, transformation directives
(`@filter`, `@sort`, `@top`, `@source`, `@join`, `@group`) attach
to a sheet's single data block by construction — there's only one
block, so attachment is unambiguous. Phase 2 enables multiple
`@block` directives per sheet (ADRs 0067, 0068), making directive
attachment a real design question:

- When a sheet has two `@block`s and one `@filter`, which block
  does the filter modify?
- When a sheet has 3 blocks and a `@source` directive in a cell
  that overlaps two of the blocks' column ranges, which block
  binds the source?

Three credible models for the attachment rule:

- **Sheet-level (status quo)** — directive applies to all blocks
  on the sheet. Simple, but breaks the multi-block use case
  (different `@filter` per block is a common need).
- **Explicit per-block syntax** — extend `@block` to nest the
  transformations, e.g.,
  `{{ @block A:D filter=[Status]="VIP" sort=[Rev] desc }}`. Reduces
  number of directive cells but reinvents the existing
  directive grammar inside `@block`.
- **Proximity-based per-block scoping (this ADR)** — directives
  attach to the closest `@block` they apply to, by row position
  and column overlap.

## Considered Options

**A. Proximity-based per-block scoping (this ADR).** A directive
cell `D` at position `(r_D, c_D)` attaches to the data block `B`
on the sheet such that:

1. `r_D < B.startRow` (directive is above the block); AND
2. The column range `[c_D..c_D]` of the directive cell overlaps
   with `[B.colStart..B.colEnd]`; AND
3. Among all blocks satisfying (1) and (2), `B.startRow - r_D` is
   minimized (the closest block below the directive in column-
   overlap zone wins).

If no block satisfies (1) and (2), the directive is *orphan* and
parsing raises `xl3/directive/orphan` with the cell location.

**B. Sheet-level (no scoping change).** Directives apply to all
blocks. Simple but doesn't support per-block filtering — the
primary motivation for multi-block.

**C. Explicit binding via `@block` arguments.** Fold the
transformation directives into the `@block` declaration:
`{{ @block A:D source=Customers filter=[Status]="VIP" }}`.
Reduces cell count but conflicts with ADR-0067's "small
`@block` grammar" decision and duplicates existing directive
syntax.

Option A chosen. Proximity scoping uses the same positional
intuition Excel authors already apply when reading a template
(a `@filter` cell sitting above and aligned with a block's
columns is "that block's filter"). It requires zero new syntax,
re-uses existing directive cells, and degrades to the sheet-
level behavior naturally when there's only one block on the
sheet (every directive trivially attaches to that block).

## Decision

The following becomes normative spec text in `language.md`'s
"Directives" section (extending existing prose):

> **Directive scoping (multi-block sheets).** Each transformation
> directive (`@filter`, `@sort`, `@top`, `@source`, `@join`,
> `@group`, `@repeat`) attaches to exactly one data block on the
> sheet, determined by the following rule:
>
> Let `D` be the directive's cell at position `(r_D, c_D)`. The
> block `B` it attaches to is the one such that:
>
> 1. The directive's row is strictly above the block's first row:
>    `r_D < B.startRow`.
> 2. The directive's column lies within the block's column range:
>    `B.colStart <= c_D <= B.colEnd`.
> 3. Among blocks satisfying (1) and (2), `B.startRow - r_D` is
>    minimized.
>
> If no block satisfies conditions (1) and (2), the directive is
> *orphan* and the parser raises `xl3/directive/orphan` at parse
> time with the cell location.
>
> On single-block sheets (one block detected per ADR-0066/0068),
> the rule degenerates: every directive cell positioned above the
> block's first row and within the block's column range attaches
> to that one block. Directives outside the block's column range
> on single-block sheets ALSO raise `xl3/directive/orphan` —
> consistent with multi-block — even though there is only one
> block to attach to.
>
> `@subtotal` is an exception: it sits *inside* a block (its row
> position determines which block contains it, ADR-0058 row
> binding rules apply within that block).

### Worked example

```text
row 1: {{ @sort [Revenue] desc }}      {{ @source Vendors }}
row 2: {{ @filter [Status]="VIP" }}                                   {{ @top 5 }}
row 3: {{ @block A:D }}                {{ @block E:H }}
row 4: {{ [Account] }} {{ [Name] }} {{ [Rev] }} {{ [Status] }}  {{ [Sku] }} {{ [Price] }} {{ [Stock] }} {{ [Vendor] }}
```

- `@sort [Revenue] desc` at A1 → col A is in block 1's col-range
  `[A..D]` AND r=1 < block 1 startRow=3 → attaches to block 1.
- `@source Vendors` at E1 → col E in block 2's `[E..H]` AND r=1 <
  block 2 startRow=3 → attaches to block 2.
- `@filter [Status]="VIP"` at A2 → block 1.
- `@top 5` at H2 → block 2.

Each block ends up with its own filter / sort / source / top
without any explicit binding markup.

### Single-block sheet behavior

A directive cell at `(r_D, c_D)` on a sheet with only one block
still requires `c_D` to lie within the block's column range to
attach. If a single-block sheet has a `@filter` cell positioned
to the right of the block's last column, the directive raises
`xl3/directive/orphan` — same as multi-block. The benefit:
authors writing single-block templates today get a clear error
if they accidentally place a directive outside the block's
column scope, instead of the previous "directive silently
applies sheet-wide" behavior.

(This is a *narrow behavior change*: pre-0.8 templates with a
directive outside the single block's col range previously had
that directive applied; now it errors. In practice no real-world
template was observed using this pattern intentionally — the
out-of-scope placement was always an authoring mistake.)

## Consequences

**One new error code** — `xl3/directive/orphan`, raised at parse
time when a directive cannot attach to any block on the sheet.
The error message names the directive name and cell location.
G3 clock reset compounds with ADRs 0067/0068.

**Narrow behavior change on single-block sheets.** A directive
placed outside the block's column range previously applied
sheet-wide; now it errors. Migration: move the directive into a
column within the block's range (almost always what the author
intended). Documented in 0.7.x → 0.8.0 migration notes.

**Sheet-level directives effectively don't exist anymore.** With
proximity-based attachment, every directive belongs to exactly
one block (or is orphan). There is no "applies to all blocks"
semantics — authors who want the same filter on multiple blocks
must declare the filter directive cell once per block (a small
but justified cost of explicit scoping).

**Directive order on a shared row is irrelevant.** When multiple
directives sit on the same row (e.g., `{{ @sort ... }}` at A1
and `{{ @source ... }}` at E1), each attaches independently per
the rule. Evaluation order across directive types is unchanged
(ADR-0029).

**Conformance fixture coverage**:
- `153-directive-orphan-error` — directive cell outside any
  block's column range raises `xl3/directive/orphan`.
- `154-multi-block-per-block-filter` — two blocks with different
  `@filter` directives, each block's output reflects only its
  own filter.
- `155-multi-block-row-function-scope` — `ROW()` returns the
  iteration index of the cell's containing block (carry-over
  from ADR-0066 single-block rule, now exercised in multi-block
  context).

## References

- ADR-0029 — directive composition and evaluation order (unchanged
  by this ADR; ordering across directive types is the same).
- ADR-0066 — column-scoped data block; provides the `colStart` /
  `colEnd` used by the column-overlap check.
- ADR-0067 — `@block` directive grammar.
- ADR-0068 — multi-block detection (strict mode); companion to
  this ADR.
