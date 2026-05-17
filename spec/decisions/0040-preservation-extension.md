# ADR 0040 - Preservation matrix amendment: CF / DV range extension + outline level

- **Status:** accepted
- **Date:** 2026-05-18
- **Spec target:** XTL 0.1
- **Affects:** ADR-0036 (template feature preservation matrix),
  evaluation.md § "Styles and Workbook Structure"

## Context

ADR-0036 pinned nine common Excel features as preserve-verbatim
(P) — conditional formatting, charts (D), named ranges, print
area, freeze pane, sheet protection, data validation, cell
comments, and image anchors. It deliberately deferred the
preserve-and-extend (PE) case for all of them: when `@repeat`
expands a data block from *N* rows to *M* rows (M > N), the
template's CF rule, named range, data-validation range, etc.,
were kept as-authored and **not** auto-stretched to cover the
expanded region. The rationale (ADR-0036 § "Why P, not PE") was
cross-impl cost: each feature has its own range encoding, and
porting nine extension behaviors is nine ports' worth of work.

Production usage since 0.4.x surfaces three items where P is
inadequate and PE is cheap:

1. **Conditional formatting `sqref` range.** Operators routinely
   author a CF rule covering the template's *N* data rows
   ("highlight when Amount < 0"). With P, the rule applies only
   to the first *N* output rows; rows *N+1..M* render without the
   rule. The fix the author wants is mechanical and unambiguous:
   stretch the `sqref` by the row delta.
2. **Data validation `sqref` range.** Same shape — a dropdown or
   range constraint authored over the template's data block must
   cover the expanded block, not just its first *N* rows.
3. **Outline level (`row.outlineLevel`).** Not in the ADR-0036
   matrix at all. ExcelJS exposes this per-row, and the reference
   impl's `cloneWorksheet` / `spliceRowsPreservingMerges` paths
   were silently dropping it. Pinning it as P closes a
   preservation gap.

CF and DV extension is unambiguous when the template's authored
range is *contained within* the `@repeat` block. The hard case
(ranges that overlap *part* of the block) is rare enough to leave
out of scope.

Per ADR-0034 Corollary 1, this is absorption-of-experience: name
the cases, choose XTL's answer, pin it.

## Considered Options

**A. Promote CF and DV from P to PE (with outline level added as
P).** Adopted below. Costs one impl path per range encoding;
pays back the common authoring case directly.

**B. Leave CF and DV at P; require authors to write whole-column
ranges (`$A:$A`).** Status quo. Works, but pushes the burden to
every author of every template — exactly the kind of foot-gun
ADR-0036 § Consequences flagged as "candidate for 0.2+ if
production users report it as the dominant authoring pain
point". Production users have reported it.

**C. PE for every P item in ADR-0036 (named ranges, print area,
…).** Over-broad. Named ranges and print area are workbook-scope
defined names whose extension semantics are tangled with formula
references and Stage 2 OOXML positioning. Out of scope for this
amendment; revisit case by case.

## Decision

Adopt **A**. ADR-0036's matrix is amended as follows:

| # | Feature | Previous | Now |
|---|---|---|---|
| 2 | Conditional formatting | P | **PE** (rules: P; `sqref` ranges: extended per rule below) |
| 8 | Data validation | P | **PE** (rules: P; `sqref` ranges: extended per rule below) |
| 10 | **Row outline level** (`row.outlineLevel`) | (not listed) | **P** |

All other rows of ADR-0036's matrix are unchanged.

### Extension rule for CF and DV `sqref` ranges (normative)

When `@repeat` expands a data block from *N* template rows to *M*
output rows (`delta = M - N`, M ≥ N):

1. For each `sqref` range *R* on the sheet:
   1. *R* MUST be extended if and only if *R*'s start row is
      at or above the `@repeat` block's first row AND *R*'s end
      row is at or below the `@repeat` block's last row.
      Equivalently: the range is fully contained in the block's
      row span (column span is irrelevant — only rows extend).
   2. Otherwise *R* MUST be left unchanged. In particular,
      ranges that overlap only *part* of the block are not
      extended: the rule cannot infer the author's intent in
      that case (was the partial overlap deliberate? was it a
      typo?). Authors who need partial-overlap behavior MUST
      use whole-column references or restructure the template.
