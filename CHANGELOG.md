# Changelog

All notable changes to xl3 are documented here. The npm package follows
[Semantic Versioning](https://semver.org/). The XTL language version is tracked
separately in [spec/STABILITY.md](./spec/STABILITY.md).

## [Unreleased]

### Added

- Stage 1 `xl3-conformance` runner with cell-value comparison.
- Bootstrap conformance fixtures covering substitution, `IF`, list-sheet filters,
  repeat-right defaults, `ROUND`, filename sanitization, and numFmt coercion.
- ADR-0004 reference implementation coupling audit, plus spec clarifications
  for cell text extraction and `source_sheet` prefix matching.
- XTL 0.1 `TEXT()` date/numeric format subset and conformance fixtures for
  `TEXT()`, rich-text cells, cached formula results, and `source_sheet` prefix
  matching, including negative half-away numeric rounding.
- `expected_error` conformance fixture mode for required failure cases.
- Source formula cells without cached results now report an error.
- Clarified that `TEXT()` formats outside the XTL 0.1 core table are
  implementation-defined extensions, not portable conformance requirements.
- Error fixtures for output filename sanitization and numFmt coercion failures.
- ADR-0005 dynamic conformance assertion protocol for render-time values such
  as `TODAY()`.
- ADR-0006 Stage 2 canonical OOXML conformance comparison design.
- `TODAY()` dynamic conformance fixture and fixture-level comparison stage
  metadata.
- Stage 2 merged-range and style/numFmt preservation fixtures plus canonical
  diff/report refinements.
- Stage 2 canonicalizer now normalizes attribute quote style, drops
  insignificant whitespace inside closing tags, and collapses empty-element
  forms (`<x></x>` ↔ `<x/>`) per ADR-0006 rule 3.
- AUTHORING.md flags the Stage 2 ExcelJS round-trip caveat and points cross-
  writer canonicalizer coverage at the unit tests until an Excel-authored
  Stage 2 fixture lands.
- `source_table` grammar is clarified and covered by conformance fixtures for
  row shorthand, open ranges, finite ranges, zero data rows, and invalid source
  column names.
- Source table header cells now have conformance coverage for rich-text and
  formula cached-result handling.
- `source_sheet` exact-match precedence, first-worksheet defaulting, hidden
  list-sheet removal, and `ROW()` repeat-block behavior now have conformance
  coverage.
- `IFEMPTY()` now has conformance coverage for empty and non-empty values.
- `@sort`/`@top` directive order now has conformance coverage.
- `@filter ... !in` and `COUNT([field])` now have conformance coverage.
- Core aggregate functions now have conformance coverage on the rendered row set.
- Comparison-boundary behavior and filename sanitization warnings now have conformance coverage.
- ADR-0007 defines a single empty-value predicate that governs `IFEMPTY`,
  `COUNT([field])`, the empty-data-row skip rule, and list-sheet
  membership filters. Whitespace-only strings are now empty; numbers
  (including `0`) and booleans (including `false`) are never empty.
  Conformance fixtures 050–054 cover each surface.

## [0.1.0-alpha.0] - 2026-05-03

Initial public draft.

### Added

- XTL 0.1 draft spec in `spec/`.
- TypeScript reference implementation in `src/`.
- Conformance corpus scaffold in `conformance/`.
- Browser and Node >=18 package entrypoint.

### Language

- Source column references use Excel-like bracket syntax: `{{ [Customer] }}`.
- Excel-style functions: `IF`, `IFEMPTY`, `SUM`, `COUNT`, `AVERAGE`, `MIN`,
  `MAX`, `ROUND`, `ABS`, `TEXT`, `ROW`, and `TODAY`.
- `_config.source_table` defines source table reads such as `1`, `A1:D`, or
  `B5:H200`.
- Single-expression cells preserve source value types and use template cell
  number/date/text formats for coercion.

[Unreleased]: https://github.com/jinyoung4478/xl3/compare/v0.1.0-alpha.0...HEAD
[0.1.0-alpha.0]: https://github.com/jinyoung4478/xl3/releases/tag/v0.1.0-alpha.0
