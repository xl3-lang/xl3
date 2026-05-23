# ADR 0067 — `@block` directive

- **Status:** accepted
- **Date:** 2026-05-24
- **Spec target:** XTL 0.1
- **Affects:** language.md (Directives + Data Blocks); impl (parser, renderer); 1 new error code

## Context

ADR-0066 (column-scoped data block) established that a sheet's data
block is the maximal connected rectangle of marker cells extended
through adjacent non-empty cells, and that the engine supports at
most one such block per sheet at 0.7.x. The single-block restriction
was intentional — multi-block detection was deferred until concrete
use cases emerged and an explicit syntactic boundary marker was in
the spec.

Two patterns surface concrete need for multi-block:

1. **Side-by-side tables** — a single sheet holding two unrelated
   data blocks, possibly bound to different sources (e.g., customer
   list on the left, product list on the right; or daily sales by
   region in two parallel columns).
2. **Vertically stacked tables** — two blocks on the same sheet at
   different starting rows, each iterating its own source (e.g., a
   header summary block at row 4 with one source and a detail block
   at row 20 with another).

The Phase 1 implicit auto-detection rule cannot disambiguate these
cases — multiple disconnected marker clusters raise
`xl3/expression/bracket-outside-block` at parse time today. An
explicit directive is needed so authors can declare each block's
geometry and the engine has unambiguous boundaries to render against.

## Considered Options

**A. `@block` directive with three grammar forms (this ADR).**
Authors declare each block via a directive cell placed above the
block, with optional Excel-native range syntax for explicit
boundaries:

- `{{ @block }}` — bare; col-range inferred from marker cells below
- `{{ @block A:D }}` — explicit col-range, row-range auto-detected
- `{{ @block A2:D7 }}` — fully explicit rectangle

**B. `@table` instead of `@block`.** Same semantics, Excel-Table-
inspired naming. Familiar to spreadsheet authors but creates a
vocabulary mismatch with spec/internal "data block" terminology.

**C. No directive — auto-detect everything.** Use a more aggressive
implicit clustering algorithm that can return multiple blocks per
sheet. Smaller spec surface but prone to silent reclassification
when authors edit templates (a stray `[col]` reference could
silently create a new block).

**D. Range-only spec (no bare form).** Always require `@block A:D`
or `@block A2:D7`. More verbose but zero ambiguity.

Option A chosen. Naming aligns with internal `DataBlock` type and
spec's existing "data block" usage (B rejected for vocabulary
consistency). The three-form grammar gives authors a typing-cost
gradient: bare for the common case, col-range when the data row
template doesn't fill the intended block extent, full-rect when
authors want zero ambiguity (e.g., in heavily reviewed templates
or auto-generated output).

The implicit auto-detection from ADR-0066 stays — `@block` is
opt-in, used only when an author needs explicit boundaries
(disambiguation, multi-block, range extension). Templates without
any `@block` keep working unchanged.

## Decision

A new directive is added to the spec's directive list:

```text
@block                  — bare; col-range auto-detected from {{...}} markers
@block <col-range>      — Excel column-letter range, e.g., A:D
@block <full-range>     — Excel A1-style rectangle, e.g., A2:D7
```

Grammar:

```text
block_directive   ::= "@block" ( WS excel_range )?
excel_range       ::= col_letters ":" col_letters                          # "A:D"
                   | col_letters digit+ ":" col_letters                    # "A2:D" — start-row + col-range
                   | col_letters digit+ ":" col_letters digit+             # "A2:D7" — full rectangle
col_letters       ::= [A-Z]+
```

`A:D7` and `A:D7` with mismatched col-letter style (lower-case,
mixed-case) raise `xl3/directive/invalid-syntax` — `@block` arguments
follow standard Excel cell-reference conventions.

### Semantics (placement and scope)

A `@block` directive cell sits in a cell whose row is **strictly
above** the block's first row. The directive's column position and
the optional range argument together determine the block's bounding
box:

- **Bare** `{{ @block }}`:
  - Block start row = first row below the directive's row that
    contains a marker cell `({{ ... }})`.
  - Block end row = last consecutive marker-containing row.
  - Block col-range = bounding box of marker cells in those rows,
    extended through adjacent non-empty cells per ADR-0066.

- **Col-range** `{{ @block A:D }}`:
  - Block col-range = explicit `[A..D]`.
  - Block start row / end row = auto-detected same as bare.
  - Marker cells inside `[A..D]` MUST be present in the inferred
    row range; if none exist, `xl3/block/empty-table` is raised.

- **Full-rect** `{{ @block A2:D7 }}`:
  - Block row range = `[2..7]` explicit.
  - Block col-range = `[A..D]` explicit.
  - Marker cells inside `[A2:D7]` MUST be present; otherwise
    `xl3/block/empty-table`.

### Interaction with `@source` / `@filter` / `@sort` / `@group` / `@top` / `@repeat` / `@join`

These directives are NOT folded into `@block` — they remain
independent directives that the engine attaches to the relevant
block via the **per-block proximity rule** (ADR-0069). An author
can combine:

```text
{{ @block A:D }} {{ @source Customers }} {{ @filter [Status] = "VIP" }} {{ @sort [Revenue] desc }}
{{ [Account] }}  {{ [Name] }}  {{ [Region] }}  {{ [Revenue] }}
```

Both `@source`, `@filter`, `@sort` attach to the `@block A:D` they
share a row with (col-overlap + same row direction matching). The
directive ordering on the row doesn't matter; spec evaluation order
is fixed (ADR-0029).

## Consequences

**Backward compatibility — strictly additive.** Templates with zero
`@block` directives continue to work via Phase 1's implicit cluster
detection (ADR-0066). Authors only need `@block` when they want
explicit boundaries (multi-block, range extension, or
self-documenting clarity).

**One new error code** — `xl3/block/empty-table`, raised when a
`@block` rectangle contains no marker cells. The existing
`xl3/expression/bracket-outside-block` (ADR-0066) is reused for the
"orphan marker outside any block" case when multi-block is in play
(see ADR-0068). G3's 30-day catalog-frozen clock resets to today.

**Grammar additions.** `block_directive`, `excel_range`, `col_letters`
are appended to `spec/language.md`'s grammar fragment alongside
`group_directive` / `subtotal_directive` (ADR-0058).

**Spec surface — three new forms.** Deliberately narrower than
"any Excel range can become a block declaration" — `@block` only
accepts column-range or rectangle forms, not whole-row forms like
`2:7` (rows-only is hard to read at a glance, and the bare form
covers the common case where the row range is obvious from
markers).

**Fixture coverage** — fixtures 149 (`block-col-range-explicit`)
and 150 (`block-full-rect-explicit`) exercise the explicit forms;
146 (`multi-block-explicit-two-tables`) exercises the bare form
in a multi-block sheet. Together they pin the three grammar forms
against the conformance corpus.

**Multi-block enables but does not require multi-source.** A
single source can feed multiple blocks (the same source's rows
iterated in two output regions). Per-block `@source` makes
multi-source explicit when needed.

## References

- ADR-0066 — column-scoped data block; primitive this directive
  builds on.
- ADR-0029 — directive composition and evaluation order; `@block`
  slots into the existing directive pipeline.
- ADR-0058 — `@subtotal` row composition; precedent for adding new
  directives with their own grammar production.
- Future ADR-0068 — multi-block detection (strict mode rules).
- Future ADR-0069 — per-block directive scoping (proximity rule).
