# ADR 0080 — Empty output: what an empty block, sheet, and file produce (amends ADR-0021)

- **Status:** accepted
- **Date:** 2026-11-03
- **Spec target:** XTL 0.1
- **Affects:** evaluation.md (§ "Inputs and Outputs", § "Render Phases", new § "Empty Output"); ADR-0021 (§ "Empty source data (zero rows)"); spec/index.md (implementation-defined table); impl (`renderer.ts`, `grouper.ts`, `index.ts`, `conformance-runner.ts`); conformance fixtures 031, 175–179
- **Amends:** ADR-0021
- **Issue:** #116

## Context

XTL said what a data block over zero rows looks like only by implication,
and said nothing normative about the sheet or file around it. ADR-0021
called zero-row output "implementation-defined, no error" and, in the same
entry, "The output file IS produced". Fixture 031 asserted the opposite:
a static `output_file_pattern` over a source with zero data rows produced
zero files. The reference implementation followed the fixture, and the
gap let three more inconsistencies in:

- A sheet whose only data block was emptied by `@filter` was removed, but
  the same sheet emptied by an unmatched `@join` was kept, and a sheet
  with two or more blocks was always kept.
- A static sheet name (`Report`) and a group-key sheet name
  (`{{ Customer }}`) went through the same removal rule, so a one-sheet
  template whose filter matched nothing produced a workbook with no
  worksheet. That file is not valid SpreadsheetML; Excel cannot open it.
- `preview()` reproduced each of these rules separately from `convert()`.

The cases differ in cause, not in what an author asked for. A rule keyed
on the cause (filter vs. join, one block vs. two) cannot be explained to
the operators who author templates, and every port would have to copy the
accidents to pass the corpus.

## Considered Options

**A. Keep "implementation-defined".** Rejected. Fixture 031 already pins
one answer, the reference implementation writes an invalid workbook for
a common template, and two ports could disagree on whether a report
exists at all — the most visible output a template has.

**B. Never omit anything: every sheet and file renders, possibly empty.**
Rejected. A template with a `{{ Customer }}` sheet would emit one empty
sheet per customer with no matching rows. Hosts that send per-customer
files rely on the opposite.

**C. Omit anything that ends up empty, including static sheets.**
Rejected. A static `Report` sheet is part of the document the author
drew; removing it changes the workbook's shape based on data, and when it
is the only sheet the result is the invalid workbook above.

**D. Static names render once; data-named groups render only when their
data survives.** Accepted. Whether something exists follows from who
named it: the template or the data.

## Decision

### Normative — the rule

What the template names statically renders exactly once. What the data
names renders once per group that still has rows after every directive.

### Normative — block

A data block over zero rows follows the column-scoped splice (ADR-0066)
with `N = 0`: its rows leave the block's columns, inside cells below move
up by the block's height, and outside cells stay in place. A
`@repeat right` block over zero rows renders no record; its template
cells are left empty in place, since a horizontal block shifts nothing.
Static cells in the sheet evaluate once, with aggregates over zero rows as
defined in ADR-0021. No template expression is left unevaluated.

### Normative — sheet

- A sheet whose name has no group key always renders once, even when every
  data block on it has zero rows.
- A sheet whose name has a group key renders for a sheet group only when
  at least one of its data blocks has a row after that block's directives
  (`source -> join -> filter -> sort -> group -> top`). A sheet without a
  data block counts its group's rows after the sheet's directives. An
  unmatched `@join` empties a block exactly as `@filter` does, and the
  number of blocks does not change the rule.

### Normative — file

- An `output_file_pattern` without a file group key names exactly one
  file. That file group exists even when the `default` source has zero
  rows; a source column the pattern references then evaluates as empty.
- A pattern with a file group key names one file per group; zero source
  rows means zero files.
- A file group whose sheets are all omitted produces no file. This is not
  an error, consistent with ADR-0021: empty data never errors.
  Implementations MUST NOT write a workbook without a worksheet.
- Filename collision detection (ADR-0031) still runs over every file group
  before rendering, including one that is later skipped.

### Normative — preview

`preview()` lists the same files and sheets `convert()` would produce,
under the same final names: sanitized, and with a group sheet skipped
when its name is already taken by another sheet in the workbook, compared
without case as Excel does (ADR-0021 § "Sheet-name collisions").

## Consequences

- ADR-0021 § "Empty source data (zero rows)" changes from
  implementation-defined to required. ADR-0021's Consequences allow a
  later ADR to tighten an entry this way. Aggregates over zero rows keep
  the ADR-0021 definition.
- Fixture 031 changes from zero files to one file: its pattern is static,
  so the file exists, and its data block renders zero rows. This is the
  one corpus expectation that moves; ADR-0021's own text already said the
  file is produced.
- Fixtures 175–179 pin the rule: a static sheet kept with a zero-row
  block (175), group sheets omitted after an empty filter (176) and an
  empty join (177), a file skipped when its sheets are all omitted (178),
  and zero files when a static pattern's only sheets are all omitted
  (179).
- The reference runner now compares worksheet names at Stage 1, as
  `runner-protocol.md` already required. Before, a sheet with no cells
  compared equal to an absent one, so the corpus could not see whether a
  group sheet was omitted.
- Behavior changes for hosts: a static sheet that a filter empties is now
  kept instead of removed; a group sheet that a join empties, or a
  multi-block group sheet whose blocks are all empty, is now omitted; a
  static pattern over zero source rows now returns one file instead of
  none; a file whose sheets are all omitted is now skipped instead of
  written without a worksheet.
- Fixed with this change: a zero-row `@repeat right` block used to keep
  its raw `{{ }}` template text; a group sheet name that differed from an
  existing sheet only in case made `convert()` throw a generic error;
  `preview()` reported unsanitized group sheet names and listed sheets
  that `convert()` skipped as duplicates.
- No export, signature, or error code changes, and no ADR flips status,
  so this does not reset ROADMAP G24.

## References

- ADR-0014 — Source joins via `@join`
- ADR-0021 — Implementation-defined boundaries (§ "Empty source data")
- ADR-0031 — Output filename collision is an error
- ADR-0066 — Column-scoped data block
- ADR-0069 — Per-block directive scoping
- evaluation.md "Empty Output", "Render Phases", "Directives"
- conformance/runner-protocol.md "Comparison stages"
