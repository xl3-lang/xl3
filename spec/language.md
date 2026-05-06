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

The text inside `[` and `]` is the exact source column name after trimming surrounding whitespace. Column names MAY contain spaces, letters, numbers, and punctuation except `]` and line breaks.

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

Comparison operators are used in `IF()` and `@filter`. They follow the
algorithm in [Comparison and String Coercion](#comparison-and-string-coercion).

## Comparison and String Coercion

Comparison operators (`=`, `!=`, `>`, `<`, `>=`, `<=`) and the `&`
concatenation operator share a single coercion model. Both `IF()`
conditions and `@filter` directives use the comparison algorithm
defined here. `@sort` uses the same algorithm.

### Canonical string form

The canonical string form of a value is:

- An empty value (per [Empty Values](./evaluation.md#empty-values)) is
  the empty string `""`.
- A Boolean: `TRUE` or `FALSE` (uppercase).
- A finite number: the shortest decimal representation that uniquely
  identifies the value, using `.` as the decimal separator and no
  scientific notation for magnitudes between `1e-4` and `1e21`.
  Integers omit the trailing decimal point.
- A string: the string itself.
- A date: implementation-defined in XTL 0.1. Portable templates
  SHOULD NOT rely on date concatenation or string-fallback comparison
  of dates. Use `TEXT()` to produce a stable string instead.

Non-finite numbers (`NaN`, `Infinity`, `-Infinity`) MUST NOT arise from
spec-conformant operations. If they appear, they stringify to `""`.

### Comparison algorithm

Comparison operators apply, in order:

1. If both operands are empty, they are equal. `=` is true; `!=` is
   false; `>` and `<` are false; `>=` and `<=` are true.
2. If exactly one operand is empty, `=` is false and `!=` is true.
   For ordering, the empty value is less than any non-empty value.
3. If both operands are numbers, or both are strings that parse as
   finite numbers via "trim, then `Number()` without producing `NaN`",
   compare numerically.
4. If both operands are Booleans, compare with `FALSE < TRUE`.
5. Otherwise, compare canonical string forms using Unicode code-point
   order. No locale-aware collation is applied.

### `&` concatenation

`&` stringifies each operand to its canonical string form and joins the
results in order. The result of `&` is always a string.

## Functions

Function names are case-insensitive. The spec writes them uppercase.

### IF

```text
{{ IF([quantity] > 100, "bulk", "normal") }}
```

Returns the second argument when the condition is **truthy**, otherwise
returns the third argument.

A value is **truthy** unless it is one of:

- The Boolean `FALSE`.
- The number `0`.
- A value that is empty per
  [Empty Values](./evaluation.md#empty-values) — missing, `null`, `""`,
  or a whitespace-only string.

There is no special-case treatment of the strings `"0"` or `"false"`.
Strings with non-whitespace content are always truthy. Templates that
need to interpret a stringly-typed flag MUST compare explicitly, for
example `IF([flag] = "1", …)`.

Comparison expressions evaluate to a Boolean and are truthy when the
comparison holds.

### IFEMPTY

```text
{{ IFEMPTY([memo], "-") }}
```

Returns the second argument when the first argument is empty per
[Empty Values](./evaluation.md#empty-values). Otherwise returns the
first argument.

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

`COUNT()` counts rows. `COUNT([field])` counts rows whose `[field]`
value is non-empty per [Empty Values](./evaluation.md#empty-values).

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

For the supported formats below, `TEXT()` returns a string. Use template cell
number/date formats when the output should remain a number or date value.

XTL 0.1 defines this minimum `TEXT()` format subset:

| Kind | Tokens / formats | Meaning |
|---|---|---|
| Date/time | `YYYY`, `YY`, `MM`, `DD`, `dd`, `HH`, `hh`, `mm`, `ss` | Zero-padded calendar fields, except `YYYY` and `YY`. `DD` and `dd` are both day-of-month. |
| Number | `0` | Rounded integer with no grouping. |
| Number | `#,##0` | Rounded integer with `,` thousands grouping. |
| Number | `0.00` | Fixed two decimal places, no grouping. |
| Number | `#,##0.00` | Fixed two decimal places with `,` thousands grouping. |

Numeric `TEXT()` rounding uses the same half-away-from-zero rule as
`ROUND()`.

Formats outside this table are extensions in XTL 0.1. An implementation MAY
accept additional formats, but their exact output is implementation-defined and
outside core conformance. Portable templates MUST use only the table above.

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
