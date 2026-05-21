# 01 · Basic renewal report

> 🌐 **이 예제는 영어 데이터 기준입니다.** 한국어 컬럼·회사명·상태값을 쓰는 운영 예제는 [`04-cafe-weekly-report`](../04-cafe-weekly-report/) 를 참고하세요.

The "hello world" of XTL — single source, `IF`, `SUM`, `@sort`, `@top`.

## What this demonstrates

- `__config__` setup (`source_sheet`, `source_table`, `output_file_pattern`).
- Column references (`{{ [Account] }}`).
- `IF(...)` for derived classification (Priority vs Standard).
- `@sort [Amount] desc` for ordering.
- `@top 10` for capping the row count.
- A footer row (`Total`) below the data block.

## Files

- `template.xlsx` — workflow contract (cells + `__config__`).
- `data.xlsx` — input renewal events.

## Output

One file: `renewal-report.xlsx` containing a single sheet `Renewals`
with at most 10 rows (here all 5 input rows fit), sorted by `Amount`
descending, with a `Tier` derived column and a `Total` footer.

## Run

From the repo root:

```bash
npm run examples:build && npm run examples:run
```

Or just this example:

```bash
node --eval "
import('node:fs').then(async ({ readFileSync, writeFileSync }) => {
  const { convert } = await import('./dist/index.js');
  const t = readFileSync('examples/01-basic-renewal-report/template.xlsx');
  const d = readFileSync('examples/01-basic-renewal-report/data.xlsx');
  const out = await convert(t.buffer, d.buffer);
  out.forEach(f => writeFileSync('examples/01-basic-renewal-report/output-' + f.filename, Buffer.from(f.data)));
  console.log('wrote', out.map(f => f.filename));
});
"
```

## Spec pointers

- [`spec/language.md`](../../spec/language.md) "Template Blocks", "IF",
  "Aggregates", "Sort", "Top".
- ADR-0007 (empty values), ADR-0016 (stable sort), ADR-0023 (operator
  coercion).
- [Cookbook 01](../../docs/cookbook/01-getting-started.md) and
  [Cookbook 09](../../docs/cookbook/09-sort-and-top.md).
