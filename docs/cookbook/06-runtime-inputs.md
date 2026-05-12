# 06 · Runtime inputs

## Scenario

The template is generic, but each run targets a specific month or
region. You don't want the operator to edit the template — they pass the
value in at convert time.

## Declare in `__inputs__`

| name | type | required | default | label | options |
|---|---|---|---|---|---|
| `month` | `text` | `true` | | `Target month (YYYY-MM)` | |
| `region` | `select` | `false` | `All` | `Region filter` | `All,Seoul,Busan,Daegu` |

Type values: `text`, `number`, `date`, `boolean`, `select`.

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
import { convert } from '@jinyoung4478/xl3';

const outputs = await convert(templateBuffer, dataBuffer, {
  inputs: { month: '2026-05', region: 'Seoul' },
});
```

If `inputs.month` is missing and `month` is marked required, xl3
raises `xl3/inputs/missing-required` at convert time. If `region`
isn't supplied, it falls back to the `default` (`All`).

## Inspect declared inputs without running

```ts
import { readTemplateInputs } from '@jinyoung4478/xl3';

const inputs = await readTemplateInputs(templateBuffer);
// → [{ name: 'month', type: 'text', required: true, ... }, ...]
```

Use this in a host UI to render a form before the operator has
uploaded the data file.

## Notes

- `select` options are comma-separated in the `__inputs__` row. A
  supplied value not in the options raises
  `xl3/inputs/select-option`.
- Date inputs are parsed as `YYYY-MM-DD` or `YYYY-MM-DDTHH:mm:ss`.
- Number inputs accept JS number literals; trailing whitespace is
  allowed.
- Spec reference: [`spec/evaluation.md`](../../spec/evaluation.md)
  "Inputs"; ADR-0010, ADR-0011.
