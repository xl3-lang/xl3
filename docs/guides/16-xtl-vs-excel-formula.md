# 16 · XTL function vs Excel formula

## Common gotchas — start here

You probably arrived here because something didn't work the way
you expected. The most likely cases:

### "I want `₩1,234,567` in a cell, `TEXT([Amount], "₩#,##0")` doesn't work"

XTL's `TEXT()` ships a small format-token set; currency tokens
aren't in it. The right answer is the cell's **number format**:

| Step | Where |
|---|---|
| 1. In the template cell, set the cell format to `"₩"#,##0` | Excel's Format Cells dialog → Custom |
| 2. Put `{{ [Amount] }}` (the bare number) in that cell | XTL substitution |

The rendered cell holds the number, Excel displays it as
`₩1,234,567`. Sorting, filtering, and downstream formulas all
keep working because the value is still a number.

The same pattern handles `(1,234)` accounting-style negatives
(`#,##0;(#,##0)`), percentages (`0.00%`), and dates
(`yyyy-mm-dd`).

### "I want `=B2*2` to compute per-row, but every row shows the same answer"

xl3 preserves your formula text verbatim across `@repeat` row
expansion — it does **not** rewrite `B2` into `B3`, `B4`, etc.
(See ADR-0046 for the contract.)

Use an XTL expression instead:

```text
{{ [Amount] * 2 }}
```

This evaluates per row at render time and writes the computed
number into each cell. Same result, no row-reference confusion.

### "I want a total at the bottom; `=SUM(B2:B5)` doesn't extend when rows multiply"

Same root cause — xl3 doesn't rewrite range references. Two
options:

- **Whole-column reference** in the footer: `=SUM(B:B)` (or use
  a `@filter` upstream to keep only data rows).
- **XTL aggregate**: put `{{ SUM([Amount]) }}` in the footer cell.
  This computes at render time and writes the number.

### "I want a clickable link per row"

Use the XTL `HYPERLINK()` function (URL/label can both reference
columns):

```text
{{ HYPERLINK([Url], [Label]) }}
```

For static URLs, a plain `=HYPERLINK("https://...", "label")`
formula in the cell also works (xl3 preserves it).

### "I want `IF(...)` with five branches; the nesting is unreadable"

`IFS(c1, v1, c2, v2, ...)` is the XTL function for multi-branch
conditionals. End with `TRUE, default` as the fallback:

```text
{{ IFS([R] > 10000, "VIP", [R] > 1000, "Standard", TRUE, "Lite") }}
```

### "I'm looking for `SUMIF` / `COUNTIF` / `AVERAGEIF`"

Don't reach for the function — use the data-block pattern.
For "sum amounts where status = VIP":

```text
{{ @filter [Status] = "VIP" }}
{{ @repeat down }}
... data row template ...
{{ SUM([Amount]) }}
```

If you need both the filtered total AND the unfiltered rows
displayed, put `=SUMIF(B:B, "VIP", C:C)` directly in the cell —
xl3 keeps the formula and Excel evaluates at open.

### "I want `ISBLANK(x)`"

It exists as of 0.5.x (ADR-0047). Returns `true` when the value
is empty per ADR-0007 — including whitespace-only strings.

```text
{{ IF(ISBLANK([Memo]), "(none)", [Memo]) }}
```

You can also use `IFEMPTY([Memo], "(none)")` for the fallback
form. They check the same predicate.

---

## The general rule

> **Use XTL `{{ ... }}` only when the value must be known before
> the workbook is written. Otherwise, put the formula in the
> cell and let Excel evaluate at open.**

The boundary is render time:

- **Before render — XTL only:** `@filter`, `@sort`, `@top`,
  `@group`, `@subtotal`, source-data aggregates (`SUM`, `COUNT`,
  …), cross-source `XLOOKUP`, `output_file_pattern`,
  `__sheet_name_pattern__`, `__inputs__` defaulting. Excel
  cannot reach into these — there's no cell for it to evaluate
  in.
- **After render — Excel is fine:** cell display formatting,
  per-cell math on rendered values, string transformations on
  output values, type tests, date-component extraction from
  output cells.

The principle is normative — ADR-0043 — and it keeps the XTL
function surface small by construction. Every Excel function not
in XTL's table is intentionally an Excel-formula path.

---

## Side-by-side cheat sheet

