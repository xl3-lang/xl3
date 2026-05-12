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

## Notes

- Aggregates ignore empty values per ADR-0007.
- `COUNT` counts non-empty values. To count all rows including empty,
  use `COUNT(Source[any-required-col])` against a column that's never
  empty.
- `AVERAGE` over zero non-empty values returns empty, not an error.
- Spec reference: [`spec/language.md`](../../spec/language.md)
  "Aggregates"; ADR-0012 for source semantics.
