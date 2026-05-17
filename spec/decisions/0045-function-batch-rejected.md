# ADR 0045 - Function batch — rejected per ADR-0043

- **Status:** rejected
- **Date:** 2026-05-18
- **Spec target:** XTL 0.1 (rejection; no spec change)

## Context

ADR-0043 settled the Excel-native preference principle: a new XTL
function is warranted only when its evaluation must happen before
rendering. ADR-0044 applied the principle to accept 6 functions.
This ADR documents the *rejection* of the remaining Tier-1 batch
candidates so the questions stay settled.

Each rejected proposal below was surfaced as a "JXLS / Excel has
this — should xl3?" question during the gap analysis after batch 2
(ADR-0038..0042). Each fails ADR-0043's test: the same value can
be produced by an Excel formula in the output cell.

## Rejected proposals

### Math expansion: `SQRT`, `POWER`, `MOD`, `INT`, `CEILING`, `FLOOR`, `SIGN`

**Why rejected:**

- Render-time uses are rare. Filters / sorts almost never need
  `SQRT([X])` or `POWER([X], 2)`.
- The output-cell use is trivially served by an Excel formula:
  `=SQRT(B2)`, `=POWER(B2, 2)`, `=MOD(B2, 7)`, `=INT(B2)`.
- xl3 already exposes `ROUND` and `ABS` because both surface in
  filter predicates. The math expansion proposals do not.

### Type tests: `ISBLANK`, `ISNUMBER`, `ISTEXT`, `ISDATE`, `ISERROR`

**Why rejected:**

- `IFEMPTY(value, fallback)` already covers the blank-fallback
  pattern (the dominant render-time use).
- `IFERROR(value, fallback)` (added by ADR-0044) covers the
  error-fallback pattern.
- For *cell-output* type checks the author writes
  `=ISNUMBER(B2)` / `=ISBLANK(B2)` and Excel evaluates.
- Type-based filter predicates exist but are exotic — when they
  appear the author can compare the result of an existing function
  (e.g., `LEN(TRIM([X])) = 0` for "blank-ish").

### `NOW`, `WEEKDAY`, `WEEKNUM`, `NETWORKDAYS`

**Why rejected:**

- `TODAY()` covers the "render-time UTC date" case. A render-time
  timestamp with sub-day precision (`NOW`) is rarely meaningful
  in operations reports — the filename pattern is the only place
  it might surface and minute-granular filenames are a footgun.
- `WEEKDAY` / `WEEKNUM` / `NETWORKDAYS` are all Excel-native
  formulas. For cell output: `=WEEKDAY(B2)` works. For filters
  they are exotic.
- xl3's `DATEDIF(..., "D")` (per ADR-0019 amendment) handles the
  "days between" question with the same UTC precision.

### Conditional aggregates: `SUMIF`, `COUNTIF`, `AVERAGEIF`, `SUMIFS`

**Why rejected:**

- xl3's data-block model already does this. The author writes:
  ```text
  {{ @filter [Status] = "VIP" }}
  {{ @filter [Customer] = "Acme" }}
  ... data block ...
  {{ SUM([Amount]) }}
  ```
  to express the equivalent of
  `=SUMIFS(Amount, Status, "VIP", Customer, "Acme")`.
- Adding `SUMIF` would create two paths to the same result —
  one block-based, one expression-based — and the choice between
  them would have no clear rule. ADR-0043's principle says: don't
  duplicate.

### `TEXT()` format token expansion: currency `₩`, percent `%`,
### accounting parens, scientific `E+00`, conditional color

**Why rejected:**

- This is the case that motivated ADR-0043 in the first place.
  Visual formatting belongs on the cell's `numFmt`, not in a
  string-returning function.
- Authors who want `₩1,200,000` in the output write the cell with
  numFmt `"₩"#,##0` and substitute the number.
- Authors who want the formatted string *in concatenation*
  (`"Total: " & TEXT([Amount], "#,##0")`) still get the current
  XTL-0.1 token set, which covers the common case.

### `SUMPRODUCT`, `MEDIAN`, `STDEV`, `PERCENTILE`, `NPV`, `PMT`, `FV`

**Why rejected:**

- Statistical and financial functions are pure Excel-formula
  territory. They operate on cell ranges in the output workbook
  and have no render-time variant.
- A user with a `=SUMPRODUCT(B2:B100, C2:C100)` cell in their
  template gets the right behavior automatically — the formula
  is preserved verbatim and Excel evaluates at open.

### String search: `FIND`, `SEARCH`

**Why rejected:**

- Excel-native for cell output: `=FIND("@", B2)`.
- Render-time use case (find substring in `__inputs__`) is exotic
  and can be done with the existing `TEXT(IF(... LIKE pattern), ...)`
  patterns once string concatenation is in play.

### Number constructors: `VALUE(s)`

**Why rejected:**

- xl3's `toNumber` coercion in arithmetic already does this
  implicitly. `[StringNumber] * 1` or `[StringNumber] + 0` is the
  XTL idiom.
- For cell output, `=VALUE(B2)` is Excel-native.

## How re-proposals should work

This ADR is not absolute. Re-proposing any rejected function is
allowed under ADR-0034 § "Disagreements" and ADR-0043's principle:
the re-proposal must demonstrate **at least one of the five
render-time-critical categories** from ADR-0043's "How to apply"
section. A "this is convenient" argument alone is not sufficient.

The clearest path to re-acceptance: a real-world template fails
because an Excel formula won't work in that position (e.g., the
function needs to feed a `@filter` predicate). A fixture or issue
illustrating the case is the strongest evidence.

## Consequences

- Future "should xl3 have X?" questions for any function in this
  list have a documented answer to cite.
- Porters know the surface is intentionally smaller than Excel's
  full catalog.
- The cookbook recipe ADR-0050 references this ADR so authors
  hitting a rejected function know where to look (the cell-formula
  path).

## References

- ADR-0043 — Excel-native preference principle (the gate)
- ADR-0044 — function batch accepted
- ADR-0034 — Relationship to prior-art template engines
  (Corollary 3 spirit)
- ADR-0037, ADR-0042 — prior rejection ADRs (format precedent)
