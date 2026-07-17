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

A template block is opened by `{{` and closed by the **first**
subsequent `}}` in cell-text order. The delimiter scanner is NOT
string-literal-aware: a `}}` inside a `"..."` literal CLOSES the
block (ADR-0051). Authors who need a literal `}}` inside a value
hold it in `__config__[key]` and reference it via
`{{ __config__[key] }}`. An expression body whose `"` count is odd
(unbalanced literal, almost always caused by an embedded delimiter)
raises `xl3/parser/unbalanced-literal`.

## Data Blocks

A *data block* on a sheet is the rectangle the engine expands across
when rendering source rows. It has two dimensions:

- **Row range** `[r_start..r_end]` — the maximal run of consecutive
  rows where each row contains at least one *data-row cell* (a cell
  whose `{{ ... }}` body references at least one `[Column]` outside
  an aggregate function). A non-data row (no `[Column]` references)
  between two data-row rows closes the block.
- **Column range** `[c_start..c_end]` — the bounding box of every
  cell with any `{{ ... }}` expression in the block's row range,
  **extended outward through contiguous non-empty cells**. A
  native Excel formula (`{ formula: "..." }`) or a static value
  immediately adjacent to a marker cell is INSIDE the block. A
  non-empty cell separated by a fully empty column is OUTSIDE.

Cells inside the rectangle are *block cells*. Cells outside the
rectangle but on the same sheet are *outside cells* (ADR-0066).

**Single block per sheet (0.x).** At XTL 0.x a sheet has at most one
data block. If the parser detects two or more disconnected clusters
of `[Column]` data-row cells, it raises
`xl3/expression/bracket-outside-block` at parse time and identifies
the second cluster's starting row. Multi-block support (with an
explicit `@block` directive for boundary disambiguation) is
deferred to a future ADR.

