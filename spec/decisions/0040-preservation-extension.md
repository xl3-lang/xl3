# ADR 0040 - Preservation matrix amendment: CF / DV range extension + outline level

- **Status:** accepted (fully implemented; CF/DV `sqref` extension
  landed with fixture `171-cf-dv-range-extension`, outline level with
  `172-outline-level-preservation`)
- **Amended:** 2026-11-20 — which block a range belongs to on a sheet
  with several blocks (see the amendment at the end)
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
      On a sheet with several blocks the block's columns decide
      too; see the 2026-11-20 amendment.
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
  should split into per-block ranges. What "contained in" a block
  means when blocks share rows is defined by the 2026-11-20
  amendment.

### Error catalog

No new error codes. Failure to apply the extension (because the
range doesn't satisfy the containment rule, or because the
output library does not surface `sqref` for editing) is a silent
no-op — the workbook still renders correctly, just without the
auto-extension. A warning MAY be emitted via the implementation's
existing warning channel; this is not normative.

## Consequences

- Conformance fixture `171-cf-dv-range-extension` pins the
  containment rule across:
  - CF range fully inside the `@repeat` block (extended).
  - CF range partially overlapping (not extended).
  - CF range entirely above the block (not extended).
  - CF range with multi-range `sqref` (per-sub-range behavior).
  - Whole-column reference (unchanged).
  - DV authored on the block row (replicated across the expanded rows,
    which the writer coalesces back into one `sqref`).
- Conformance fixture `172-outline-level-preservation` pins per-row
  `outlineLevel` survival through `@repeat`.

  *Numbering note.* This section previously named fixtures `125` and
  `126`. Neither was ever written, and both numbers were later taken by
  unrelated fixtures (`125-hyperlink-function`,
  `126-date-arithmetic-functions`), so the citation pointed at real
  fixtures that verify nothing about this ADR. Same defect as the one
  corrected in ADR-0036 (xl3#108). The names above are the fixtures that
  exist.

  Writing `172` is also what surfaced the gap in the outline-level half.
  It was recorded as shipped in 0.6.0, and the `cloneWorksheet` /
  `spliceRowsPreservingMerges` copies named below were indeed in place —
  but the path that writes `@repeat`-expanded rows copied row height and
  cell styles without the level, so produced rows kept whatever the
  splice left behind. The normative sentence "each takes the template
  row's outline level" was unimplemented for the exact case it is about.
  A claimed-but-absent fixture is how that survived two minor releases.
- The reference impl gains two code paths:
  1. A post-expansion sweep over the sheet's CF and DV rule
     collections that rewrites contained `sqref` ranges.
  2. An `outlineLevel` copy on every row write — in
     `cloneWorksheet`, in `spliceRowsPreservingMerges`, and in the
     `@repeat` expansion write loops (both the plain and the grouped
     path). The level is assigned unconditionally rather than only when
     truthy, so a level-0 template row clears a residue the splice left
     on a reused row object.
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

## Amendment (2026-11-20) — which block a range belongs to on a sheet with several blocks

Rule 1.1 decides containment by rows alone, and says so: "column span
is irrelevant — only rows extend". That was complete when this ADR was
accepted. A sheet then held one data block, and the block took the full
width of its rows. ADR-0066 (2026-05-23) gave a block a column range,
and ADR-0068 (2026-05-24) allowed several `@block` rectangles on one
sheet, including rectangles placed side by side on the same template
rows.

For side-by-side blocks the row test cannot tell the blocks apart.
Every range on the shared rows is inside the row span of each of them,
so a range was extended by the growth of the block beside it. Measured
on the reference implementation while xl3#138 was in review (commit
`76baca5`, before the column test below was added), with one block in
`A:B` and one in `D:E`, each under its own `@filter` row, and a CF rule
on each block's data row:

| Records, left / right | Left range | Right range |
|---|---|---|
| 3 / 4 | `B1:B3` | `E1:E3` — the fourth record is not covered |
| 4 / 1 | `B1:B4` | `E1:E4` — three cells with no record are covered |

In the 3 / 4 case a list validation on each data row came out on
`B1:B4` and `E1:E4`, so `B4`, which holds no record, carried one.

The "Multi-block templates" paragraph above already states the intent:
"a CF range contained in block 1 extends by block 1's delta; a range
contained in block 2 extends by block 2's delta". When blocks share
rows, "contained in" has to mean the block's rectangle, not its rows.

### Normative rules (amendment)

On a sheet with **more than one data block** (explicit mode, ADR-0068):

1. A range *R* MUST be extended by a block if and only if *R* satisfies
   rule 1.1 for that block's rows AND every cell of *R* lies within
   that block's column range (ADR-0066, ADR-0067).
2. A range that satisfies rule 1.1 for a block's rows but is not within
   that block's columns MUST be left unchanged by that block. This
   covers a range that spans the columns of two blocks, and a range in
   columns that belong to no block. Like a partial row overlap (rule
   1.2), it is a silent no-op.
3. Rule 4 is unchanged. A multi-range `sqref` is processed per
   sub-range, so `"B3 E3"` extends `B3` by the left block and `E3` by
   the right block.
4. Data validation follows the same test, cell by cell.

With these rules the two cases above come out as `B1:B3` / `E1:E4` and
`B1:B4` / `E1`.

On a sheet with **exactly one data block**, rule 1.1 applies as
written. The column span is irrelevant there, also for a block that has
a column range: a range on the block's rows but beside its columns is
still extended, although the cell it was written for is an outside cell
and is not repeated (ADR-0066). This amendment does not change that.
It is the rule as shipped, and applying the column test there could
move the output of existing templates. Whether a single block should
take the column test too is left open.

### Consequences (amendment)

- The reference implementation passes the block's column range to the
  post-expansion sweep on a sheet with several blocks (xl3#138). No
  error code and no warning is added.
- The rules are pinned by the reference implementation's own tests
  (`directive-row-ranges.test.ts`, "CF / DV ranges of side-by-side
  blocks"): each range extended by its own block in both orders, a
  multi-range `sqref` tested per sub-range, and a range across both
  blocks or beside them left as authored.
- **No conformance fixture pins this amendment.** Fixture
  `171-cf-dv-range-extension` covers a sheet with one block only. Until
  a fixture with side-by-side blocks exists, a port has this text and
  nothing to run against. It is named here as missing, so that it is
  not later read as covered (see the numbering note above).
- Ports MUST apply the column test on a sheet with several blocks. A
  port that applies rule 1.1 alone there reproduces the table above.
