# 06 · Runtime inputs

## Scenario

The template is generic, but each run targets a specific month or
region. You don't want the operator to edit the template — they pass the
value in at convert time.

## Declare in `__inputs__`

| name | type | required | default | label | options |
|---|---|---|---|---|---|
| `month` | `text` | `true` | | `Target month (YYYY-MM)` | |
| `region` | `select` | `false` | `All` | `Region filter` | `All\|Seoul\|Busan\|Daegu` |

Type values: `text`, `number`, `date`, `select`.

## Use in template cells, filenames, and group keys

```text
Cell:           {{ "Report for " & __inputs__[month] }}
Filename:       output_file_pattern = {{ __inputs__[month] }}-renewals.xlsx
Filter:         {{ @filter [Region] = __inputs__[region] OR __inputs__[region] = "All" }}
```

Wait — that last one doesn't work as written; XTL has no `OR` keyword.
The clean pattern is two template sheets, picked by an upstream
condition. For now, the simpler use of `__inputs__` is to inject a
literal value into a cell, a filename, or a fixed comparison:

```text
{{ @filter [Region] = __inputs__[region] }}
```

…and have the host only call `convert()` after the operator picks a
specific region.

## Pass values from the host

```ts
import { convert } from '@xl3-lang/xl3';

const outputs = await convert(templateBuffer, dataBuffer, {
  inputs: { month: '2026-05', region: 'Seoul' },
});
```

If `inputs.month` is missing and `month` is marked required, xl3
raises `xl3/inputs/missing-required` at convert time. If `region`
isn't supplied, it falls back to the `default` (`All`).

## Inspect declared inputs without running

```ts
import { readTemplateInputs } from '@xl3-lang/xl3';

const inputs = await readTemplateInputs(templateBuffer);
// → [{ name: 'month', type: 'text', required: true, ... }, ...]
```

Use this in a host UI to render a form before the operator has
uploaded the data file.

## Computed defaults and labels (ADR-0050)

The `default`, `label`, `description`, and `options` columns are XTL
templates evaluated at input-read time. You can compose values from
`__config__` or call pure scalar functions:

| name | type | default | label |
|---|---|---|---|
| `title_prefix` | `text` | `{{ __config__[region] }} 거래명세서` | `Title prefix` |
| `report_date` | `text` | `{{ TEXT(TODAY(), "YYYY-MM-DD") }}` | `Report date` |
| `report_label` | `text` | `{{ UPPER(__config__[region]) }}-{{ __config__[period] }}` | `Report label` |

The host UI calling `readTemplateInputs()` sees the post-evaluation
strings (e.g., `"KR 거래명세서"`, the current UTC date). The user no
longer sees the raw `{{ ... }}` placeholder.

**Available bindings at input-read time:**

- `__config__[key]` — values declared earlier in the `__config__`
  sheet.
- Pure scalar functions: `TODAY`, `DATE`, `IF`, `IFEMPTY`, `IFS`,
  `IFERROR`, `UPPER`, `LOWER`, `TRIM`, `TEXT`, `YEAR`, `MONTH`, `DAY`,
  `EOMONTH`, `EDATE`, `DATEDIF`, `ROUND`, `ABS`.

**Not available — these throw at input-read time:**

- `[Column]` / `Source[Column]` — no source row context yet.
  Error code: `xl3/inputs/forward-reference`.
- `__inputs__[name]` — input rows are independent declarations, not
  a dependency graph. Same error code.
- `ROW()`, `SUM`, `COUNT`, `AVERAGE`, `MIN`, `MAX`, `XLOOKUP` — these
  read render-state or source data that does not exist yet. Error
  code: `xl3/inputs/runtime-only-fn`.

> **Migration note.** Before 0.6, `{{ ... }}` in `__inputs__` cells
> was treated as literal text. If an existing template had a closed
> `{{ ... }}` block intended as literal characters, that string now
> evaluates as an expression. Most authors will not be affected — the
> prior behavior was surprising in practice.

## Notes

- `select` options are pipe-separated in the `__inputs__` row (e.g.
  `Seoul|Busan|Daegu`). A supplied value not in the options raises
  `xl3/inputs/select-option`. The pipe split runs **after** the cell
  template evaluates, so `options: {{ __config__[regions] }}` works
  when `__config__[regions]` is the literal string `Seoul|Busan|Daegu`.
- Date inputs are parsed as `YYYY-MM-DD` or `YYYY-MM-DDTHH:mm:ss`.
- Number inputs accept JS number literals; trailing whitespace is
  allowed.
- Spec reference: [`spec/evaluation.md`](../../spec/evaluation.md)
  "Inputs"; ADR-0010, ADR-0011, ADR-0050.
