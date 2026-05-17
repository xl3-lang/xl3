# ADR 0047 - `ISBLANK` as `IFEMPTY` predicate alias

- **Status:** accepted
- **Date:** 2026-05-18
- **Spec target:** XTL 0.1
- **Affects:** spec/language.md function table, src/functions.ts; revisits
  ADR-0045's rejection of the `ISBLANK` family

## Context

ADR-0045 rejected the entire `ISBLANK / ISNUMBER / ISTEXT / ISDATE /
ISERROR` family on Excel-native preference grounds (Excel formula
`=ISBLANK(B2)` reaches the cell-output case). The pragmatic review
of commit 2d76913 pushed back on `ISBLANK` specifically: it is
*the* canonical Excel function for blank-fallback patterns, and
rejecting it forces every author coming from Excel to learn the
xl3-specific `IFEMPTY` vocabulary before they can write their first
conditional.

The friction is asymmetric across the family:

- `ISBLANK` — every Excel user reaches for this first. High friction.
- `ISNUMBER`, `ISTEXT`, `ISDATE`, `ISERROR` — exotic. Low friction.

This ADR carves `ISBLANK` out of the ADR-0045 rejection and accepts
it as a predicate alias for the existing `IFEMPTY` empty-check.
The other four functions in the family stay rejected.

## Considered options

**A. Carve out `ISBLANK` only as a thin alias for the
ADR-0007 empty predicate.** Friction goes away; surface gain
minimal (one function). Other type-tests stay rejected.

**B. Accept the full `IS*` family.** Bigger surface, more porter
work, and `ISNUMBER`/`ISTEXT` add genuinely new semantics (XTL
doesn't currently have a runtime "type of" concept exposed).

**C. Keep the rejection and document the workaround.** Saves
0 LoC; user-facing pain stays.

## Decision

Adopt **A**.

### `ISBLANK(value)` specification

Single-argument function returning a boolean.

- Returns `true` if `value` is empty per ADR-0007 (null, undefined,
  empty string, or string consisting entirely of Unicode whitespace
  except for the U+200B / U+FEFF zero-width carve-out).
- Returns `false` otherwise. Numbers (including 0) are never blank;
  booleans (including false) are never blank; dates are never
  blank; non-empty strings are never blank.

**Per ADR-0043:** narrowly justified. The function passes the gate
via filter-predicate use (`@filter ISBLANK([Note])` once filter LHS
supports function calls) and via `__inputs__` defaulting flows.
Cell-output use can still use `=ISBLANK(B2)` Excel formula — the
ADR-0043 retroactive table marks `ISBLANK` as 🟡 borderline like
the rest of the recent batch.

### Why `ISBLANK` is the only `IS*` accepted

- `ISBLANK` is the *Excel-user entry point* for conditional logic.
  An author who learned Excel for ten years will never reach for
  `IFEMPTY` first; they will type `ISBLANK` and expect it to work.
  This is the largest single-function friction point in the
  rejected set.
- The semantic is *identical* to the existing `IFEMPTY` empty
  predicate. No new runtime behavior — `ISBLANK(x)` is `IFEMPTY(x,
  true) === true ? true : false` essentially. Implementation is a
  one-liner.
- `ISNUMBER`, `ISTEXT`, `ISDATE` require XTL to surface a "type of"
  concept it doesn't currently expose (cell values flow as untyped
  unknowns through the evaluator). Adding them would require
  decisions about how source-data type detection works that haven't
  been made yet.
- `ISERROR` is even more exotic — the eager-eval model means
  thrown errors don't propagate to it; only error-cell markers can
  be caught, and `IFERROR` already does that.

## Implementation

`functions.ts`: add
```ts
ISBLANK: (v) => isEmpty(v),
```
(One line. The `isEmpty` helper is the same ADR-0007 predicate the
rest of the codebase uses.)

`normalizer.ts` FUNCTION_ARITY: add `ISBLANK: { min: 1, max: 1 }`.

`spec/language.md` function table: new row.

## Consequences

- The `IS*` family stays mostly rejected (per ADR-0045); only
  `ISBLANK` is the exception, justified by user-friction asymmetry.
- The ADR-0043 retroactive table grows by one 🟡 entry.
- Cookbook 16 gains a sentence: "Excel users reaching for
  `ISBLANK`: it works, and it's identical to `IFEMPTY` for the
  blank-check half. Prefer `IFEMPTY(value, fallback)` when you
  want a fallback; prefer `ISBLANK(value)` when you want a
  boolean for a downstream conditional."
- Porters add one trivial function — no new runtime concept.

## References

- ADR-0007 — Empty value definition (the predicate `ISBLANK`
  reuses)
- ADR-0043 — Excel-native preference principle (gate this
  passes narrowly)
- ADR-0045 — Function batch rejected (the rejection this
  amends)
- Cookbook 16 — XTL function vs Excel formula
