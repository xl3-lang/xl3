# 12 · Empty values in depth

## What "empty" means in XTL

Per ADR-0007:

- **Empty**: missing/null/undefined, OR a string of only Unicode whitespace.
- **NOT empty**: number `0`, Boolean `false`, any non-whitespace string,
  any Date.

The strings `"0"` and `"false"` are non-empty. To filter them out, compare
explicitly: `[Amount] != "0"`.

## `IFEMPTY` — fallback for missing values

```text
{{ IFEMPTY([Owner], "Unassigned") }}
{{ IFEMPTY([Notes], "—") }}
{{ IFEMPTY([Region], __config__[default_region]) }}
```

`IFEMPTY(value, fallback)` returns `fallback` only when `value` is empty.
It does NOT trigger on `0` or `false`.

## Empty vs zero — a common bug

```text
{{ IFEMPTY([Amount], "n/a") }}        → "0" (the number) for a zero-amount row
{{ IF([Amount] = 0, "n/a", [Amount]) }} → "n/a" for a zero-amount row
```

If you want both "missing" and "zero" to read as `n/a`:

```text
{{ IF(IFEMPTY([Amount], 0) = 0, "n/a", [Amount]) }}
```

## Empty group keys → `(blank)`

Per ADR-0026, a row with an empty group-key value produces:

- A file named `(blank).xlsx` if used in `output_file_pattern`.
- A sheet named `(blank)` if used in a sheet template name.

This matches Excel's pivot-table convention. If you'd rather error
loudly, filter upstream:

```text
{{ @filter [Region] != "" }}        ← drop rows with empty Region
```

## Empty in aggregates

`SUM`, `COUNT`, `AVERAGE`, `MIN`, `MAX` skip empty values:

```text
data:    [10, 20, "", 30]
SUM:     60     (not error)
COUNT:   3      (not 4)
AVERAGE: 20     (not 15)
```

`AVERAGE` over zero non-empty values returns empty (not error). To detect
that explicitly, wrap in `IFEMPTY`:

```text
{{ IFEMPTY(AVERAGE([Amount]), "no data") }}
```

## Empty in `IF` conditions

Truthiness (per ADR-0008):

- Empty → falsy.
- Number `0` → falsy.
- Boolean `false` → falsy.
- Strings `"0"` and `"false"` → **truthy** (non-empty strings).
- Any Date → truthy.

```text
{{ IF([Region], [Region], "Unknown") }}      → "" if Region is "", else Region
{{ IF([Amount], [Amount], "no data") }}      → "no data" if Amount is 0 or empty
```

## Empty cells in single-expression cells

Per ADR-0026: a cell containing only `{{ expr }}` that evaluates to
empty produces an empty cell (no error). The cell exists in OOXML; its
value is empty. Re-reading via xl3 reads it as empty per ADR-0007.

If the cell mixes literals: `{{ [Amount] }} won`, the result is
`" won"` (with the empty number stringified as empty + leading space).

## Spec pointers

- [`spec/evaluation.md`](../../spec/evaluation.md) "Empty Values".
- ADR-0007 (empty definition), ADR-0008 (truthiness), ADR-0026 (lifecycle).
- [Cookbook 02](./02-conditional-cells.md) for the IF/IFEMPTY basics.
