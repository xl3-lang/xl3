# Examples

Four production-shaped XTL templates. Each is a complete `template.xlsx`
+ `data.xlsx` pair that runs through `convert()`.

> 🌐 **For Korean operators / 한국어 운영팀**: `04-cafe-weekly-report` 는
> 한국어 컬럼·회사명·상태값 기준의 운영 예제입니다 (거래명세서·정산
> 워크플로 모양). `01–03` 은 의도적으로 영어 데이터로 둡니다.

| # | Folder | Demonstrates |
|---|---|---|
| 01 | `01-basic-renewal-report/` | Single source, `IF`, `SUM`, `@sort`, `@top`. The "hello world" of XTL. |
| 02 | `02-sheet-per-region/` | One sheet per group key (Region), `@filter ... in __lists__[…]`, per-sheet aggregate footer. |
| 03 | `03-multi-source-join/` | `__sources__` + `@source` + `@join` + `XLOOKUP` + `__inputs__`. The full XTL 0.1 surface in one template. |
| 04 | `04-cafe-weekly-report/` | `@group` + `@subtotal` per-category subtotals (ADR-0038), nested `IF`, ADR-0050 computed `__inputs__` default. The 0.6 grouping showcase. |

## Running the examples

```bash
# Build the .xlsx pairs from the .mjs source.
npm run examples:build

# Run convert() against every pair and report results.
npm run examples:run
```

## Why these and not more?

Examples cover composed shapes, not unit behavior. The conformance corpus
([`conformance/fixtures/`](../conformance/fixtures)) covers each spec rule
in isolation. These three templates exercise combinations real reporting
workflows tend to use, so they catch regressions where individually-correct
rules interact incorrectly.

Adding more examples is fine when a real workflow shape isn't covered by
01/02/03. New examples should:

- Be reproducible from `examples/scripts/build.mjs` (no hand-edited xlsx).
- Include a `README.md` describing the scenario and the rules it exercises.
- Pass `npm run examples:run` and the corresponding vitest test.
