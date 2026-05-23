# ADR 0068 — Multi-block detection (strict mode)

- **Status:** accepted
- **Date:** 2026-05-24
- **Spec target:** XTL 0.1
- **Affects:** language.md (Data Blocks); impl (parser); 1 new error code

## Context

ADR-0066 established column-scoped data blocks but limited a sheet
to at most one block, with disconnected marker clusters raising
`xl3/expression/bracket-outside-block` at parse time. ADR-0067
introduced the `@block` directive for explicit boundary declaration.

The remaining design question: when both implicit detection and
explicit `@block` directives are in play on the same sheet, how
does the engine decide which cells belong to which block? Two
competing models:

- **Permissive (mixed-mode)** — explicit `@block` directives claim
  their rectangles; any leftover marker cells outside all explicit
  blocks form an additional implicit block subject to ADR-0066's
  cluster rules. Friendly for migrating an existing single-block
  template by adding a sidebar via just one new `@block` on the
  sidebar.
- **Strict** — if a sheet has any `@block` directive, ALL marker
  cells on that sheet MUST be inside some `@block` rectangle.
  Mixed mode is forbidden; the implicit auto-detection runs only
  when zero `@block` directives are declared.

Permissive is friendlier per-migration; strict is friendlier per-
review and per-spec.

## Considered Options

**A. Strict mode (this ADR).** One-of:
- ZERO `@block` on sheet → ONE implicit block per ADR-0066's rules.
  Cluster-completeness check applies (multiple disconnected clusters
  raise `xl3/expression/bracket-outside-block`).
- ≥1 `@block` on sheet → all marker cells must lie inside some
  `@block` rectangle. Orphan markers raise
  `xl3/expression/bracket-outside-block`. No implicit cluster
  detection runs.

**B. Permissive (mixed) mode.** `@block` directives claim their
rectangles; leftover marker cells form additional implicit blocks
subject to ADR-0066 cluster checks. Up to N+M total blocks per
sheet (N explicit + M implicit).

**C. No-mix forbidden** — sheets are either all-implicit or
all-explicit. Same as strict A but framed as a sheet-mode toggle.
Effectively equivalent to A.

Option A chosen. Strict mode trades a small one-time migration
cost (when an author wants a second block, they must add `@block`
to the existing block too, not just the new one) for substantial
review and debugging clarity:

- Reading a template's first `@block` instantly tells the reader
  "this sheet uses explicit blocks; check the others." No silent
  hidden implicit block.
- Adding a stray marker reference somewhere on the sheet
  immediately raises an error pointing at the location, rather
  than silently extending or creating a new implicit cluster.
- Conformance testing the "any `@block` present" rule is a
  one-line predicate; mixed mode requires per-cell membership
  tracking across N explicit + M implicit blocks.

The migration cost is bounded: a real-world transition adds one
`@block` directive cell to the existing block (one keystroke
effort). Existing templates without `@block` continue to work
unchanged via ADR-0066 implicit detection.

## Decision

The following becomes normative spec text in `language.md`'s
"Data Blocks" section (extending the existing single-block
description):

> A sheet's data block(s) are determined by which directives the
> author declared:
>
> **Implicit mode (no `@block` directives on sheet).** Exactly one
> data block per sheet, detected via the marker-cluster rule
> (ADR-0066). If two or more disconnected marker clusters exist,
> `xl3/expression/bracket-outside-block` is raised.
>
> **Explicit mode (one or more `@block` directives on sheet).**
> Each `@block` directive defines one data block whose row and
> column ranges are determined by the directive's form (bare /
> col-range / full-rect; ADR-0067). All marker cells (`[Column]`
> references outside aggregates) on the sheet MUST lie inside
> some `@block` rectangle; orphan markers raise
> `xl3/expression/bracket-outside-block` and identify the cell
> location.
>
> `@block` rectangles MUST NOT overlap. Overlap (row or column
> intersection between any two `@block` declarations on the same
> sheet) raises `xl3/block/overlap` at parse time and identifies
> the two blocks.

