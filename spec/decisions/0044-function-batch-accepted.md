# ADR 0044 - Function batch — accepted per ADR-0043

- **Status:** accepted
- **Date:** 2026-05-18
- **Spec target:** XTL 0.1
- **Affects:** spec/language.md function table; src/functions.ts; conformance corpus

## Context

ADR-0043 added the Excel-native preference principle. This ADR
applies it to the Tier-1 function-batch backlog (the candidates
that surfaced during the JXLS comparison work) and **accepts six
functions** that meet the principle's gate:

| Function | Render-time critical category |
|---|---|
| `UPPER(s)` | Used in `output_file_pattern` and `__sheet_name_pattern__` to normalize a source value for the filename / sheet-name; also composes with other XTL functions for filter values (e.g., `__inputs__[customer]`) |
| `LOWER(s)` | Same |
| `TRIM(s)` | Used in filename / sheet-name patterns and `__inputs__` defaulting to strip operator-typed whitespace |
| `IFERROR(value, fallback)` | Guards `#DIV/0!` and future error-cell markers inside cell expressions; the renderer is eager, so `IFERROR` does not catch `xtlError` throws — for `XLOOKUP` no-match use its built-in 4-arg fallback instead |
| `IFS(c1, v1, c2, v2, ...)` | Multi-branch conditional inside cell expressions and `output_file_pattern`; cleaner than deep `IF` chains and reaches the filename context (no Excel formula path in a filename pattern) |
| `DATE(year, month, day)` | Composes a date from `__inputs__` integer components for use in `output_file_pattern`, `__sheet_name_pattern__`, `@sort` (comparing against the synthesized date), and `__lists__` membership tests |

The strongest render-time justification each function shares is
the *filename / sheet-name pattern* context — those patterns are
evaluated by XTL before any cell is written, so there is no Excel
formula path available there. For pure cell-output use the
Excel-formula alternative often exists (`=UPPER(B2)`,
`=IFS(...)`); the function form is what makes these computations
reachable in XTL's pre-render contexts.

**Known limitation (current parser):** `@filter` accepts only
`[Column] op literal` predicates. Function-call LHS (e.g.,
`@filter UPPER([X]) = "Y"`) is **not currently supported** —
authors normalize source-side or use a richer comparison value.
Extending the parser is a future ADR.

## Specification

### `UPPER(s)`, `LOWER(s)`

**Signature:** one argument, returns a string.

**Behavior:**

- Convert all letters in `s` to uppercase / lowercase using
  ECMAScript `String.prototype.toUpperCase()` /
  `toLowerCase()` (locale-insensitive — see "Locale" below).
- Empty / null / undefined input returns the empty string.
- Non-string inputs (numbers, booleans, dates) are first
  converted to their canonical string form (per ADR-0009) before
  case conversion. Booleans become `TRUE` / `FALSE` already
  uppercase; numbers and dates stay character-equivalent.

**Locale:** Unicode default-case-folding only. No Turkish
dotless-`I`, no Greek final-sigma. Authors who need locale-aware
case folding handle it host-side in `__inputs__` or upstream of
the source workbook. (Mirrors ADR-0020 deferred locale collation.)

### `TRIM(s)`

**Signature:** one argument, returns a string.

**Behavior:**

- Strip leading and trailing Unicode whitespace from `s`.
- Internal whitespace is preserved unchanged (Excel's `TRIM()`
  collapses runs of internal whitespace; XTL diverges — see
  "Compatibility" below).
- Whitespace is the same set as ADR-0007 (ECMAScript `\s` plus
  the U+200B / U+FEFF zero-width carve-out; zero-width characters
  are content, not whitespace).
- Empty / null / undefined input returns the empty string.

**Compatibility:** Excel `TRIM()` also collapses internal
runs. XTL keeps the simpler "edges only" form because:

1. The most common use case is sanitizing source-data leading /
   trailing whitespace (`@filter TRIM([Customer]) = "Acme"`).
2. Internal-run collapse can change semantic data (an address
   with double-space separators).
3. Authors who want the Excel form can do it in a follow-up cell
   formula or normalize source-side.

### `IFERROR(value, fallback)`

**Signature:** two arguments. Returns either `value` (if no error
marker) or `fallback` (if `value` is an XTL error-cell marker).

**Behavior:**

- If `value` is an XTL error-cell marker (currently only
  `#DIV/0!` per ADR-0025), return `fallback`.
- Otherwise return `value` unchanged, including `0`, `false`,
  and the empty string.

**Scope (important):** XTL's evaluator is *eager* — both arguments
to `IFERROR` are evaluated before `IFERROR` runs. If `value`'s
evaluation **throws** an `xtlError` (e.g., `XLOOKUP` no-match
without its own 4th-arg fallback), the throw propagates past
`IFERROR`; the function only sees values that already evaluated
successfully, including error-cell markers. To guard a no-match
`XLOOKUP`, use the function's built-in 4-arg form:
`XLOOKUP([k], src[k], src[v], "fallback")`. `IFERROR` is the
mechanism for division-by-zero and any future error-cell markers
added under ADR-0025's extension path.

