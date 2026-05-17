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

## Amendment (2026-05-18) — promote 6 functions

- **Status:** accepted (this amendment)
- **Date:** 2026-05-18
- **Spec target:** XTL 0.1
- **Affects:** `spec/language.md` § "Functions" (function table + a new
  "Date Component and Arithmetic Functions" subsection),
  `src/functions.ts`, `src/error-codes.ts` (new
  `xl3/eval/type-mismatch` code), conformance corpus
  (one fixture per function).

The original deferral above is preserved as the prior decision. This
amendment promotes the highest-value subset to **accepted** for the
next minor release. The deferred-status header at the top of this ADR
is superseded by the **accepted** status of this amendment; the prose
is kept for historical context per ADR-0034 Corollary 1 (absorb
experience, name the decision).

Per ADR-0034 Corollary 1, the function set, semantics, and edge
cases below are absorbed from JXLS / Excel experience without
importing JXLS's expression-language form. The functions are
Excel-native names and are evaluated by XTL's runtime so that
template output does not depend on Excel recalculating formulas in
the rendered workbook.

### Functions added

| Function | Arity | Returns | Behavior |
|---|---|---|---|
| `YEAR(date)` | 1 | Number (integer) | 4-digit calendar year of `date`, in UTC. |
| `MONTH(date)` | 1 | Number (integer) | Month 1–12 of `date`, in UTC. |
| `DAY(date)` | 1 | Number (integer) | Day-of-month 1–31 of `date`, in UTC. |
| `EOMONTH(date, months)` | 2 | Date (UTC midnight) | The last day of the month that is `months` calendar months away from `date`. `months` MAY be negative. |
| `EDATE(date, months)` | 2 | Date (UTC midnight) | The date that is `months` calendar months away from `date`, preserving day-of-month. If the source day-of-month does not exist in the target month, the result is clamped to that month's last day (Excel semantics). |
| `DATEDIF(start, end, unit)` | 3 | Number (integer) | Count of complete `unit`s between `start` and `end`. `unit` is one of `"Y"`, `"M"`, `"D"` (case-sensitive per Excel). End-exclusive: a one-second gap before the boundary does not count. |

All six entries are also added to the `FUNCTION_ARITY` table per
ADR-0024.

### Semantics (normative)

- **Timezone.** All extraction and arithmetic operate in **UTC**, per
  ADR-0017 § "Timezone (normative)". Implementations MUST NOT use
  host-locale accessors (`getFullYear`, `getMonth`, `getDate`); they
  MUST use the UTC variants. This rule covers component extraction,
  month rollover in `EOMONTH` / `EDATE`, and the day count in
  `DATEDIF`.

- **Argument types.** The first argument of all six functions MUST be
  a Date value per ADR-0017. A non-Date argument (string, number,
  Boolean, empty) raises **`xl3/eval/type-mismatch`**. String-to-Date
  coercion is intentionally not applied here: authors who hold a
  string like `"2026-05-08"` pass it through user-input coercion
  (ADR-0010) or compute the Date upstream. This keeps the per-call
  surface narrow and matches the ADR-0023 "fail loudly on operand
  shape" principle.

- **`months` argument** (`EOMONTH`, `EDATE`). MUST be an integer
  (Number with zero fractional part). Fractional or non-numeric
  values raise `xl3/eval/type-mismatch`. Negative values are valid.
  Out-of-range values (very large positive or negative) are valid as
  long as the resulting calendar date is representable by the host's
  Date type; implementations MAY reject results outside the Excel
  serial-date range (1900–9999) as `xl3/eval/type-mismatch`.

- **`unit` argument** (`DATEDIF`). MUST be one of the string literals
  `"Y"`, `"M"`, `"D"`. Other values — including lowercase `"y"`,
  Excel's extended `"YM"` / `"YD"` / `"MD"` units, or any other
  string — raise `xl3/eval/type-mismatch`. The lowercase / extended
  units MAY be added by a future ADR.

- **`DATEDIF` sign.** When `start > end`, the result is the negative
  of the count that would be returned for the swapped arguments.
  This is a deliberate departure from Excel's `#NUM!` error for
  reversed arguments: reports rendered through XTL routinely compute
  "days remaining until renewal" where the order can be either sign,
  and the negative result is more useful than an error.

