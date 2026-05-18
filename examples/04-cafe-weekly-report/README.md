# 04 · Cafe weekly sales report (`@group` + `@subtotal`)

The 0.6 grouping showcase — single source, per-category subtotal
rows emitted inside a single data block via `@group` + `@subtotal`
(ADR-0038), plus a `__inputs__` default computed at input-read
time (ADR-0050).

## What this demonstrates

- `@sort [카테고리]` — stable group order; ADR-0038 §"Composition"
  says sorts apply before grouping.
- `@group [카테고리]` — partitions the row set into per-category
  groups (커피 / 논커피 / 베이커리).
- `@subtotal SUM([수량])` / `@subtotal SUM([매출])` — pure
  column aggregates emit once at each group boundary.
- Per-row `IF(...)` nesting to derive a 등급 (베스트 / 양호 / 보통)
  label from the row's 수량.
- Mid-cell template composition for a localized subtitle:
  `{{ __inputs__[period_label] }} 기준 주간 매출 리포트`.
- ADR-0050 `__inputs__` default written as XTL:
  `{{ TEXT(TODAY(), "YYYY-MM-DD") }}`. The host UI sees today's
  date string, not the raw `{{ ... }}` placeholder.

## Why 매출 is precomputed in the raw data

`@subtotal` only accepts single-column aggregates
(`SUM(col)` / `COUNT()` / `AVERAGE(col)` / `MIN(col)` / `MAX(col)`).
A composite expression like `SUM([수량] * [단가])` would raise
`xl3/subtotal/bad-aggregate`. So the data file carries a precomputed
`매출` column. The per-row data still demonstrates an XTL expression
(`IF(...)` for 등급) without pulling arithmetic into the aggregate.

If a real workbook can't reshape its raw data, the documented
fallback is a native Excel `SUMPRODUCT` / `SUMIFS` formula in a
post-block grand-total footer instead of `@subtotal`. See
[`docs/llm-template-authoring.md`](../../docs/llm-template-authoring.md)
§"Footer escape hatch."

## Files

- `template.xlsx` — workflow contract (cells + directives + `__inputs__`).
- `data.xlsx` — 9 menus × 7 weekdays = 63 sales rows. Weekend days
  carry a quantity bump so the categorical "베스트 / 양호 / 보통"
  tier visibly differs across weekdays vs weekend.

## Output

One file named `레인보우카페_주간리포트_{period_label}.xlsx` containing
a single `주간 리포트` sheet — title block + header + 63 expanded
rows broken into three per-category subtotal segments.

Approximate weekly numbers (raw is deterministic):

| Category | Qty subtotal | 매출 subtotal |
|---|---:|---:|
| 논커피 | 96 | 528,000 |
| 베이커리 | 148 | 816,000 |
| 커피 | 539 | 2,961,000 |

## Run

```bash
npm run examples:build && npm run examples:run
```

The host may override `period_label`:

```ts
await convert(tpl, data, { inputs: { period_label: '5월 11일~17일' } });
```

When omitted, the ADR-0050 default `{{ TEXT(TODAY(), "YYYY-MM-DD") }}`
resolves to today's UTC date (per ADR-0001).

## Spec pointers

- ADR-0038 — `@group` / `@subtotal` directives.
- ADR-0050 — `__inputs__` cells are XTL.
- ADR-0007 — empty-value model (governs whether a group is empty).
- [`docs/guides/18-group-and-subtotal.md`](../../docs/guides/18-group-and-subtotal.md)
  — full recipe.
- [`docs/guides/06-runtime-inputs.md`](../../docs/guides/06-runtime-inputs.md)
  §"Computed defaults and labels."
- [`docs/llm-template-authoring.md`](../../docs/llm-template-authoring.md)
  — LLM authoring guide (this example reflects the recommended 0.6
  patterns).
