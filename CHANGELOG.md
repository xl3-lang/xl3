# Changelog

All notable changes to xl3 are documented here. The npm package follows
[Semantic Versioning](https://semver.org/). The XTL language version is tracked
separately in [spec/STABILITY.md](./spec/STABILITY.md).

## [Unreleased]

### Added

- ADR-0012 introduces a **multi-source data model**. Templates can
  declare additional named data sources in a new reserved sheet
  `__sources__` (columns: `name`, `sheet`, `table`, `description`).
  Cells reference a named source's current-row column via the Excel
  structured-ref form `Customers[Account]`. The `@source <Name>`
  directive scopes a data block to a named source so its `[Column]`
  shorthand resolves there. Aggregate functions
  (`SUM`/`COUNT`/`AVERAGE`/`MIN`/`MAX`) accept a source-prefixed
  bracket and operate on that source's full row set
  (`SUM(Renewals[Amount])`). Row-level cross-source references and
  source joins are intentionally deferred to ADR-0013/0014.
  Conformance fixtures 069–073 cover declaration, cross-source
  aggregates, the directive, undeclared-source errors, and the
  row-context cross-source error.
- **BREAKING (ADR-0011): reserved sheet naming + unified reference syntax.**
  - Reserved system sheets are now dunder-wrapped: `_config` →
    `__config__`, `_inputs` (ADR-0010) → `__inputs__`. New reserved
    sheet `__lists__` consolidates user-defined membership lists; the
    old `_<name>` arbitrary list-sheet pattern is retired.
  - User-defined values inside `__config__` no longer require a `_`
    prefix on the key; access them via `{{ __config__[key] }}`.
  - The `{{ _<name> }}` cell-reference syntax is fully retired.
    Templates now use `{{ __config__[name] }}`, `{{ __inputs__[name] }}`,
    or `{{ __lists__[name] }}` (the last only inside `@filter ... in/!in`).
  - Filter directive form is now `@filter [field] in __lists__[name]`.
  - Author-created sheet names matching `^__[a-z]+__$` are reserved
    and rejected at parse time.
  - The `__sources__` reserved sheet name is reserved for a future ADR
    (multi-source data model).
  - All conformance fixtures, the runner protocol's meta.yaml shape,
    and the browser site are migrated to the new naming.



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
- ADR-0008 defines truthiness for `IF()` and any future Boolean-valued
  context. A value is truthy unless it is `false`, the number `0`, or
  empty per ADR-0007. **BREAKING:** the reference implementation no
  longer special-cases the strings `"0"` and `"false"`; both are
  truthy. Authors who relied on the old behavior MUST rewrite as
  explicit comparisons (e.g. `IF([flag] = "1", …)`).
  Conformance fixtures 055–058 cover each branch. **BREAKING:** the
  unreachable Go-template-style `{{ if … }} … {{ end }}` block in the
  reference impl is removed (never spec-blessed, never used).
- ADR-0009 defines a single comparison algorithm shared by `IF()`,
  `@filter`, and `@sort`, plus a canonical string form used by `&`
  concatenation, list-sheet reading, and the algorithm's string
  fallback. **BREAKING:** the reference implementation drops the
  hardcoded `localeCompare(_, 'ko')` Korean collation in favor of
  Unicode code-point order; mixed-script sort outputs change. Booleans
  now stringify to `TRUE` / `FALSE` (uppercase). Conformance fixtures
  059–063 cover the numeric/string fast path, code-point sort order,
  canonical-form concatenation, empty concatenation, and empty-vs-value
  equality.
- ADR-0007 amendment: "Unicode whitespace" matches ECMAScript
  `String.prototype.trim` (Unicode `\s`); zero-width characters
  (U+200B, U+FEFF) are explicitly **not** whitespace.
- ADR-0009 amendments: numeric comparison uses IEEE 754 equality
  (`0.1 + 0.2 = 0.3` is false; templates needing tolerance MUST
  `ROUND()`), and the Unicode minus sign (U+2212) is not parsed as a
  number. Conformance fixture 064 covers the Unicode-minus fallback.
- ADR-0010 introduces runtime user inputs. Templates declare
  per-run values in a new `_inputs` sheet (columns: `name`, `type`,
  `default`, `label`, `description`, `options`); hosts call
  `convert(template, source, { inputs })` and `preview(...)` with the
  same option, or `readTemplateInputs(template)` to introspect the
  declarations. Coercion follows ADR-0007/0009/0003 (text/number/date)
  plus a `select` enum. Missing required inputs and invalid values are
  errors with stable diagnostic substrings. The runner protocol gains
  an `inputs:` meta.yaml block. Conformance fixtures 065–068 cover
  default fallback, host-supplied values flowing into cells and
  filename patterns, the missing-required error, and `select`
  validation.

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
