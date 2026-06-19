# ADR 0071 — Source cell scalar reference (`SOURCECELL` — read a fixed cell from the dynamic source)

- **Status:** proposed
- **Date:** 2026-06-19
- **Spec target:** XTL 1.x (additive; backward-compatible, deferred from the 0.1 → 1.0 freeze per STABILITY.md "intentionally deferred")
- **Affects:** language.md (function table + new "SOURCECELL" subsection); ADR-0024 arity table (new row); evaluation.md (Source Data Model, render phases); impl (normalizer, template-eval, reader, types); new error codes
- **Issue:** #57

## Context

The source (the user-attached, **dynamic** workbook — ADR-0012/0017) is
modeled today as a strictly **tabular** value source: a `source_table`
range whose first selected row is column headers and whose subsequent
rows are data (`spec/evaluation.md` § "Source Data Model"). The only way
to read a source value is by **column** — `{{ [Col] }}` for the active
row, `{{ Source[Col] }}` for a named source. The reader
(`src/reader.ts`) parses a header row, then iterates data rows into
`row[header]` maps. Nothing above, beside, or outside the declared table
range is reachable.

Real-world operations exports routinely carry **positional metadata
outside the table** — a report title in `A1`, a 거래처명/기간 in a merged
banner cell, an 작성자/발행일 in a fixed corner cell. These are single
scalar values pinned to a **cell address**, not a column of the data
grid. Operators want to lift such a value into the output (e.g. "put the
거래처명 from the source's `A1` into the template's header cell").

Three things make this impossible today:

1. **No cell-address read path.** `{{ A1 }}` is not grammar (bare `A1`
   parses as a name lookup per ADR-0054, not a coordinate); `{{ Source[A1] }}`
   treats `A1` as a *column header string*, not a coordinate.
2. **The metadata lives outside `source_table`.** Even widening the range
   to include row 1 would force the banner into the column-header row and
   corrupt the data model.
3. **`__inputs__` cannot reach the source.** ADR-0050 forbids source
   references in `__inputs__` defaults (`xl3/inputs/forward-reference`) —
   inputs are host-supplied, not lifted from the source workbook.

The current spec-clean workaround is to **pre-process the source outside
xl3** and inject the value as a runtime `__inputs__` value. That works but
pushes a per-file manual/host step onto every run of a *dynamic* source —
exactly the toil xl3 exists to remove. The positioning is
*operator-authored rules + dev-owned engine*: the operator should be able
to declare "the title is in `A1`" **in the template**, once.

Note this is a **read**, distinct from the **write** rejected in
ADR-0042. ADR-0042 rejected `@update D5 = …` (mutating an output cell from
elsewhere) on five grounds — chief among them that it makes the template
ambiguous and re-introduces evaluation-order dependence (ADR-0016). A
source-cell *read* mutates nothing, is a pure function of the source
workbook, and is order-independent. The objections in ADR-0042 do not
transfer; see "Relationship to ADR-0042" below.

## Considered Options

The hard part is the **surface**, not the capability. Two prior ADR
decisions constrain it:

- ADR-0012 chose `Source[Column]` for cell references **specifically to
  mirror Excel's structured-ref `=Sales[Amount]`** — in Excel and XTL
  alike, `[...]` means *column/field*.
- ADR-0012 Option D **rejected the sheet-bang form** (`Customers!Account`)
  because "Excel uses `!` for sheet+cell, not sheet+column; repurposing it
  would invent a hybrid that matches neither convention." XTL deliberately
  keeps `!` out of its grammar.

**A. Inline bracket coordinate** — `{{ [$A$2] }}`, `{{ Source[$A$2] }}`,
`{{ [Sheet1!$A$2] }}`, disambiguated by `$`-bearing bracket content.
*Against:* (P2) `[$A$2]` puts a coordinate in the **column namespace** —
Excel never writes a cell as `[$A$2]`, so it fights the very convention
ADR-0012 chose `[Column]` to honor; (P1) `[Sheet1!$A$2]` reintroduces the
`!` sheet-qualifier ADR-0012 D explicitly removed; (P3) `Source[Sheet!…]`
crams two addressing axes (source name *outside*, sheet name *inside*)
into one bracket, admitting ill-defined combinations; (P4) `$`/`!` are
already legal `column_name` characters, so the form overloads
existing-but-pathological syntax and needs a carve-out. Rejected.

**B. Directive `{{ @source[A2] }}`.** *Against:* a `{{ }}` block is
`directive | expression` and a directive yields no cell value (category
error); `@source` is already the source-switch directive (ADR-0012/0065);
`[A2]` already a column. Rejected.

**C. A function `SOURCECELL(...)` — ADOPTED.** The coordinate travels as a
**string-literal argument**, so it never touches the `[...]` column
namespace and never reintroduces `!` as XTL syntax. Brackets keep meaning
columns; `"Sheet1!A2"` inside a string is Excel's *exact, real* notation,
parsed opaquely. Source selection is an explicit argument, not a colliding
axis. Consistent with how XTL already "reaches into a source" — ADR-0070's
map primitive is `XLOOKUP(Source[…])`, and `TODAY()`/`DATE()` are the
precedent for "evaluated once, constant" functions. *Against:* more verbose
than `[$A$2]`; adds one function-table row. Accepted — verbosity is a
non-issue for a rare metadata read, and the function table is the normal
place capability is added (ADR-0024/0044).

## Decision

Adopt **C**. Add a user-facing function **`SOURCECELL`** that reads a
single cell from the source workbook by address. Naming/reuse is **not**
part of this ADR — it rides on `__derived__` (ADR-0070).

### Signature and arity (ADR-0024 table addition)

```
SOURCECELL( address )            -- arity 1
SOURCECELL( source , address )   -- arity 2
```

| function | min | max | shape |
|----------|-----|-----|-------|
| `SOURCECELL` | 1 | 2 | `[source,] address` |

- **`address`** — a **string literal** (`"A2"`, `"$A$2"`, `"Sheet1!A2"`).
  It MUST be a literal, not a column/expression (`SOURCECELL([Col])` →
  `xl3/cells/dynamic-address`); this keeps the value constant-foldable at
  source-read time. `$` signs are optional and ignored (absolute vs
  relative is meaningless for a fixed read) — accepted for Excel
  paste-compatibility.
- **`source`** (arity 2) — a **declared source name** as a bare
  identifier (the `Source[Column]` style, ADR-0012), e.g.
  `SOURCECELL(Customers, "A2")`. Omitted ⇒ the default source (ADR-0065).
- **Arity** is validated at normalize time per ADR-0024
  (`xl3/eval/arity-mismatch`).

### Address grammar

```
address_string = '"' , [ sheet_ref "!" ] , a1_coordinate , '"' ;
a1_coordinate  = [ "$" ] , column_letters , [ "$" ] , row_number ;  (* single cell *)
column_letters = letter , [ letter ] , [ letter ] ;                 (* A … XFD *)
sheet_ref      = simple_sheet_name | "'" , sheet_name , "'" ;
```

- Exactly **one** cell. A range (`"A1:B2"`) ⇒ `xl3/cells/range-not-scalar`.
- A sheet may be named (`"Summary!B2"`) and **need not be a declared
  source** — the cell is read straight from the worksheet. Sheet names with
  spaces/special chars use Excel's quoting inside the string
  (`"'2026 결산'!B2"`).
- A malformed address ⇒ `xl3/cells/invalid-address`.

### Semantics

- **Read timing:** at source-read time, alongside table parsing and
  before `@filter`/grouping. Independent of `source_table` — the
  coordinate addresses the **worksheet**, not the table region (that is
  the point: the metadata lives outside the table).
- **Constant / row-independent:** `SOURCECELL` returns the **same value on
  every output row** — it does not vary per `@repeat` iteration. With a
  literal address it is effectively a constant folded once. (Contrast
  `{{ [Region] }}`, a per-row column read.)
- **Value & type:** the cell's stored value, with the same value-type and
  number/date-format coercion a single-expression data cell receives
  (ADR-0052/0064). An empty target cell yields the empty string
  (ADR-0062). A cell holding a native Excel formula yields its **cached
  computed value** (the `source_table` formula-column read path, ADR-0046)
  — not the formula text. Embedded in mixed text it renders as a string,
  like any expression.
- **Merged cells:** the value lives in the merge's top-left cell; an
  address pointing at a non-top-left member of a merged region yields the
  empty string (Excel behavior).
- **Errors:** `xl3/eval/arity-mismatch` (0 or >2 args, ADR-0024);
  `xl3/cells/dynamic-address` (address arg not a string literal);
  `xl3/cells/invalid-address`; `xl3/cells/range-not-scalar`;
  `xl3/cells/sheet-not-found`; `xl3/cells/unknown-source` (arity-2 source
  name not declared). An address beyond the worksheet's used bounds
  resolves to empty string (not an error — matches reading a blank cell).

### Naming and reuse → `__derived__` (ADR-0070), not here

`SOURCECELL(...)` is an expression with no name, so it cannot appear in
sheet-tab or `@file` patterns (which forbid `[`/`]`). When a name is
needed — for naming an output, for reuse across many cells, or for a
single audit site — declare a **derived column** (ADR-0070) whose
expression is the read:

| name        | expression           |
|-------------|----------------------|
| ReportTitle | `SOURCECELL("A1")`   |

`ReportTitle` is then a bare identifier usable in sheet/file names and in
cells (`{{ [ReportTitle] }}`). This composes the two proposals into **one
read function + one naming layer**, with no third mechanism and no new
reserved sheet.

## Examples

```text
{{ SOURCECELL("A1") }}                  -- default source sheet, cell A1
거래처명: {{ SOURCECELL("A2") }}          -- mixed text → string
{{ SOURCECELL(Customers, "A1") }}       -- named source Customers, cell A1
{{ SOURCECELL("Summary!B2") }}          -- worksheet Summary (need not be a source)
{{ SOURCECELL("'2026 결산'!B2") }}        -- quoted sheet name with a space
```

A banner-plus-table template: `A1 = {{ SOURCECELL("A1") }}` (title, outside
the table) sits above `A5 = {{ [품목] }}` (`@repeat` data block). The title
is constant on every rendered row; the data cells vary per row.

## Scope

- **In scope:** `SOURCECELL` reading a single fixed cell from the source
  workbook by address, optionally source- or sheet-qualified; usable
  anywhere an expression is legal.
- **Out of scope (separate proposals if demanded):** range/spilled reads
  (`"A1:B5"` → array); dynamic/computed addresses; per-row positional
  reads; *writing* to cells by address (remains rejected, ADR-0042); a
  dedicated `__cells__` reserved sheet (redundant with `__derived__`); the
  inline bracket and `@source[A2]` surfaces (see Alternatives).

## Consequences

- Operators lift positional metadata (title/date/거래처명 in a banner cell)
  **in the template**, once, with no per-run host pre-processing — matching
  the product positioning.
- One new function, zero new reserved sheets, **no change to bracket
  semantics** (brackets stay column-only, honoring ADR-0012). Naming reuses
  the already-proposed `__derived__` (ADR-0070).
- Implementation is contained: `reader.ts` gains an address-keyed read on
  the already-open source workbook (independent of the table parse);
  `normalizer` adds `SOURCECELL` to the function table and emits a tagged
  IR (distinct from the existing `sourceCell "Name" "Col"` row×column IR —
  the function is coordinate-based, so name it unambiguously, e.g.
  `sourceCellAt "<source>" "<address>"`); `template-eval` resolves it
  against the workbook; `types.ts` carries it; ADR-0024's arity table and
  the language.md function table gain a row. New error codes are catalog
  **additions** (not a G3-resetting change).
- Additive only: no existing template changes behavior; no bracket
  overload, no carve-out, no public API break.
- New conformance fixtures (stage 1): scalar from an out-of-table cell read
  into a header; `SOURCECELL(Source, …)` source-qualified;
  `SOURCECELL("Sheet!…")` sheet-qualified; quoted-sheet-name;
  constant across a `@repeat` block; cached-formula-value read;
  merged-cell member; arity-mismatch / dynamic-address / range-not-scalar /
  sheet-not-found / unknown-source errors; a `__derived__` alias
  (`SOURCECELL("A1")`) used as a sheet name.
- Listed in `INFORMATIONAL_ADRS` of `src/__tests__/spec-coverage.test.ts`
  while **proposed** (doc-only design ahead of impl), removed when the
  fixtures land — same handling as ADR-0070.

## Relationship to ADR-0042

ADR-0042 rejected runtime cell *mutation*. This ADR proposes a source
*read*. The distinction is load-bearing:

- **Nothing in the output is mutated.** The value flows from a source cell
  into a `{{ }}`-marked template cell. Every cell that changes still
  carries a visible marker (ADR-0042 objection #1 — template-is-handover —
  satisfied, not violated).
- **No evaluation-order dependence.** `SOURCECELL` is a pure function of
  the source workbook, fixed before grouping; there is no "cell A updates,
  then B reads A" chain (ADR-0042 objection #4 / ADR-0016 does not apply).
- **Substitution does *not* already cover this** (ADR-0042 objection #2's
  premise fails here): no column and no in-cell expression can reach a
  value sitting *outside the table region* of a dynamic source. That gap
  is precisely what this ADR fills.

## Alternatives considered

1. **Inline bracket coordinate** `[$A$2]` / `Source[$A$2]` /
   `[Sheet1!$A$2]` (Option A). Rejected on four grounds: (P2) a bracketed
   coordinate fights ADR-0012's `[...]`=column convention — Excel never
   writes a cell that way; (P1) the `!` sheet-qualifier was explicitly
   removed by ADR-0012 Option D; (P3) source-vs-sheet axis collision in
   `Source[Sheet!…]`; (P4) overload of legal `column_name` characters
   forcing a carve-out. `SOURCECELL` dissolves all four by keeping the
   coordinate in a string argument.
2. **`__cells__` reserved sheet.** Rejected as redundant with ADR-0070:
   the only thing a name buys — use in sheet/file patterns and reuse — is
   exactly what a `__derived__` column with a `SOURCECELL(...)` expression
   already provides. A second naming mechanism violates the small-surface
   thesis (README; ADR-0043) and the no-speculative-feature bar
   (ADR-0042 #5).
3. **`{{ @source[A2] }}` directive form** (Option B). Rejected:
   directive-in-value-position category error; `@source` already taken;
   `[A2]` already a column.
4. **Bare `Sheet1!$A$2`** (no function, no brackets). Rejected: doubly
   blocked — bare `A1` as a coordinate was rejected by ADR-0054, and `!`
   as bare XTL syntax was removed by ADR-0012 D.

## Open questions (for review before implementation)

- Function name: `SOURCECELL` vs `CELLOF` vs `SRCCELL`. (`SOURCECELL`
  chosen for readability and to echo `Source[…]`.)
- Whether to allow the arity-2 `source` to also be a `__derived__`-style
  name or strictly a declared source — proposed strictly declared.
- Whether the cached-formula-value rule needs a `recalc`-staleness caveat
  mirroring ADR-0046's note.
- Quoted-sheet-name escaping: does a sheet name containing a literal `'`
  need an escape, or is that out of scope (use a `__derived__` alias)?

## References

- ADR-0070 — Derived columns (the naming/reuse layer; a derived column
  whose expression is `SOURCECELL(...)`)
- ADR-0012 — Multi-source data model (chose `Source[Column]`; rejected the
  `!` sheet-bang form in Option D — the constraints this surface honors)
- ADR-0024 — Function arity (the table `SOURCECELL` joins;
  `xl3/eval/arity-mismatch`)
- ADR-0044 — Function batch accepted (precedent for adding functions)
- ADR-0017 — Source value model (tabular row/column access this extends)
- ADR-0065 — `@source` default explicit form (default-source resolution)
- ADR-0042 — Rejected: runtime cell mutation (the *write* this is distinct
  from)
- ADR-0016 — Ordering and stability (order-independence argument)
- ADR-0050 — Template inputs as XTL expressions (why `__inputs__` cannot
  reach the source)
- ADR-0054 — Bare name in cell context (why bare `A1` is not a coordinate)
- ADR-0046 — Cell formula preservation (cached-value read path)
- ADR-0052 / ADR-0062 / ADR-0064 — value-type coercion, empty-string,
  string→number scope (scalar value semantics)
- ADR-0043 — Excel-native preference / small XTL surface (the thesis the
  `__cells__` rejection protects)
- README § "Why the runtime needs to be boring" (small, auditable surface)
