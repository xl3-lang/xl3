# Changelog

All notable changes to xl3 are documented here. The npm package follows
[Semantic Versioning](https://semver.org/). The XTL language version is tracked
separately in [spec/STABILITY.md](./spec/STABILITY.md).

## [Unreleased]

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
