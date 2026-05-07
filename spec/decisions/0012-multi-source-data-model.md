# ADR 0012 - Multi-source data model

- **Status:** accepted
- **Date:** 2026-05-07
- **Spec target:** XTL 0.1 draft
- **Affects:** evaluation.md, language.md

## Context

XTL 0.1 templates today consume exactly one tabular data source — the
worksheet selected by `__config__.source_sheet` and `source_table`.
Many real reporting workflows need data from *two or more* sheets in
the same workbook: a customer master alongside a renewals list, an
order master alongside line items, a product catalog joined with sales
events.

ADR-0011 reserved the `__sources__` sheet name for this purpose
without specifying its shape. This ADR fills it in.

The decision must answer four sub-questions:

1. **Declaration** — how does a template name multiple sources?
2. **Cell reference** — how do template cells refer to a specific
   source's column?
3. **Iteration** — when a data block expands per row, *which* source's
   rows drive the expansion?
4. **Cross-source** — what does it mean to reference one source while
   iterating another?

A future ADR (0013) covers source joins / lookup; this ADR
intentionally stops short of that.

## Considered Options

### Declaration

**A. `__config__` rows** (`source_sheet.customers = Customers`,
`source_table.customers = 1`). Cost: each source needs N parallel
rows; `__config__` becomes a partial-records collection masquerading
as a key/value sheet.

**B. Dedicated `__sources__` sheet** (chosen, per ADR-0011 reservation).
A row per source with columns `name`, `sheet`, `table`, `description`.
Cost: one more reserved sheet — already paid by ADR-0011.

### Cell reference

**C. Excel structured-ref form** `Customers[Account]` (chosen). Mirrors
Excel's own `=Sales[Amount]` from inside or outside a structured table.
Aligned with the unified `__sheet__[key]` pattern from ADR-0011.

**D. Sheet-bang form** `Customers!Account`. Closer to Excel's
*sheet/cell* reference syntax (`=Sheet1!A1`). Cost: Excel itself uses
`!` for sheet+cell, not sheet+column; repurposing it would invent a
hybrid that matches neither convention.

**E. Dot-path form** `Customers.Account`. Power Fx / Power Query style.
Cost: discards Excel structured-ref familiarity and creates a third
syntactic form (alongside `[Column]` and `__sheet__[key]`).

### Iteration

**F. Implicit — first source** wins for the data block. Cost: silent;
authors can't choose.

**G. Explicit `@source SourceName` directive** (chosen). The directive
sits in the data block (like `@filter`/`@sort`) and names the source
that drives row expansion. Without `@source`, the block iterates over
the implicit *default* source.

**H. Per-cell source binding.** Each cell explicitly tags its source.
Cost: verbose; defeats the "data block expands rows" abstraction.

### Cross-source

**I. Allow row-level cross-source** — when iterating Customers,
`Renewals[Date]` returns "current Renewals row's Date." Requires a
join/lookup mechanism. Out of scope for this ADR.

**J. Restrict row-level to active source; allow aggregates over any**
(chosen). Inside a block scoped to source X, `[Column]` and
`X[Column]` resolve to the current row's column. Other sources can
appear *only* inside aggregate functions: `SUM(Renewals[Amount])`
operates on Renewals' full row set regardless of the active block.

## Decision

### `__sources__` sheet

A template MAY declare named additional data sources by providing the
reserved sheet `__sources__`. Row 1 is the header; each subsequent row
declares one source.

| Column | Required | Meaning |
|---|---|---|
| `name` | yes | Source name. Must consist of letters, digits, and underscores. Must NOT start with `__`. Must NOT be `default` (reserved). |
| `sheet` | yes | Source worksheet name in the data workbook, or prefix pattern ending with `*`. |
| `table` | no | Source-table selector for that sheet (defaults to `1`). Same syntax as `__config__.source_table`. |
| `description` | no | Free-form note; not normative. |

Source names are case-sensitive. Duplicate names are an error.