**Block expansion semantics** (rendering side, normative in
`evaluation.md`'s "Render Phases"):

- Block cells are cloned into the expanded rows — one record per
  `(r_end - r_start + 1)` template rows.
- Outside cells with row `r < r_start` stay at their original
  position (header / configuration rows above the block).
- Outside cells with row `r >= r_start` stay at their original row
  `r` even when the splice inserts rows for block expansion. They
  do **NOT** shift downward. Their formula text is preserved
  verbatim.
- Cells in inside columns but rows `r > r_end` (i.e., the
  footer-row case where the block has a "Total" label and footer
  formula in the same columns as the data) DO shift down by
  `(N - 1) × (r_end - r_start + 1)` to land below the expanded
  data block.

The asymmetry — inside-col cells below the block shift, outside-col
cells in the same rows do not — is intentional. It supports the
common "side summary table" pattern (a parallel block-independent
report area to the right or left of the main data block) without
requiring the author to declare separate sheets.

When an author wants a label/formula pair where both shift together
(e.g., A4='footer', B4=LOWER(A4)), they place both cells inside the
block's column range. If the marker cells happen not to reach B
(e.g., only A2 has a marker), B is outside and won't follow A's
shift; the workaround is to add a marker at B2 (even a trivial
literal expression like `{{ "" }}`) or — once available in a future
release — use the explicit `@block A:B` form.

## Source Columns

Source columns are referenced with bracket syntax:

```text
{{ [Customer] }}
{{ [Customer Name] }}
{{ [Units Per Case] }}
```

The text inside `[` and `]` is the exact source column name after trimming surrounding whitespace. Column names MAY contain spaces, letters, numbers, and punctuation except `]` and line breaks.

Bare names such as `{{ Customer }}` are not source column references in cells. Bare names are reserved for sheet and file group keys.

Per ADR-0054, a bare identifier inside a template block resolves in
this order, with `xl3/expression/unknown-name` raised on
unresolved lookup:

| Context | Resolution order |
|---|---|
| `output_file_pattern` | file group key → `__inputs__[name]` → `__config__[name]` |
| Sheet-name pattern | sheet group key → `__inputs__[name]` → `__config__[name]` |
| Data cell | enclosing file group key → enclosing sheet group key → `__inputs__[name]` → `__config__[name]` (boolean literal `TRUE`/`FALSE` still resolves as a literal before this chain) |

Bare identifiers in data cells do NOT resolve to source columns;
authors MUST use the explicit `[Column]` form for column
references. The shorthand resolution chain in data cells exists so
that `{{ Region }}` inside a sheet whose `output_file_pattern` is
`{{ [Region] }}.xlsx` reads the active group's value as expected.

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

Per ADR-0064, the string→number coercion (distinct from literal
parsing) accepts these shapes:

| Shape | Accepted? | Example |
|---|---|---|
| Decimal integer | yes | `"42"`, `"-42"` |
| Decimal fraction | yes | `"3.14"`, `"-3.14"` |
| Thousands separator | yes | `"1,234"`, `"-1,234.56"` |
| Scientific notation | yes | `"1e5"`, `"-1.5e-3"`, `"1.5E10"` |
| Hex prefix `0x`/`0X` | no — error `xl3/eval/operand-coercion` | `"0x10"` |
| Binary prefix `0b`/`0B` | no | `"0b101"` |
| Octal prefix `0o`/`0O` | no | `"0o17"` |
| Leading `+` | no | `"+5"` |
| Unicode minus `U+2212` prefix | no | `"−5"` |
| Produces `±Infinity` | no | `"Infinity"`, IEEE 754 overflow |
| Trailing non-numeric chars | no | `"5px"`, `"5 abc"` |
| Multi-line string | no | a string containing internal LF |

The asymmetry between literal parsing (strict) and string coercion
(permissive) is by design: literals are authored, while coerced
strings come from data (CSV exports, financial systems) where
scientific or hex notation occurs naturally.

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

The six **source-side** Excel error sentinels — `#N/A`, `#VALUE!`,
`#REF!`, `#NAME?`, `#NUM!`, `#NULL!` — read from source as the
empty value per ADR-0017. Per ADR-0053, they contribute `""` to
mixed-text and `&`-concatenation positions and raise
`xl3/cell/numfmt-coercion` in number/date-format single-expression
cells. `#DIV/0!` is the only sentinel the engine itself produces
during XTL evaluation; it follows the rules above. Authors who
want a visible "missing" marker for source-side sentinels wrap the
column reference with `IFEMPTY([col], "missing")`.

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
| `UPPER` | 1 | uppercase letters in a string — ADR-0044 |
| `LOWER` | 1 | lowercase letters in a string — ADR-0044 |
| `TRIM` | 1 | strip leading/trailing whitespace (internal preserved) — ADR-0044 |
| `IFERROR` | 2 | value, fallback — returns fallback when value is an error-cell marker — ADR-0044 |
| `IFS` | even ≥ 2 | (cond, value) pairs; returns first truthy branch; `xl3/eval/no-match` if none — ADR-0044 |
| `DATE` | 3 | year, 1-based month, day — UTC midnight — ADR-0044 |
| `ISBLANK` | 1 | true if value is empty per ADR-0007; alias of the IFEMPTY predicate — ADR-0047 |
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

Per ADR-0060, the `lookup_value` (first arg) and the optional
`fallback` (fourth arg) are full XTL expressions. They MAY be
literals, bare brackets, source-prefixed brackets, function calls,
or composite expressions. A `Source[Column]` reference in either
position is subject to the active-source rule (ADR-0012): it
resolves to the current row only when `Source` is the active
source of the surrounding block; otherwise raises
`xl3/source/row-cross-block`. The array-argument constraints
(same-source, no bare brackets) apply only to `lookup_array` and
`return_array`.

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

Per ADR-0059, the single argument to `SUM`, `AVERAGE` (and its
`AVG` alias), `MIN`, `MAX`, and the 1-arg form of `COUNT` MUST be a
column reference of the form `[Column]` or `Source[Column]`. Any
other shape (literal, expression, function call) raises
`xl3/eval/bad-aggregate-arg`. Authors who need a per-row computed
aggregate either add a helper column upstream or compute the
per-row value in a separate cell.

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
{{ @group [Region], [Customer] }}
{{ @top 10 }}
{{ @repeat right 3 }}
{{ @source Renewals }}
{{ @join Customers on Customers[Account] = Renewals[Account] }}
{{ @block A:D }}
```

Directive names and sort directions are case-insensitive.

### `@block` — explicit data block declaration

Per ADR-0067, `@block` lets an author declare the geometry of a
data block explicitly. Three forms are recognized:

```text
@block                  — bare; col-range auto-detected from {{...}} markers
@block <col-range>      — explicit column range, e.g., A:D
@block <full-rect>      — explicit row × column rectangle, e.g., A2:D7
```

A `@block` directive cell sits in a cell whose row is **strictly
above** the block's first row. Without arguments, the block's
column range is the bounding box of `{{ ... }}` marker cells below
the directive (per ADR-0066 column-scoped detection). With a col-
range argument like `A:D`, the column range is explicit and the
row range is auto-detected. With a full rectangle like `A2:D7`,
both row and column ranges are explicit; the rectangle MUST contain
at least one marker cell or `xl3/block/empty-table` raises.

Two `@block` rectangles on the same sheet MUST NOT overlap (any
row × column intersection raises `xl3/block/overlap`).

**Block-detection mode** (ADR-0068, strict): a sheet either has
*zero* `@block` directives (implicit mode — ADR-0066 single-block
cluster detection applies, multiple disconnected clusters raise
`xl3/expression/bracket-outside-block`), or one or more `@block`
directives (explicit mode — ALL `[Column]` marker cells MUST sit
inside some `@block` rectangle, orphan markers raise the same
error code).

**Directive scoping in multi-block sheets** (ADR-0069): all other
directives — `@filter`, `@sort`, `@top`, `@source`, `@join`,
`@group`, `@repeat` — attach to a specific block by **proximity**:

> Let directive `D` sit at `(r_D, c_D)`. It attaches to the data
> block `B` such that (1) `r_D < B.startRow`, (2) `B.colStart ≤
> c_D ≤ B.colEnd`, and (3) `B.startRow - r_D` is minimized among
> blocks satisfying (1) and (2). If no block satisfies (1) and (2)
> the directive raises `xl3/directive/orphan`.

This rule degenerates correctly on single-block sheets: there is
only one candidate, so the closest-block-below check is trivial.

`ROW()` inside a block returns the block's iteration index
(1-based per record); a `ROW()` cell that does not belong to any
block raises `xl3/expression/row-outside-block`.

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

Keeps the first N rows after filters and sorts. Per ADR-0055, N
MUST be a positive integer (≥ 1). `@top 0`, `@top -5`, and
`@top 05` (leading zero) are parse errors raising
`xl3/directive/invalid-syntax`.

### Repeat Right

```text
@repeat right
@repeat right 3
```

Repeats the detected data block horizontally. The optional number is the column span per repeated record; when omitted, the column span is `1`. Per ADR-0055, the column span MUST be a positive integer (≥ 1); `@repeat right 0` and `@repeat right -3` raise `xl3/directive/invalid-syntax`.

### Source

```text
@source <SourceName>
```

Scopes the surrounding data block to the named source declared in
`__sources__` (per ADR-0012). Inside the block, the bracket shorthand
`[Column]` resolves to the active source's row, and aggregates over
`Source[Column]` work as before. Without `@source`, the active source
is the default `source_sheet` configured in `__config__`.

The explicit form `@source default` is legal and equivalent to
omitting the directive (ADR-0065). Source-name arguments are
case-sensitive: `@source DEFAULT` raises `xl3/source/undeclared`
because no `__sources__` row declares that name.

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

### Group + Subtotal

```text
@group [Key1], [Key2], …, [KeyN]
```

`@group` partitions the active row set into N-level nested groups
for interleaved `@subtotal` emission inside a single data block
(ADR-0038). Group identity uses the ADR-0009 canonical-string
equality rule; group order is encounter order **after** `@filter`
and `@sort` have applied (`@group` itself does not reorder).

A data block MAY contain at most one `@group`. `@group` with no
key list raises `xl3/group/missing-key`. `@group` is incompatible
with `@repeat right` (`xl3/directive/invalid-syntax`).

A `@subtotal` row contains one or more `{{ @subtotal <aggregate> }}`
expressions. Each subtotal row binds to one group nesting level —
the **first** `@subtotal` row in source order binds to the
innermost key (`[KeyN]`), the next binds to `[KeyN-1]`, and so on
outward. The outermost `@subtotal` fires once at the end of the
data block (it is the "grand total via outermost subtotal" pattern).

Supported aggregate bodies — anything else raises
`xl3/subtotal/bad-aggregate`:

- `SUM(<column-ref>)`
- `COUNT()` or `COUNT(<column-ref>)`
- `AVERAGE(<column-ref>)`
- `MIN(<column-ref>)`
- `MAX(<column-ref>)`

Composite expressions (`SUM([A]) - SUM([B])`, `IF(...)`, etc.) are
deferred. The column reference inside the aggregate follows the
same `[Column]` / `Source[Column]` form as elsewhere; the spec
scoping rule from ADR-0038 § "Aggregate scoping" applies — the
aggregate operates over the current group's row set, not the full
block.

Per ADR-0058, a `@subtotal` row MAY contain any number of
`{{ @subtotal <aggregate> }}` expressions in different cells. All
of them share the row's single nesting-level binding (the level
inferred from row order) and evaluate against the same group row
set at each emission. Mixing aggregate kinds (`SUM` + `COUNT` +
`AVERAGE`) and column references on a single subtotal row is
permitted.

A `@subtotal` row MAY also carry literal-text cells, static
formulas, and other `{{ ... }}` expressions that do NOT reference
the current row's columns (there is no "current row" at a group
boundary). Referencing a current-row column outside an aggregate
raises `xl3/subtotal/mixed-row` (ADR-0058), naming the offending
cell. A native cell formula on a `@subtotal` row is preserved
verbatim and its cached result is never interpreted as template
text (ADR-0046), so a formula whose cached value happens to
resemble a marker does not trigger this error.

Empty groups — all data rows empty (ADR-0007) — are skipped.

```text
{{ @sort [Region] }}
{{ @sort [Customer] }}
{{ @group [Region], [Customer] }}
{{ [Region] }} | {{ [Customer] }} | {{ [Amount] }}
"Customer subtotal" |                 | {{ @subtotal SUM([Amount]) }}
"Region subtotal"   |                 | {{ @subtotal SUM([Amount]) }}
```

Errors:

- `xl3/group/missing-key` — `@group` with no key list.
- `xl3/subtotal/outside-group` — `@subtotal` cell in a block with
  no `@group`, or more `@subtotal` rows than `@group` keys.
- `xl3/subtotal/bad-aggregate` — `@subtotal` body is not one of
  `SUM`, `COUNT`, `AVERAGE`, `MIN`, `MAX`, or its argument is not a
  column reference of the allowed form.
- `xl3/subtotal/mixed-row` — a `@subtotal` row also carries a
  current-row `[Column]` reference outside an aggregate (ADR-0058).

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
