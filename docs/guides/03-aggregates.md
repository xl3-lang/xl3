# 03 · Aggregates over rows

## Scenario

Add a footer row that totals the data block above it. Or pull a
cross-source aggregate (e.g., overall company total) into a header cell.

## Bare-bracket aggregate — operates on the data block

```text
{{ SUM([Renewal]) }}
{{ COUNT([Renewal]) }}
{{ AVERAGE([Renewal]) }}
{{ MIN([Renewal]) }}
{{ MAX([Renewal]) }}
```

In the **data block** these accumulate over the source rows being
iterated. In a **footer row** (a row below the data block, no template
block in the data-block row), the same expression refers to the
just-expanded block.

```text
| A1: Account     | B1: Renewal             |
| A2: {{ [Acct] }}| B2: {{ [Renewal] }}     | ← data block
| A3: Total       | B3: {{ SUM([Renewal]) }}| ← footer
```

After expansion with 3 source rows: row 3 becomes row 5, and `B5` shows
the sum of all three `Renewal` values.

## Source-qualified aggregate — operates on the WHOLE source

```text
{{ SUM(Renewals[Amount]) }}        # whole source, not the active block
{{ COUNT(Customers[Account]) }}
```

When you write `SUM(SourceName[Column])`, xl3 sums over the **entire**
named source — not the filtered or joined block. Use this for "overall
total" cells in headers that should not change when the block is filtered.

`Renewals` is a name declared in `__sources__`. See
[Recipe 07](./07-multi-source-join.md).

## Filter changes the block, not the source

```text
{{ @filter [Region] = "Seoul" }}
{{ [Account] }}    | {{ [Renewal] }}
Total:              | {{ SUM([Renewal]) }}        # Seoul rows only
Overall:            | {{ SUM(Source[Renewal]) }}  # all rows
```

`SUM([Renewal])` reflects the post-filter block. `SUM(Source[Renewal])`
ignores the filter.

## What doesn't work — arithmetic inside aggregates

The single argument to `SUM`, `AVERAGE`, `MIN`, `MAX`, and 1-arg
`COUNT` MUST be a column reference (`[Column]` or `Source[Column]`).
Per-row arithmetic, literals, and function calls inside the aggregate
are **rejected** at parse time with `xl3/eval/bad-aggregate-arg`
(ADR-0059):

```text
{{ SUM([Qty] * [Price]) }}     # ✗ per-row arithmetic — rejected
{{ SUM(1 + 2) }}                # ✗ literal expression — rejected
{{ SUM(IF([Region]="Seoul", [Amount], 0)) }}   # ✗ function call — rejected
{{ AVERAGE([Net] - [Cost]) }}   # ✗ per-row subtraction — rejected
```

This is intentional. Excel's `SUMPRODUCT` / array-formula semantics
(per-row compute then aggregate) are out of scope for XTL 0.x — see
ADR-0059 § "Why not allow `SUM([a] + [b])`".

### Fix: helper column upstream

The canonical pattern (revenue = Σ qty × price) is expressed by
adding the per-row product as a column in the **source workbook**,
then summing that column:

```text
# In the source data, add a "Amount" column:
| Qty | Price | Amount        |
|   3 |   100 |   =B2*C2  (or pre-computed 300) |
|   2 |   150 |   =B3*C3  (or 300)              |

# In the template:
{{ SUM([Amount]) }}             # ✓ — sums the pre-computed column
```

If the source is generated programmatically, write the multiplication
result directly into the column. If the source is a hand-maintained
workbook, use a normal Excel formula in the `Amount` column.

### Fix: row-level cell, then footer aggregate

If you only need the per-row product visible (not summed) in the
expanded output, compute it row-by-row in a template cell:

```text
| {{ [Qty] }} | {{ [Price] }} | {{ [Qty] * [Price] }} |   # ✓ row-level
```

This works because `{{ [Qty] * [Price] }}` evaluates per iterated
row. It is **not** the same as `SUM([Qty] * [Price])` — to also get
a footer total of those products, fall back to the helper-column
fix above (or use a native Excel `SUMPRODUCT` formula in the footer
cell, which xl3 preserves verbatim per ADR-0046).

## Notes

- Aggregates ignore empty values per ADR-0007.
- `COUNT` counts non-empty values. To count all rows including empty,
  use `COUNT(Source[any-required-col])` against a column that's never
  empty.
- `AVERAGE` over zero non-empty values returns empty, not an error.
- Composite expressions inside the aggregate (literal, arithmetic,
  function call) raise `xl3/eval/bad-aggregate-arg` per ADR-0059.
- Spec reference: [`spec/language.md`](../../spec/language.md)
  "Aggregates"; ADR-0012 for source semantics; ADR-0059 for the
  argument-shape rule.
