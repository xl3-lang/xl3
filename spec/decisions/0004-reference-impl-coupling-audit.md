# ADR 0004 - Reference implementation coupling audit

- **Status:** accepted
- **Date:** 2026-05-04
- **Spec target:** XTL 0.1 draft
- **Affects:** language.md, evaluation.md, conformance fixtures, reference implementation boundaries

## Context

The TypeScript implementation is the first implementation, but it is not
normative. XTL's portability depends on keeping three things separate:

1. Behavior that belongs in the spec and conformance corpus.
2. Behavior that is merely an ExcelJS workaround in the reference implementation.
3. Behavior that is currently ambiguous and could leak into other ports by
   accident if it is not classified.

This audit records the current coupling sites before additional fixture,
canonicalization, or multi-language runner work is added on top of them.

## Decision

Classify each implementation coupling site as one of:

- **Spec behavior:** keep the implementation aligned and add conformance coverage
  where useful.
- **Spec gap:** update `language.md` or `evaluation.md` before treating current
  implementation behavior as portable.
- **Impl-only workaround:** keep the behavior behind implementation boundaries and
  do not make it normative.

Do not perform a broad renderer abstraction refactor as part of this ADR. The
next code refactor should be limited to the sites identified as impl-only
workarounds and should not change observable output.

## Audit

| Site | Current behavior | Classification | ExcelJS coupling | Recommended action |
|---|---|---|---|---|
| `src/functions.ts:3` `toDate` | `TEXT()` accepts JS `Date`, Excel serial-like numbers above 25569, and host-parsed strings. | Spec gap | Partial. Serial handling and timezone compensation are implementation choices today. | Define the minimum date inputs accepted by `TEXT()`, including Excel serial date-system rules or explicitly mark serial support as optional. Avoid relying on host date parsing. |
| `src/functions.ts:150` `formatDate` | Supports `YYYY`, `YY`, `MM`, `DD`, `dd`, `HH`, `hh`, `mm`, `ss` with local `Date` accessors. | Spec gap | Partial. Accessor choice is tied to how the implementation constructs dates. | Add a normative `TEXT()` token table and state whether formatting uses the XTL date value's calendar fields rather than host timezone conversion. |
| `src/functions.ts:169` `formatNumber` | Formats all numeric `TEXT()` values with thousands separators and appends two decimals only when a fractional part exists. | Spec gap | No direct ExcelJS quirk; this is implementation-defined behavior. | Define the supported numeric `TEXT()` formats for XTL 0.1, or restrict `TEXT()` conformance claims to the formats covered by fixtures. |
| `src/parser.ts:13`, `src/reader.ts:123`, `src/renderer.ts:20`, `src/conformance-runner.ts:249` | Rich-text cell values are flattened by concatenating runs. Formula cell values use the cached `result` when present. | Spec gap | Yes. ExcelJS exposes these as object shapes; other libraries expose different structures. | Add "cell text extraction" rules: rich text is evaluated as the concatenation of text runs, and formulas are not recalculated; cached results are used when available. |
| `src/reader.ts:104` `resolveSheet` | `source_sheet` exact name wins; a trailing `*` selects the first worksheet whose name starts with the prefix. | Spec gap | Low. Workbook order is library-exposed but format-level observable. | Clarify prefix matching in `evaluation.md`, including first-match behavior and no-match error. |
| `src/renderer.ts:130`, `src/renderer.ts:255`, `src/renderer.ts:305`, `src/renderer.ts:635` | Merged ranges below row splices are saved, unmerged, and reapplied because `spliceRows` does not reliably update merge refs. | Impl-only workaround | Strong. This compensates for ExcelJS row-splice behavior. | Keep as implementation detail. If refactored, move row-splice plus merge preservation behind the workbook document boundary. No spec change. |
| `src/renderer.ts:125`, `src/renderer.ts:272`, `src/renderer.ts:356` | Renderer still directly depends on `ExcelJS.Worksheet`, `ExcelJS.Style`, and `ExcelJS.CellValue` even though `WorkbookDocument` exists. | Impl-only boundary leak | Strong. The abstraction currently covers cloning/removal/write, not sheet mutation. | Future refactor candidate: introduce narrow row/cell mutation operations only around repeated rendering and merge handling. Do not abstract the entire workbook model. |
| `src/excel-document.ts:47` `cloneWorksheet` | Clones sheet properties, page setup, views, columns, row heights, cells, styles, merges, and images manually. | Impl-only workaround | Strong. ExcelJS has no full worksheet clone primitive. | Keep impl-only. Preserve comments around copied facets and add conformance only for observable style/structure requirements, not for cloning mechanics. |
| `src/excel-document.ts:126` `sanitizeSheetName` | Sheet names map `[` and `]` to parentheses, forbidden chars to `_`, truncate to 31 code points, and fall back to `Sheet`. | Implementation-defined behavior | Partial. Excel's sheet-name constraints are real, but replacement policy is local. | Leave implementation-defined unless cross-implementation sheet name equality becomes a conformance requirement. Filename sanitization remains spec-normative; sheet sanitization does not. |
| `src/conformance-runner.ts:232` `loadCells` | Stage 1 conformance compares non-auxiliary cell values through ExcelJS, ignoring styles and OOXML structure. | Known Stage 1 limitation | Strong. It is intentionally not the canonical OOXML runner. | Keep documented as Stage 1. Stage 2 should use canonical OOXML comparison rather than expanding this value-only path. |

## Spec Clarifications Made With This ADR

This ADR adds the low-risk clarifications that are already consistent with the
reference implementation:

- `language.md` now defines the minimum XTL 0.1 `TEXT()` date and numeric
  format subset.
- `evaluation.md` now states that `source_sheet` prefix patterns select the first
  matching worksheet in workbook order, after exact-name matching.
- `evaluation.md` now defines cell text extraction for rich text and cached
  formula results.

## Remaining Follow-Ups

The remaining low-risk work should happen before renderer refactoring:

1. Move row-splice plus merge preservation behind a narrow workbook document
   boundary only after the fixture coverage above exists.

## Consequences

- The current implementation can remain the reference implementation without
  becoming the de-facto specification.
- The most risky leakage sites are now explicit before a second implementation
  exists.
- Future work has a clear split: spec gaps should produce prose and fixtures;
  impl-only workarounds should stay behind narrow workbook-manipulation code.

## Closed by

- ADR-0007 closes the empty-value-predicate gap (`IFEMPTY`,
  `COUNT([field])`, list-sheet membership, empty-row skip).
- ADR-0008 closes the truthiness gap for `IF()` and any future
  Boolean-valued context.
- ADR-0009 closes the comparison-operator and string-coercion gaps for
  `IF`, `@filter`, `@sort`, list-sheet reading, and `&`.
