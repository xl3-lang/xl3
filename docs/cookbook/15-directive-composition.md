# 15 · Composing directives (`@filter`, `@sort`, `@top`, `@source`, `@join`)

## What directives are and aren't

Directives (`@filter`, `@sort`, `@top`, `@source`, `@join`) live inside
a **data block** and shape the row set the block iterates over. They are
evaluated in a fixed order regardless of source-cell order:

1. **`@source <Name>`** — picks which source the block iterates over.
2. **`@join <Source> on ...`** — pairs primary rows with rows from
   another source.
3. **`@filter <condition>`** — keeps rows where the condition is truthy.
4. **`@sort <column> [asc|desc]`** — orders the rows.
5. **`@top <N>`** — keeps the first N rows after filtering and sorting.

Authoring tip: put the directives in the order they execute. That's
not required by the spec — but it makes the template readable.

## Composing them

A common shape: top 5 high-value Seoul renewals.

```text
{{ @filter [Region] = "Seoul" }}
{{ @filter [Amount] > 1000 }}
{{ @sort [Amount] desc }}
{{ @top 5 }}
{{ [Account] }} | {{ [Amount] }}
```

Order of evaluation:
1. Filter Region=Seoul.
2. Filter Amount>1000 (compose with AND).
3. Sort the surviving rows by Amount descending.
4. Take the first 5.

## Multiple `@filter` directives compose with AND

Per ADR-0029, multiple `@filter` in one block AND together. There is
no `OR` keyword. To express OR, either:

- Combine into one filter with `IN`:
  `{{ @filter [Region] in __lists__[active_regions] }}`
- Split into two data blocks (each in its own template region) and
  let the row sets union by virtue of both being rendered.
- Pre-process upstream.

## Composing `@source` + `@join`

```text
{{ @source Renewals }}
{{ @join Customers on Renewals[customer_id] = Customers[id] }}
{{ @filter Customers[tier] = "A" }}
{{ @sort Renewals[amount] desc }}
{{ @top 10 }}
{{ Renewals[customer_id] }}
{{ Customers[name] }}
{{ Renewals[amount] }}
```

Steps:
1. Iterate Renewals (per `@source`).
2. Inner-join with Customers by id; rows with no match drop.
3. Keep only joined rows where Customers' tier is "A".
4. Sort by Renewals.amount desc.
5. Take top 10.

`@filter` can reference either source's columns; column resolution
uses the active block's source for bare brackets and the explicit
`Source[Column]` form for the joined side.

## Forbidden compositions

Per ADR-0029:

- **At most one `@source`** per data block. Duplicates raise
  `xl3/directive/invalid-syntax`.
- **At most one `@join`** per data block. Multi-join is out of scope.
- **No self-join**. `@join S on S[a] = S[b]` where `S` is the active
  source raises `xl3/join/bad-on-clause`.

## `@top` after `@sort`

```text
{{ @sort [Amount] desc }}
{{ @top 10 }}
```

Top-N is meaningless without an ordering. If you write `@top` without
`@sort`, you get the first N rows in source order — which can be
useful but is rarely what authors mean.

## Empty after filter

If `@filter` drops all rows, the data block expands to zero rows. The
template row's styling/formats stay on the output but no data row is
produced. Footer rows below the block stay visible.

## Spec pointers

- ADR-0029 — Directive composition + source edge semantics.
- [`spec/language.md`](../../spec/language.md) "Filter", "Sort", "Top",
  "Source", "Join".
- [Cookbook 05](./05-sheet-per-group.md) for `@filter in __lists__[…]`.
- [Cookbook 07](./07-multi-source-join.md) for the `@source` + `@join` basics.
- [Cookbook 09](./09-sort-and-top.md) for `@sort` + `@top` basics.
