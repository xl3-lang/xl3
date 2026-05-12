# 14 · `__config__` as a value dictionary

## Scenario

Several cells reference the same constant — a department name, a date
threshold, a renewal cutoff. Putting the literal in every cell is
fragile; one update means hunting across the template. `__config__`
doubles as a value dictionary the author can read from any cell.

## How it works

Per ADR-0011, `__config__` is the reserved configuration sheet. It has
two columns: `key` and `value`. Some keys are spec-defined
(`source_sheet`, `source_table`, `output_file_pattern`, `name`). Any
other key is author-defined and accessible via:

```text
{{ __config__[key_name] }}
```

## Example

`__config__`:

| key | value |
|---|---|
| `source_sheet` | `Raw` |
| `source_table` | `1` |
| `output_file_pattern` | `report.xlsx` |
| `priority_threshold` | `10000` |
| `default_region` | `Seoul` |
| `report_owner` | `Mina` |

Template cells:

```text
{{ "Prepared by " & __config__[report_owner] }}
{{ IF([Renewal] > __config__[priority_threshold], "Priority", "Standard") }}
{{ IFEMPTY([Region], __config__[default_region]) }}
```

Changing `priority_threshold` from 10000 to 5000 updates every cell at
once. The author edits one cell in `__config__`, not 20 expressions
scattered across the report.

## Type-awareness

Values stored in `__config__` carry the cell type they're authored
with:

- Number cells become numbers (`10000` compares as numeric).
- String cells become strings.
- Date cells become Dates.
- Booleans become Booleans.

```text
__config__[priority_threshold] > 5000     ← numeric comparison
__config__[start_date] = TODAY()           ← date comparison
```

If you need to force a type, store as the right Excel cell type. For
explicit conversion in the template, use `TEXT()` (number → string) or
arithmetic (`__config__[x] + 0` to coerce numeric-string → number).

## Reserved keys you can't reuse

Per ADR-0011, the following `__config__` keys are spec-defined and
read by the engine itself; don't shadow them with custom semantics:

- `name`
- `source_sheet`
- `source_table`
- `output_file_pattern`

Custom keys MUST NOT match `^_+` (avoid dunder names). Otherwise any
identifier works.

## Why not put it in source data?

Two options for "shared constants" in a workflow:

1. **`__config__` author-defined keys** — value lives in the template.
   Updates require re-versioning the template. Best for organization-
   wide constants the operator should not edit.
2. **`__inputs__` declarations with `default`** — value lives in the
   template but the host can override per run. Best for per-run
   parameters (target month, threshold) the operator might adjust.

Use `__config__` for "this template is hardcoded to these constants;
update the template to change them." Use `__inputs__` for "this template
takes parameters; the host decides them per run."

## Spec pointers

- ADR-0011 — Reserved sheet naming.
- [`spec/evaluation.md`](../../spec/evaluation.md) "Template Configuration".
- [Cookbook 06](./06-runtime-inputs.md) for `__inputs__` (the per-run alternative).