The implicit **default** source — declared via
`__config__.source_sheet` and `__config__.source_table` — is always
named `default`. Authors cannot redeclare it in `__sources__`.

If `__config__.source_sheet` is unset, the default source falls back
to the first worksheet in the data workbook (existing behavior).

### Cell references

| Form | Meaning |
|---|---|
| `[Column]` | The active source's current row's column. |
| `Customers[Column]` | Customers' current row's column — only when `Customers` is the active source. Outside that scope at row level, this is an error. |
| `default[Column]` | Same as `[Column]` if the active source is `default`; otherwise an error. |

Inside aggregate functions, `Source[Column]` operates on the named
source's full row set, independent of the active source:

```
{{ SUM(Renewals[Amount]) }}
{{ COUNT(Customers[Account]) }}
{{ AVERAGE(Renewals[Amount]) }}
```

### `@source` directive

A data block MAY scope its iteration to a named source with the
`@source` directive:

```
{{ @source Customers }}
{{ @sort [Account] asc }}
{{ @repeat }}
{{ [Account] }}
{{ [Region] }}
```

`@source <Name>` MUST appear before any `@filter`/`@sort`/`@top` of
the same block (it changes which row set those operate on). Without
`@source`, the active source is `default`.

Referencing `@source` with an undeclared name is an error.

### Aggregates and cross-source

`SUM(<Source>[Column])` and the other aggregates (`COUNT`, `AVERAGE`,
`MIN`, `MAX`) accept a source-prefixed bracket and aggregate over that
source's full row set, ignoring the active block's filters. To
aggregate over the *active* row set after filters/sorts, use the
unprefixed form `SUM([Column])`.

`COUNT()` (no argument) continues to count rows in the active row set.

### Errors

The following are errors:

- `__sources__` row missing `name` or `sheet`.
- `__sources__` row with reserved name (`default`) or invalid pattern.
- Duplicate source name in `__sources__`.
- Cell reference to an undeclared source (`Unknown[Column]`).
- `@source <Name>` referencing a name not in `__sources__` and not
  `default`.
- Row-level reference to a non-active source's column outside an
  aggregate.

Diagnostic substrings (stable for fixtures):

- `__sources__ row N missing required name/sheet`
- `__sources__ has duplicate source name "X"`
- `__sources__ row N has invalid name "X"` (bad characters or
  reserved)
- `Source "X" is not declared in __sources__`
- `Cannot reference X[Column] outside an active @source X block`

## Consequences

- Single-source templates that don't add `__sources__` work
  unchanged. The default source via `__config__.source_sheet` /
  `source_table` keeps its existing semantics.
- `[Column]` continues to work the same way — it now reads from the
  active source instead of "the source," but in single-source
  templates the two are identical.
- File-grouping (`output_file_pattern`) and sheet-grouping templates
  derive their group keys from the **default** source's first row
  context (current behavior). A future ADR can extend this if real
  use cases need it.
- Aggregates over named sources operate on the source's *full*
  row set — they ignore `@filter`/`@sort` directives on the current
  block. Authors who need filtered cross-source aggregates can copy
  the filter into the cross-source aggregate's expression in a
  follow-up ADR.
- Row-level cross-source references are forbidden until
  ADR-0013 (lookup) or ADR-0014 (join) lands. Authors who need
  "current customer's renewals" must wait or pre-join in the data
  workbook.
- Default-source fallback to the first worksheet (existing behavior)
  still applies when `__config__.source_sheet` is omitted.

## References

- ADR-0011: reserved sheet naming + unified `__sheet__[key]` form.
- ADR-0007: empty value definition (still governs cells in any
  source).
- ADR-0009: comparison and string coercion (still governs comparisons
  across cells regardless of source).
- ADR-0013 (placeholder): XLOOKUP-style cross-source lookup.
- ADR-0014 (placeholder): source joins via `@source ... on ...`.
- `spec/evaluation.md` "External Data Sources" — new section that
  defines `__sources__`, `Source[Column]`, and `@source`.
