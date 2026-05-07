# ADR 0014 - Source joins via `@join`

- **Status:** accepted
- **Date:** 2026-05-07
- **Spec target:** XTL 0.1 draft
- **Affects:** evaluation.md, language.md

## Context

ADR-0012 introduced multi-source data and ADR-0013 added per-cell
`XLOOKUP`. Those cover the common "for each primary row, fetch a
column from elsewhere" case. They do not cover the *block-level*
join: rendering one row per pair where the iteration shape itself
depends on the join (e.g. one rendered row per renewal, with the
matched customer's columns available alongside in row context).

The natural Excel-adjacent shape is a join directive that pairs the
primary block source with a secondary source on a key. The result is
that cells inside the block see *both* sources' columns at row level.

## Considered Options

**A. Stick with XLOOKUP only.** Cost: every cell that wants joined
data calls `XLOOKUP`, which is verbose for templates with many
columns from the joined source. Performance is also worse without
indexing (ADR-0013 leaves that as an impl detail).

**B. SQL-style multi-table FROM clause.** Cost: too much spec surface
for a templating system; alien to spreadsheet authors.

**C. `@join` directive on the block (chosen).** A single `@join
SourceName on SourceName[k] = ActiveSource[k]` directive pairs the
primary source's row with one row of the joined source. Inside the
block, `[Column]` resolves to the active source's row and
`SourceName[Column]` resolves to the paired joined row.

## Decision

A data block MAY add **one** `@join` directive after `@source`:

```text
{{ @source Renewals }}
{{ @join Customers on Customers[Account] = Renewals[Account] }}
{{ @repeat }}
{{ Renewals[Account] }} | {{ Customers[Name] }} | {{ Renewals[Amount] }}
```

`@join` MUST appear after `@source` for the same block. Without
`@source`, the active source is `default`; `@join` joins against that.

### Pairing semantics — inner, first-match

For each row of the primary (active) source, the engine finds the
**first** row in the joined source whose join-column value equals the
primary row's join-column value (per ADR-0009 comparison). If no
match is found, the primary row is **dropped** from rendering (inner
semantics).

`@join` operates on the joined source's full row set; it ignores any
`@filter`/`@sort`/`@top` directives on the current block (which apply
to the primary).

### Cell references inside the block

| Form | Meaning |
|---|---|
| `[Column]` | Active source's current row's column. |
| `Renewals[Column]` | Active source's row column (when active source is `Renewals`). |
| `Customers[Column]` | Paired joined row's column. |
| `OtherSource[Column]` | Error — only the active source and the joined source are available at row level. |

`SUM(Customers[Column])`, `COUNT(...)`, etc. continue to operate on
that source's full row set (per ADR-0012), independent of the join.

### Multiple joins, left semantics, multi-row matches

Out of scope for ADR-0014:

- Multiple `@join` directives in the same block.
- `@join ... left` (preserve unmatched primary rows).
- Multi-row matches → cross-product.

A future ADR can extend if real demand emerges.

### Error diagnostics (stable substrings)

- `@join requires "<JoinedSource>[col] = <PrimarySource>[col]"`
- `@join source "X" must be declared in __sources__`
- `@join key columns must reference the joined and primary sources`
- `Cannot reference X[Column] outside an active @source X or @join X
  block`

## Consequences

- The "render one row per primary, with paired joined columns
  available everywhere in the block" idiom has a clean expression.
  Templates that previously needed XLOOKUP per cell can now declare
  the join once and reference both sources naturally.
- Inner semantics are deliberate: no-match rows disappear, which
  matches the strict tone of `XLOOKUP` without a fallback. Authors
  who need left-join behavior can use `XLOOKUP` per cell for the
  optional-column pattern.
- Performance: the engine indexes the joined source by its join
  column on first use of the block (O(M)), then matches each primary
  row in O(1). XLOOKUP indexing follows the same approach (impl-only
  optimization, not normative).
- `@join` is intentionally limited to one directive per block in 0.1.
  Templates that need multi-source row pairing chain via XLOOKUP
  inside cells.

## References

- ADR-0007 (empty value): empty join keys never match.
- ADR-0009 (comparison and string coercion): drives equality.
- ADR-0012 (multi-source data model): provides `__sources__` and
  `Source[Column]` row-level refs.
- ADR-0013 (XLOOKUP cross-source lookup): the per-cell sibling.
