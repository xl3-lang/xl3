# Glossary

Terms used across XTL spec documents, ADRs, and conformance fixtures.
Where a definition references a section in another document, that
section is normative; this page is summary material.

## A

**Active source.** The named source that bare-bracket field references
(`[Column]`) inside a data block resolve against. Set by `@source`
or, in its absence, the default source declared via `source_sheet`
in `__config__`. (See ADR-0012, evaluation.md "External Data Sources".)

**Aggregate function.** A function whose argument is a column
reference and whose result is a single scalar over many rows:
`SUM`, `AVERAGE`, `AVG`, `MIN`, `MAX`, `COUNT`. Source-prefixed
aggregates (`SUM(Source[col])`) operate on the source's full row
set; bare aggregates (`SUM([col])`) operate on the active block's
filtered rows. (See ADR-0012, language.md "Aggregates".)

## B

**Block.** See *data block*.

**Bracket field.** A column reference of the form `[Column]`. Resolves
against the active source's current row inside a data block. Outside
a data block, it is a syntax error. (See language.md "Source Columns".)

## C

**Canonical string form.** The deterministic string representation of
a value used by `&` concatenation, list membership, and the comparison
algorithm's string fallback. Empty → `""`; Boolean → `TRUE`/`FALSE`
(uppercase); finite Number → ECMAScript shortest round-trippable
form; String → itself; Date → `YYYY-MM-DD` or `YYYY-MM-DDTHH:mm:ss`
(UTC). (See ADR-0009, ADR-0017, language.md "Canonical String Form".)

**Conformance corpus.** The set of fixture directories under
`conformance/fixtures/`, each containing `template.xlsx`,
`data.xlsx`, optionally `expected.xlsx`, and `meta.yaml`. The corpus
is the executable contract: spec prose disagreeing with a passing
fixture loses. (See conformance/runner-protocol.md.)

## D

