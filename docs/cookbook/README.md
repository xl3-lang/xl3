# XTL Cookbook

Focused, copy-paste recipes for common reporting workflows. Each recipe is
a short markdown page with a scenario, the template cells, and the
expected output.

The cookbook complements two existing surfaces:

- **[`examples/`](../../examples/)** holds three runnable templates
  (`renewal-report`, `sheet-per-region`, `multi-source-join`) that
  exercise composed shapes end-to-end. Copy one as a starting point.
- **[`spec/language.md`](../../spec/language.md)** is the normative
  reference for each function and directive. Use it when a recipe
  doesn't cover your exact case.

Recipes here favor "the smallest template that demonstrates X" over
production realism — the goal is fast lookup when you remember the
shape but forget the syntax.

## Recipes

| # | Recipe | What you'll learn |
|---|---|---|
| 01 | [Getting started in 5 minutes](./01-getting-started.md) | Template + data → output. Substitution and `__config__`. |
| 02 | [Conditional cells](./02-conditional-cells.md) | `IF`, `IFEMPTY`, comparison operators, truthiness. |
| 03 | [Aggregates over rows](./03-aggregates.md) | `SUM`, `COUNT`, `AVERAGE`, `MIN`, `MAX` — block vs whole-source. |
| 04 | [One file per group](./04-file-per-group.md) | File grouping via `output_file_pattern`. |
| 05 | [One sheet per group](./05-sheet-per-group.md) | Sheet grouping + list-based filtering. |
| 06 | [Runtime inputs](./06-runtime-inputs.md) | `__inputs__` for per-run values (month, region, etc.). |
| 07 | [Multi-source + `@join`](./07-multi-source-join.md) | `__sources__`, `@source`, `@join`. |
| 08 | [`XLOOKUP`](./08-xlookup.md) | Cross-source lookups. |
| 09 | [Sort and Top-N](./09-sort-and-top.md) | `@sort` (stable), `@top`, multi-key sort. |
| 10 | [Styling and branding](./10-styling-and-branding.md) | `tabColor`, merged cells, `numFmt`, `TEXT()`. |

## How to read a recipe

Each recipe has the same shape:

1. **Scenario** — the operator's goal in one sentence.
2. **`__config__`** — required keys.
3. **Template cells** — the smallest set of cells that produce the goal.
4. **Data** — a tiny input table.
5. **Output** — what `convert()` returns.
6. **Notes** — gotchas and pointers to the spec when you want more.

## Conventions

- Cells use the `A1` notation Excel uses, not `[row, col]`.
- `__config__` values are written as `key = value` for compactness;
  in a real `template.xlsx` they live in two columns (`A: key`,
  `B: value`).
- Source data is shown as a markdown table to keep the recipe terse.
  The real `data.xlsx` would have those rows in a worksheet matching
  `source_sheet`.

## Running a recipe

The cookbook recipes are documentation-first — not every recipe ships
with a runnable `.xlsx` pair. To try one:

1. Open Excel and create a new workbook.
2. Add the `__config__` sheet with the keys listed.
3. Add the data sheet matching `source_sheet`.
4. Add the template sheet with the cells from the recipe.
5. Save as `template.xlsx`. Save the data as `data.xlsx`.
6. Run `convert(templateBuffer, dataBuffer)` (see [README](../../README.md#usage)).

Or, faster: copy one of the [runnable examples](../../examples/) and
adapt it.
