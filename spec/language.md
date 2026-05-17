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

Whitespace immediately inside `{{` and `}}` is insignificant — the
parser trims leading and trailing whitespace before normalization.
The following are equivalent:

```text
{{ [name] }}
{{[name]}}
{{    [name]    }}
{{
  [name]
}}
```

Whitespace inside operator spacing (e.g., `{{ [a] + [b] }}` vs
`{{ [a]+[b] }}`) is also insignificant. Whitespace inside string
literals is preserved (`"hello world"` keeps its space).

A template block whose inner content is empty (`{{ }}` or
whitespace-only) is a parse error per ADR-0021
(`xl3/parser/empty-block`).

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

### String literals (per ADR-0028)

A `"`-delimited matched pair. **No escape sequences** — backslashes
pass through literally; there is no normative way to embed a `"`
inside a string literal in 0.x. Authors who need a `"` in a value
hold it in a `__config__` author key (cell content can be any
character) and reference it via `{{ __config__[key] }}`.

An unbalanced or duplicated quote (`"a"b"`, `"a` etc.) is
implementation-defined; portable templates use exactly one matched
pair per literal.

### Number literals (per ADR-0028)

A decimal number, optionally with a leading `-` for negation. Allowed
shapes: `5`, `-5`, `3.14`, `-3.14`, `0`. The Unicode minus
`U+2212` is NOT recognized as a sign (per ADR-0009 amendment).

**Unary operators on non-literal expressions are NOT supported in
XTL 0.x.** All of the following raise `xl3/eval/unsupported-syntax`:

- `+5`, `+[col]` (unary plus)
- `--5`, `-(0 - 5)` (double negation)
- `-[col]`, `-(expr)`, `-__config__[k]` (unary minus on
  non-literal)

Workaround for column negation: write `(0 - [col])` or `[col] * -1`.

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

String parsing follows ADR-0009 and ADR-0023: trim, then `Number()`
without producing `NaN`. Commas are treated as thousands separators
(`"1,234"` parses as `1234`); no scientific notation in literals; no
leading `+`. The Unicode minus `U+2212` is not a sign character
(per ADR-0009 amendment).

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

Division by zero produces an Excel `#DIV/0!` error cell (per
ADR-0025). A numeric single-expression cell renders as a real Excel
error cell with value `#DIV/0!`; in a text-format cell, mixed-text
cell, or inside `&` concatenation, the string `"#DIV/0!"` is
substituted at the position. If the error value flows into a further
arithmetic operator within the same cell expression (e.g., `(1/0) + 5`),
it fails to coerce to a finite number and raises
`xl3/eval/operand-coercion` per the table above.

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
   order. No locale-aware collation is applied. **No Unicode
   normalization is applied** either (ADR-0030) — NFC `한` (U+D55C)
   and NFD `한` (U+1112 U+1161 U+11AB) render identically but
   compare as different strings. Authors with mixed-form data
   normalize upstream.

### `&` concatenation

`&` stringifies each operand to its canonical string form and joins the
results in order. The result of `&` is always a string.

## Functions

Function names are case-insensitive. The spec writes them uppercase.

Each user-facing function has a normative arity (see ADR-0024). A
call with the wrong number of arguments raises
`xl3/eval/arity-mismatch` at parse / normalize time, BEFORE any
operand evaluation.

| Function | Args | Notes |
|---|---|---|
| `IF` | 3 | condition, true-value, false-value |
| `IFEMPTY` | 2 | value, fallback (alias: `IFBLANK`) |
| `ROUND` | 2 | value, places |
| `ABS` | 1 | value |
| `TEXT` | 2 | value, format |
| `ROW` | 0 | row index in current data block |
| `TODAY` | 0 | UTC date |
| `YEAR` | 1 | 4-digit year of a date (UTC) — ADR-0019 amendment |
| `MONTH` | 1 | month 1-12 of a date (UTC) — ADR-0019 amendment |
| `DAY` | 1 | day-of-month 1-31 of a date (UTC) — ADR-0019 amendment |
| `EOMONTH` | 2 | date of the last day of the month `N` months from a date (UTC midnight) — ADR-0019 amendment |
| `EDATE` | 2 | date `N` months from a date, same day clamped (UTC midnight) — ADR-0019 amendment |
| `DATEDIF` | 3 | integer count of complete `"Y"`/`"M"`/`"D"` units between two dates (negative when start > end) — ADR-0019 amendment |
| `HYPERLINK` | 2 | url, label — produces a clickable cell — ADR-0039 |
| `XLOOKUP` | 3 or 4 | value, lookup-array, return-array, [fallback] |
| `SUM` | 1 | column ref |
| `AVERAGE` (alias `AVG`) | 1 | column ref |
| `MIN` | 1 | column ref |
| `MAX` | 1 | column ref |
| `COUNT` | 0 or 1 | 0 = block row count; 1 = non-empty count for column |
| `CONCAT` | 1+ | variadic; alternative to `&` |

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

**Multiple `@filter` directives compose with AND.** A row passes
the block only if every `@filter` predicate is satisfied. There is
no `OR` form in XTL 0.1; templates that need disjunction compose
the alternatives with `__lists__[…]` membership filters or
pre-filter the source upstream.

```text
{{ @filter [Region] = "Seoul" }}
{{ @filter [Amount] > 10000 }}
```

A row passes only when both conditions hold.

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
