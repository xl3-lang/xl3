# XTL Language

This document defines the XTL 0.1 template language surface. The notation here is normative for template authors and implementations.

A formal grammar for the contents of `{{ ... }}` template blocks
lives in [`grammar.ebnf`](./grammar.ebnf) — non-normative supporting
material for porters and tooling. Term definitions live in
[`glossary.md`](./glossary.md).

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

### Arithmetic — `+`, `-`, `*`, `/`

Both operands MUST coerce to a finite number. Coercion rules per
ADR-0023:

| Operand type | Coerced value |
|---|---|
| Number (finite) | itself |
| Boolean | 1 (TRUE) / 0 (FALSE) |
| Empty (per [Empty Values](./evaluation.md#empty-values)) | 0 |
| String that parses as a finite number | parsed number |
| String that does not parse as a number | error `xl3/eval/operand-coercion` |
| Date | error |
| Anything else | error |

String parsing follows ADR-0009: trim, replace commas with nothing,
`Number()` without producing `NaN`. The Unicode minus `U+2212` is
not a sign character (per ADR-0009 amendment).

```text
{{ [price] * [quantity] }}
{{ [total] / 10 }}
{{ [a] + [b] }}
{{ [a] - [b] }}
```

Examples:

| Expression | Result |
|---|---|
| `1 + 2` | 3 |
| `"10" + 5` | 15 |
| `"1,234" + 1` | 1235 |
| `TRUE + 1` | 2 |
| `[empty-cell] + 5` | 5 |
| `"abc" + 5` | error |

Division by zero behavior is currently undecided (ADR-0023 §"Open
question") — see ADR-0023 for the option set.

### String concatenation — `&`

Each operand stringifies via canonical string form (see
[Comparison and String Coercion](#comparison-and-string-coercion))
and the results are joined. Always succeeds; no type errors.

```text
{{ [item] & " (" & [size] & ")" }}
```

### Comparison — `=`, `!=`, `>`, `<`, `>=`, `<=`

Used in `IF()` and `@filter`. Follow the algorithm in
[Comparison and String Coercion](#comparison-and-string-coercion).
Mixed types fall through to canonical-string-form code-point order;
no coercion errors.

```text
=
!=
>
<
>=
<=
```

## Comparison and String Coercion

Comparison operators (`=`, `!=`, `>`, `<`, `>=`, `<=`) and the `&`
concatenation operator share a single coercion model. Both `IF()`
conditions and `@filter` directives use the comparison algorithm
defined here. `@sort` uses the same algorithm.

### Canonical String Form

The canonical string form of a value is:

- An empty value (per [Empty Values](./evaluation.md#empty-values)) is
  the empty string `""`.
- A Boolean: `TRUE` or `FALSE` (uppercase).
- A finite number: the shortest decimal representation that uniquely
  identifies the value, using `.` as the decimal separator and no
  scientific notation for magnitudes in `[1e-6, 1e21)`. Integers omit
  the trailing decimal point. Matches ECMA-262 §6.1.6.1.13.
- A string: the string itself.
- A date: `YYYY-MM-DD` when the time component is exactly midnight
  (`00:00:00`); otherwise `YYYY-MM-DDTHH:mm:ss`. (Defined by
  ADR-0017; previously deferred from ADR-0009.)

  Date components MUST be read in UTC. Excel cells store
  timezone-naive serial dates that ExcelJS and similar libraries
  return as UTC-anchored `Date` objects; using local-timezone
  accessors (`getFullYear`, `getMonth`, `getDate`) introduces
  off-by-one drift on any non-UTC host. Hosts that need a
  timezone-aware date (e.g., a "today in Seoul" filename token)
  should compute it outside the renderer and pass it through
  `__inputs__` or `__config__`.

Non-finite numbers (`NaN`, `Infinity`, `-Infinity`) MUST NOT arise from
spec-conformant operations. If they appear, they stringify to `""`.

### Comparison Algorithm

Comparison operators apply, in order:

1. If both operands are empty, they are equal. `=` is true; `!=` is
   false; `>` and `<` are false; `>=` and `<=` are true.
2. If exactly one operand is empty, `=` is false and `!=` is true.
   For ordering, the empty value is less than any non-empty value.
3. If both operands are numbers, or both are strings that parse as
   finite numbers via "trim, then `Number()` without producing `NaN`",
   compare numerically. Numeric comparison uses IEEE 754 equality;
   `0.1 + 0.2` is therefore not equal to `0.3`. Templates that need
   tolerance MUST round explicitly via `ROUND()`.
4. If both operands are Booleans, compare as values with `false`
   ordered before `true`.
5. If both operands are dates, compare by their underlying timestamp.
   This captures the case where one operand is a midnight-only
   `YYYY-MM-DD` and the other is a datetime — they would otherwise
   compare as different canonical strings.
6. Otherwise, compare canonical string forms using Unicode code-point
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

- The Boolean `false`.
- The number `0`.
- A value that is empty per
  [Empty Values](./evaluation.md#empty-values) — missing, `""`, or a
  whitespace-only string.

There is no special-case treatment of the strings `"0"` or `"false"`.
A string with non-whitespace content is always truthy, including a
stringly-typed flag value of `"0"` or `"false"`. Templates that need to
interpret such a flag MUST compare explicitly, for example
`IF([flag] = "1", …)`.

Comparison expressions evaluate to a Boolean and are truthy when the
comparison holds.

### IFEMPTY

```text
{{ IFEMPTY([memo], "-") }}
```

Returns the second argument when the first argument is empty per
[Empty Values](./evaluation.md#empty-values). Otherwise returns the
first argument.

### XLOOKUP

```text
{{ XLOOKUP([Account], Customers[Account], Customers[Name]) }}
{{ XLOOKUP([Account], Customers[Account], Customers[Name], "(unknown)") }}
```

Looks up `lookup_value` in `lookup_array` and returns the
corresponding value from `return_array`. The arrays MUST be source-
prefixed bracket references (e.g. `Customers[Account]`) and MUST
come from the same source.

The function walks the source's rows in workbook order and returns
the first row whose `lookup_array` column equals `lookup_value` per
the [Comparison Algorithm](#comparison-algorithm). If no row matches:

- If a fourth argument is provided, return it.
- Otherwise this is an error.

XTL 0.1 supports exact match only — no wildcards, approximate match,
or reverse search.

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

`ROW()` returns the 1-based row index inside the current repeat block. Calling `ROW()` outside a repeat block is an error. `TODAY()` returns the UTC date at render time. Implementations MUST NOT use the host runtime's local timezone; templates that need a locale-specific date should compute it in the source workbook or pass it through `__config__` as an author-defined value.

## Directives

Directives are written as template expressions, usually in rows immediately above data blocks.

```text
{{ @filter [Status] = "Open" }}
{{ @filter [Customer] in __lists__[IncludedCustomers] }}
{{ @filter [Category] !in __lists__[ExcludedCategories] }}
{{ @sort [total] desc }}
{{ @top 10 }}
{{ @repeat right 3 }}
{{ @source Renewals }}
{{ @join Customers on Customers[Account] = Renewals[Account] }}
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

`in` and `!in` require a list reference of the form
`__lists__[<name>]` (per ADR-0011), where `<name>` is the column header
inside the reserved `__lists__` sheet. The legacy `_<name>` list-sheet
form is retired.

### Sort

```text
@sort [field] asc
@sort [field] desc
```

When the direction is omitted, `asc` is used.

`@sort` is **stable**. Rows whose sort key compares equal preserve
their source order. With multiple `@sort` directives, the **first**
directive is the primary sort key and later directives are
tiebreakers in the order they appear. Source order is the final
tiebreaker (matching Excel "Sort by … then by …" and SQL `ORDER BY a,
b`).

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

### Source

```text
@source <SourceName>
```

Scopes the surrounding data block to the named source declared in
`__sources__` (per ADR-0012). Inside the block, the bracket shorthand
`[Column]` resolves to the active source's row, and aggregates over
`Source[Column]` work as before. Without `@source`, the active source
is the default `source_sheet` configured in `__config__`.

Referencing an undeclared source is an error. Referencing a column
that is not declared in the source's headers is an error
(`xl3/source/unknown-column`); silent fallthrough to empty would mask
typos.

### Join

```text
@join <JoinedSource> on <JoinedSource>[<key>] = <PrimarySource>[<key>]
```

Pairs each primary row of a `@source` block with the first matching
row from `<JoinedSource>` (per ADR-0014, inner-join semantics, first
match). Unmatched primary rows are dropped. Inside the block,
`<PrimarySource>[Column]` and the bare `[Column]` resolve to the
primary row; `<JoinedSource>[Column]` resolves to the paired joined
row. Multiple `@join` clauses, left-join semantics, and multi-row
matches are out of scope for XTL 0.1.

Both sides of the `on` clause MUST be source-prefixed bracket
references; one side MUST name `<JoinedSource>` and the other
`<PrimarySource>`. Either source being undeclared in `__sources__`,
or a malformed `on` clause, is an error.

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
