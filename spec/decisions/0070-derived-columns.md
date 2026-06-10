# ADR 0070 — Derived columns (operator-authored computed group keys)

- **Status:** proposed
- **Date:** 2026-06-10
- **Spec target:** XTL 1.x (additive; backward-compatible, deferred from the 0.1 → 1.0 freeze per STABILITY.md "intentionally deferred")
- **Affects:** language.md (Group Keys, new "Derived Columns" section); evaluation.md (reserved sheets, render phases); impl (parser, grouper/pre-pass, renderer naming); new reserved sheet + new error codes
- **Issue:** #54

## Context

Operators want output **sheet/file names** driven by a lookup — e.g. a
거래처/지점 code mapped to a human display name, or one output per entry
of an operator-maintained table. Two hard limits block this today:

1. **Sheet-name patterns cannot contain `[` or `]`** (language.md
   "Group Keys"). The pattern lives in the worksheet **tab name**, and
   Excel forbids `[`/`]` in tab names — so `{{ [Col] }}` or
   `{{ XLOOKUP([code], Map[code], Map[name]) }}` is impossible to even
   author there. Sheet names accept only **bare group keys**
   (sheet group key → `__inputs__` → `__config__`, per ADR-0054).
2. **Group keys are column names.** `grouper.ts` partitions by reading
   `row[key]` directly; a key must be a real column on the source row.
   There is no way to group by, or name by, a value that is *computed*
   (looked up, concatenated, formatted) rather than stored.

`__lists__` does not help: it is a membership **array** (`name → string[]`),
valid only as the RHS of `@filter … in/!in` (ADR-0057), and the
normalizer rejects it everywhere else (`xl3/lists/invalid-use`). It is
not a `key → value` map and cannot be referenced in a name.

The current spec-clean workaround is to materialize the display value as
a **real source column** — authored upstream, or via a `source_table`
Excel formula column whose cached result is read as data (ADR-0046,
fixtures 014/036) — then group by that column. This works but forces the
mapping into the **data**. The xl3 positioning is *operator-authored
rules + dev-owned engine*: the operator should be able to declare the
mapping **in the template**, not require it baked into every data export.

## Decision

Introduce **derived columns**: named expressions, authored by the
operator in the template, evaluated **once per source row** and
**materialized onto the row** before grouping and rendering. A derived
column is indistinguishable from a real column downstream — it can be a
**group key** (hence usable bare in sheet *and* file names), read in a
cell as `{{ [Name] }}`, etc.

This sidesteps limit (1) entirely: the lookup expression is authored
where brackets are legal (a reserved cell), and the tab name references
only the **bare** derived name. It dissolves limit (2): grouping/naming
keep reading `row[key]` — the engine just populated that key first.

### Declaration surface (RECOMMENDED — see Alternatives)

A new reserved sheet `__derived__`, parallel to `__lists__`/`__sources__`:

| name        | expression                                         |
|-------------|----------------------------------------------------|
| RegionName  | `XLOOKUP([region_code], Regions[code], Regions[name])` |
| Period      | `TEXT(TODAY(), "YYYY-MM")`                          |

- Row 1 = headers `name`, `expression` (fixed).
- Each subsequent row declares one derived column.
- The `expression` cell is an ordinary cell → **brackets and function
  calls are legal** (the whole point — it is NOT a tab name).
- Evaluated per source row with the row context + reserved sheets
  (`__sources__`, `__config__`, `__inputs__`) in scope, exactly like a
  data-cell expression. `XLOOKUP(Source[…])` is therefore the map
  primitive — **no new `key→value` map structure is introduced**;
  a lookup table is just a declared source (ADR-0013).

### Semantics

- **Evaluation order:** after sources are read and `@join` applied,
  before `@filter` / grouping. A derived column MAY reference real
  columns of its own row and other reserved sheets; it MUST NOT
  reference another derived column (no forward/inter-derived refs in
  1.x — keeps evaluation a single pass; revisit if needed).
- **Materialization:** `row[name] = eval(expression, rowCtx)`. The name
  occupies the same namespace as source columns; declaring a derived
  name equal to an existing source column is an error
  (`xl3/derived/name-collision`).
- **Naming:** no change to the naming layer. A derived name is a bare
  identifier, so `extractGroupKeys` already picks it up; grouping reads
  the materialized value. Works identically for `output_file_pattern`
  and sheet-tab patterns.
- **Errors:** a derived expression that throws surfaces with the
  derived column's name and the offending row context.

## Scope

- **In scope (this ADR, the #54(A) slice):** derived columns +
  their use as group keys / in names / in cells.
- **Out of scope (deferred to a follow-up, #54(B)):** list/table-driven
  **fan-out** — emitting an output per *declared* entry even when the
  data has zero matching rows, and ordering outputs by a declared list.
  That changes the output-generation axis (grouper/renderer emit
  outputs only for groups that exist in the data today) and warrants its
  own ADR.

## Consequences

- Operators express mapping/derivation **in the template**, matching the
  product positioning. Lookups reuse `XLOOKUP` + a source — one mental
  model, no new map type.
- Implementation is contained and low-risk: a **pre-pass** that stamps
  derived values onto rows; grouping, naming, and cell eval are
  unchanged because they already operate on `row[col]`.
- Files: `parser.ts` (read `__derived__`, validate, collect into the
  template model), a grouper/render pre-pass (materialize per row),
  `normalizer`/`extractColumnRefs` (derived names resolve as columns),
  `types.ts`, new error codes, spec text, and stage-1 conformance
  fixtures (derived-key sheet name, derived-key filename, lookup via
  source, name-collision error).
- Additive only: no existing template changes behavior. No public API
  break; new reserved sheet + new error codes (catalog addition, not a
  G3-resetting change — additions are allowed).

## Alternatives considered

1. **Declare in `__config__` rows** (`derived.RegionName = …`). Rejected:
   `__config__` is flat fixed-key metadata; overloading it with an
   open-ended `name → expression` map is muddier than a dedicated sheet.
2. **A `@derive Name = expr` directive in-sheet.** Viable, but couples a
   sheet-level construct to a workbook-global concern (the same derived
   key is wanted across sheets/files) and complicates per-sheet scoping.
   A reserved sheet is workbook-global by nature.
3. **A new `key→value` map sheet (`__maps__`) + a bare-free `LOOKUP`
   function.** Rejected as redundant: `XLOOKUP` against a source already
   is the map; adding a second lookup mechanism + data type is surface we
   do not need.
4. **Allow brackets in sheet-name patterns.** Impossible: the constraint
   is Excel's (tab names cannot contain `[`/`]`), not ours.

## Open questions (for review before implementation)

- Reserved sheet name: `__derived__` vs `__columns__` vs `__keys__`.
- Whether to permit a derived column to reference an aggregate
  (`SUM(...)`) — proposed **no** for 1.x (per-row only), to keep the
  pre-pass row-local.
