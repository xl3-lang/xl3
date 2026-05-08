# ADR 0029 - Directive composition + source edge semantics

- **Status:** accepted
- **Date:** 2026-05-09
- **Spec target:** XTL 0.1
- **Affects:** evaluation.md, language.md, ADR-0012, ADR-0014, ADR-0027

## Context

A spec audit caught four under-specified shapes around directive
composition and source semantics:

1. **Multiple `@source` directives in the same data block** — the
   reference impl silently let the last `@source` win; earlier ones
   were noise. Authors who wrote two `@source` directives expecting
   "iterate over both" got a single-source render with no
   diagnostic.

2. **Multiple `@join` directives in the same data block** — same
   silent-last-wins shape. ADR-0014 explicitly leaves multi-join
   out of scope for XTL 0.x; the impl should refuse, not silently
   pick one.

3. **Self-join** (`@join Renewals on Renewals[a] = Renewals[b]`)
   where the joined source equals the primary — produces zero
   matched rows because the inner-join semantics with first-match
   over the same row set isn't well-defined here. Authors expecting
   a tree / hierarchy walk got an empty output.

4. **Function name case-insensitivity** — `if(...)`, `IF(...)`, and
   `If(...)` all worked. Confirmed but never spec-pinned.

5. **Hidden source rows** — included in iteration. Confirmed but
   never spec-pinned. (Authors who want filtering use explicit
   `@filter`.)

## Considered Options

For #1–#3 (composition):

- **A. Error on duplicates / self-joins.** Strict, fail-loud.
- **B. Define semantics** (e.g., self-join = recursive walk;
  multi-join = chained pairing). Pro: feature. Con: spec creep,
  multi-join already deferred per ADR-0014.
- **C. Document as undefined / impl-defined.** Worst — silent
  fallthroughs continue.

For #4 (function case):

- **D. Pin case-insensitivity normatively** with a fixture.
- **E. Mandate uppercase-only.** Stricter.

For #5 (hidden rows):

- **F. Include hidden rows in iteration.** Current impl behavior;
  authors filter explicitly.
- **G. Skip hidden rows.** Excel pivot behavior; treat hidden as
  intentional exclusion.

## Decision

#1–#3 — Adopt **A** (error). Multi-join and self-join can be
revisited post-1.0 if real use cases emerge; until then they're
silent-fallthrough → coded error per the audit-pass theme.

#4 — Adopt **D** (case-insensitive, normative).

#5 — Adopt **F** (hidden rows included). Match current behavior;
authors filter explicitly with `@filter`. Authors who want
visibility-aware filtering pre-process upstream.

### Composition rules (normative)

A data block MAY contain at most one `@source` directive and at
most one `@join` directive. The directive parser detects duplicates
and raises `xl3/directive/invalid-syntax`.

A `@join` directive MUST reference a different source than the
block's active source (`block.source`). Self-joins raise
`xl3/join/bad-on-clause`.

### Function name case-insensitivity (normative)

Function names are case-insensitive. `IF`, `if`, `If`, `iF` all
resolve to the same function. The spec writes them uppercase by
convention; the corpus accepts any casing.

### Hidden rows in source (normative)

Source rows whose row-level `hidden` property is `true` are
**included** in iteration. Templates that need to skip hidden rows
filter explicitly via `@filter` against a column the author
controls (e.g., a "Status" column with values like "active" /
"archived").

The reference impl reads via ExcelJS, which exposes hidden rows
identically to visible rows. Other ports SHOULD do the same.

## Consequences

- Templates with duplicate `@source` / `@join` or self-join now
  error at parse time. Author-fix is one of: remove the duplicate,
  rename the source for self-join (or pre-compute via XLOOKUP).
- Lowercase function names continue to work; the fixture pins this
  so a future tightening doesn't accidentally break it.
- Hidden source rows are normatively included. Authors who relied
  on Excel-style "hidden = exclude" must add an explicit visibility
  filter.
- 4 new conformance fixtures: 114 (duplicate `@source`), 115
  (self-join), 116 (case-insensitive function name), 117 (hidden
  row included).

## References

- ADR-0012 — Multi-source data model
- ADR-0014 — `@join` (multi-join out of scope)
- ADR-0024 — Function arity (case-insensitive lookup precedent)
- ADR-0027 — Directive validation pattern
- evaluation.md "External Data Sources" + "Source Data Model"