- **`DATEDIF` end-exclusivity.** Matches Excel: `DATEDIF(d, d, "D")`
  is `0`; `DATEDIF(d, d+1day, "D")` is `1`; `DATEDIF(d, d+1day-1s, "D")`
  is `0`.

- **Output types.** `YEAR`, `MONTH`, `DAY`, `DATEDIF` return Number
  (integer). `EOMONTH` and `EDATE` return **Date values at UTC
  midnight** — not strings — so that template cell number formats
  for dates (e.g., `yyyy-mm-dd`) apply at render time as they would
  for a Date column. Authors who want a string render compose with
  `TEXT()` per ADR-0017's canonical date idiom:

  ```text
  {{ TEXT(EOMONTH(TODAY(), 0), "YYYY-MM-DD") }}
  ```

  This is the canonical month-end-string idiom and is pinned by a
  conformance fixture.

### Spec text additions

- `spec/language.md` § "Functions" table gains six rows in the order
  `YEAR`, `MONTH`, `DAY`, `EOMONTH`, `EDATE`, `DATEDIF`, placed after
  `TODAY` so the date-related entries stay grouped.
- A new subsection "Date Component and Arithmetic Functions" follows
  "Row and Date Functions", with one short example per function and
  the `TEXT(EOMONTH(...), ...)` idiom called out.
- `src/error-codes.ts` gains `xl3/eval/type-mismatch` in the union
  and in the ADR-0015 snapshot test. Per ADR-0015 the catalog is
  append-only.
- `src/functions.ts` implements the six functions using UTC
  accessors and the arity validation already wired through ADR-0024.

### Use cases

These functions are the floor of Korean B2B operations reporting:

- "이번 달 말일까지의 정산 기간" — settlement period ending at this
  month-end: `EOMONTH(TODAY(), 0)`.
- "결제일 + 30일" — payment due date: `EDATE(...)` is not exactly
  this (`EDATE` is month-stride), but the function is part of the
  same idiom set; for day-stride the canonical form is upstream
  arithmetic on the input Date, with `DATEDIF` for the inverse query.
- "근속 일수" — tenure in days: `DATEDIF([HireDate], TODAY(), "D")`.
- "분기말 보고" — quarter-end reporting: `EOMONTH(TODAY(), 0)` after
  upstream selection of the right month.

### Considered options (amendment)

**A. Ship all six as specified (chosen).** Highest-value subset; one
ADR; one fixture per function. Matches the original deferral's
"likely subset" wording.

**B. Ship only `YEAR` / `MONTH` / `DAY` first.** Pro: smaller surface
per release. Con: the component-extractors are the lowest-value
half — most templates that need date arithmetic need `EOMONTH` and
`DATEDIF` for the month-end and tenure idioms.

**C. Coerce strings to dates inside these functions.** Pro: forgives
authors who hold a string. Con: ADR-0017 already routes string-Date
coercion through the input pipeline; per-function string coercion
duplicates that pipeline and risks divergent rules per function.
Rejected.

**D. Match Excel's `#NUM!` for `DATEDIF` with reversed args.** Pro:
strict Excel compatibility. Con: the negative-result form is
strictly more useful and Excel-default behavior on `#NUM!` is to
surface the error cell into the rendered workbook, which ADR-0017
then routes through the error-sentinel-as-empty rule — a worse UX
than a signed integer. Rejected.

**E. Hold `WORKDAY` / `NETWORKDAYS` for a later ADR.** Unchanged
from the original deferral above. These require a holiday-calendar
model and remain out of scope.

### Consequences

- Templates that previously computed month-end, tenure, or component
  extraction upstream can now express them inline. Source-side
  workarounds remain valid; this is additive.
- Three of the six functions return Date values, so template numFmt
  formatting for date cells continues to work end-to-end without an
  intermediate `TEXT()` call.
- A new error code `xl3/eval/type-mismatch` joins the ADR-0015
  catalog. The snapshot test asserts the additional code.
- Conformance corpus grows by six fixtures (one per function),
  including: `YEAR` over a date and a non-date (error), `MONTH`
  basic, `DAY` basic, `EOMONTH` with `months=0`, `months=-1`, and
  `months=+12`, `EDATE` with day clamping (e.g., Jan 31 + 1 month →
  Feb 28/29), `DATEDIF` for all three units including the reversed-
  argument negative case.
- `WORKDAY` / `NETWORKDAYS` and locale-aware variants remain out of
  scope and unchanged by this amendment.
