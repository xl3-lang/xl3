# XTL Language

This document defines the XTL 0.1 template language surface. The notation here is normative for template authors and implementations.

## Template Blocks

Template expressions are written inside double braces:

```text
{{ expression }}
```

Whitespace immediately inside `{{` and `}}` is insignificant.

## Source Columns

Source columns are referenced with bracket syntax:

```text
{{ [Customer] }}
{{ [Customer Name] }}
{{ [Units Per Case] }}
```

The text inside `[` and `]` is the exact source header name after trimming surrounding whitespace. Column names MAY contain spaces, letters, numbers, and punctuation except `]` and line breaks.

Bare names such as `{{ Customer }}` are not source column references in cells. Bare names are reserved for sheet and file group keys.

## Literals

XTL 0.1 supports:

```text
"text"
123
123.45
-123
```

String literals use double quotes. Number literals are decimal numbers.

## Operators

Arithmetic:

```text
{{ [price] * [quantity] }}
{{ [total] / 10 }}
{{ [a] + [b] }}
{{ [a] - [b] }}
```

String concatenation:

```text
{{ [item] & " (" & [size] & ")" }}
```

Comparison operators:

```text
=
!=
>
<
>=
<=
```

Comparison operators are used in `IF()` and `@filter`.

## Functions

Function names are case-insensitive. The spec writes them uppercase.

### IF

```text
{{ IF([quantity] > 100, "bulk", "normal") }}
```

Returns the second argument when the condition is true, otherwise the third argument.

### IFEMPTY

```text
{{ IFEMPTY([memo], "-") }}
```

Returns the second argument when the first argument is empty, null, or missing. Otherwise returns the first argument.

### Aggregates

Aggregates operate on the current rendered row set.

```text
{{ SUM([total]) }}
{{ COUNT() }}
{{ COUNT([customer]) }}
{{ AVERAGE([price]) }}
{{ MIN([date]) }}
{{ MAX([date]) }}
```

`COUNT()` counts rows. `COUNT([field])` counts non-empty values in that field.

### Numeric Functions

```text
{{ ROUND([amount], 0) }}
{{ ABS([delta]) }}
```

`ROUND(value, places)` rounds to the given number of decimal places. Rounding uses half-away-from-zero, matching Excel's `ROUND()` (e.g., `ROUND(2.5, 0)` is `3` and `ROUND(-2.5, 0)` is `-3`).

### Text Formatting

```text
{{ TEXT([date], "YYYY-MM-DD") }}
{{ TEXT([amount], "#,##0") }}
```

`TEXT()` returns a string. Use template cell number/date formats when the output should remain a number or date value.

XTL 0.1 defines this minimum `TEXT()` format subset:

| Kind | Tokens / formats | Meaning |
|---|---|---|
| Date/time | `YYYY`, `YY`, `MM`, `DD`, `dd`, `HH`, `hh`, `mm`, `ss` | Zero-padded calendar fields, except `YYYY` and `YY`. `DD` and `dd` are both day-of-month. |
| Number | `0` | Rounded integer with no grouping. |
| Number | `#,##0` | Rounded integer with `,` thousands grouping. |
| Number | `0.00` | Fixed two decimal places, no grouping. |
| Number | `#,##0.00` | Fixed two decimal places with `,` thousands grouping. |

Numeric `TEXT()` rounding uses the same half-away-from-zero rule as
`ROUND()`. Formats outside this table are implementation-defined in XTL 0.1.

### Row and Date Functions

```text
{{ ROW() }}
{{ TODAY() }}
{{ TEXT(TODAY(), "YYYY-MM-DD") }}
```

`ROW()` returns the 1-based row index inside the current repeat block. Calling `ROW()` outside a repeat block is an error. `TODAY()` returns the UTC date at render time. Implementations MUST NOT use the host runtime's local timezone; templates that need a locale-specific date should compute it in the source workbook or pass it through `_config` as a user variable.

## Directives

Directives are written as template expressions, usually in rows immediately above data blocks.

```text
{{ @filter [Status] = "Open" }}
{{ @filter [Customer] in _IncludedCustomers }}
{{ @filter [Category] !in _ExcludedCategories }}
{{ @sort [total] desc }}
{{ @top 10 }}
{{ @repeat right 3 }}
```

Directive names and sort directions are case-insensitive.

### Filter

```text
@filter [field] operator value
```

Operators:

```text
=
!=
>
<
>=
<=
in
!in
```

`in` and `!in` require a list sheet reference such as `_IncludedCustomers`.

### Sort

```text
@sort [field] asc
@sort [field] desc
```

When the direction is omitted, `asc` is used.

### Top

```text
@top 10
```

Keeps the first N rows after filters and sorts.

### Repeat Right

```text
@repeat right
@repeat right 3
```

Repeats the detected data block horizontally. The optional number is the column span per repeated record; when omitted, the column span is `1`.

## Group Keys

Sheet names use bare group keys because Excel sheet names cannot contain `[` or `]`:

```text
{{ Customer }}
```

File patterns may use either bare group keys or bracketed source columns:

```text
{{ Customer }}_report.xlsx
{{ [Customer] }}_report.xlsx
{{ TEXT(TODAY(), "YYYY-MM-DD") }}_report.xlsx
```
