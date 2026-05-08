# ADR 0026 - Empty value lifecycle in cell rendering and group keys

- **Status:** accepted
- **Date:** 2026-05-09
- **Spec target:** XTL 0.1
- **Affects:** evaluation.md, language.md, ADR-0007, ADR-0009, ADR-0021

## Context

ADR-0007 defines what counts as empty (`null`/`undefined`/empty
string/whitespace-only string). ADR-0009 specifies that empty values
canonicalize to `""`. But two questions about how that empty
canonicalized value is treated downstream were left unspecified:

1. **Single-expression cell evaluating to empty** — what cell value
   does the engine write to the output workbook? `null` (truly blank
   cell), `""` (empty-string cell), or something else?
2. **Group key value evaluating to empty** — when a row's group key
   column (file or sheet group) is empty, what does the rendered
   filename / sheet name look like?

The reference impl had different behavior for each:

- Single-expression empty: cell written as `""` (ExcelJS string-typed
  empty) — visible in OOXML as a cell entry with empty `<v/>`.
- File-level group key empty: filename becomes `.xlsx`, fails the
  ADR-0002 sanitizer with `xl3/filename/empty`, halts the entire
  conversion.
- Sheet-level group key empty: sheet name interpolation produces an
  empty string, then `sanitizeSheetName` falls back to literal
  `"Sheet"`. Conversion succeeds with a sheet named `Sheet`.

The asymmetry is bad: file vs. sheet behave differently for the same
underlying empty value. And halting the whole conversion because a
single row had `Region=""` is overly strict for the typical reporting
shape (most data has at least a few sloppy rows).

## Considered Options

### Single-expression cell evaluating to empty

**S-A. Write empty string `""`.** ExcelJS string-typed cell with
empty value. Matches Excel's `=""` formula behavior. Re-reading via
xl3 reads as empty per ADR-0007. Keeps a cell entry in the OOXML so
column widths, styles, and merge anchors are preserved.

**S-B. Write `null` (truly blank cell).** No OOXML cell entry.
Stricter "empty"-ness. Re-reading per ADR-0007 still reads as empty.
But loses cell formatting if any was applied.

### Group key value evaluating to empty

**G-A. Halt with empty-filename error (current file-level
behavior).** Strict: one bad row stops the conversion. Painful for
real reporting data.

**G-B. Skip the row.** Hides data; user sees fewer rows than they
sent and may not notice.

**G-C. Substitute a `(blank)` placeholder.** Excel pivot table
behavior for empty group values. Visible, doesn't lose data, doesn't
halt. May collide with the rare literal string `"(blank)"` (same
collision Excel pivot has).

## Decision

Adopt **S-A** for cell rendering and **G-C** for group keys.

### Single-expression cell evaluating to empty

A single-expression cell whose evaluation is empty (per ADR-0007)
writes the empty string `""` to the output cell. The cell is present
in OOXML; its value is the empty string. Re-reading the cell via
xl3 reads as empty per ADR-0007.

This matches Excel's behavior when a cell formula returns `""`. It
preserves cell-level metadata (numFmt, style, merge anchor) that
would be lost if the cell were truly blank.

### Mixed-text cell with empty expression substitution

In a mixed-text cell, an embedded `{{ expr }}` whose result is empty
substitutes the empty string at its position. The surrounding text
is preserved.

Example: `prefix-{{ [Note] }}-suffix` with empty `[Note]` →
`prefix--suffix`.

### Group key value evaluating to empty

When a file-level or sheet-level group key value is empty (per
ADR-0007 over the canonical-string form), the engine substitutes the
literal token `(blank)` for that key value before the filename or
sheet name is interpolated. Group identity uses the substituted
value, so rows with empty group keys are grouped together — and
rows whose source value is the literal string `(blank)` (rare)
collide into the same group. Authors who need to distinguish empty
from literal `(blank)` should pre-process upstream.

The substitution happens at extract time (in `grouper.extractKey`),
so:
- Filename: `{{ Region }}.xlsx` with empty Region → `(blank).xlsx`
- Sheet name: `{{ Region }}` with empty Region → `(blank)`
- Both group keys identify the row as belonging to the `(blank)`
  group.

Sanitization (ADR-0002) still runs against the substituted name —
`(blank).xlsx` is a valid OOXML filename, so no sanitization error.

The placeholder is `(blank)` — lower-case ASCII, 7 chars, matches
Excel's `(blank)` displayed in pivot tables. A future ADR may make
the placeholder configurable per template; until then it's
normative.

### Scope: not all empty-value contexts

This ADR covers:
- Cell rendering (S-A)
- Group key extraction (G-C)

It does NOT change behavior for:
- `__config__` author keys interpolated into filenames or sheet
  names — these continue to render their canonical-string form
  (empty if empty), which means a `__config__[suffix]=""` produces
  `.xlsx` and triggers `xl3/filename/empty` per ADR-0002. Authors
  who want a default for empty config keys provide one explicitly
  or use `IFEMPTY()`.
- `__inputs__` runtime inputs — same as `__config__`.
- `&` concatenation — empty operand stringifies to `""` per ADR-0009.

The cleanest mental model: `(blank)` placeholder is a **grouping
affordance**, not a global empty-value substitute.

## Consequences

- File-level group keys with empty values no longer halt conversion.
  Real reporting data with sloppy rows now produces a `(blank).xlsx`
  bucket instead of failing the whole run.
- Sheet-level group keys produce `(blank)` instead of the prior
  `Sheet` fallback. Behavior change but consistent with file-level.
- Templates that previously relied on the `xl3/filename/empty` error
  to validate their data should add an explicit upstream filter or
  use ADR-0010 inputs validation. Fixture 019 was rewritten to
  exercise the empty-basename error path via `__config__` instead
  (which still errors).
- Single-expression empty-result behavior is now pinned. Stage 1
  conformance has been comparing the empty-string form already; this
  ADR makes the spec match the impl.
- New conformance fixtures 107 (file-level `(blank)`) and 108 (sheet-
  level `(blank)`) pin the behavior.

## References

- ADR-0002 — Output filename sanitization (still applies AFTER
  blank-substitution)
- ADR-0007 — Empty value definition
- ADR-0009 — Comparison and string coercion (canonical-string form
  of empty is `""`)
- ADR-0023 — Excel-default principle (the rationale for `(blank)`)
- evaluation.md "Source Data Model" / "Output Filenames"
- language.md "Group Keys"