**Difference from `IFEMPTY`:** `IFEMPTY` checks the *value*
against the empty predicate (ADR-0007). `IFERROR` checks whether
the value is an error-cell marker. Use `IFERROR` to guard
expressions that may produce `#DIV/0!`. Use `IFEMPTY` to
substitute defaults for blank source cells.

**Per ADR-0043:** *narrowly* justified — the catchable case
(`[A] / [B]` divide-by-zero in a cell expression) **can** be done
with `=IFERROR(B2/C2, 0)` in the output cell. The render-time-
critical case that survives the gate is *guarded values in
filename / sheet-name patterns* and `__inputs__` defaulting,
where Excel formula cannot reach. ADR-0043's retroactive table
marks `IFERROR` as 🟡 borderline; cookbook 16 documents the
cell-output Excel-formula path as preferred for pure cell uses.

The function is still accepted (not rejected) because the
filename / `__inputs__` cases are real and would otherwise
require host-side pre-processing.

### `IFS(c1, v1, c2, v2, ...)`

**Signature:** even arity ≥ 2. Pairs of `(condition, value)`.

**Behavior:**

- Evaluate conditions left-to-right.
- The first condition that is truthy (per ADR-0008) returns its
  paired value.
- If no condition is truthy, raises `xl3/eval/no-match`. Authors
  who want a default value supply a trailing `TRUE, default` pair
  (the Excel idiom).
- Odd-arity calls raise `xl3/eval/arity-mismatch`.

**Compatibility:** Excel's `IFS` returns `#N/A` when no match.
XTL chooses an explicit error so authors fix the gap rather than
ship `#N/A` to the output workbook. The `TRUE, default` idiom
is documented in the cookbook.

### `DATE(year, month, day)`

**Signature:** three numeric arguments. Returns a Date at UTC
midnight.

**Behavior:**

- All three arguments coerce to integer per `toNumber`. Non-finite
  values raise `xl3/eval/type-mismatch`.
- `month` is **1-based** (matching Excel: `DATE(2026, 5, 18)`
  is May 18, 2026).
- Out-of-range `month` or `day` values — both positive AND
  negative — *roll over* using JS Date semantics (matches Excel's
  `DATE()` rollover behavior).
  - `DATE(2026, 13, 1)` → 2027-01-01 (overflow into next year)
  - `DATE(2026, 2, 30)` → 2026-03-02 (overflow past February)
  - `DATE(2026, -1, 1)` → 2025-12-01 (negative month rolls back)
  - `DATE(2026, 5, 0)` → 2026-04-30 (day 0 rolls back to prior
    month's last day)
- Negative `year` raises `xl3/eval/type-mismatch` (mirrors Excel's
  rejection of years < 1900 — but xl3 accepts the full positive
  integer range; specifically, year 0 is permitted and produces
  the ECMA-262 date for that calendar year).

**Per ADR-0043:** justified — `DATE` composes a date from
`__inputs__` integer components (e.g., host passes `{ year: 2026,
month: 5 }` and the template builds the filter range via
`DATE(__inputs__[year], __inputs__[month], 1)`).

## Error catalog

New code: `xl3/eval/no-match` for `IFS` no-match (per ADR-0015's
append-only rule).

`xl3/eval/type-mismatch` (added in ADR-0019 amendment) is reused
by `DATE` argument validation.

## Composition with existing functions

- `IFERROR(XLOOKUP([Account], Customers[Account], Customers[Name]), "Unknown")`
  is the canonical guarded-lookup pattern.
- `IFS([Renewal] > 10000, "VIP", [Renewal] > 1000, "Standard", TRUE, "Lite")`
  is the multi-tier conditional pattern.
- `DATE(YEAR(TODAY()), MONTH(TODAY()), 1)` composes the first of
  the current UTC month.
- `UPPER(TRIM([Customer]))` is the canonical normalize-for-filter
  pattern.

## Consequences

- The XTL function table grows by 6 entries. All six are
  ECMAScript / Excel-standard semantics so porters implement
  them in <50 lines each.
- The IFS no-match error is the third arity-related error
  (after `xl3/eval/arity-mismatch` and the new `xl3/eval/no-match`).
- The cookbook recipe ADR-0050 ("XTL function vs Excel formula")
  uses these functions in side-by-side examples.

## References

- ADR-0043 — Excel-native preference principle (the gate)
- ADR-0019 amendment — date arithmetic (sibling batch)
- ADR-0039 — HYPERLINK (sibling batch)
- ADR-0024 — function arity policy
- ADR-0008 — truthiness rules (used by `IFS`)
- ADR-0009 — string coercion (used by `UPPER`/`LOWER`)
- ADR-0015 — error code catalog (the new `xl3/eval/no-match`)
- ADR-0045 — function batch — rejected per ADR-0043
