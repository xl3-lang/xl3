# ADR 0058 — `@subtotal` row composition: same-row level binding

- **Status:** accepted
- **Date:** 2026-05-22
- **Spec target:** XTL 0.1
- **Affects:** language.md § "Group + Subtotal", ADR-0038

## Context

ADR-0038 § "Subtotal" pinned the per-row nesting-level inference
rule but left two boundary shapes implicit:

1. **Multiple `@subtotal` expressions on the same row.** ADR-0038
   says "a `@subtotal` row is a row that contains one or more
   `{{ @subtotal <aggregate> }}` expressions." Multiple
   expressions in different cells of the same row is the *common*
   shape (label cell + value cell, or value cells for several
   aggregated columns). But: are all those expressions at the
   *same* nesting level (the level the row binds to)? Or could
   they bind to different levels via cell position? The ADR is
   silent on the latter; the reference impl picks "all at the row's
   level" implicitly.

2. **Heterogeneous aggregate kinds on the same row.** Can a single
   row carry `{{ @subtotal SUM([Amount]) }}` in one cell and
   `{{ @subtotal COUNT() }}` in another? The aggregate-supported
   list in ADR-0038 § "Supported aggregates" permits each
   individually, but the per-row composition is not pinned.

The reference impl (`src/grouper.ts`, `src/renderer.ts`) does the
expected thing — every `@subtotal` expression on a row evaluates at
the row's nesting level, against the same group's row set, with the
aggregate computed independently per expression. But "the expected
thing" is the silent-fallthrough red flag.

## Considered Options

**A. Pin: all `@subtotal` cells on a row share the row's nesting
level; each aggregate is computed independently against the same
row set.** Matches reference impl; minimal new surface. Adopted.

**B. Allow per-cell explicit level binding via syntax extension
(e.g., `{{ @subtotal SUM([X]) on [Region] }}`).** ADR-0038 already
flagged this as a future ADR. Defer.

**C. Reject multiple `@subtotal` cells on the same row.** Forces
one aggregate per row, which would multiply the template's row
count. Rejected — not what authors want.

## Decision

Adopt **A**.

### Normative rules (added to language.md § "Group + Subtotal")

A `@subtotal` row MAY contain any number of `{{ @subtotal
<aggregate> }}` expressions, each in its own cell. All of these
expressions:

1. Share the row's **single** nesting-level binding (per ADR-0038
   row-order rule). The row binds to one level — innermost for the
   first `@subtotal` row in source order, the next outer level for
   the second, etc.
2. Evaluate against the **same** group row set for the bound level
   at each group boundary.
3. May use **different** aggregate functions and column references.
   Permitted combinations include:

   | Row cells | Bound level |
   |---|---|
   | `"Subtotal:"` and `{{ @subtotal SUM([Amount]) }}` | innermost |
   | `{{ @subtotal SUM([Amount]) }}`, `{{ @subtotal COUNT() }}`, `{{ @subtotal AVERAGE([Amount]) }}` | innermost |
   | `{{ @subtotal SUM([Sales]) }}`, `{{ @subtotal SUM([Returns]) }}` | innermost |

4. Are emitted together — when a group boundary fires, every cell
   on the bound subtotal row renders simultaneously (the row is a
   row, not a stream of independent cells).

### What is still rejected (per ADR-0038)

- A current-row column reference outside an aggregate on a
  `@subtotal` row. **Amended by ADR-0073:** this raises the dedicated
  `xl3/subtotal/mixed-row` code (naming the offending cell), not the
  `xl3/expression/unknown-name`-class error originally written here.
- A `@subtotal` body that is not one of the five supported
  aggregates (`xl3/subtotal/bad-aggregate`).
- More `@subtotal` rows than `@group` keys (`xl3/subtotal/outside-
  group`).

### Explicit per-cell level binding — still deferred

The syntax `{{ @subtotal SUM([X]) on [Region] }}` remains deferred
per ADR-0038. Same-row cells cannot bind to different group levels
in XTL 0.1.

### Same-row mixed-level subtotals: explicitly unsupported

A `@subtotal` row binds to exactly one group level (the row's
position in the source order determines that level per ADR-0038).
An author who places two `@subtotal` expressions on the same
visual row hoping each binds to a different level (e.g., one to
`[Customer]`-level totals next to one to `[Region]`-level totals)
will NOT get that behavior — both expressions bind to the same
level (the row's level). The row emits each time the bound level's
group boundary fires; the "other" level's aggregate is computed
against the SAME-level row set, which produces the same value
both times.

This is the documented limitation, not a bug. Authors who need
two-level subtotals on the same visual row of the rendered output
either:

1. Compose them across two source rows (the standard pattern).
2. Use a future ADR's explicit binding form once it lands.

Implementations MAY emit a warning when a `@subtotal` row contains
multiple aggregates targeting columns that differ from the row's
implicit binding level (heuristic detection), but the warning is
not normative and detection rules are implementation-defined.

## Consequences

- No spec behavior change; ADR-0038's implicit composition is now
  explicit.
- Reference impl change: none.
- Conformance fixture additions:
  - `161-subtotal-multi-aggregate-same-row` — a single inner-level
    `@subtotal` row carrying SUM + COUNT + AVERAGE; all three
    render at the same boundary against the same group set.
  - `162-subtotal-mixed-column-refs` — two SUM aggregates over
    different columns on the same row.
- No new error code.

## References

- ADR-0038 — `@group` + `@subtotal` directives
- ADR-0015 — Stable error codes
- language.md § "Group + Subtotal"
