# XTL Evaluation

This document defines how an XTL implementation reads inputs and produces outputs.

## Inputs and Outputs

An XTL conversion takes:

```text
template.xlsx
data.xlsx
```

and produces one or more `.xlsx` output files.

The template workbook defines the output workbook shape, template expressions, grouping rules, directives, and configuration. The source workbook provides tabular data.

## Template Configuration

A hidden sheet named `_config` MAY provide metadata and runtime settings.

| Key | Meaning | Example |
|---|---|---|
| `name` | Template display name | `Order summary` |
| `description` | Free text | `Monthly order summary` |
| `source_sheet` | Source sheet name, or prefix pattern ending with `*` | `Orders`, `Data_*` |
| `header_row` | 1-based source header row | `1` |
| `source_range` | Optional Excel range. The first row is headers; remaining rows are data. | `B5:H200` |
| `output_file_pattern` | Output filename template | `{{ Customer }}_report.xlsx` |
| `match_pattern` | Batch matching pattern | `Orders*` |
| `_<name>` | User variable | `_title = Order Summary` |

When `source_range` is present, it defines both the header row and source columns. In that case, `header_row` is ignored for source reading.

## Source Data Model

The source data model is an ordered list of rows. Each row is a mapping from header name to cell value.

By default:

1. `source_sheet` selects the worksheet. If omitted, the first worksheet is used.
2. `header_row` selects the header row.
3. Rows below `header_row` are data rows.
4. Empty data rows are skipped.

When `source_range` is set:

1. The range start row is the header row.
2. The range start/end columns define the only source columns.
3. Rows below the range start row, through the range end row, are data rows.
4. Empty data rows inside the range are skipped.

## List Sheets

Any sheet whose name starts with `_` is a list sheet, except `_config`.

List sheets:

- MAY be visible, hidden, or very hidden in the template.
- MUST be removed from output workbooks.
- Are read from their first column.
- Ignore empty cells.
- Are referenced by `@filter ... in _SheetName` and `@filter ... !in _SheetName`.

Referencing a missing list sheet is an error.

## Render Phases

Implementations MUST render in this conceptual order:

1. Parse `_config`, list sheets, sheet templates, directives, and variables.
2. Read source rows.
3. Resolve source columns referenced by template expressions.
4. Split source rows into file groups from `output_file_pattern`.
5. Split file groups into sheet groups from sheet-name group keys.
6. Apply directives to the current row set.
7. Expand repeat blocks.
8. Evaluate static cells and data cells.
9. Remove `_config`, list sheets, and directive rows from output.
10. Write output files.

The exact implementation strategy may differ, but observable output MUST match this order.

## Directives

Directives apply in this order:

```text
filter -> sort -> top
```

Multiple filters are combined with logical AND. Multiple sorts are applied in directive order.

`@repeat right` changes block expansion direction and is not a data filtering directive.

## Cell Evaluation

### Single-Expression Cells

A cell whose complete content is one template expression is a single-expression cell:

```text
{{ [OrderDate] }}
```

Single-expression cells preserve the evaluated value type where possible.

If the template cell has a number/date/text format, the implementation MUST coerce string source values to match that format:

- Date-like formats coerce supported date strings or Excel serial numbers to dates.
- Number-like formats coerce numeric strings to numbers.
- Text format `@` coerces to string.

If coercion fails, the implementation MUST report an error.

The minimum set of supported date formats and numeric format tokens is not normatively defined by XTL 0.2 and is left to each implementation. Implementations that support fewer formats than another implementation may declare partial conformance.

### Mixed Text Cells

A cell containing literal text around one or more expressions is a mixed text cell:

```text
Order date: {{ [OrderDate] }}
```

Mixed text cells render as strings. Template number/date formats do not coerce mixed text cells.

### TEXT Function

`TEXT(value, format)` always returns a string. It is intended for filenames and explicit display strings, not for cells that should remain numeric/date values.

## Output Filenames

Each output filename produced by `output_file_pattern` evaluation MUST be sanitized in this order:

1. **Replace forbidden characters** with `_`:
   - The set `< > : " / \ | ? *`
   - ASCII control characters in the range `0x00`-`0x1F`.
2. **Trim** leading and trailing whitespace and trailing `.` characters.
3. **Reserved name guard:** if the resulting basename (before the `.xlsx` extension), case-insensitive, equals one of `CON`, `PRN`, `AUX`, `NUL`, `COM1`-`COM9`, `LPT1`-`LPT9`, append a single `_` to the basename.
4. If steps 1-3 yield an empty filename or empty basename, this is an error.
5. If the UTF-8 byte length of the resulting filename exceeds 255, this is an error. Implementations MUST NOT silently truncate.
6. Implementations SHOULD emit a warning when any of steps 1-3 changed the rendered string, including the original and the sanitized filename. Warnings MUST NOT change output semantics.

These rules apply to filenames only. Sheet names follow Excel's own forbidden set and 31-character length limit, defined separately by the implementation.

Unicode characters (e.g., CJK, accented letters, emoji) are not restricted: any code point outside the explicitly forbidden set is preserved.

## Styles and Workbook Structure

Implementations SHOULD preserve template workbook structure and formatting, including:

- Cell style
- Number/date format
- Font, fill, border, alignment
- Row height and column width
- Merged cells where possible
- Images where possible

Style preservation does not override value semantics. For example, a string returned by `TEXT()` remains a string even if the template cell has a date format.

## Errors

The following conditions are errors:

- Referencing a source column that does not exist.
- Referencing a list sheet that does not exist.
- Using an invalid directive.
- Using an invalid `source_range`.
- Failing to coerce a single-expression cell value to its template cell format.
- Producing an invalid output filename after sanitization rules are applied.
- Calling `ROW()` outside a repeat block.

Implementations MAY provide warnings for non-fatal portability issues, but warnings MUST NOT change output semantics.
