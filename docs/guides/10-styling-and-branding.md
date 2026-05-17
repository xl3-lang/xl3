# 10 · Styling and branding

## Scenario

Output workbooks should match your company's brand — sheet tab colors,
font choices, number formats, merged title rows.

## Author styles directly in the template

xl3 preserves all template styling. The data block expands rows, but
each rendered row inherits the styled template row's font, fill,
borders, number format, alignment, etc. Footer rows below the data
block keep their styling and shift down as the block expands.

You don't write a "style" directive — Excel styling lives in the
template `.xlsx` itself.

## Sheet `tabColor`

Set the tab color in Excel (right-click the sheet tab → `Tab Color`).
xl3 preserves it verbatim per ADR-0032 #3. Output sheets keep the
template's tab color.

## Number formats and `TEXT()`

Two ways to control how a number renders:

**1. Cell `numFmt` on the template cell.** Author the template
cell with a number format like `#,##0.00` or `[$₩-ko-KR]#,##0`. The
formatted output cell carries the same format.

**2. `TEXT()` in the expression.** Force a string-typed cell with the
exact format you want:

```text
{{ TEXT([Amount], "$#,##0.00") }}
{{ TEXT([Date], "yyyy-mm-dd") }}
{{ TEXT([Pct], "0.0%") }}
```

Use `TEXT()` when you need the formatted string in a concatenation:
`{{ "Total: " & TEXT(SUM([Amount]), "$#,##0") }}`.

Supported `TEXT()` formats follow the core Excel format table.
Formats outside the core table are implementation-defined per
ADR-0021.

## Merged cells

xl3 preserves merges in the template:

- Merges **above** the data block stay where they are.
- Merges **below** the data block shift down as the data block expands.
- Merges **inside** the data block (across cells of one template row)
  are preserved on every rendered row.

Vertical merges that cross the data-block boundary are
implementation-defined per ADR-0021 — avoid them in portable templates.

## Headers in merged cells: don't

A common trap: the source-data sheet has a merged title row above the
column headers. xl3 reads headers from the row pointed to by
`source_table`. If that row is merged, behavior is reader-library-
defined (ADR-0032 #2) — ExcelJS returns the merge value on every cell
and trips `xl3/source/duplicate-name`. Keep header rows un-merged.

## Print setup

`pageSetup` (orientation, margins, print area), `views` (zoom, frozen
panes), and `defaultRowHeight` are all preserved per ADR-0032 #3.
Author them in the template; they carry through to the output.

## Notes

- Workbook properties (themes, defined names, print areas) are
  preserved verbatim. Set them once in the template; every output
  inherits.
- Spec reference: ADR-0032 "Niche limits and workbook pass-through
  behaviors"; [`spec/evaluation.md`](../../spec/evaluation.md) "Cell
  Evaluation" for cell-level styling.
