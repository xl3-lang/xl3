# ADR 0071 — Source cell scalar reference (read a fixed cell from the dynamic source)

- **Status:** proposed
- **Date:** 2026-06-19
- **Spec target:** XTL 1.x (additive; backward-compatible, deferred from the 0.1 → 1.0 freeze per STABILITY.md "intentionally deferred")
- **Affects:** language.md (Data Expressions / bracket forms, new "Source cell references" subsection); evaluation.md (Source Data Model, render phases); grammar.ebnf (bracket content classification); impl (reader, normalizer, types); new error codes
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

**A. A reserved sheet `__cells__` mapping name → (source, cell).** A
dedicated declaration sheet, parallel to `__lists__`/`__sources__`; cells
reference the bare name. *For:* one audit site; a name is usable in sheet
*and* file name patterns. *Against:* a whole new reserved sheet for a
narrow need, and **its one unique benefit — naming — is already covered by
the proposed `__derived__` sheet** (ADR-0070): a derived column
`Title = [$A$1]` is a *named* source-cell scalar, usable bare in names.
Adding `__cells__` duplicates that mechanism. Rejected as redundant — see
Alternatives.

**B. A directive form `{{ @source[A2] }}`.** *For:* visually "source-
scoped". *Against:* three hard collisions with existing grammar — a `{{ }}`
block is `directive | expression` and a directive produces no cell value
(category error); `@source` is already the source-switch directive
(ADR-0012/0065); and `[A2]` already denotes a *column named `A2`*.
Rejected.

**C. An inline `$`-coordinate bracket form — ADOPTED.**
`{{ [$A$2] }}`, `{{ Source[$A$2] }}`, `{{ [Sheet1!$A$2] }}`. Reuses the
existing `bracket_field` / `source_bracket_field` surface, disambiguated
by **bracket content**: an absolute-coordinate pattern (`$`-bearing) reads
a cell; anything else stays a column reference. *For:* reuses Excel's own
absolute-reference mental model (`$A$2` "does not move" ⇒ constant across
`@repeat` rows — the semantics fall out for free); no new reserved sheet;
the value-carrying cell keeps a visible `{{ }}` marker. *Against:* `$` and
`!` are already legal `column_name` characters, so this **overloads**
existing-but-pathological syntax (a column literally named `$A$2`); needs a
content-classification rule and a documented carve-out. Accepted — the
overload is vanishingly rare and precisely specifiable; see Decision.

## Decision

Adopt **C**. Introduce an **inline source-cell reference**: a bracket
whose content matches an **absolute A1 coordinate** reads a single cell
from the source workbook by address. Naming/reuse is **not** part of this
ADR — it rides on `__derived__` (ADR-0070). No new reserved sheet.

### Surface and disambiguation

Inside `{{ }}`, the contents of a `[...]` bracket are classified by
**content**, not by a new sigil:

```
cell_coordinate = [ sheet_name "!" ] "$" column_letters "$" row_number
   column_letters = "A".."Z" (1–3, case-insensitive)
   row_number     = digit_seq (>= 1)
   sheet_name     = a simple worksheet name (letters, digits, _, space-free)
```

- A bracket whose **entire trimmed content** matches `cell_coordinate`
  is a **source cell reference**. Forms:
  - `[$A$2]` — cell `A2` of the **default source's** worksheet.
  - `Source[$A$2]` — cell `A2` of named source `Source`'s worksheet.
  - `[Sheet1!$A$2]` — cell `A2` of worksheet `Sheet1` in the source
    workbook (a sheet that need **not** be a declared source).
- A bracket whose content does **not** match `cell_coordinate` is a
  **column reference**, exactly as today — no behavior change.
- **Both `$` signs are required.** `[A2]`, `[A$2]`, `[$A2]` remain column
  references (no ambiguity introduced). The full Excel-absolute spelling
  `$A$2` is the lexical signal.
- A range (`[$A$1:$B$5]`) is **not** a scalar →
  `xl3/cells/range-not-scalar`. Exactly one cell.

