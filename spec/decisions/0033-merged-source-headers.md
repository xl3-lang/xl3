# ADR 0033 - Merged source-table headers

- **Status:** accepted
- **Date:** 2026-05-17
- **Spec target:** XTL 0.1
- **Affects:** evaluation.md (Source Data Model), ADR-0015 (error catalog)

## Context

Real-world Korean spreadsheet sources (거래명세서, 발주서, 정산표,
etc.) commonly use horizontally-merged cells for table headers — one
visual heading that spans several columns. ExcelJS exposes this by
returning the master cell's value for *every* cell in the merged
range, so a single merged "품목" header that spans J11:M11 reads as
four cells with the same text.

The previous reader iterated `leftCol..rightCol` and called
`headerText()` on every cell. That made:

1. The second column in any horizontal merge trip
   `xl3/source/duplicate-name`, with no obvious link back to the
   merge as the root cause.
2. A perfectly ordinary invoice-style source effectively unreadable
   without manually unmerging cells — a destructive change the
   author often cannot make in vendor-provided templates.

The spec said only that "duplicate source column names are errors"
without addressing merges, so the impl behavior was the de-facto
contract. Authors hitting this had no spec-text to appeal to.

## Considered Options

**A. Treat horizontal-merge slaves as transparent.** A merged
header occupies one logical column at the master's column index.
Slave cells in the same row contribute no header and do not count
as duplicates. The data column lives at the master.

**B. Repeat the merged header as N distinct columns with name
suffixes** (e.g., `품목`, `품목 (2)`, `품목 (3)`). Pro: no
information loss if data cells under each slave column carry
independent values. Con: in practice the data row under a merged
header is either also merged (master-only value) or blank in
slaves, so the suffixed columns are noise. Names are non-portable
across writers that suffix differently.

**C. Reject merged headers explicitly with a coded error.** Pro:
forces authors to fix the source. Con: most authors cannot fix a
vendor-provided template, and the rejection adds no diagnostic
value over the existing duplicate-name error.

**D. Read the merged header but emit a warning.** Pro: surfaces
the merge to careful authors. Con: warning UX is host-specific and
the behavior is correct without it.

## Decision

Adopt **A**.

### Normative behavior

When reading a `source_table` header row:

1. A header cell is the **master** of its merge if it is not merged,
   or if it is merged and the merge master is in the same column.
2. A header cell is a **horizontal-merge slave** if it is merged and
   the merge master is in a *different* column (i.e., the merge
   spans columns).
3. Horizontal-merge slaves are transparent during header reading:
   they contribute no column to the source, are not subject to the
   empty-header check, and do not participate in duplicate-name
   detection.
4. Vertical merges (master in the same column, different row) keep
   the previously-defined behavior: the slave reads its master's
   text. This is the intended behavior for multi-row header bands.
5. After skipping horizontal-merge slaves, the remaining header
   cells form the source's columns in left-to-right column order.
   The empty-header, duplicate-name, and reserved-name checks
   apply to this filtered list as before.
6. Each retained header is anchored to its master's column. Data
   rows are read at that column number, not at consecutive offsets
   from `leftCol`.

### Error edge

If the user-supplied `source_table` range contains *no* master cells
in the header row (i.e., the range starts and ends inside a single
horizontal merge), the implementation MUST raise
`xl3/source/missing-header` with a message that mentions the merge
band so the author can widen the range to include the merge master.

The error code is unchanged from the previously-published catalog;
only the message text is extended.

### Spec text

`spec/evaluation.md` "Source Data Model" / "Column name rules" gains
a new bullet:

> 8. Horizontally-merged header cells form one column at the merge
>    master's column index. Slave cells (same row, different column
>    from the master) are transparent: they do not contribute a
>    column and do not cause a duplicate-name error. Vertical
>    merges in the header row read the master's text at the slave's
>    column unchanged.

## Consequences

- A previously-failing common case (Korean invoice templates with
  merged headers) now reads as authors visually expect.
- No new error code; the existing `xl3/source/duplicate-name`
  surface is narrower (genuinely independent same-named cells
  only) without losing diagnostic power for that case.
- Data-row reading must use a per-column column map rather than
  `leftCol + i`. This is an internal-impl change; the row-record
  shape is unchanged.
- This ADR does **not** change how merges behave in:
  - Data rows. Vertical and horizontal merges in body cells continue
    to broadcast the master value (the existing implicit behavior).
    Authors who don't want that should unmerge the data region.
  - Reserved-sheet parsers (`__config__`, `__inputs__`,
    `__sources__`, `__lists__`). Those use distinct parsers and are
    out of scope; revisit if real fixtures surface a merge problem
    there.
  - The output writer. Template merges are preserved per the
    existing style-preservation rule (`evaluation.md` §"Styles and
    Workbook Structure"); this ADR is read-side only.

## Amendment (2026-05-17) — 2D merges, "transparent" precision, porter guidance

Three clarifications added after the first review pass surfaced
the gaps. None changes the rule set; all sharpen the prose.

### 2D merges (regions spanning both rows and columns)

A merge whose region spans both multiple rows AND multiple
columns (e.g., `J11:M12`) is handled by the existing rules
mechanically — no new rule is needed:

- The master is the top-left cell (`J11`). It is read as a normal
  header per Rule 1.
- Cells in the same row as the master, different column (`K11`,
  `L11`, `M11`) are horizontal slaves per Rule 2: transparent.
- Cells in a different row but the same column as the master
  (`J12`) are vertical-direction slaves. Rule 1's same-column
  clause treats them as header-reading positions; they read the
  master's text in place. (This is how multi-row header bands
  work and why `source_table = J12:N` against a 2D merge
  starting at `J11` still yields a `품목` header.)
- Cells with both different row and different column (`K12`,
  `L12`, `M12`) are horizontal slaves per Rule 2: transparent.

The reference impl pins this with reader tests
`2D-merge-header-at-master-row` and `2D-merge-header-at-slave-row`,
plus conformance fixture 124.

### Definition: "transparent"

A horizontal-merge slave header cell is **transparent**: when
iterating the header row from `leftCol` to `rightCol`, the
implementation MUST skip the cell entirely. The cell contributes
no column to the source's column list, does not trigger
empty-header / duplicate-name / reserved-name checks, and is not
referenced in error messages produced for that header row.

The retained master cell participates in empty-header,
duplicate-name, and reserved-name checks **exactly as an
unmerged header cell at the same column would**. The master is
not exempted from any check.

### Porter note (reading-library independence)

The normative rule is **column-skip + master-anchored read**. It
is independent of how the underlying spreadsheet library
materializes merge slaves:

- ExcelJS returns the master's value on every cell in the merge.
- openpyxl returns `None` on slave cells, value only on the
  master.
- Other libraries vary.

A port MUST identify horizontal-merge slaves from the workbook's
*merge-region metadata*, not from cell-value presence. A port
MUST read the master's value when header text is needed for a
master cell that the workbook library otherwise reports as having
its own value (ExcelJS case) or for a vertical-direction header
slave whose master is on a row above the chosen header row.

## References

- ADR-0015 — Structured error reporting (error-code catalog)
- ADR-0017 — Source value model
- ADR-0032 — Niche limits and pass-through (§#2 superseded by
  this ADR, see ADR-0032 §#2 supersession note)
- ADR-0035 — Data-row merged cell semantics (data-row companion)
- `spec/evaluation.md` — Source Data Model section
