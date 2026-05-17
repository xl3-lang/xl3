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

## Reserved Sheets

xl3 defines four reserved sheet names. Any sheet whose name matches
the dunder-wrapped pattern `__<name>__` is reserved for engine use.
Authors MUST NOT create sheets with that shape; everything else is
template content.

| Sheet | Purpose |
|---|---|
| `__config__` | Single configuration object — engine metadata + author-defined values |
| `__inputs__` | Runtime input declarations (collection; see [Inputs](#inputs)) |
| `__sources__` | Named external data source declarations (collection; see [External Data Sources](#external-data-sources), per ADR-0012) |
| `__lists__` | Author-defined membership lists (collection; see [List Sheets](#list-sheets)) |

References to reserved-sheet contents from cell expressions use Excel
structured-reference form `__sheet__[key]` — the same form used for
multi-source columns in a future ADR. The legacy `_<name>` reference
syntax is retired in this version.

## Template Configuration

A hidden sheet named `__config__` MAY provide metadata and author-
defined values. Column A holds the key, column B holds the value.

| Key | Meaning | Example |
|---|---|---|
| `name` | Template display name | `Order summary` |
| `description` | Free text | `Monthly order summary` |
| `source_sheet` | Source sheet name, or prefix pattern ending with `*` | `Orders`, `Data_*` |
| `source_table` | Source table selector. The first selected row contains column names; rows below are data. | `1`, `A1:D`, `B5:H200` |
| `output_file_pattern` | Output filename template | `{{ __config__[customer] }}_report.xlsx` |
| `match_pattern` | Batch matching pattern | `Orders*` |
| any other key | Author-defined value | `title = Q2 Sales` |

`source_table` is the only source table selector.

Author-defined values use any key not listed in the system table
above. They are referenced from cells via `{{ __config__[key] }}`.
For example, a row `title = Q2 Sales` is referenced as
`{{ __config__[title] }}`. Authors MUST NOT reuse system key names
for author-defined values.

Templates that need *per-run* values use the `__inputs__` sheet
instead (see [Inputs](#inputs)).

## External Data Sources

A template MAY declare additional named data sources beyond the
default by providing the reserved sheet `__sources__`. Row 1 is the
header; each subsequent row declares one source.

| Column | Required | Meaning |
|---|---|---|
| `name` | yes | Source name. Letters, digits, and underscores only. MUST NOT start with `__` and MUST NOT be `default` (reserved for the implicit source). |
| `sheet` | yes | Source worksheet name in the data workbook, or prefix pattern ending with `*`. |
| `table` | no | Source-table selector for that sheet, defaulting to `1`. Same syntax as `source_table` in `__config__`. |
| `description` | no | Free-form note. |

Implementations MUST identify columns by header text, case-insensitive.

The implicit **default** source — declared via `source_sheet` and
`source_table` rows in `__config__` — is always named `default`. It
cannot be redeclared in `__sources__`.

### Cell references

`[Column]` continues to mean "the active source's current row's
column." `Source[Column]` is the structured-reference form for a
named source:

```
{{ [Account] }}                   active source's current row
{{ Customers[Account] }}          Customers' current row (only when active)
{{ SUM(Renewals[Amount]) }}       aggregate over Renewals' full row set
```

Row-level `Source[Column]` is valid only when `Source` is the active
source for the surrounding data block. Inside an aggregate function,
`Source[Column]` always operates on `Source`'s full row set
independent of the active block.

### `@source` directive

A data block MAY scope its iteration to a named source:

```
{{ @source Customers }}
{{ @filter [Region] = "Seoul" }}
{{ [Account] }}
{{ [Region] }}
```

The data block above expands vertically by default — one rendered
row per source row — without an explicit `@repeat` directive (see
[Directives](#directives)).

Without `@source`, the active source is `default`. `@source` MUST
appear before `@filter`/`@sort`/`@top` directives of the same block
(it determines which row set those operate on).

Referencing an undeclared source — either via `@source <Unknown>` or
via `Unknown[Column]` — is an error.

### `@join` directive

A data block MAY add **one** `@join` directive immediately after
`@source` to pair each primary-source row with a row of a second
source:

```
{{ @source Renewals }}
{{ @join Customers on Customers[Account] = Renewals[Account] }}
{{ [Account] }} | {{ Customers[Name] }} | {{ [Amount] }}
```

For each primary row, the engine finds the **first** matching joined
row (per [Comparison Algorithm](./language.md#comparison-algorithm))
and renders the pair. "First" is defined by the joined source's
natural row order — top-to-bottom over its `source_table` range.
This is normative: when multiple joined rows have an equal join key,
two implementations MUST pick the same paired row.

If no match is found, the primary row is **dropped** (inner-join
semantics).

Inside the block, `[Column]` and `<PrimarySource>[Column]` resolve
to the primary row; `<JoinedSource>[Column]` resolves to the paired
joined row. References to other sources at row level remain an error.

Multiple `@join` directives, left-join semantics, and multi-row
matches are out of scope for XTL 0.1.

## Inputs

A template MAY declare runtime inputs by providing a reserved sheet
named `__inputs__`. The first row is a header; each subsequent row
declares one input.

| Column | Required | Meaning |
|---|---|---|
| `name` | yes | Input name. Must consist of letters, digits, and underscores only. |
| `type` | yes | One of `text`, `number`, `date`, `select`. |
| `default` | no | If non-empty, used when the host omits the input. The default value is parsed by the input's `type`. |
| `label` | no | Human-facing prompt text. Hosts SHOULD use it as the form label. |
| `description` | no | Optional longer-form help. |
| `options` | no | Required when `type = select`. Pipe-separated allowed values, e.g. `Seoul\|Busan\|Daegu`. |

Implementations MUST identify columns by header text, case-insensitive.
Columns beyond those listed above are reserved and MUST be ignored.

An input is **required** when its row has no `default`. Hosts MUST
supply every required input; omitting one is an error.

Resolved input values are referenced from cells via
`{{ __inputs__[name] }}`. For example, an input declared with
`name = month` is referenced as `{{ __inputs__[month] }}`.

Input names MUST NOT collide with author-defined values declared as
non-system rows in `__config__`; this is an error at parse time.

Inputs are coerced from host-supplied values:

- `text` — passes the host string through. Non-string host values
  stringify via canonical string form (see
  [Comparison and String Coercion](./language.md#comparison-and-string-coercion)).
- `number` — parsed via "trim, then `Number()` without producing
  `NaN`." Failure is an error.
- `date` — coerced by the same rules as date-format single-expression
  cells. Failure is an error.
- `select` — host value MUST equal one of the declared `options` after
  canonical-string-form normalization. Failure is an error.

Coerced input values participate in `IF()`, `@filter`, `&`,
comparisons, and `TEXT()` like any other value.

## Source Data Model

The source data model is an ordered list of rows. Each row is a mapping from
source column name to cell value.

`source_sheet` selects the worksheet. If omitted, the first worksheet is used.
If `source_sheet` ends with `*`, it is a prefix pattern. The implementation MUST
select the first worksheet, in workbook order, whose name starts with the prefix
before `*`. If no worksheet matches, this is an error. Exact sheet-name matches
take precedence over prefix matching.

`source_table` is interpreted within the selected worksheet:

| Form | Meaning |
|---|---|
| `N` | Row `N` contains source column names. The source columns are the non-empty cells from the first non-empty cell through the last non-empty cell. Rows below `N` are data rows through the worksheet's used row end. |
| `A1:D` | Cells `A1:D1` contain source column names. Rows below are data rows through the worksheet's used row end. |
| `A1:D200` | Cells `A1:D1` contain source column names. Rows `2:200` in columns `A:D` are data rows. |

If `source_table` is omitted, it defaults to `1`.

`N` MUST be a 1-based positive integer. Range forms MUST use absolute Excel A1
coordinates with a left column, first row, right column, and optional end row.
The left column MUST NOT be to the right of the right column. The optional end
row MUST NOT be above the first row.

When a range form includes an end row equal to the first row, such as
`A1:D1`, the source table contains column names and zero data rows. This is
valid.

Source table column-name cells use the same effective text/value extraction as
source data cells before trimming.

Column name rules:

1. Source column name cell values are converted to strings and trimmed.
2. Source column names are case-sensitive.
3. Rich-text source column name cells are read by concatenating text runs.
4. Formula source column name cells use the cached formula result. If no cached
   result is available, this is an error.
5. Empty column names inside the selected source table are errors.
6. Duplicate source column names are errors.
7. Empty data rows are skipped.
8. Horizontally-merged header cells form one column at the merge master's
   column index (per ADR-0033). Slave cells in the same row but a different
   column from the master are transparent: they contribute no column and do
   not cause a duplicate-name error. Vertical merges in the header row read
   the master's text at the slave's column unchanged. If the selected range
   contains only slave cells of a merge (no master in the window), this is
   an error (`xl3/source/missing-header`); widen the range to include the
   merge master.

Merged cells in **data rows** (rows below the header row) follow a
separate rule per ADR-0035: a merge slave's value is the merge master's
value. A vertical merge spanning *N* data rows yields *N* data rows, each
sharing the master's value at that column. A horizontal merge in a data
row gives every slave column the master's value at that row. Empty-data-row
skip is evaluated *after* merge broadcast. Authors who want a vertical
merge to count as one logical record SHOULD unmerge the source data region.

For row-number shorthand (`source_table = N`), gaps between the first and last
non-empty column name cell are therefore errors after the source column span is
inferred.

## Empty Values

A value is **empty** if it is missing — the source column does not exist
on this row, or the cell is blank — or if it is a string whose contents
are entirely Unicode whitespace.

Numbers, including `0`, are never empty. Booleans, including `false`,
are never empty. Dates are never empty. Non-empty strings are never
empty. A formula whose cached result is the empty string is empty by
this rule.

Excel error cells (`#N/A`, `#VALUE!`, `#DIV/0!`, `#REF!`, `#NAME?`,
`#NUM!`, `#NULL!`) — whether static or carried as a formula cached
result — are also empty per this rule (ADR-0017). Implementations MAY
emit a warning when they encounter one; warnings MUST NOT change
output semantics.

The empty predicate governs every place the spec refers to an empty
value:

- `IFEMPTY(value, fallback)` returns `fallback` when `value` is empty.
- `COUNT([field])` counts a row when its `[field]` value is non-empty.
- A source row is empty when every cell in the source-table column span
  is empty. Empty data rows are skipped before grouping and rendering.
- List-sheet entries are read by dropping empty cells from the sheet's
  first column.
- A source-row value that is empty never matches `@filter [field] in
  __lists__[name]`. The same value always matches `@filter [field]
  !in __lists__[name]`.

## List Sheets

A template MAY declare named membership lists by providing a reserved
sheet named `__lists__`. Row 1 is the header; each header cell is the
name of one list. Below row 1, each column holds that list's values.

```
__lists__:
| fruits | allowed_status | excluded_regions |
|--------|----------------|------------------|
| apple  | open           | test             |
| banana | pending        | internal         |
| cherry | reviewing      |                  |
```

The `__lists__` sheet:

- MAY be visible, hidden, or very hidden in the template.
- MUST be removed from output workbooks.
- Each cell is converted to its canonical string form per
  [Comparison and String Coercion](./language.md#comparison-and-string-coercion)
  and trimmed of Unicode whitespace. Cells empty after trimming (per
  [Empty Values](#empty-values)) are skipped.
- Order within each column is preserved. Duplicate entries are not removed.

Lists are referenced from filter directives:

```
{{ @filter [Fruit] in __lists__[fruits] }}
{{ @filter [Status] !in __lists__[allowed_status] }}
```

`__lists__[name]` is a list array. It is valid only inside `@filter
... in` and `@filter ... !in`; using it elsewhere is an error.

Referencing a list name not declared in `__lists__` (or referencing
`__lists__[name]` when no `__lists__` sheet exists) is an error.

## Render Phases

Implementations MUST render in this conceptual order:

1. Parse `__config__`, `__inputs__`, `__lists__`, sheet templates, directives, and variables.
2. Read source rows.
3. Resolve source columns referenced by template expressions.
4. Split source rows into file groups from `output_file_pattern`.
5. Split file groups into sheet groups from sheet-name group keys.
6. Apply directives to the current row set.
7. Expand repeat blocks.
8. Evaluate static cells and data cells.
9. Remove reserved `__<name>__` sheets and directive rows from output.
10. Write output files.

The exact implementation strategy may differ, but observable output MUST match this order.

## Ordering

Output ordering is deterministic and source-driven:

- **File groups** appear in **first-seen** order. The engine walks
  source rows in the source's natural order; the first row whose
  `output_file_pattern` evaluates to filename `X` causes that group
  to be emitted first.
- **Sheet groups within a file** appear in **first-seen** order over
  the file group's row list. The first matching row determines the
  sheet's position.
- The single-source iteration order is `source_table` reading
  top-to-bottom. With multi-source data (see [External Data
  Sources](#external-data-sources)) the rule applies to the
  *primary* source's rows; named sources contribute to aggregates
  and joins but do not affect output ordering.

Sort stability is defined under
[`@sort`](./language.md#sort): equal sort keys preserve source order.

## Directives

Directives apply in this order:

```text
filter -> sort -> top
```

Multiple filters are combined with logical AND. With multiple sorts,
the first `@sort` is the primary key and later sorts are tiebreakers.

`@repeat right` changes block expansion direction and is not a data
filtering directive. Without an explicit `@repeat`, data blocks
expand vertically (downward) — one rendered row per source row.

## Cell Text Extraction

Template expression parsing and source-row reading operate on each cell's
effective text/value:

- Plain string, number, boolean, and date cells are read as their cell values.
- Rich-text cells are read as the concatenation of their text runs, in order.
- Formula cells are not recalculated by XTL. If the workbook contains a cached
  formula result, that cached result is used. If a formula cell is read as a
  source data value and no cached result is available, this is an error.

## Source Value Model

A source value is one of the following kinds (per ADR-0017):

| Kind | Notes |
|---|---|
| Missing | Source column does not exist on this row, or the cell is blank. Empty per [Empty Values](#empty-values). |
| String | Unicode text. Empty per ADR-0007 only when entirely whitespace. |
| Number | IEEE 754 double. `NaN` and infinities are not produced by spec-conformant operations; they stringify to `""` and flow as empty. |
| Boolean | `TRUE` / `FALSE`. |
| Date | A calendar instant; may or may not carry a time component. |

Excel cell shapes map onto kinds:

| Excel cell | XTL kind |
|---|---|
| Blank | Missing |
| String / inline / shared string | String |
| Number (incl. dates stored as serials with non-date format) | Number |
| Date-formatted cell | Date |
| Boolean | Boolean |
| Formula with cached result | The result's kind |
| Error cell (`#N/A`, `#VALUE!`, `#DIV/0!`, …) | Missing (per [Empty Values](#empty-values)) |

A percentage-formatted Excel cell flows as its underlying Number
value (50% → `0.5`). Templates that need formatted output use
`TEXT(value, "0%")` (an extension format outside the XTL 0.1 core
table) or rely on the template cell's number format being preserved.

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

The minimum set of supported date formats and numeric format tokens is not normatively defined by XTL 0.1 and is left to each implementation. Implementations that support fewer formats than another implementation may declare partial conformance.

### Mixed Text Cells

A cell containing literal text around one or more expressions is a mixed text cell:

```text
Order date: {{ [OrderDate] }}
```

Mixed text cells render as strings. Template number/date formats do not coerce mixed text cells.

### TEXT Function

For XTL 0.1 core formats, `TEXT(value, format)` returns a string. It is intended
for filenames and explicit display strings, not for cells that should remain
numeric/date values.

Formats outside the XTL 0.1 core `TEXT()` table are implementation-defined
extensions. The conformance corpus does not assert a specific result for those
formats.

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

Implementations MUST preserve the following template features verbatim
in the rendered output (per ADR-0036):

- Cell style (font, fill, border, alignment)
- Number/date format
- Row height and column width
- Merged cells in both the template and source data rows (per ADR-0033
  for source headers and ADR-0035 for source data rows)
- Images and their anchor ranges
- Conditional formatting rules and their `sqref` ranges
- Named ranges / defined names (workbook-scope and sheet-scope)
- Print area and print titles (repeating rows / columns)
- Freeze pane / split (sheet `views`)
- Sheet protection state and per-cell locked / hidden flags
- Data validation rules (dropdowns, range constraints) and their ranges
- Cell comments (notes)

These are preserved **verbatim**. Ranges, anchors, and references are
**not** auto-extended when `@repeat` expands rows: the engine carries
the template's encoding through to the output unchanged. Authors who
need a rule (e.g., conditional formatting) to cover repeat-expanded
rows SHOULD anchor it with whole-column references in the template
(e.g., `$A:$A`) rather than relying on engine-side extension.

Charts are **implementation-defined** in XTL 0.1 (per ADR-0036 item 3
and ADR-0006); a port may preserve, lose, or partially preserve chart
objects. A future ADR will normatively pin chart behavior when Stage 2
conformance reaches charts.

Style preservation does not override value semantics. For example, a
string returned by `TEXT()` remains a string even if the template cell
has a date format.

## Errors

The following conditions are errors:

- Referencing a source column that does not exist (`xl3/source/unknown-column`).
- Referencing a source not declared in `__sources__` (`xl3/source/undeclared`).
- Referencing a list inside `__lists__` that does not exist
  (`xl3/lists/missing-reference`).
- Using an invalid directive.
- Using an invalid `source_table`.
- Using empty or duplicate source column names.
- Author-created sheets matching the reserved dunder pattern
  `^__[a-z]+__$` (per ADR-0011, `xl3/sheet/reserved-name`).
- Referencing the `__sources__` declaration sheet as a value
  dictionary (e.g., `__sources__[Customers]`,
  `xl3/sources/not-a-dictionary`); use the source name directly.
- Failing to coerce a single-expression cell value to its template
  cell format (`xl3/cell/numfmt-coercion`).
- Producing an invalid output filename after sanitization rules are
  applied (`xl3/filename/empty`, `xl3/filename/too-long`).
- Calling `ROW()` outside a repeat block (`xl3/cell/row-outside-repeat`).
- Source formula cells without cached results (`xl3/cell/formula-no-cache`).
- Missing required `__inputs__` (`xl3/inputs/missing-required`),
  invalid input value, or `select` value not in `options`
  (see ADR-0010 for the full input error catalog).
- XLOOKUP with no match and no fallback (`xl3/xlookup/no-match`),
  bare-bracket arg (`xl3/xlookup/bare-bracket`), or source-mismatched
  arrays (`xl3/xlookup/source-mismatch`).
- `@join` referencing an undeclared source
  (`xl3/join/undeclared-source`) or a malformed `on` clause
  (`xl3/join/bad-on-clause`).
- Row-level reference to a non-active source's column
  (`xl3/source/row-cross-block`).
- Unsupported expression syntax — unary `+`/`--`, or unary `-` on a
  non-literal (column reference, reserved-sheet reference, or
  sub-expression) (`xl3/eval/unsupported-syntax`, per ADR-0028).
- Invalid directive syntax — duplicate `@source` or `@join` in the
  same data block, or an empty directive body
  (`xl3/directive/invalid-syntax`, per ADR-0029).

Per ADR-0015, every spec-defined error carries a stable `error.code`
of the form `xl3/<category>/<id>`. Hosts use the code for
localization and programmatic dispatch; the English `Error.message`
remains the conformance contract.

Implementations MAY provide warnings for non-fatal portability issues, but warnings MUST NOT change output semantics.

## Resource limits

Resource limits — maximum input template size, maximum source row
count, maximum output workbook size, maximum iteration count for
`@repeat`, maximum recursion depth — are **implementation-defined**.
The XTL 0.1 spec does not mandate specific bounds. Implementations
SHOULD document their limits and SHOULD raise a stable
`xl3/limits/...` error code when a limit is hit, but the codes
themselves are not part of the spec contract because hosts vary
widely in deployment shape (browser, CLI, server) and threat model.

Hosts that accept untrusted templates (e.g., a SaaS that accepts
user-uploaded `.xlsx`) MUST enforce their own limits at a layer
above the engine — sandboxing, request size caps, timeouts — and
SHOULD NOT rely on the engine to detect malicious inputs.
