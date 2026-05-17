# ADR 0032 - Niche limits and workbook pass-through behaviors

- **Status:** accepted
- **Date:** 2026-05-09
- **Spec target:** XTL 0.1
- **Affects:** evaluation.md "Source Data Model" + "Cell Evaluation"; ADR-0021

## Context

The spec audit pass surfaced four small under-specified shapes that
share a theme: they're niche, but the corresponding behavior was
never normatively documented. Bundling them here avoids opening
four micro-ADRs for behaviors that mostly only need a paragraph.

1. **String values longer than Excel's per-cell limit (32,767
   chars)** — what does xl3 do when source data, an evaluated
   expression, or a template literal produces a cell value that
   exceeds Excel's 32,767-char per-cell limit?

2. **Source headers in merged cells** — `__sources__` headers in
   row 1 (or wherever `source_table` points) can technically be
   inside merged ranges. What does xl3 read?

3. **Workbook / sheet properties** (tab color, page setup,
   views, default row height) — how are these preserved from
   template to output?

4. **Integer precision beyond 2^53** — JS numbers are IEEE 754
   doubles; integers beyond 2^53 lose precision. What's the spec
   position?

## Considered Options

Each axis has the same option shape (per existing audit-pass
treatment):

**A. Document existing behavior as the spec.**
**B. Tighten with validation / fixture coverage.**
**C. Defer entirely.**

## Decision

Adopt **A** for all four. Each is a niche case where the existing
impl behavior is reasonable; this ADR makes it normative so future
impl changes don't accidentally diverge.

### #1 — String values longer than 32,767 chars

**Position: implementation-defined; XTL does not enforce Excel's
per-cell limit.**

A cell value exceeding 32,767 characters is permitted by xl3 and
written to OOXML as-is. The resulting workbook may fail to open in
Excel (Excel rejects cells over the limit when reading), but xl3
does not pre-validate. Authors and hosts that need Excel
compatibility must validate the cell length upstream.

Rationale: enforcing the limit at xl3 would require either
truncation (silent data loss) or an error (forces every host to
length-check before passing data in). Neither is universally
correct; the conservative stance is "xl3 writes what you give it;
Excel-compatibility validation is a host concern."

### #2 — Source headers in merged cells

**Superseded by ADR-0033 (2026-05-17).** The position below
("implementation-defined; portable templates do NOT merge header
cells") is **no longer the spec's position**. ADR-0033 changed
the contract: a horizontally-merged header cell forms one logical
column at the merge master, and slave cells are transparent (no
duplicate-name error). Real Korean vendor templates are readable
as-is. ADR-0035 separately covers data-row merges, and ADR-0036
pins related preservation features.

The original §#2 text is retained below for historical record:

> ~~When `source_table` points at a row whose cells are part of a
> merged range, the value reported per individual cell is reader-
> library-defined. ExcelJS (the reference impl's reader) returns the
> merge value on every cell in the range. xl3 then hits the
> existing `xl3/source/duplicate-name` check, since the same value
> appears across multiple header cells.~~
>
> ~~Other libraries may return only the top-left cell's value with
> others as empty, in which case xl3 would hit
> `xl3/source/missing-header` instead.~~
>
> ~~Both error paths reject the template. The spec's normative position
> is: **templates that merge header cells are not portable**. Authors
> should remove merges from header rows.~~

### #3 — Workbook and sheet properties

**Position: preserved verbatim from template to output.**

The reference impl's `cloneWorksheet` copies `properties` (which
includes `tabColor`, `defaultRowHeight`, `defaultColWidth`),
`pageSetup`, and `views` from the template sheet to each output
sheet. Other workbook-level properties (themes, defined names,
print areas) are similarly preserved by ExcelJS's workbook
copy/load cycle.

Authors who want a specific tab color, page orientation, or print
area set it in the template; xl3 carries it through.

This pass-through preservation is normative — porters MUST
preserve workbook and sheet properties unless an ADR specifically
overrides them.

Fixture 120 pins tabColor preservation as the most user-visible
example.

### #4 — Integer precision beyond 2^53

**Position: implementation-defined within IEEE 754 limits.**

xl3's value model treats all numbers as IEEE 754 doubles (per
ADR-0017). Integers up to 2^53 (~9 quadrillion) are exact;
integers larger lose precision according to IEEE 754 rules. A
source cell with value `9007199254740993` (2^53 + 1) reads as
`9007199254740992` because no double-precision representation
exists for the odd value.

xl3 does NOT detect or warn about precision loss. Authors who need
exact integer representation beyond 2^53 (rare in reporting:
financial IDs, very large counts) store values as strings in the
source and apply `TEXT()` if formatting is needed.

A future ADR may introduce a `BIGINT` value kind if real demand
emerges; until then, IEEE 754 doubles are the only numeric type.

## Consequences

- Four niche behaviors are now spec-documented. Future impl
  changes can't silently diverge.
- One new conformance fixture (120) pins tabColor pass-through
  (the most testable and most user-visible).
- No new error codes. No impl change required.
- No impact on conformance pass rate.

## References

- ADR-0002 — Output filename sanitization (similar
  "impl-defined-with-recommendation" pattern)
- ADR-0017 — Source value model (IEEE 754 numeric model)
- ADR-0021 — Implementation-defined boundaries (similar pattern
  for memory model, sync vs async, etc.)
- ADR-0022 — Excel version compatibility (the version-axis
  catalog this ADR complements with limit-axis catalog)