### Mode determination

The parser checks the sheet's cells for `@block` directives before
running implicit cluster detection:

- If at least one `@block` cell exists, mode = explicit.
- Otherwise, mode = implicit (ADR-0066 detection runs as today).

The two modes never coexist on the same sheet by construction;
this is the "strict" choice.

### Multi-block sheet layout examples

**Side-by-side two tables** (both bound to default source):
```text
{{ @block A:C }}                          {{ @block E:H }}
{{ [Account] }} {{ [Name] }} {{ [Total] }} {{ [Sku] }} {{ [Price] }} {{ [Stock] }} {{ [Vendor] }}
```

**Vertically stacked two tables** (different sources):
```text
{{ @block }} {{ @source Customers }}
{{ [Account] }}  {{ [Name] }}

(gap rows here are fine — they're between blocks, not inside one)

{{ @block }} {{ @source Vendors }}
{{ [Vendor] }}  {{ [Country] }}
```

**Mixed orientation — explicit + an outside-cell side note** (no
implicit second block; the static side note isn't a block):
```text
{{ @block A:D }}                                  side note (outside)
{{ [Customer] }} {{ [Revenue] }} {{ [Region] }} {{ [Status] }}
```

### Cross-block reference semantics (informational)

Per ADR-0066, outside cells are preserved at their original row
positions and their formula text is preserved verbatim. With
multi-block, "outside" means outside all blocks on the sheet.

If an outside cell references a cell inside a block (e.g., a side
note formula `=B5`), the engine does not rewrite the reference —
the block-expansion may have shifted block-interior cells, so
the reference can become stale. This is documented in ADR-0066
and applies identically in multi-block mode. Workaround patterns:
use whole-column references (`SUM(B:B)`), or place the formula
inside a block's column range so it shifts together with the
data.

Block-to-block references (a cell in block A referencing a cell
in block B) are similarly user-managed; the engine doesn't track
or guarantee cross-block reference validity.

## Consequences

**Backward compatibility — strictly additive.** Implicit-mode
templates (no `@block`) are unchanged. The `xl3/block/overlap`
error is new but can only be raised by templates using `@block`
— which didn't exist before this ADR.

**Two error codes affected**:
- `xl3/expression/bracket-outside-block` (existing per ADR-0066) —
  its meaning is extended: in explicit mode it also fires for
  marker cells outside any declared `@block`.
- `xl3/block/overlap` (new) — added to catalog. G3 30-day clock
  resets to today (compound reset with ADR-0067's
  `xl3/block/empty-table`).

**Migration cost is bounded.** Adding a second block to an existing
single-block template requires the author to also add `@block` to
the existing block (one cell). No other change is required.

**Implementer note.** The mode-determination pass should run before
cluster detection so the parser doesn't waste work computing
implicit clusters that will be discarded in explicit mode. The
overlap check requires O(B²) rectangle intersection across the
sheet's `@block` set (B = number of `@block` directives per sheet);
in practice B ≤ 5 or so for realistic templates, so the quadratic
cost is negligible.

**Conformance fixtures**:
- `146-multi-block-explicit-two-tables` — two `@block` directives,
  different col-ranges, default source.
- `147-multi-block-different-sources` — per-block `@source` binding.
- `148-multi-block-different-start-rows` — stacked vertically.
- `151-block-overlap-error` — `xl3/block/overlap`.
- `152-block-empty-table-error` — `xl3/block/empty-table` (per
  ADR-0067; covers the multi-block case where one block has no
  markers).

`145-block-bracket-outside-error` (already shipped in 0.7.x) was
written assuming the Phase 1 single-block enforcement and remains
valid: in implicit mode it still raises for disconnected clusters.

## References

- ADR-0066 — column-scoped data block; cluster detection rule.
- ADR-0067 — `@block` directive grammar.
- ADR-0069 — per-block directive scoping (companion to this ADR).
- ADR-0015 — append-only error code catalog principle (G3 clock
  reset note above).