### Carve-out (the overload cost)

Because `column_name` permits any character except `]`/CR/LF, a source
column whose **header literally is** `$A$2` (or `Sheet1!$A$2`) can no
longer be referenced by the bare bracket form — that spelling now means
the cell. XTL has no escape mechanism (ADR-0051), so such a column is
**unreferenceable by `[...]`** and must be renamed upstream or read via a
`__derived__` alias. This is accepted: a header literally equal to an
absolute coordinate is pathological, and the rule is precisely specified.

### Semantics

- **Read timing:** at source-read time, alongside table parsing and
  before `@filter`/grouping. Independent of `source_table` — the
  coordinate addresses the **worksheet**, not the table region (that is
  the point: the metadata lives outside the table).
- **Row-independence:** a source cell reference is **constant on every
  output row** — it does not vary per `@repeat` iteration. This mirrors
  Excel: `$A$2` is an absolute reference that does not move on fill-down.
  (Contrast `{{ [Region] }}`, a relative column read that varies per row.)
- **Value & type:** the cell's stored value, with the same value-type and
  number/date-format coercion a single-expression data cell receives
  (ADR-0052/0064). An empty target cell yields the empty string
  (ADR-0062). A cell holding a native Excel formula yields its **cached
  computed value** (the `source_table` formula-column read path, ADR-0046)
  — not the formula text. Embedded in mixed text it renders as a string,
  like any expression.
- **Merged cells:** the value lives in the merge's top-left cell; a
  reference to a non-top-left member of a merged region yields the empty
  string (Excel behavior).
- **Errors:** target sheet missing (`xl3/cells/sheet-not-found`); a
  declared `Source` that names no known source
  (`xl3/cells/unknown-source`); a range coordinate
  (`xl3/cells/range-not-scalar`). An in-workbook address beyond the
  worksheet's used bounds resolves to empty string (not an error — matches
  reading a blank cell).

### Naming and reuse → `__derived__` (ADR-0070), not here

A source cell reference has **no name**, so it cannot appear in sheet-tab
or `@file` patterns (which forbid `[`/`]`). When a name is needed — for
naming an output, for reuse across many cells, or for a single audit site
— declare a **derived column** (ADR-0070) whose expression is the
coordinate read:

| name        | expression  |
|-------------|-------------|
| ReportTitle | `[$A$1]`     |

`ReportTitle` is then a bare identifier usable in sheet/file names and in
cells (`{{ [ReportTitle] }}`). This composes the two proposals into **one
read primitive + one naming layer**, with no third mechanism.

## Scope

- **In scope:** inline scalar reads from a fixed source cell by absolute
  coordinate, optionally source- or sheet-qualified; use anywhere an
  expression is legal.
- **Out of scope (separate proposals if demanded):** ranges/spilled reads
  (`$A$1:$B$5` → array); per-row positional reads (a different address per
  iteration); *writing* to cells by address (remains rejected, ADR-0042);
  quoted/space-bearing sheet names in the inline form (use a `__derived__`
  alias, or revisit); a dedicated `__cells__` reserved sheet (redundant
  with `__derived__` — see Alternatives).

## Consequences

- Operators lift positional metadata (title/date/거래처명 in a banner cell)
  **in the template**, once, with no per-run host pre-processing — matching
  the product positioning.
- One new concept (coordinate read), zero new reserved sheets. Naming
  reuses the already-proposed `__derived__` (ADR-0070).
- Implementation is contained: `reader.ts` gains an address-keyed read on
  the already-open source workbook (independent of the table parse); the
  `normalizer` bracket classifier (`BRACKET_FIELD_RE` / `SOURCE_BRACKET_RE`
  at `src/normalizer.ts:7,13`) gains a content check — coordinate pattern →
  `sourceCell` IR, else the existing column path; `types.ts` carries the
  ref; `grammar.ebnf` documents the bracket-content split. New error codes
  are catalog **additions** (not a G3-resetting change).
