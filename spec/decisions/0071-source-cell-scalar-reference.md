# ADR 0071 — Source cell scalar reference (read a fixed cell from the dynamic source)

- **Status:** proposed
- **Date:** 2026-06-19
- **Spec target:** XTL 1.x (additive; backward-compatible, deferred from the 0.1 → 1.0 freeze per STABILITY.md "intentionally deferred")
- **Affects:** language.md (new "Source Cells" section); evaluation.md (Source Data Model, reserved sheets, render phases); impl (reader, parser, normalizer, types); new reserved sheet + new error codes
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

**A. A lexical coordinate form in expressions** — e.g. `{{ Source!A1 }}`
or `{{ CELL(Source, "A1") }}`. Reads inline wherever an expression is
legal. *For:* terse, no new sheet. *Against:* `!` collides with Excel's
own sheet-qualifier syntax and with `Source[Col]`; a bare coordinate
inside `{{ }}` reopens the `A1`-is-a-name ambiguity ADR-0054 closed;
scatters fragile addresses across arbitrary cells with no single place to
audit them.

**B. A reserved sheet mapping name → (source, cell) — RECOMMENDED.**
Parallel to `__lists__`/`__sources__`/proposed `__derived__`. The operator
declares each scalar once, in one auditable place; cells reference the
**bare name**. *For:* one declaration site; bare names are legal in sheet
*and* file name patterns (sidesteps the Excel tab-name `[`/`]` ban, same
win ADR-0070 documents); reuses the established reserved-sheet read model
(ADR-0056). *Against:* a new reserved sheet to specify and port.

**C. Reject — keep the source strictly tabular; tell operators to
pre-process.** *For:* zero new surface. *Against:* leaves a real,
recurring use case (positional metadata in dynamic exports) unserved, and
forces a manual/host step onto every run — counter to the product thesis.

## Decision

Adopt **B**. Introduce **source cell scalars**: named, workbook-global
scalar values, each declared in the template as a fixed **(source, sheet,
cell address)** triple, read **once** from the source workbook before
grouping, and materialized as a named scalar usable in cells and names.

### Declaration surface

A new reserved sheet `__cells__`, parallel to `__lists__`/`__sources__`:

| name        | source     | cell        |
|-------------|------------|-------------|
| ReportTitle |            | A1          |
| Period      |            | Sheet1!C2   |
| VendorName  | Orders     | B1          |

- Row 1 = headers `name`, `source`, `cell` (fixed; `source` optional).
- Each subsequent row declares one source cell scalar.
- **`name`** — a bare identifier; occupies the same namespace as columns
  and (proposed) derived names. Collision with any source column or
  derived name is an error (`xl3/cells/name-collision`).
- **`source`** — optional named source (ADR-0012). Empty ⇒ the default
  source (ADR-0065).
- **`cell`** — a single A1-style coordinate, optionally sheet-qualified
  (`Sheet1!C2`). Unqualified ⇒ the source's first/active worksheet. A
  range (`A1:B2`), a column-only (`A:A`), or a malformed address is an
  error (`xl3/cells/invalid-address`). Exactly one cell — scalars only.

### Semantics

- **Read timing:** at source-read time, alongside table parsing and
  before `@filter`/grouping. Independent of `source_table` — the cell MAY
  lie outside the table range (that is the point).
- **Value & type:** the cell's stored value, with the same value-type and
  number/date-format coercion a single-expression data cell receives
  (ADR-0052/0064). An empty target cell yields the empty string
  (consistent with ADR-0062). A cell holding a native Excel formula
  yields its **cached computed value** (the same read path as a
  `source_table` formula column, ADR-0046) — not the formula text.
- **Scope:** workbook-global and **row-independent**. A source cell scalar
  is the *same value on every output row*; it does **not** vary per
  `@repeat` iteration. (If a per-row positional read is ever wanted, that
  is a separate proposal.)
- **Reference forms:**
  - bare in names — `{{ ReportTitle }}` in a sheet-tab or `@file` pattern
    (bare-name resolution order extends to include `__cells__`; see
    ADR-0054 amendment in Consequences);
  - in a cell — `{{ [ReportTitle] }}` (bracket form, like any column) or
    `{{ __cells__[ReportTitle] }}` (explicit reserved-sheet read,
    ADR-0056). Both resolve to the same scalar.
- **Errors:** target sheet missing (`xl3/cells/sheet-not-found`); address
  out of the worksheet's used bounds resolves to empty string (not an
  error — matches reading a blank cell); a declared `source` that names no
  known source (`xl3/cells/unknown-source`).

### Relationship to ADR-0042

ADR-0042 rejected runtime *cell mutation*. This ADR proposes a source
*read*. The distinction is load-bearing, not cosmetic:

