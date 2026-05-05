# ADR 0001 — `TODAY()` returns UTC date

- **Status:** accepted
- **Date:** 2026-05-03
- **Spec target:** XTL 0.1 draft
- **Affects:** language.md

## Context

The XTL 0.1 draft says `TODAY()` returns "the current local date at render time." This is under-specified across implementations: "local" can mean the host runtime's timezone, the user's browser timezone, the server's timezone, or UTC. Two conformant implementations could produce different results for the same template at the same instant near midnight.

xl3's identity is reproducible cross-implementation conversion. A function whose value depends on host timezone is the exact failure mode the spec is meant to prevent.

## Considered Options

**A. Host local timezone (current text).** Matches Excel's `TODAY()` semantics. Familiar to spreadsheet users. Cost: same template + same data + same instant can yield different output across hosts. Defeats reproducibility.

**B. UTC.** Deterministic. One source of truth. Cost: non-Excel-aligned. Users whose reports need a locale-specific date must pre-compute it in source data or compose with `TEXT()` plus an explicit offset (which XTL 0.1 does not provide — see Consequences).

**C. Implementation-defined, with a `_config.timezone` knob.** Maximum flexibility. Cost: a config knob is itself a portability hazard if it has a default; if it has no default, every template that uses `TODAY()` becomes config-bound. Adds spec surface for marginal gain.

**D. Reject `TODAY()` entirely; require source-data dates.** Cleanest from a determinism standpoint. Cost: large UX regression — date-stamped filenames are a primary use case (`{{ TEXT(TODAY(), "YYYY-MM-DD") }}_report.xlsx`).

## Decision

**`TODAY()` returns the UTC date at render time.**

Concretely, the spec text in `language.md` is updated from:

> `TODAY()` returns the current local date at render time.

to:

> `TODAY()` returns the UTC date at render time. Implementations MUST NOT use the host runtime's local timezone. Templates that need a locale-specific date should compute it in the source workbook or pass it through `_config` as a user variable.

## Consequences

- The reference implementation (`src/functions.ts`) currently constructs a local-midnight `Date` and must be changed to a UTC-midnight `Date`.
- A `TODAY()` conformance fixture is **deferred**: the current fixture model assumes a static `expected.xlsx`, but `TODAY()` is render-time-dependent. A future runner-protocol amendment (or a dedicated "structural" fixture category) must add support for assertions of the form "this cell matches the UTC date computed at runner-start time, formatted as `YYYY-MM-DD`." Until that lands, `TODAY()` is covered only by reference-impl unit tests.
- This decision does not introduce a `_config.timezone` knob. A future ADR may revisit if locale-aware date stamping becomes a frequent enough user need.
- The earlier "current local date at render time" wording is retired; existing templates that depended on local timezone behavior will see a one-day shift in the worst case.

## References

- XTL 0.1 draft: `spec/language.md` "Row and Date Functions"
- Related: ADR-0003 (numFmt coercion MUST) reinforces the same principle — spec normativity over implementation flexibility.
