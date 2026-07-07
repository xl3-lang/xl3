# 18 · Group rows and emit subtotals

## Scenario

Your invoice / settlement / purchase-order workbook has line-item
rows broken into per-customer or per-month sections, with a
subtotal line after each section and (optionally) a grand-total
line at the bottom:

```
Acme    Widget A    10,000
Acme    Widget B     5,000
        Subtotal    15,000
Beta    Widget A    20,000
        Subtotal    20,000
        Grand Total 35,000
```

XTL 0.6 ships two directives that do this in a single data block,
without pre-aggregating in the source or post-processing the
output (ADR-0038).

## The two pieces

### `@group [Key1], [Key2], …`

`@group` partitions the active row set into N-level nested groups
for interleaved subtotal emission. It does NOT reorder rows — group
order is encounter order *after* `@filter` and `@sort` have
applied. Pair it with `@sort` over the same keys to get a stable
group order.

```text
{{ @sort [Customer] }}
{{ @group [Customer] }}
```

### `@subtotal <aggregate>`

A row containing a `{{ @subtotal SUM([Amount]) }}` cell is a
**subtotal row**. It does not iterate per source row; instead, the
renderer emits it once at every group boundary at the row's bound
level. The supported aggregates are `SUM`, `COUNT`, `AVERAGE`,
`MIN`, `MAX`.

The first `@subtotal` row in source order binds to the **innermost**
group key. Stack additional `@subtotal` rows below to bind to
outer levels — the bottommost binds to the outermost key.

## Single-level grouping

```text
{{ @sort [Customer] }}
{{ @group [Customer] }}
{{ [Customer] }} | {{ [Item] }} | {{ [Amount] }}
"Subtotal"       |              | {{ @subtotal SUM([Amount]) }}
```

For three source rows (Acme/Widget/100, Beta/Bolt/50,
Acme/Gear/200) this renders:

```
Acme    Widget   100
Acme    Gear     200
        Subtotal 300
Beta    Bolt      50
        Subtotal  50
```

## Two-level nesting + grand total

```text
{{ @sort [Region] }}
{{ @sort [Customer] }}
{{ @group [Region], [Customer] }}
{{ [Region] }} | {{ [Customer] }} | {{ [Amount] }}
"Customer subtotal" |              | {{ @subtotal SUM([Amount]) }}
"Region subtotal"   |              | {{ @subtotal SUM([Amount]) }}
```

The topmost `@subtotal` row (Customer subtotal) binds to the
innermost key (`[Customer]`); the next row (Region subtotal) binds
to `[Region]`. Both emit at boundaries; the inner one fires before
the outer when both end simultaneously.

The "grand total via outermost subtotal" pattern: with a single
`@group [Customer]` plus two `@subtotal` rows, the outer one fires
exactly once — at the end of the data block — because the outer
group's boundary IS the end of the data.

## Composition with other directives

| Directive | Interaction |
|---|---|
| `@filter` | Filters apply **before** grouping. Filtered-out rows are not in any group. A group whose all rows were filtered out simply does not appear. |
| `@sort` | Sorts apply before grouping. To fix group order, `@sort` by the same keys as `@group` in the same order. |
| `@source` | Each `@source` block has its own grouping scope. |
| `@join` | Joined-row columns participate in grouping like primary-row columns. Group keys MAY reference joined columns. |
| `@top` | Applies **after** grouping at the row level. Subtotals are emitted only for groups whose data rows survived the `@top` cut. |
| `@repeat right` | Incompatible with `@group` (`xl3/directive/invalid-syntax`). |

## Edge cases

- **Single-group degenerate case** — if `@group [Key]` and all rows
  share one value of `[Key]`, the subtotal still emits once at
  that group's boundary. This matches the grand-total pattern when
  the dataset happens to contain one outer-group value.
- **Empty groups** — a group whose data rows are all empty (per
  ADR-0007) is skipped: neither data rows nor `@subtotal` emit.
- **Aggregate args** — only column references are accepted inside
  `@subtotal`. Composite expressions (`SUM([A]) - SUM([B])`,
  `IF(...)`) raise `xl3/subtotal/bad-aggregate` and are deferred.
- **Literal-text cells on a `@subtotal` row** — fine; the
  "Subtotal:" label sits next to the aggregate cell, both rendered
  on each emission. The literal cells MUST NOT reference current-
  row columns; there is no current row at a group boundary.
- **A stray `[Column]` marker demotes the row — silently.** The
  parser recognizes a `@subtotal` row only when it carries at least
  one `{{ @subtotal … }}` cell and **no** current-row `[Column]`
  reference outside an aggregate. One marker anywhere on the row —
  including inside mixed literal text, or hiding in a native
  formula's *cached result* after an Excel/LibreOffice re-save (see
  [round-trip hazards](../llm-template-authoring.md#excel-round-trips-formula-caches-and-programmatic-editing))
  — reclassifies the whole row as a second data-row template. The
  render still succeeds; the symptom is unmistakable: the subtotal
  band repeats after **every** data row, showing block-level grand
  totals instead of per-group sums. If you see that signature,
  audit the subtotal row for markers and for formula caches.
- **Dynamic group labels on the band** come from a native formula,
  not a marker (a marker would demote the row, and aggregates
  coerce strings to numbers). Keep a helper column of group-key
  markers inside the data block (hide the column), then read the
  row above the band:

  ```text
  =IF(LEFT(INDIRECT("W"&(ROW()-1)),2)="{"&"{", "",
      INDIRECT("W"&(ROW()-1))) & " subtotal"
  ```

  The `INDIRECT(…&ROW())` form survives verbatim per-emission
  copying (ADR-0046); the `LEFT(...)="{"&"{"` guard keeps the
  formula's template-time cache free of marker text.

## Errors

- `xl3/group/missing-key` — `@group` directive with no key list.
- `xl3/subtotal/outside-group` — `@subtotal` cell in a block with
  no `@group`, or more `@subtotal` rows than `@group` keys.
- `xl3/subtotal/bad-aggregate` — body is not one of `SUM`, `COUNT`,
  `AVERAGE`, `MIN`, `MAX`, or its argument isn't a column reference.

## See also

- [ADR-0038 — `@group` and `@subtotal` directives](../../spec/decisions/0038-group-and-subtotal.md)
- [`spec/language.md` § "Group + Subtotal"](../../spec/language.md)
- [Cookbook 03 — Aggregates](./03-aggregates.md) — block-level
  `SUM` / `COUNT` / `AVERAGE` without grouping
- [Cookbook 15 — Directive composition](./15-directive-composition.md)
  for the full directive-ordering rules
