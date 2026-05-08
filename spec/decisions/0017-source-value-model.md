# ADR 0017 - Source value model

- **Status:** accepted
- **Date:** 2026-05-08
- **Spec target:** XTL 0.1 draft
- **Affects:** evaluation.md, language.md, ADR-0009

## Context

ADR-0004's reference-impl coupling audit catalogued a gap: the spec
talks about source values having "types" (string, number, boolean,
date) without ever defining the value model normatively. ADR-0009
explicitly deferred date canonical-string form and Excel error
sentinels. ADR-0007 defined empty for missing/null/whitespace-string
but did not address error cells.

Three concrete consequences of this gap:

1. **Dates round-trip through `&` concatenation host-dependently.**
   `[Customer] & " (" & [signup_date] & ")"` produces different
   strings on different hosts because canonical-string-form falls
   through to `String(date)` for date values.
2. **Excel error cells** (`#N/A`, `#VALUE!`, `#DIV/0!`, etc.)
   currently fall through `parseCellValue` as the underlying object.
   Templates that try to render them get `[object Object]`-like
   text; aggregates over them produce `NaN` and downstream weirdness.
3. **Percentage cells** are sometimes confusing: Excel stores `0.5`
   for "50%". Authors expecting "50%" in output need to know that
   their template should use `TEXT(value, …)` or a template cell
   format.

ADR-0017 closes these by defining the value model normatively. The
ambition is bounded: lock the round-trip-stable types, defer the
impl-defined edge cases.

## Considered Options

### Date canonical string form

**A. ISO 8601 with always-present time** (`YYYY-MM-DDTHH:mm:ss`).
Cost: a date column without time renders as `2026-05-08T00:00:00`
which most authors don't want.

**B. Date-only when time is midnight, datetime otherwise (chosen).**
`2026-05-08` for a pure date; `2026-05-08T09:30:00` for a datetime.
Cost: a single conditional in the canonicalizer; matches author
intuition.

**C. Implementation-defined.** Status quo. Cost: explicitly the
problem ADR-0017 exists to fix.

### Excel error sentinels

**D. Treat as empty (chosen).** A cell carrying `#N/A` / `#VALUE!`
reads as empty per ADR-0007. `IFEMPTY([Status], "—")` catches it;
`COUNT([field])` skips it; aggregates ignore it.

**E. Surface as a distinct error value.** A new value kind that
templates could detect via `ISERROR()`. Cost: a new function and
value type for an edge case; spec surface grows.

**F. Throw at read time.** Cost: error cells are common in real
workbooks (formulas that haven't recalculated, missing lookups);
hard-failing every conversion would be operator-hostile.

### Percentage cells

**G. Underlying number, no spec rule (chosen).** Excel stores `0.5`
for "50%" — that's the numeric value, and that's what flows through
XTL. Authors who need formatted output use `TEXT(value, "0%")` (an
implementation extension at this point) or rely on the template cell
format being preserved.

**H. Detect percentage cells and multiply by 100.** Cost: surprises
authors who want the underlying `0.5` for arithmetic
(`SUM([rate])`); breaks the principle that source values flow
through unchanged.

## Decision

### XTL value kinds

A source value is one of these kinds:

- **Missing** — the source column doesn't exist on this row, or the
  cell is blank. Treated as empty per ADR-0007.
- **String** — Unicode text. Empty per ADR-0007 only when entirely
  whitespace.
- **Number** — IEEE 754 double. `NaN` and the infinities are not
  produced by spec-conformant operations; if they appear, they
  stringify to `""` (per ADR-0009) and flow as empty.
- **Boolean** — `true` / `false`.
- **Date** — a calendar instant. May or may not carry a time
  component; canonical-string form distinguishes.

Source workbook cells map onto these kinds:

| Excel cell shape | XTL kind |
|---|---|
| Blank cell | Missing |
| String / inline string / shared string | String |
| Number (including dates stored as serials with non-date format) | Number |
| Date-formatted cell | Date |
| Boolean | Boolean |
| Formula with cached result | The result's kind |
| Error cell (`#N/A`, `#VALUE!`, `#DIV/0!`, etc.) | Missing (per ADR-0007) |

### Date canonical string form

The canonical string form of a Date value is:

- `YYYY-MM-DD` when the time component is exactly midnight (00:00:00).
- `YYYY-MM-DDTHH:mm:ss` when the time component is non-midnight.

Example: a Date for 2026-05-08 (no time) renders as `"2026-05-08"`
in `&` concatenation; a Date for 2026-05-08 09:30:00 renders as
`"2026-05-08T09:30:00"`.

This form supersedes the "implementation-defined" wording in
ADR-0009 §"Canonical string form".

### Error sentinels read as empty

When the reader encounters an Excel error cell — either a static
error cell or a formula whose cached result is an error object —
the value is treated as **empty** per ADR-0007. Aggregate functions
skip it (`COUNT([field])`, `SUM`, `MIN`, `MAX`); `IFEMPTY` returns
the fallback; `@filter ... in __lists__[…]` does not match it.

Implementations MAY emit a warning when an error sentinel is read.
Warnings MUST NOT change output semantics.

### Percentage cells

Percentage-formatted Excel cells flow as their underlying number
(50% → `0.5`). Templates that need formatted percentage output use
`TEXT(value, "0%")` (extension) or rely on the template cell's
number format preserving "0%". The spec does not introduce a
"percentage" value kind.

### Spec text additions

- `evaluation.md` gains a new section "Source Value Model"
  immediately after "Cell Text Extraction", stating the kinds and
  the Excel-cell mapping.
- `language.md` "Comparison and String Coercion" §"Canonical String
  Form" replaces "Date — implementation-defined in XTL 0.1" with the
  YYYY-MM-DD / YYYY-MM-DDTHH:mm:ss rule.
- `evaluation.md` "Empty Values" gains a bullet covering Excel
  error cells.

## Consequences

- `&` concatenation over a Date now produces a deterministic,
  cross-impl-stable string. Templates that previously showed
  `String(date)` host-dependent text will see `2026-05-08` form.
  This is a deliberate, signalled break for the 0.x window.
- Error sentinels stop polluting downstream renders. Aggregates
  become numerically meaningful even when source data has occasional
  `#N/A`. Templates can detect via `IFEMPTY` (per ADR-0007).
- Percentage cells continue to behave as they always did — this ADR
  documents the rationale rather than changing the rule.
- The reference impl gains:
  - `parseCellValue` handles `{ error }` objects (and formula
    results that are error objects) by returning `''`.
  - `canonicalString` handles Date values per the new rule.
- `compareValues` (ADR-0009) gains a Date branch: two Dates compare
  by their underlying timestamp; mixed Date / non-Date falls through
  to canonical-string-form ordering (the existing total order).
- This ADR does not introduce `ISERROR()`, `ISDATE()`, or other
  predicate functions. A future ADR can extend if real demand
  appears.
- Locale-specific date formatting (e.g. `2026년 5월 8일`) remains a
  template author concern via `TEXT(date, format)` with the
  XTL 0.1 minimum format set; locale formatters are extensions.

## References

- ADR-0004: reference-impl coupling audit (gap #9 — value
  representation).
- ADR-0007: empty value definition (now extended to error cells).
- ADR-0009: comparison and string coercion (date canonical form
  was deferred from there to here).
- ADR-0010: runtime user input date coercion (already aligned with
  the YYYY-MM-DD form for resolved input values).
- `spec/evaluation.md` "Cell Text Extraction", "Empty Values".
- `spec/language.md` "Comparison and String Coercion".
