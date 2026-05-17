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

## Headers in merged cells: supported

Vendor templates (거래명세서, 발주서, 정산서) often merge header cells
across multiple columns to label a group of fields with one heading.
xl3 reads these natively as of 0.5.0 (per ADR-0033): a horizontally-
merged header forms **one** logical column at the merge master,
and slave cells in the same row are transparent.

Example: a header row with `B1:D1 = "품목"` (merged across 3 columns)
and `E1 = "수량"` reads as two source columns `품목` and `수량`. Data
for `품목` is read from column B; columns C and D are skipped because
their cells are merge slaves of B.

Multi-row header bands (2D merges that span both rows and columns)
also work — point `source_table` at the **last** row of the band so
data starts immediately below it. For a `J11:M12` band, use
`source_table = J12:N` (not `J11:N`, which would treat row 12 as a
phantom data row carrying the merge master's text).

If the original source genuinely has two columns named the same
thing (not because of a merge), `xl3/source/duplicate-name` still
fires. The narrowing only applies to merge slaves.

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