**Data block.** A contiguous range of rows in a template sheet that
expand once per matching source row at render time. The renderer
detects them by finding cells with bare `[Column]` references; the
range can be modified by `@source`, `@filter`, `@sort`, `@top`,
`@repeat right`, and `@join` directives. (See evaluation.md "Render
Phases".)

**Default source.** The implicit source loaded from the workbook
referenced by `__config__.source_sheet`. Inside a data block with
no `@source` directive, it is the active source. Internal name:
`default`. Authors do not usually write `@source default` explicitly.

**Directive.** A template-block whose contents start with `@`.
Directives modify the surrounding data block. The XTL 0.1 set:
`@filter`, `@sort`, `@top`, `@repeat right`, `@source`, `@join`.
(See language.md "Directives".)

**Dunder (sheet).** A reserved sheet whose name matches the pattern
`^__[a-z]+__$` — i.e., wrapped in double underscores. The four
declared dunder sheets are `__config__`, `__inputs__`, `__sources__`,
`__lists__`. Author-created sheets matching the pattern are rejected
at parse time. (See ADR-0011.)

## E

**Empty value.** A value that is missing (`null`/`undefined`), the
empty string, or a string consisting only of Unicode whitespace.
Numbers (including `0`), Booleans (including `false`), and Dates are
NEVER empty, regardless of value. (See ADR-0007, evaluation.md
"Empty Values".)

**Excel error sentinel.** A cell whose value is one of `#N/A`,
`#VALUE!`, `#DIV/0!`, etc. Read as empty per ADR-0017. Implementations
MAY warn when one is encountered.

**Expression.** The contents of a `{{ ... }}` template block. Can be
a literal, a function call, a bracket reference, a reserved-sheet
reference, or any combination thereof joined by operators. (See
spec/grammar.ebnf for the formal grammar.)

## F

**File group.** A grouping of source rows by the keys declared in
`__config__.output_file_pattern` group keys. Each group becomes one
output `.xlsx`. Emitted in first-seen order over the source's
natural row order (per ADR-0016).

**Filter.** A directive that drops rows from a data block based on a
predicate. Two forms: `@filter [field] op value` and
`@filter [field] in __lists__[name]` (or `!in`).

## G

**Group key.** A column whose distinct values divide source rows into
file groups (when the column appears in `output_file_pattern`) or
sheet groups (when it appears in a sheet's name template).

## I

**Informational ADR.** An ADR whose status is `informational` —
documentation, audit, or process material that does not bind impl
behavior. (See ADR-0004 for an example, 0000-template.md for the
status taxonomy.)

**Input.** A runtime value declared in `__inputs__` and supplied by
the host via the `inputs` option to `convert(...)`. Coerced per
declared `type` (text, number, date, select). (See ADR-0010.)

## J

**Join.** A `@join` directive pairing each row of the active source
with the first matching row of a second source by key. XTL 0.1
supports inner-join semantics with deterministic first-match
ordering. (See ADR-0014.)

## L

**List sheet.** A column inside `__lists__` whose values are the
membership set for `@filter ... in __lists__[name]`. (See ADR-0011,
evaluation.md "List Sheets".)

## N

**Named source.** A source declared in `__sources__` with an explicit
name. Referenced as `Name[Column]` from anywhere a source-prefixed
bracket is valid. The default source is not "named" in this sense.

## P

**Primary source.** Inside a `@join` block, the active source — its
rows drive the iteration. The joined source provides paired columns
through `JoinedSource[Column]` references.

## R

**Reserved sheet.** One of `__config__`, `__inputs__`, `__sources__`,
`__lists__`. Their names and behaviors are defined by ADR-0011.
Author-created sheets matching the dunder pattern are reserved (and
rejected) regardless of whether they match one of the four declared
names. Reserved sheets do not appear in output workbooks.

**Reserved-sheet reference.** A template expression of the form
`__sheet__[key]` that looks up `key` inside a reserved sheet's
key-value table. Valid for `__config__`, `__inputs__`, and
`__lists__`; the form `__sources__[name]` is an error
(`xl3/sources/not-a-dictionary`) because `__sources__` is a
declaration sheet, not a value dictionary.

## S

**Sheet group.** A grouping of source rows by the keys in a sheet
template's name. Each group becomes one output worksheet within its
file. Emitted in first-seen order (per ADR-0016).

**Single-expression cell.** A cell whose template content is exactly
one `{{ expression }}` and nothing else. Such cells preserve the
source value's type (a Date stays a Date, a Number stays a Number)
when the cell's number format is compatible. (See ADR-0003,
evaluation.md "Single-Expression Cells".)

**Source.** A worksheet (or worksheet + table range) read by the
engine to provide row data. The default source comes from
`__config__.source_sheet`; named sources are declared in
`__sources__`. (See ADR-0012.)

**Source-prefixed bracket.** A reference of the form `Source[Column]`
where `Source` is a declared source name. Resolves to the source's
current-row column inside a `@source` block, or feeds an aggregate
or `XLOOKUP` over that source's full row set in static contexts.
(See ADR-0012.)

## T

**Template block.** The `{{ ... }}` syntax that demarcates an XTL
expression or directive within an Excel cell value. (See language.md
"Template Blocks".)

**Truthy / falsy.** A value is truthy unless it is empty (per
ADR-0007), Boolean `false`, or numeric `0`. The strings `"0"` and
`"false"` are truthy because they are non-empty strings. (See
ADR-0008.)

## X

**XLOOKUP.** A function that finds the first row in a source where a
lookup column equals a value, and returns a column from that row.
Mirrors Excel's signature for the basic 3-arg form plus an optional
fallback. Wildcard, approximate, and reverse-search modes are out
of scope for XTL 0.1. (See ADR-0013, language.md "XLOOKUP".)

**XTL.** Excel Template Language. The language defined by `spec/`.
Implementation-neutral; xl3 is the TypeScript reference impl.
