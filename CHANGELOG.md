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
- `_config.source_range` allows range-based source table reads such as `B5:H200`.
- Single-expression cells preserve source value types and use template cell
  number/date/text formats for coercion.

[Unreleased]: https://github.com/jinyoung4478/xl3/compare/v0.1.0-alpha.0...HEAD
[0.1.0-alpha.0]: https://github.com/jinyoung4478/xl3/releases/tag/v0.1.0-alpha.0
