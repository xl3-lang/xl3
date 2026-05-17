# 16 · XTL function vs Excel formula

## When to put logic in `{{ ... }}` vs in a cell formula

xl3 evaluates `{{ ... }}` expressions **before** the workbook is
written. After it finishes, the output is a normal `.xlsx` that
Excel will open and recalculate. Many computations can live on
either side. This recipe is the rule for picking which.

## The rule (ADR-0043)

> **Use an XTL `{{ ... }}` expression only when the value must be
> known before rendering. Otherwise, put the formula in the cell
> and let Excel evaluate at open time.**

The boundary is render time:

- **Before render** (XTL only): `@filter`, `@sort`, `@top`,
  `@group`, `@subtotal`, source-data aggregates, cross-source
  lookups, `output_file_pattern`, `__sheet_name_pattern__`,
  `__inputs__` defaulting. Excel cannot reach into these.
- **After render** (Excel can do it): cell display formatting,
  per-cell math on the rendered values, string transformations
  on output values, type tests, date component extraction from
  output cells.

## Side-by-side examples

### Visual number formatting

| Goal | XTL way (avoid) | Excel-formula way (prefer) |
|---|---|---|
| Show `1,234,567.00` for a number | `{{ TEXT([Amount], "#,##0.00") }}` returns a **string** | Cell value `{{ [Amount] }}`, cell `numFmt = "#,##0.00"`. Stays a **number** and sorts / aggregates correctly downstream. |
| Show `₩1,234,567` (Korean Won) | `TEXT()` cannot do currency in XTL 0.1 | Cell `numFmt = "₩#,##0"`, cell value `{{ [Amount] }}` |
| Show negative in parens `(1,234)` | `TEXT()` cannot do parens | Cell `numFmt = "#,##0;(#,##0)"`, cell value `{{ [Amount] }}` |

**Use `TEXT()` in XTL only when you need the formatted *string*
itself** — for example, inside `output_file_pattern` (`{{ TEXT(TODAY(), "YYYY-MM-DD") }}_report.xlsx`)
or concatenated with other strings (`"Total: " & TEXT([Sum], "#,##0")`).

### Hyperlinks

| Goal | XTL way | Excel-formula way |
|---|---|---|
| Static URL `https://example.com/help` | (no XTL needed) | Cell value `=HYPERLINK("https://example.com/help", "도움말")` — preserved verbatim, Excel renders clickable |
| Per-row URL built from a column | `{{ HYPERLINK([Url], [Label]) }}` produces a clickable cell directly | Could also be `={{ "HYPERLINK(""" & [Url] & """, """ & [Label] & """)" }}` but the quoting is awful — prefer `HYPERLINK()` |

### Date component extraction

| Goal | XTL way | Excel-formula way |
|---|---|---|
| Filter rows to "this month" | `{{ @filter MONTH([Date]) = MONTH(TODAY()) }}` — **must** be XTL (filter is render-time) | (Excel can't filter pre-render) |
| Display the month name in a cell | `{{ MONTH([Date]) }}` returns a number | Cell value `=MONTH(B2)`, or cell `numFmt = "mmm"` with the date itself in the cell |
| Compose a filename for the previous month | `{{ TEXT(EDATE(TODAY(), -1), "YYYY-MM") }}_report.xlsx` | (filename is render-time; no formula path) |

### Conditional output

| Goal | XTL way | Excel-formula way |
|---|---|---|
| Tier label per row (3+ branches) | `{{ IFS([R] > 10000, "VIP", [R] > 1000, "Standard", TRUE, "Lite") }}` | Cell value `=IFS(B2 > 10000, "VIP", B2 > 1000, "Standard", TRUE, "Lite")` — both work; XTL form aggregates / filters by tier in the same template |
| Filter rows where tier is "VIP" | Must be XTL: pre-compute or filter on raw column | (Excel can't filter pre-render) |

### String transformations

| Goal | XTL way | Excel-formula way |
|---|---|---|
| Display uppercase company name | `{{ UPPER([Customer]) }}` | Cell value `=UPPER(B2)` |
| Use uppercase for filename | `{{ UPPER([Region]) }}_report.xlsx` in `output_file_pattern` | (filename is render-time; no formula path) |
| Strip whitespace and use as filter | XTL parser doesn't yet accept `@filter UPPER([X]) = "Y"` — normalize source-side instead | — |

### Math

| Goal | XTL way | Excel-formula way |
|---|---|---|
| Round amount to 2 decimals for display | (cell `numFmt = "#,##0.00"` is usually the right answer) | Or `=ROUND(B2, 2)` in the cell. `ROUND()` is also XTL but only needs to be XTL when a filter uses it |
| `MOD`, `INT`, `SQRT`, `POWER` for display | XTL does not provide these | Cell formula — `=MOD(B2, 7)`, `=SQRT(B2)`, etc. Excel evaluates at open |

### Type tests

| Goal | XTL way | Excel-formula way |
|---|---|---|
| Substitute "n/a" for blank | `{{ IFEMPTY([X], "n/a") }}` | Or cell formula `=IF(ISBLANK(B2), "n/a", B2)` |
| Guard a division | `{{ IFERROR([A] / [B], 0) }}` catches `#DIV/0!` | Or cell formula `=IFERROR(B2/C2, 0)` |
| Check `ISNUMBER` / `ISTEXT` / `ISBLANK` | XTL does not provide these | Cell formula — Excel native |

## Quick reference

When you find yourself reaching for a function that XTL doesn't
expose:

1. Is the value used **inside a directive** (`@filter`, `@sort`,
   `@top`, `@group`, `@subtotal`) or in a **filename / sheet-name
   pattern**? → It must be XTL. File an issue if XTL lacks the
   function.
2. Otherwise → put the Excel formula directly in the cell.
   xl3 preserves the formula; Excel evaluates at open time.

## Why this rule exists

ADR-0043 spells out the principle: XTL's function surface stays
small by construction so porters have a clear catalog to
implement. Adding functions for cell-output use only duplicates
what Excel already does and bloats the spec.

The cost of "use Excel formulas in cells" is that the output
workbook isn't fully self-contained — opening it depends on
Excel recalculating. For most operational reports this is the
expected workflow anyway.

## See also

- [ADR-0043 — Excel-native preference principle](../../spec/decisions/0043-excel-native-preference.md)
- [ADR-0044 — Function batch accepted](../../spec/decisions/0044-function-batch-accepted.md)
- [ADR-0045 — Function batch rejected](../../spec/decisions/0045-function-batch-rejected.md)
- [Cookbook 10 — Styling and branding](./10-styling-and-branding.md) — when `numFmt` is the right answer
- [Cookbook 11 — TEXT() formatting](./11-text-formatting.md) — when `TEXT()` *is* the right answer
