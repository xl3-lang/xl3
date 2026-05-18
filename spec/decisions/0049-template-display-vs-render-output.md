# ADR 0049 - Template-display vs render-output: intentional asymmetry

- **Status:** informational
- **Date:** 2026-05-18
- **Spec target:** XTL 0.x (clarification)
- **Affects:** authoring UX expectations; cookbook 16, cookbook 17;
  ADR-0036 (preservation matrix); ADR-0043 (Excel-native preference)

## Context

When an author opens an xl3 template directly in Excel — for
editing, review, or sanity-check — they see the template *in its
unrendered form*. Cells with `{{ ... }}` placeholders display the
literal placeholder string. This produces three visual surprises
that have been reported as "errors":

1. **Number-formatted cell holds a string.** A cell with
   `numFmt = "#,##0.00"` and value `{{ [Amount] }}` shows the
   literal `{{ [Amount] }}` in the cell (the format does not
   apply to non-numeric content).
2. **Dashboard sheet formulas error out.** A dashboard cell with
   `=VLOOKUP("key", Data!A:B, 2, FALSE)` referencing a placeholder
   in the Data sheet returns `#N/A` because the lookup against a
   placeholder string never matches; `=Data!B2 + 100` returns
   `#VALUE!` because string + number fails.
3. **Data validation alerts.** A cell with a "must be a number"
   rule pops a validation alert when the author clicks into the
   placeholder cell.

These are not bugs in xl3. The render output is correct in every
case — the rendered workbook has the right values, the formulas
evaluate correctly when Excel recalculates at open time, and data
validation rules apply to the substituted values. **The
"error-looking" display happens only during template authoring,
before any render runs.**

This ADR settles the contract: the asymmetry is intentional, the
recommended response is author convention, and the engine does
NOT try to mask it.

## Decision

### The asymmetry is the contract

The engine guarantees correctness of the **rendered output**. It
does **not** guarantee that the template, opened in Excel without
rendering, displays as a finished workbook.

Concretely, the engine MUST:

1. Preserve cell `numFmt` so the rendered cell formats correctly.
2. Preserve formulas verbatim (ADR-0046), including cross-sheet
   references, so they evaluate against the rendered data at
   workbook-open time.
3. Preserve data validation rules so they apply to substituted
   values (ADR-0036 §8).

The engine MUST NOT:

1. Pre-substitute placeholders with sample values to make the
   template "look finished." (That would defeat the placeholder
   as a visual signal — see Rationale below.)
2. Maintain a separate "template-view" format and "render" format
   per cell. (Dual-format adds spec surface and porter cost; the
   gain is marginal.)
3. Rewrite dashboard formulas to be "placeholder-safe." (Authors
   own dashboard composition.)

### Recommended author conventions

Documented in **Cookbook 17 — Template-authoring vs rendered
preview** (this ADR's user-facing companion). Summary:

- **Placeholder cells display as text** — accept this as
  intentional signal. The string makes it obvious which cells
  are template variables and which are static.
- **Dashboard formulas referencing placeholder data** — wrap
  with `IFERROR(...)` for clean template-view UX:
  ```text
  =IFERROR(VLOOKUP("Acme", Data!A:B, 2, FALSE), "—")
  =IFERROR(AVERAGE(Data!B:B), 0)
  ```
  Pre-render: shows `—` or `0`. Post-render: shows the real value.
- **Preview the rendered output** — use `preview()` API,
  `xl3.io` playground, or a quick `convert(template, sampleData)`
  to verify the dashboard layout.
- **Data validation on data rows** — place validation on the
  template row only; xl3 propagates it to expanded rows. If the
  rule rejects placeholder values, accept the template-time alert
  or relax the rule to "warning" instead of "stop."

### What does NOT happen (clarifying non-errors)

These should NOT be confused with errors and do NOT need to be
fixed:

- **Number-stored-as-text green triangle on `{{ ... }}` cells** —
  does not appear. Excel's heuristic for that warning is
  "numeric-looking string"; `{{ ... }}` is clearly non-numeric.
- **`#NAME?` / `#REF!` errors on placeholder cells themselves** —
  do not appear. Placeholders are plain strings, not malformed
  formulas. (They do appear on *other cells* that try to use the
  placeholder as input.)
- **Lost styles when rendering replaces the placeholder** — does
  not happen. The template cell's `numFmt`, font, fill, border
  are applied to the rendered cell (ADR-0036 §1, ADR-0046).

## Rationale

### Why visible placeholders are a feature, not a bug

A template cell visually distinct from its rendered form has two
benefits:

1. **Authoring clarity.** The author can see *at a glance* which
   cells are variables and which are static. If placeholders
   silently rendered as `(blank)` or sample data, the author
   would lose this visual map.
2. **Reviewability.** A reviewer opening the template can see
   exactly which fields are dynamic without running the engine.
   This matches the README thesis that the template is the
   handover artifact — the contract must be readable in the
   tool the author already uses (Excel itself).

The cost — formulas referencing placeholder data show
template-time errors — is a real friction, but it has a clean
author-side workaround (`IFERROR`). The benefit of visible
placeholders is permanent; the friction is one-time learning.

### Why dual-format would lose more than it gains

A "template-view format" + "render-view format" system would
require:

- Two `numFmt` values per cell, stored in a sidecar location
  (extra spec surface).
- Engine logic that swaps between them at the right moment (more
  code paths in the renderer and `preview()`).
- Porters implementing the dual-format dance (extra porter cost).
- Author choosing two formats per cell (extra authoring step).

The benefit: placeholders look "neater" in template view. Not
worth it.

### Why dashboard-formula auto-IFERROR-wrapping is rejected

A renderer-side feature that wrapped author-written formulas with
`IFERROR(..., 0)` would:

- Silently swallow real author errors (e.g., a typo in a sheet
  name now returns 0 instead of `#REF!`).
- Make the rendered workbook's formula text different from the
  template's — breaking ADR-0046's verbatim-preservation contract.
- Behave inconsistently across cases (when to wrap? IFERROR
  semantics differ from IFNA).

Authors wrap their own formulas with `IFERROR` when they want
clean template view. This is the right intervention point.

## Consequences

- Authors learn one convention (wrap dashboard formulas with
  `IFERROR`) and get clean template view.
- The engine stays simple — no dual-format, no auto-wrapping.
- Cookbook 17 (next commit) operationalizes this for Korean
  operations-team templates which routinely use dashboard sheets.
- Future feature requests for "template-view-friendly mode" cite
  this ADR for the recommended workaround.

## References

- ADR-0036 — Template feature preservation matrix (formulas,
  data validation, conditional formatting preservation)
- ADR-0043 — Excel-native preference principle (the broader
  philosophy this ADR fits within)
- ADR-0046 — Cell formula preservation contract (verbatim
  preservation guarantees)
- ADR-0048 — JXLS boundary final + inconvenience refinement
- Cookbook 16 — XTL function vs Excel formula
- Cookbook 17 — Template-authoring display (this ADR's
  user-facing companion)
- README § "The template is the handover artifact" (the thesis
  that makes visible placeholders a feature)
