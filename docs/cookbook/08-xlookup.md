# 08 · `XLOOKUP`

## Scenario

You want to pull a single column from a different source by matching
a key. Like a one-shot `VLOOKUP` / `INDEX(MATCH(...))` / SQL
`LEFT JOIN ... LIMIT 1`.

## Basic shape

```text
{{ XLOOKUP(lookup_value, lookup_array, return_array) }}
```

- `lookup_value` — the value you want to find.
- `lookup_array` — the column of the other source to search in.
- `return_array` — the column of the other source to return from.

The first matching row's `return_array` value is returned. Comparison
follows XTL's standard comparison algorithm (numeric on
number-or-numeric-string, raw code-point on strings). No wildcards, no
approximate matching, no reverse search — those are out of scope per
ADR-0013.

## Example

`__sources__`:

| name | sheet | table |
|---|---|---|
| `Customers` | `Customers` | `1` |

Template cells:

```text
A2: {{ [customer_id] }}
B2: {{ XLOOKUP([customer_id], Customers[id], Customers[name]) }}
C2: {{ XLOOKUP([customer_id], Customers[id], Customers[tier]) }}
```

For each row in the default source, xl3 finds the matching Customers
row by `id` and pulls `name` / `tier`.

## No-match behavior

If `lookup_value` is not in `lookup_array`, xl3 raises
`xl3/xlookup/no-match`. There is no implicit "return empty" — the spec
prefers loud failure over silent missing data. To allow misses, filter
upstream or use `@join` (drops unmatched rows entirely) instead.

A future XLOOKUP signature may add an optional `if_not_found`. For
now, validate the data first.

## Source-mismatch protection

`lookup_array` and `return_array` MUST be columns of the same source.
`XLOOKUP([id], Customers[id], Renewals[name])` raises
`xl3/xlookup/source-mismatch` — mixing sources would mean returning a
value from a row position that has no meaningful relationship to the
matched row.

## Performance

xl3 builds an index on first XLOOKUP over a `(rows, column)` pair, so
subsequent lookups against the same column are O(1). The first lookup
in a converter run pays the O(N) cost; lookups in the same data block
are then constant-time.

## Notes

- Comparison is type-aware: number-or-numeric-string matches across
  the divide, so `XLOOKUP("42", Customers[id], ...)` finds a row whose
  `id` is the number `42`.
- Use `@join` when every primary row should be paired with the joined
  row; use `XLOOKUP` when you want one cell from another source.
- Spec reference: [`spec/language.md`](../../spec/language.md) "XLOOKUP";
  ADR-0013.