- **Nothing in the output is mutated.** The value flows from a source cell
  into a `{{ }}`-marked template cell. Every cell that changes still
  carries a visible marker (ADR-0042 objection #1 — template-is-handover —
  is satisfied, not violated).
- **No evaluation-order dependence.** A source cell scalar is a pure
  function of the source workbook, fixed before grouping. There is no
  "cell A updates, then B reads A" chain (ADR-0042 objection #4 / ADR-0016
  — does not apply).
- **Substitution does *not* already cover this** (ADR-0042 objection #2's
  premise fails here): there is no column and no in-cell expression that
  can reach a value sitting *outside the table region* of a dynamic
  source. That gap is precisely what this ADR fills.

## Scope

- **In scope:** named scalar reads from a fixed source cell; use in cells
  and in sheet/file names.
- **Out of scope (separate proposals if demanded):** ranges/spilled reads
  (`A1:B5` → array); per-row positional reads (a different address per
  iteration); *writing* to source or output cells by address (remains
  rejected, ADR-0042); discovering metadata by pattern/search rather than
  fixed address.

## Consequences

- Operators declare positional metadata mappings **in the template**,
  once, matching the product positioning — no per-run host pre-processing
  for the common "title/date/거래처명 in a banner cell" case.
- Implementation is contained: `reader.ts` gains a second, address-keyed
  read path on the already-open source workbook (independent of the table
  parse); `parser.ts` reads/validates `__cells__`; `normalizer` /
  `extractColumnRefs` resolve `__cells__` names as scalars; `types.ts`
  carries the declarations; `extractGroupKeys` / bare-name resolution
  (ADR-0054) extend to include `__cells__` after derived names and before
  `__inputs__`. New error codes are catalog **additions** (not a
  G3-resetting change).
- Additive only: no existing template changes behavior; new reserved sheet
  + new error codes; no public API break.
- New conformance fixtures (stage 1): scalar from an out-of-table cell
  read into a header; sheet-qualified address; scalar as a bare sheet-name
  key; cached-formula-value read; `invalid-address`, `name-collision`,
  `sheet-not-found`, `unknown-source` error cases.
- Listed in `INFORMATIONAL_ADRS` of `src/__tests__/spec-coverage.test.ts`
  while **proposed** (doc-only design ahead of impl), removed when the
  fixtures land — same handling as ADR-0070.

## Alternatives considered

1. **Lexical `Source!A1` / `CELL(...)` form** (Option A above). Rejected:
   `!`/coordinate ambiguity, no single audit site, fragile scatter.
2. **Overload `__config__`** (`cell.ReportTitle = A1`). Rejected for the
   same reason ADR-0070 declines it for derived columns: `__config__` is
   flat fixed-key *static* metadata; an open-ended `name → (source, cell)`
   map belongs in a dedicated sheet.
3. **Widen `source_table` to include the banner row.** Rejected: corrupts
   the header/data model; the metadata is not a column.
4. **A new `key→value` map type.** Rejected as redundant — this is a
   positional read, orthogonal to the `XLOOKUP`-against-a-source map
   primitive ADR-0070 already relies on.

## Open questions (for review before implementation)

- Reserved sheet name: `__cells__` vs `__scalars__` vs `__metadata__`.
- Sheet-qualifier syntax: reuse Excel's `Sheet1!A1` inside the `cell`
  column, or split into a separate `sheet` column?
- Should an out-of-bounds address be a hard error rather than empty
  string? (Leaning empty-string for parity with blank-cell reads, but a
  stricter "you pointed at nothing" error may catch authoring mistakes.)
- Whether the cached-formula-value rule needs a `recalc`-staleness caveat
  mirroring ADR-0046's note.

## References

- ADR-0017 — Source value model (tabular row/column access this extends)
- ADR-0012 — Multi-source data model (named sources; `source` column)
- ADR-0065 — `@source` default explicit form (default-source resolution)
- ADR-0042 — Rejected: runtime cell mutation (the *write* this ADR is
  carefully distinct from)
- ADR-0016 — Ordering and stability (order-independence argument)
- ADR-0050 — Template inputs as XTL expressions (why `__inputs__` cannot
  reach the source)
- ADR-0054 — Bare name in cell context (bare-name resolution order this
  amends)
- ADR-0056 — Reserved sheet read policy (`__cells__[name]` read model)
- ADR-0046 — Cell formula preservation (cached-value read path)
- ADR-0052 / ADR-0062 / ADR-0064 — value-type coercion, empty-string,
  string→number scope (scalar value semantics)
- ADR-0070 — Derived columns (the reserved-sheet + bare-name precedent
  this mirrors)
- README § "Why xl3 exists" (operator-authored rules thesis)
