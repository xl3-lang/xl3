# ADR 0013 - XLOOKUP cross-source lookup

- **Status:** accepted
- **Date:** 2026-05-07
- **Spec target:** XTL 0.1 draft
- **Affects:** language.md

## Context

ADR-0012 introduced multi-source data and forbade row-level cross-
source references. The most common reason templates need cross-source
data is *lookup* — for the current row's `[Account]`, fetch the
customer name from a separate `Customers` source. ADR-0012 deferred
this pattern, naming it as the gating ADR-0013 work.

Excel's `XLOOKUP` function is the modern, well-known shape for this
exact operation:

```excel
=XLOOKUP(lookup_value, lookup_array, return_array, [if_not_found])
```

Operators who use Excel daily can read it without spec text. Template
authors who don't already know XLOOKUP can find Microsoft's
documentation. xl3 mirrors the same shape.

## Considered Options

**A. Status quo + deferred to ADR-0014 join.** Cost: lookup is the 80%
case; making authors wait for full join semantics is over-engineered.

**B. Custom XTL function (e.g., `LOOKUP(Customers, Account, Name)`).**
Shorter signature when the key column has the same name on both sides.
Cost: invents new shape; loses Excel familiarity for authors who
already know XLOOKUP.

**C. Excel `XLOOKUP` 1:1 (chosen).** Same signature, same semantics
modulo wildcards/approximate match (deferred).

**D. Inline `@source ... on ...` join.** ADR-0014 territory. Different
shape (block-level row pairing), not a per-cell lookup.

## Decision

XTL 0.1 adds `XLOOKUP` to the core function set:

```text
{{ XLOOKUP(lookup_value, lookup_array, return_array) }}
{{ XLOOKUP(lookup_value, lookup_array, return_array, if_not_found) }}
```

Semantics:

- `lookup_array` and `return_array` MUST be source-prefixed bracket
  references of the form `Source[Column]`. Bare `[Column]` is an
  error in these positions. Both arrays MUST come from the same
  source.
- `lookup_value` is any expression that produces a scalar value. The
  current row's columns, `__inputs__[name]`, `__config__[key]`, and
  function results are all valid.
- The function walks `Source`'s rows in workbook order and returns
  the first row whose `lookup_array` column equals `lookup_value` per
  ADR-0009 comparison. The returned value is the same row's
  `return_array` column.
- If no row matches:
  - If `if_not_found` is provided, return that value.
  - Otherwise this is an error.

Approximate match, wildcard match, reverse search, and array-form
return are NOT in XTL 0.1. The function takes 3 or 4 arguments only.

### Error diagnostics (stable substrings)

- `XLOOKUP arg 2 must be a source-prefixed bracket reference like Customers[Account]`
- `XLOOKUP arg 3 must be a source-prefixed bracket reference like Customers[Name]`
- `XLOOKUP arg 2 source "X" and arg 3 source "Y" must match`
- `XLOOKUP: no row in <Source> where [<lookupCol>] equals <value>`

## Consequences

- The "for each row, fetch a column from another source" idiom — the
  most common cross-source pattern — has a clean expression.
- `XLOOKUP` with no fallback is intentionally strict. Templates that
  expect every row to match (typical in master-detail reports) catch
  data drift loudly.
- Cross-source row pairing where the *iteration shape* of a block
  depends on the join (one row per renewal joined to its customer)
  remains ADR-0014 territory. XLOOKUP is per-cell; ADR-0014 is
  per-block.
- Wildcard, approximate, and reverse-search modes are intentionally
  out of scope. Power Excel users miss them; portable templates
  don't need them. A future ADR can extend if real demand appears.
- The reference impl handles same-source enforcement at parse time
  (when the normalizer rewrites the call) so source mismatches and
  bad arg shapes fail before any data is read.

## References

- ADR-0007 (empty value): empty values are skipped from match.
- ADR-0009 (comparison and string coercion): drives equality.
- ADR-0012 (multi-source data model): provides `Source[Column]` syntax
  and the source row sets XLOOKUP iterates.
- Microsoft XLOOKUP: <https://support.microsoft.com/en-us/office/xlookup-function-b7fd680e-6d10-43e6-84f9-88eae8bf5929>
