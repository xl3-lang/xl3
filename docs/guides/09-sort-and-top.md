# 09 · Sort and Top-N

## Scenario

Show the top 10 renewals by amount, in descending order. Or sort
multi-key: by region (alphabetical), then by amount (descending).

## `@sort`

```text
{{ @sort [Renewal] desc }}
{{ [Account] }} | {{ [Renewal] }}
```

Direction is `asc` (default) or `desc`. `@sort` is **stable** — rows
with equal sort keys preserve their original (first-seen) order.

## Multi-key sort

```text
{{ @sort [Region] asc }}
{{ @sort [Renewal] desc }}
{{ [Account] }} | {{ [Region] }} | {{ [Renewal] }}
```

The first `@sort` is the **primary** key; later `@sort` directives are
tiebreakers (Excel/SQL convention). Above: rows are grouped by Region
alphabetically; within each Region, rows are descending by Renewal.

## `@top`

```text
{{ @sort [Renewal] desc }}
{{ @top 10 }}
{{ [Account] }} | {{ [Renewal] }}
```

`@top N` keeps the first `N` rows after all filters and sorts. Put
`@top` AFTER `@sort` — sort first, then take the top.

If `N` exceeds the number of available rows, `@top` is a no-op (returns
all rows). Negative or zero `N` produces an empty block.

## Combine with `@filter`

```text
{{ @filter [Renewal] > 1000 }}
{{ @sort [Renewal] desc }}
{{ @top 5 }}
{{ [Account] }} | {{ [Renewal] }}
```

Order: filter → sort → top. Multiple `@filter`s compose with AND
(ADR-0029-adjacent; see [Recipe 05](./05-sheet-per-group.md) for list
filters).

## Comparison semantics

`@sort` uses XTL's standard comparison:

- Numbers-or-numeric-strings: numeric.
- Booleans: `false < true`.
- Dates: timestamp.
- Otherwise: canonical string form in Unicode code-point order. **No
  locale collation.** "Z" < "a" (uppercase < lowercase in ASCII).

If your operators want locale-aware ordering, pre-sort upstream or
add a sort-key column.

## Notes

- Stable sort means equal keys preserve insertion order — critical
  when multiple `@sort` directives are used as tiebreakers.
- `@top` after a `@sort` is the canonical "top N" pattern. `@top`
  alone (no sort) returns the first N rows in source order.
- Spec reference: [`spec/language.md`](../../spec/language.md) "Sort"
  and "Top"; ADR-0016.