| Goal | XTL way | Excel-formula way | Pick |
|---|---|---|---|
| Show `1,234,567.00` for a number | `{{ TEXT([A], "#,##0.00") }}` (string) | Cell `numFmt = "#,##0.00"`, value `{{ [A] }}` (number) | **Excel-formula** for visual; XTL when you need the string |
| Show `₩1,234,567` | (not supported in XTL) | Cell `numFmt = "₩"#,##0` | **Excel-formula** |
| Show negative in parens | (not supported) | Cell `numFmt = #,##0;(#,##0)` | **Excel-formula** |
| Per-row math (`*2`) | `{{ [A] * 2 }}` | `=B2*2` ❌ doesn't rewrite per row | **XTL** |
| Footer SUM over expanding range | `{{ SUM([A]) }}` | `=SUM(B:B)` whole-column works | Either |
| Static hyperlink | (no need) | `=HYPERLINK("...", "label")` | **Excel-formula** |
| Per-row dynamic hyperlink | `{{ HYPERLINK([Url], [Label]) }}` | not feasible (quoting hell) | **XTL** |
| Filter rows for "this month" | `{{ @filter MONTH([Date]) = MONTH(TODAY()) }}` | (Excel can't filter pre-render) | **XTL only** |
| Filename "previous month" | `{{ TEXT(EDATE(TODAY(), -1), "YYYY-MM") }}.xlsx` | (no formula path in filename) | **XTL only** |
| Multi-branch tier label | `{{ IFS([R]>10000, "VIP", [R]>1000, "Std", TRUE, "Lite") }}` | `=IFS(B2>10000, "VIP", ...)` | Either; XTL when filter/group depends on it |
| Conditional aggregate | `@filter` + `SUM` block | `=SUMIF(B:B, "VIP", C:C)` | XTL for block totals; Excel-formula for cross-cutting |
| `MOD` / `INT` / `SQRT` / `POWER` | (not supported in XTL) | Cell formula | **Excel-formula** |
| Blank check | `ISBLANK([X])` or `IFEMPTY([X], "fallback")` | `=ISBLANK(B2)` | Either; ISBLANK matches the Excel idiom |
| Other `IS*` type tests | (not supported) | `=ISNUMBER(B2)` etc. | **Excel-formula** |

---

## Quick decision tree

```
Does the value affect:
  • which rows render?           → @filter / @sort       (XTL)
  • how rows are grouped?        → @group / @subtotal    (XTL)
  • the output filename?         → {{ ... }}             (XTL)
  • the sheet name?              → {{ ... }}             (XTL)
  • a __inputs__ default?        → {{ ... }}             (XTL)
  • per-row computed display?    → {{ ... }}             (XTL)
  • how a cell *looks*?          → cell numFmt           (Excel-side)
  • a per-row formula?           → {{ ... }} expression  (XTL)
  • a whole-column / static calc?→ =FORMULA in cell      (Excel-side)
```

---

## Why this rule exists

The XTL function surface stays small by construction (ADR-0043)
so porters have a clear catalog to implement. Adding functions
for cell-output use only duplicates what Excel already does and
bloats the spec.

The trade-off: an xl3 output workbook isn't fully self-contained
when authors use cell formulas — opening it depends on Excel
recalculating. For most operational reports this is the expected
workflow.

When you find yourself reaching for a function XTL doesn't have:

1. **Is the value used inside a directive (`@filter`, `@sort`,
   `@top`, `@group`, `@subtotal`) or in a `output_file_pattern` /
   `__sheet_name_pattern__`?** → It must be XTL. If XTL doesn't
   provide what you need, file an issue using the "Function
   re-proposal" template (see GitHub issues).
2. **Otherwise** → put the Excel formula directly in the cell.
   xl3 preserves it; Excel evaluates at open time.

## See also

- [ADR-0043 — Excel-native preference principle](../../spec/decisions/0043-excel-native-preference.md)
- [ADR-0044 — Function batch accepted](../../spec/decisions/0044-function-batch-accepted.md)
- [ADR-0045 — Function batch rejected](../../spec/decisions/0045-function-batch-rejected.md)
- [ADR-0046 — Cell formula preservation contract](../../spec/decisions/0046-cell-formula-preservation.md)
- [ADR-0047 — ISBLANK as IFEMPTY alias](../../spec/decisions/0047-isblank-as-ifempty-alias.md)
- [Cookbook 10 — Styling and branding](./10-styling-and-branding.md) — when `numFmt` is the right answer
- [Cookbook 11 — TEXT() formatting](./11-text-formatting.md) — when `TEXT()` *is* the right answer
- [Cookbook 12 — Empty values in depth](./12-empty-values.md) — IFEMPTY / ISBLANK companion