- Additive only: existing templates are unchanged **except** the
  pathological "column literally named `$A$2`" carve-out, which is
  documented and accepted. No public API break.
- New conformance fixtures (stage 1): scalar from an out-of-table cell read
  into a header; `Source[$A$2]` source-qualified; `[Sheet1!$A$2]`
  sheet-qualified; constant across a `@repeat` block; cached-formula-value
  read; merged-cell member; `[A2]`-stays-a-column regression;
  `range-not-scalar` / `sheet-not-found` / `unknown-source` errors; a
  `__derived__` alias used as a sheet name.
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
- **No evaluation-order dependence.** A source cell read is a pure
  function of the source workbook, fixed before grouping; there is no
  "cell A updates, then B reads A" chain (ADR-0042 objection #4 / ADR-0016
  does not apply).
- **Substitution does *not* already cover this** (ADR-0042 objection #2's
  premise fails here): no column and no in-cell expression can reach a
  value sitting *outside the table region* of a dynamic source. That gap
  is precisely what this ADR fills.

## Alternatives considered

1. **`__cells__` reserved sheet** (Option A). Rejected as **redundant with
   ADR-0070**: the only thing a name buys — use in sheet/file patterns and
   reuse — is exactly what a `__derived__` column with a coordinate
   expression already provides. Adding `__cells__` would be a second
   naming mechanism for the same job, against the small-surface thesis
   (README; ADR-0043) and the no-speculative-feature bar (ADR-0042 #5).
2. **`{{ @source[A2] }}` directive form** (Option B). Rejected: directive-
   in-value-position category error; `@source` already taken; `[A2]`
   already a column.
3. **Lexical `Source!A1` (no brackets).** Rejected: `!` collides with the
   sheet-qualifier role and reads as ad-hoc; the bracket form reuses the
   established `Source[…]` surface instead.
4. **Require a new sigil (`[#A2]`, `[@A2]`).** Rejected: `$A$2` already is
   Excel's unambiguous absolute-coordinate spelling and carries the
   "does-not-move" meaning for free; inventing a sigil discards that
   mnemonic.

## Open questions (for review before implementation)

- Sheet-qualified inline form: support only simple sheet names now, and
  defer quoted/space-bearing names to a `__derived__` alias — or specify a
  quoting rule (`['My Sheet'!$A$1]`) up front?
- Require both `$` signs (adopted), or also accept a single `$`
  (`[$A2]`/`[A$2]`) as a coordinate? Adopted: both, to keep `[A$2]` /
  `[$A2]` available as column references and the signal unambiguous.
- Whether the cached-formula-value rule needs a `recalc`-staleness caveat
  mirroring ADR-0046's note.

## References

- ADR-0070 — Derived columns (the naming/reuse layer; `__cells__` folds
  into a derived column whose expression is a coordinate read)
- ADR-0017 — Source value model (tabular row/column access this extends)
- ADR-0012 — Multi-source data model (named sources; `Source[…]` surface)
- ADR-0061 — Source name lexical disambiguation (the `Identifier "["`
  rule this refines with a bracket-content check)
- ADR-0065 — `@source` default explicit form (default-source resolution)
- ADR-0042 — Rejected: runtime cell mutation (the *write* this is distinct
  from)
- ADR-0016 — Ordering and stability (order-independence argument)
- ADR-0050 — Template inputs as XTL expressions (why `__inputs__` cannot
  reach the source)
- ADR-0054 — Bare name in cell context (why bare `A1` is not a coordinate)
- ADR-0051 — String literal / block delimiter boundary (no escape
  mechanism → the carve-out)
- ADR-0046 — Cell formula preservation (cached-value read path)
- ADR-0052 / ADR-0062 / ADR-0064 — value-type coercion, empty-string,
  string→number scope (scalar value semantics)
- ADR-0043 — Excel-native preference / small XTL surface (the thesis the
  `__cells__` rejection protects)
- README § "Why the runtime needs to be boring" (small, auditable surface)
