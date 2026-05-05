# ADR 0003 — Single-expression cell numFmt coercion is MUST

- **Status:** accepted
- **Date:** 2026-05-03
- **Spec target:** XTL 0.1 draft
- **Affects:** evaluation.md

## Context

XTL 0.1 says, for single-expression cells whose template cell has a number/date/text format:

> the implementation **MAY** coerce string source values to match that format

`MAY` makes coercion optional. Two conformant implementations can therefore render the same template against the same data with different output types — one writes the cell as a number, the other as a string with the same printable form. Excel treats those differently in formulas, sorting, and pivot tables, so the visible output diverges downstream even when the rendered text is identical.

This contradicts the spec's stated reason for existing: cross-implementation reproducibility. Coercion is a core feature; an MUST is the only commitment that holds reproducibility.

## Considered Options

**A. Keep MAY (status quo).** Easier for implementations whose host language has weak number/date parsing. Cost: spec is too weak to be meaningful for type-sensitive workflows.

**B. Promote to MUST when the template cell format implies the type, and the source value is convertible.** Mandates the behavior; failure to convert remains an error (already in the 0.1 errors list). Cost: tighter conformance bar; impls that cannot parse all date formats must declare partial conformance.

**C. Promote to MUST and define the *minimum* set of date/number formats every conformant implementation must support.** Most prescriptive. Cost: pulls Excel-numFmt parsing into normative spec scope, which is a significant surface area increase. Defer to a future ADR.

## Decision

Option B. The MAY in `evaluation.md` becomes MUST.

Spec text in `evaluation.md` "Cell Evaluation / Single-Expression Cells" is updated from:

> If the template cell has a number/date/text format, the implementation MAY coerce string source values to match that format

to:

> If the template cell has a number/date/text format, the implementation MUST coerce string source values to match that format. Date-like formats coerce supported date strings or Excel serial numbers to dates. Number-like formats coerce numeric strings to numbers. Text format `@` coerces to string. Failing to coerce is an error.

The error case is already enumerated in the existing errors list ("Failing to coerce a single-expression cell value to its template cell format") and remains unchanged.

The set of supported date formats and numeric format tokens is **not** normatively specified by this ADR — that is deferred to a future ADR (Option C). Implementations that support fewer formats than another implementation can declare partial conformance against the corpus.

## Consequences

- The reference implementation (`src/renderer.ts` `renderCellValue`, `coerceDateValue`, `coerceNumberValue`) already throws when coercion fails, matching the new MUST. No impl change is required.
- New conformance fixtures cover three coercion paths: numeric string to number under a numeric format, date-like string to date under a date format, and `@` format coercing values to string. Failure-mode fixtures are deferred until the runner protocol gains an `expected_error` mode (same constraint that defers ADR-0002 error fixtures).
- An implementation that lacks a numFmt parser cannot claim full XTL 0.1 conformance. This is intentional — coercion is core, not an extension.
- The minimum format set remains under-specified. Two impls may legitimately disagree on whether `"15-Jan-2026"` is parseable. That ambiguity is bounded: each side reports either success-with-equal-value or an error; silent string-pass-through is no longer conformant.

## References

- XTL 0.1 draft: `spec/evaluation.md` "Cell Evaluation / Single-Expression Cells"
- Related: ADR-0001 (TODAY() = UTC) follows the same principle — normative determinism over implementation flexibility.
