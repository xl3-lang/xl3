# ADR 0080 — Opt-in formula reference adjustment

- **Status:** accepted
- **Date:** 2026-09-13
- **Spec target:** XTL 0.1, explicit formula adjustment mode
- **Affects:** ADR-0046, evaluation.md, parser, renderer, CLI through the existing APIs

## Context

ADR-0046 copies formula text verbatim. For a template row holding `B2*2`,
three output records all reference B2. A footer `SUM(B2:B2)` keeps that
range even though the footer moves to B5. This is compatible with the
old contract but does not implement ordinary per-record spreadsheet math.

Reference adjustment is a rendering responsibility, separate from executing
Excel functions. Under ADR-0043 and ADR-0048, the engine must not grow a
second Excel calculation engine to solve this problem.

## Decision

Add the optional `__config__` system key `formula_mode`:

- Omitted or `preserve`: ADR-0046 remains unchanged, including caches and
  verbatim references. Existing fixture 129 remains unchanged.
- `adjust`: explicitly opt in to the rules below. No host-side layout
  option is needed; CLI, JSON, and XLSX inputs use the same template setting.
- Any other value, including an explicitly empty value, raises
  `xl3/formula/invalid-mode`.

The setting is case-sensitive. It is available through `TemplateMeta` and
`writeConfigSheet`. Like other system keys it can be read as
`{{ __config__[formula_mode] }}` when present. Authors previously using
`formula_mode` as an arbitrary config variable must rename that variable
before opting into this updated template contract.

### Supported layout and syntax

The first implementation supports at most one vertical, ungrouped data
block per formula-bearing sheet, including explicitly declared multi-row
blocks and stationary side areas. Grouped output files and sheet-name
expansion remain allowed; `@group` / `@subtotal` within a sheet, horizontal
blocks and multiple blocks on a formula-bearing sheet are rejected with
`xl3/formula/unsupported-layout`.

Only ordinary formulas containing unqualified A1 references are translated:
relative, absolute and mixed cells, rectangular ranges, and whole-column
ranges. String literals (including Excel's doubled quotes), numbers,
booleans, operators and function names are preserved. Formula functions
are not evaluated. Defined names, explicit sheet references (even to the
same sheet), external/structured references, whole-row ranges, array
formulas, spill syntax, INDIRECT and OFFSET are outside this first mode.
They raise `xl3/formula/unsupported-reference` with the template sheet/cell.
Authors can keep `preserve` for templates outside this scope.

### Coordinate rules

All translation starts from the original template coordinates, before
directive rows are removed. Each formula's original location is retained.

1. Remove directive rows from referenced row coordinates. A reference
   whose endpoint is a removed directive row raises
   `xl3/formula/invalid-reference`.
2. In block columns, references below the original block shift by
   `(recordCount - 1) * templateBlockHeight`. References in side columns
   do not receive this structural shift. Structural changes apply even
   to `$`-anchored rows, just as insertion differs from copying.
3. For a formula replicated with a record, add
   `recordIndex * templateBlockHeight` to relative row references.
   `$`-anchored rows do not receive this copy offset. Column references
   and their `$` anchors remain unchanged in a vertical repeat.
4. For a static formula, a rectangular range encompassing the complete
   template block row span in block columns grows with the block. If its
   last row equals the original block end, that endpoint grows to the
   last emitted row. An endpoint below the block shifts by rule 2.
   A scalar reference into the block continues to target the first copy.
5. A static range selecting only part of a multi-row record is ambiguous
   (the copies may be discontiguous) and is rejected. A range crossing
   moving block columns and stationary side columns at or below the
   block is also rejected. Whole-column ranges are left unchanged.
6. Formulas in side cells stay at their original positions after directive
   deletion; formulas in block-column footers move below the output block.
7. Direct self-references, including a footer `SUM(B:B)` placed in column B,
   and translated references outside Excel's row limit raise
   `xl3/formula/invalid-reference`. This is not a full cycle detector or
   an Excel formula syntax validator.

Whitespace can be a reference intersection operator: in
`SUM(B2 (B2:B2))`, both occurrences of B2 are references and must be
translated. A reference followed by parentheses must not be mistaken for
a function name (LOG10 is a built-in exception with A1-shaped spelling).
Direct reference arguments to ROW, COLUMN, ROWS and COLUMNS inspect
location/shape rather than cell values. Their references still translate,
but are excluded from the direct self-dependency check, including nested
parentheses around the reference. Expressions that calculate values inside
those arguments do not receive this exemption.

The current empty-source/sheet-pruning policy remains in effect. If a
retained sheet's join yields zero records after the existing sheet-pruning
step, `adjust` rejects it rather than emitting formulas against a deleted
block. Defining an empty-table total or synthesizing a placeholder row is
not part of this change.

### Shared formulas, caches and recalculation

Resolve shared-formula slaves to their effective formula at the original
cell, then emit standalone formulas. Never duplicate shared owners.
Clear cached results on all retained native formula cells in this mode,
including static dependent formulas. Write `fullCalcOnLoad="1"` so Excel
can recalculate when opened. This is a request to the consuming application;
xl3 does not calculate values or guarantee caches to readers that do not
recalculate. Styling, values and existing layout rules are unchanged.

### Engine selection and diagnostics

The JavaScript implementation supports this mode. The host's `auto` mode
must route these templates to JS instead of letting an older WASM engine
silently ignore the option. Explicit `engine: 'wasm'` must fail clearly.
Other engines must implement the mode before claiming its fixtures; passing
the older corpus does not establish support for this addition.

Template analysis, preview and source validation reject unsupported formula
syntax/layout. Rendering additionally checks reference bounds and range
geometry against the actual emitted record count. Preview remains a file /
sheet plan, not proof of fully calculated or geometrically valid formulas.

## Verification

- Fixture 173: hand-authored formulas C2=`B2*2`, C3=`B3*2`, C4=`B4*2`,
  B5=`SUM(B2:B4)` after three records. Stage 2 checks formula XML and styles.
  Columns D and E also verify intersection-reference translation and a
  ROW formula referring to its own location without reading its value.
- Fixture 174: explicit cross-sheet formula is rejected with its cell location.
- Unit tests cover `$` anchors, directive deletion, shared formulas,
  multi-row records, stationary side areas, caches, one/zero records,
  unsupported syntax and unsafe references.

## Compatibility

No default formula behavior or public runtime export changes. The optional
metadata field and four error codes are additive. Formula adjustment is
explicit and must be tested on a copy of an existing template before
deployment. The package is not released by this change.
