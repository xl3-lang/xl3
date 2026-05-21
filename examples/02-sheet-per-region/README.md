# 02 · Sheet per region with list filter

> 🌐 **이 예제는 영어 데이터 기준입니다.** 한국어 컬럼·회사명·상태값을 쓰는 운영 예제는 [`04-cafe-weekly-report`](../04-cafe-weekly-report/) 를 참고하세요.

One sheet per `Region`, filtered to a curated `__lists__[ActiveRegions]`.

## What this demonstrates

- Sheet templates with group keys: the sheet name `{{ Region }}` expands
  to one sheet per distinct `Region` in the source.
- `__lists__` for membership filtering: only rows whose `Region` appears
  in `__lists__[ActiveRegions]` are kept. The `Jeju` row is dropped.
- `@filter ... in __lists__[name]` syntax.
- `IFEMPTY` for falling back on missing `Status` values.
- `TODAY()` in `output_file_pattern` for a date-stamped filename.

## Files

- `template.xlsx` — sheet template, `__config__`, `__lists__`.
- `data.xlsx` — six customer rows across four regions.

## Output

One file with name `regions-YYYY-MM-DD.xlsx` (today's UTC date), with
one sheet per active region (`Seoul`, `Busan`, `Daegu`). Each sheet has
a row per matching account, sorted by `Amount` descending, plus a
`Region total` footer.

## Run

```bash
npm run examples:build && npm run examples:run
```

## Spec pointers

- [`spec/language.md`](../../spec/language.md) "Filter", "Group Keys".
- [`spec/evaluation.md`](../../spec/evaluation.md) "List Sheets".
- ADR-0007 (empty / `IFEMPTY`), ADR-0026 (empty group key → `(blank)`),
  ADR-0016 (first-seen ordering).
- [Cookbook 05](../../docs/cookbook/05-sheet-per-group.md).
