# 03 · Multi-source join with runtime inputs

The full XTL 0.1 surface in one template: named sources, `@source`,
`@join`, `XLOOKUP`, runtime `__inputs__`.

## What this demonstrates

- `__sources__` declaring two named sources (`Renewals`, `Customers`).
- `__inputs__` declaring a `month` runtime input with a default.
- `@source Renewals` switching the data block's active source.
- `@join Customers on Customers[Account] = Renewals[Account]` —
  inner-join, first-match.
- Source-qualified column references (`{{ Renewals[Amount] }}`,
  `{{ Customers[Owner] }}`).
- `XLOOKUP` for a single cross-source value lookup.
- Whole-source aggregate: `SUM(Renewals[Amount])` over the full source,
  not the joined block.
- Merged title row + bold header row (template styling preservation).

## Files

- `template.xlsx` — multi-sheet template (`Report`, `__inputs__`,
  `__sources__`, `__config__`).
- `data.xlsx` — `Customers` and `Renewals` sheets.

## Output

One file with name `{month}-renewals.xlsx` — defaults to
`2026-05-renewals.xlsx` if no input supplied. The single sheet
`Report` contains the joined renewal rows (Foxtrot is dropped because
it has no matching Customer), sorted by `Amount` descending, with a
total footer and an XLOOKUP demo cell.

## Run

```bash
npm run examples:build && npm run examples:run
```

`examples:run` supplies `{ month: '2026-05' }` automatically for this
example. To run with a different month from code:

```ts
import { readFileSync } from 'node:fs';
import { convert } from '@jinyoung4478/xl3';

const t = readFileSync('examples/03-multi-source-join/template.xlsx');
const d = readFileSync('examples/03-multi-source-join/data.xlsx');
const out = await convert(t.buffer, d.buffer, { inputs: { month: '2026-06' } });
```

## Spec pointers

- [`spec/language.md`](../../spec/language.md) "Source", "Join",
  "XLOOKUP".
- [`spec/evaluation.md`](../../spec/evaluation.md) "External Data
  Sources", "Inputs".
- ADR-0010 (inputs), ADR-0011 (reserved sheets), ADR-0012 (named
  sources + whole-source aggregates), ADR-0013 (XLOOKUP), ADR-0014
  (join), ADR-0029 (join edges).
- [Cookbook 06](../../docs/cookbook/06-runtime-inputs.md),
  [Cookbook 07](../../docs/cookbook/07-multi-source-join.md),
  [Cookbook 08](../../docs/cookbook/08-xlookup.md).