2. The extension applied is: end-row += `delta`. Start row,
   start column, and end column are unchanged.
3. Whole-column references (`$A:$A`, `1048576`-style end rows)
   are not modified — they already cover the expanded region.
4. Multi-range `sqref` values (e.g., `"A2:A5 C2:C5"`) are
   processed per sub-range. Sub-ranges that match the containment
   rule are extended; others are left unchanged.

### Outline level (normative)

The reference impl's `cloneWorksheet` and
`spliceRowsPreservingMerges` paths MUST copy `outlineLevel` on
every row written to the output sheet. This includes:

- Header rows above the `@repeat` block.
- The first cloned row of the `@repeat` block (carries the
  template row's outline level).
- Every subsequent row produced by `@repeat` (each takes the
  template row's outline level; outline level is replicated, not
  extended).
- Trailer rows below the block.

There is no "extension" semantics for outline level — the value
is per-row, not per-range. The PE concept does not apply.

### Composition with multi-output directives

- **File-per-group / sheet-per-group splits (`@file` / `@sheet`).**
  Each output workbook/sheet gets its own copy of the template's
  CF and DV rules with the extension applied per that output's
  row count. The extension is computed per output, not once for
  the union of all outputs.
- **Multi-block templates** (two independent `@repeat` blocks on
  one sheet). The extension is per-block: a CF range contained
  in block 1 extends by block 1's delta; a range contained in
  block 2 extends by block 2's delta. A range spanning *across*
  multiple blocks is out of scope — the engine emits a warning
  (no error code added; see § "Consequences") and leaves the
  range as-authored. This case is rare; authors who need it
  should split into per-block ranges.

### Error catalog

No new error codes. Failure to apply the extension (because the
range doesn't satisfy the containment rule, or because the
output library does not surface `sqref` for editing) is a silent
no-op — the workbook still renders correctly, just without the
auto-extension. A warning MAY be emitted via the implementation's
existing warning channel; this is not normative.

## Consequences

- Conformance fixture 125 (`125-cf-dv-range-extension`) pins the
  containment rule across:
  - CF range fully inside the `@repeat` block (extended).
  - CF range partially overlapping (not extended).
  - CF range entirely above the block (not extended).
  - DV range with multi-range `sqref` (per-sub-range behavior).
  - Whole-column reference (unchanged).
- Conformance fixture 126 (`126-outline-level-preservation`)
  pins per-row `outlineLevel` survival through `@repeat`.
- The reference impl gains two code paths:
  1. A post-expansion sweep over the sheet's CF and DV rule
     collections that rewrites contained `sqref` ranges.
  2. An `outlineLevel` copy on every row write in
     `cloneWorksheet` and `spliceRowsPreservingMerges`.
- Ports based on libraries other than ExcelJS MUST replicate
  both paths. Range encoding varies: ports SHOULD reuse their
  library's `sqref` parser/serializer rather than rolling their
  own.
- ADR-0036's matrix is now amended, not superseded. ADR-0036
  remains the authoritative document for the unchanged seven
  rows; this ADR is the authoritative document for rows 2, 8,
  and 10.
- The remaining P rows of ADR-0036 (images, named ranges, print
  area, freeze pane, sheet protection, cell comments) stay P.
  Any future promotion to PE will require its own ADR with the
  same shape as this one.

## References

- ADR-0034 — Relationship to prior-art template engines
  (Corollary 1: absorb experience)
- ADR-0036 — Template feature preservation matrix (the ADR this
  amends; § "Why P, not PE" called this case out as a candidate
  for 0.2+)
- ADR-0035 — Data-row merged cells (recent absorption following
  ADR-0034 Corollary 1)
- `docs/internal/jxls-absorption-plan.md` (Category A items A3,
  A9 + outline level promotion)
- `evaluation.md` § "Styles and Workbook Structure"
- `src/excel-document.ts` (`cloneWorksheet`,
  `spliceRowsPreservingMerges` — the paths that copy per-row
  metadata)
