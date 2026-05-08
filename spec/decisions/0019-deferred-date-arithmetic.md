# ADR 0019 - Deferred: date arithmetic functions

- **Status:** accepted
- **Date:** 2026-05-08
- **Spec target:** XTL 0.1 (deferral); functions land no earlier than XTL 1.x
- **Affects:** STABILITY.md "What 1.0 does NOT include"; future ADR for the actual functions

## Context

Real reporting templates routinely need date arithmetic — "renewal
month + 30 days", "end of fiscal quarter", "days between two dates".
Excel ships these as `EOMONTH`, `EDATE`, `DATEDIF`, `WORKDAY`,
`NETWORKDAYS`, etc. XTL 0.1 has no date arithmetic surface; templates
that need it currently compute the values upstream (in the source
workbook, in `__inputs__`, or in a wrapper script) and pass the
resolved value into the template.

This ADR records the **decision to defer**, not a design for the
functions themselves. Adding new functions is backwards-compatible
(per ADR-0014's pattern) and does not require a major version bump,
so deferring to XTL 1.x is a clean cut.

## Considered Options

**A. Ship a date arithmetic subset in 1.0.**
Pro: matches Excel mental model; reduces the upstream-computation
burden for template authors. Con: each function carries its own
edge-case surface (month-end clamping, leap-year semantics, holiday
calendars for `WORKDAY`). Specifying them properly is a multi-ADR
effort that delays 1.0.

**B. Defer all date arithmetic to a future ADR after 1.0.**
Pro: 1.0 cut is unblocked; templates that need arithmetic compute
it upstream, which works today. Con: authors of templates that
expect Excel-like ergonomics will hit a wall.

**C. Ship just `TODAY()` (already in 0.1) and a single `DATE_ADD`
primitive.**
Pro: minimum viable arithmetic. Con: still requires specifying
month-end semantics; one function is rarely enough — once shipped,
authors will ask for `EOMONTH`, `EDATE`, etc.

## Decision

Adopt option B. XTL 0.1 ships with `TODAY()` only (per ADR-0001).
Date arithmetic functions are explicitly deferred to a future ADR
that may land any time during the XTL 1.x line.

A separate ADR — when proposed — MUST cover:

1. The function set to add (likely `EOMONTH`, `EDATE`, `DATEDIF`
   as the highest-value subset; `WORKDAY` / `NETWORKDAYS` are out
   of scope until a holiday-calendar model is specified).
2. Month-end clamping rules (Excel: clamp to last day of target
   month; spec MUST be explicit).
3. Argument coercion: do these accept strings like `"2026-05-08"`,
   or only Date values?
4. Time component handling: do they preserve / drop / zero out
   the time portion?
5. Conformance fixtures for each function, including edge cases
   (leap year Feb 29, month-end clamping, negative offsets).

Until that ADR ships, templates needing arithmetic compute it
outside the engine and pass the result through `__inputs__` or
`__config__`.

## Consequences

- 1.0 templates that need arithmetic look slightly clunkier than
  Excel formulas. This is a real ergonomics cost.
- The cost is paid in template-author time, not in
  implementation-time or porter-time. Removing this cost from the
  1.0 critical path is the right tradeoff.
- A 1.x release adding date arithmetic does not bump the spec
  major version. Implementations that don't yet support the new
  functions remain conformant for the surface they target.

## References

- ADR-0001 — `TODAY()` UTC semantics (the only date function in 0.1)
- ADR-0017 — Source value model (Date type definition)
- `STABILITY.md` "What 1.0 does NOT include"
