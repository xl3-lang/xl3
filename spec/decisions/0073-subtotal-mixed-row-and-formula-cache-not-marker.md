# ADR 0073 — `@subtotal` mixed-row is an error; a formula cell's cached result is not template text (amends ADR-0038/0058, ADR-0046)

- **Status:** accepted
- **Date:** 2026-07-17
- **Spec target:** XTL 0.1
- **Affects:** language.md (§ "Group + Subtotal"); ADR-0038 / ADR-0058 (subtotal-row error clause); ADR-0046 (marker-recognition scope); impl (`parser.ts` — subtotal-row classification + `cellString`); error-codes catalog (`error-codes.ts`, `types.ts`); conformance fixtures 159, 160
- **Amends:** ADR-0038, ADR-0058, ADR-0046
- **Issue:** #66

## Context

Two related defects, both surfacing on `@subtotal` rows, were reported
in #66 (hit in production 2026-07-06).

**1. Silent demotion of a mixed subtotal row.** The spec (language.md
§ "Group + Subtotal", pinned by ADR-0038 and ADR-0058) says a
`@subtotal` row binds to a group boundary — there is no "current row"
there — so a current-row `[Column]` reference outside an aggregate on
such a row is an error. The reference impl did **not** raise it. In
`parser.ts` the row classifier was:

```ts
if (hasSubtotalCell && !hasDataVar) { /* register subtotal row */ }
...
if (hasDataVar) { /* register data-row template */ }
```

A row with **both** a `@subtotal` cell and a current-row `[Column]`
reference matched neither the first branch (`!hasDataVar` is false)
nor the intended error path — it fell through to the second branch and
was silently reclassified as a **second data-row template**. The
subtotal band was then emitted after *every* data row, and its
`@subtotal` cells evaluated as block-level (grand-total) aggregates.
The render succeeded, produced plausible-looking numbers, and gave no
diagnostic — the worst outcome for a template author.

**2. Formula-cache self-corruption.** Marker/directive recognition
reads a cell's text. `parser.ts`'s `cellString` also read a *formula
cell's cached `<v>` result* as that text. A native label formula on a
subtotal row — e.g. `=INDIRECT("W"&(ROW()-1))&" / Subtotal"` — computes
to the marker text of a neighbouring cell. One Excel/LibreOffice
open-and-save later, the cell caches `{{ [Key] }} / Subtotal`, and the
next parse reads that cache as a **live marker**, sets `hasDataVar`,
and triggers defect (1) — the template corrupts itself with no author
edit. Notably the renderer's own `cellString` (`renderer.ts`) never
had the `result` branch: it returns `"[object Object]"` for a formula
cell and never substitutes into one. So the parser and renderer already
*disagreed* about formula-cache markers; only a template where they
agree can render correctly, and defect (2) is exactly the disagreement.

## Considered Options

**A. Make the impl match the spec, reusing `xl3/expression/unknown-name`.**
Zero catalog change; matches the "unknown-name-class" wording ADR-0038/
0058 used. But `[Customer]` on a subtotal row is a *valid, existing*
column used in an *illegal position* — "unknown name" reads wrong — and
the code sits outside the `xl3/subtotal/*` family that hosts already
dispatch on.

**B. Dedicated `xl3/subtotal/mixed-row` (chosen).** Consistent with
`xl3/subtotal/outside-group` and `xl3/subtotal/bad-aggregate`; a precise,
localizable message naming the offending cell. Additive to the catalog
(adds a code, removes none) — backwards-compatible, does not reset the
G3 error-catalog gate.

**C. For the formula-cache path: align the parser to the renderer
(chosen).** Marker/directive recognition ignores formula cells entirely
(parser `cellString` returns `''` for `{ formula }` / `{ sharedFormula }`
shapes). This is the minimal change that removes the parser/renderer
divergence at its root. For **cell markers** (`{{ [Col] }}` substitution)
it changes nothing observable: the renderer never substituted into a
formula cell, so any marker the parser read from a cached result was
already inert at render time. The one shape whose *parse* behaviour does
change is a **directive** expressed as a formula's cached result (e.g. a
formula caching `{{ @group [Customer] }}` or `{{ @block A:C }}`): the
parser used to act on it. Authoring a directive as a formula's cached
value is not a documented pattern — directives are literal `{{ @… }}`
strings — so no *supported* template changes, but the claim is "no
supported template", not "no template whatsoever". The alternative (a
targeted guard only on subtotal rows) would leave the divergence live
everywhere else.

## Decision

Adopt **B** and **C**.

### Normative — subtotal mixed row (amends ADR-0038 / ADR-0058)

A `@subtotal` row that carries a current-row `[Column]` reference
outside an aggregate raises **`xl3/subtotal/mixed-row`**, naming the
offending cell. This replaces the "`xl3/expression/unknown-name`-class
error" wording in language.md § "Group + Subtotal" and in ADR-0058
§ "What is still rejected". A current-row reference means the same
`[Column]` / active-source `Source[Column]` shape that classifies a
data row elsewhere; a static-context call over a source column
(`SUM(Source[Column])`, `XLOOKUP(...)`) is not a current-row reference
and remains legal on a subtotal row.

### Normative — formula cached results are not template text (amends ADR-0046)

Marker and directive recognition (`{{ … }}`) applies only to a cell's
literal string content (including rich-text runs). A formula cell is
preserved verbatim and re-evaluated by the host at open time
(ADR-0046); its cached `<v>` result is **never** interpreted as
template text. An implementation MUST NOT extract markers or directives
from a formula cell's cached result. (The cell is still a non-empty
cell for ADR-0066 block-range extension purposes.)

## Consequences

- **Impl:** `parser.ts` gains a `hasSubtotalCell && hasDataVar` guard
  that throws `xl3/subtotal/mixed-row`; `parser.ts` `cellString` returns
  `''` for formula/shared-formula cells instead of their cached result.
  `error-codes.ts` and `types.ts` gain the new code. No renderer change
  (it already ignored formula caches).
- **Catalog:** additive — one new error code, none removed or renamed.
  Backwards-compatible; does not reset the G3 gate.
- **Behavior compatibility:** no *supported* template that renders
  correctly today changes. Defect (1) only ever produced spec-violating
  output; it now errors. Defect (2)'s self-corrupted templates now
  render correctly again (the label formula is preserved and the row
  stays a proper subtotal row) instead of silently demoting. The one
  unsupported shape that changes is a directive authored as a formula's
  cached result (see Option C) — the parser no longer acts on it.
- **Conformance:**
  - `159-subtotal-mixed-row-error` — a subtotal row with a plain-string
    current-row `[Column]` ref → `xl3/subtotal/mixed-row`.
  - `160-subtotal-formula-cache-not-marker` — a subtotal-row label that
    is a native formula caching `{{ [Customer] }} / Subtotal` renders
    as a proper subtotal row (formula preserved verbatim; per-group
    sums 150, 200), not the demoted grand-total symptom.
- **Not committed:** this ADR does not change how legal `@subtotal`
  rows compose (ADR-0058 stands), nor does it add per-cell level
  binding (still deferred).

## References

- ADR-0038 — `@group` + `@subtotal` directives
- ADR-0058 — `@subtotal` row composition
- ADR-0046 — Cell formula preservation contract
- ADR-0015 — Stable error codes
- language.md § "Group + Subtotal"
- Issue #66; docs context in #65 (guide 18 symptom signature)
