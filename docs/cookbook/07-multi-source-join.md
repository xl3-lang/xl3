# 07 · Multi-source + `@join`

## Scenario

The renewal data has a `customer_id` but the customer's full name lives
in a separate `Customers` table. You want renewal rows with the
customer's `Name` and `Tier` joined in.

## Declare sources in `__sources__`

| name | sheet | table | description |
|---|---|---|---|
| `Renewals` | `Renewals` | `1` | per-renewal rows |
| `Customers` | `Customers` | `1` | one row per customer |

The default `source_sheet` from `__config__` is still implicit; you
reference it as `[Column]` without a source prefix. Named sources are
referenced as `SourceName[Column]`.

## `@source` to switch the active block source

```text
{{ @source Renewals }}
{{ [customer_id] }}   ← bare bracket resolves against Renewals
{{ [amount] }}
```

By default the data block iterates over the configured `source_sheet`.
`@source <Name>` redirects it to `<Name>` for that block.

## `@join` to pair primary rows with rows from another source

```text
{{ @source Renewals }}
{{ @join Customers on Renewals[customer_id] = Customers[id] }}
{{ [customer_id] }}             ← Renewals row
{{ Customers[name] }}            ← joined customer row
{{ Customers[tier] }}
{{ [amount] }}
```

`@join` is **inner-join, first-match**:

- For every Renewals row, find the FIRST Customers row where
  `id = customer_id`.
- If no match, the Renewals row is dropped.
- Multi-row matches: only the first match is used.

The `on` clause must reference both sources by name. Self-joins
(`@join S on S[a] = S[b]` where `S` is the active source) raise
`xl3/join/bad-on-clause` per ADR-0029.

## Pulling cross-source values without joining: `XLOOKUP`

If you don't need every Renewals row paired with a Customers row,
`XLOOKUP` is lighter-weight:

```text
{{ XLOOKUP([customer_id], Customers[id], Customers[name]) }}
```

See [Recipe 08](./08-xlookup.md).

## Cross-source aggregates

Aggregates over a named source operate on the **whole source**, not the
joined/filtered block:

```text
{{ COUNT(Customers[id]) }}      ← total customers, ignores filters
{{ SUM(Renewals[amount]) }}      ← total renewals, ignores filters
```

See [Recipe 03](./03-aggregates.md).

## Notes

- One `@source` and one `@join` per data block. Duplicates raise
  `xl3/directive/invalid-syntax` per ADR-0029.
- Multi-join (chain of `@join`s) is deferred per ADR-0014.
- Function name matching is case-insensitive: `if`, `If`, `IF`.
- Spec reference: [`spec/evaluation.md`](../../spec/evaluation.md)
  "External Data Sources"; ADR-0012, ADR-0014.
