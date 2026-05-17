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

## References

- ADR-0015 — Structured error reporting (error-code catalog)
- ADR-0017 — Source value model
- `spec/evaluation.md` — Source Data Model section
