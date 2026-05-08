# Changelog

All notable changes to xl3 are documented here. The npm package follows
[Semantic Versioning](https://semver.org/). The XTL language version is tracked
separately in [spec/STABILITY.md](./spec/STABILITY.md).

## [Unreleased]

### Added

- ADR-0022 "Excel version compatibility" — informational catalog of
  which Excel-version differences XTL 0.1 is immune to, which it
  leaves implementation-defined, and which authoring patterns
  templates should avoid for portability across Excel for Windows /
  Mac / Online / 365, LibreOffice, and Numbers. README gets a short
  link-and-summary; spec/index.md gets a row in the navigation table.

### Changed

- **npm package renamed** from `xl3` to `@jinyoung4478/xl3`. The
  unscoped `xl3` name was rejected by npm's typosquatting prevention
  (too similar to `xlsx`, `xml`, etc.). Project name, GitHub repo,
  and the `xl3.io` domain are unchanged — only the npm package and
  the import specifier change. Install is now
  `npm install @jinyoung4478/xl3`; importing is
  `import { convert } from '@jinyoung4478/xl3'`. The conformance
  CLI binary (`xl3-conformance`) keeps its name.

### Fixed (xl3-py issue #1 batch)

- **IF condition `=` operator now recognized** (issue #1 finding #5,
  the highest-value finding of the Python port). The
  `normalizeCondition` op list had `==` but not `=`, so the spec's
  equality operator silently fell through and templates like
  `IF([Amount] = 0, "zero", "non-zero")` evaluated as truthy
  regardless of `[Amount]`. Fixture 048 was authored against the
  bug; its `expected.xlsx` is re-built so D3 (Amount=1) is
  `"non-zero"` instead of `"zero"`. `==` retained as an impl-only
  tolerance — ports MAY accept `=` only.
- **U+FEFF / U+200B no longer treated as whitespace** by `isEmpty`
  (issue #1 finding #2). Native `String.prototype.trim` strips
  U+FEFF; ADR-0007 amendment explicitly excludes zero-width chars.
  `isEmpty` now pre-replaces zero-width chars with a sentinel before
  trimming. Fixture 095 pins the behavior.
- **ADR-0009 1e-4 → 1e-6 cutoff correction** (issue #1 finding #1).
  Spec text said "no scientific notation between 1e-4 and 1e21" and
  cited ECMA-262, but ECMA-262 §6.1.6.1.13 actually uses 1e-6.
  ADR-0009 + language.md "Canonical String Form" corrected to
  `[1e-6, 1e21)`. Fixture 096 covers the boundary.

### Added

- Conformance fixtures 095 (FEFF non-empty), 096 (1e-6 cutoff).
- PORTERS_GUIDE.md "Language-specific gotchas" section — Python
  `repr(float)` divergence (issue #1 finding #3), openpyxl
  `tzinfo=None` (finding #4), zero-width whitespace handling.

### Added

- ADR-0021 "Implementation-defined boundaries" — explicit catalog of
  the gray-area gaps in XTL 0.1, classified per item as
  implementation-defined or required. Covers memory model, sync vs.
  async, native Excel formulas, `TEXT()` extensions, merge cells,
  `__config__` author-defined keys, empty source, sheet-name
  collisions, empty template blocks, non-template input sheets.
  spec/index.md gets an "Implementation-defined boundaries" matrix
  mirroring the catalog.
- `evaluation.md` `@join` first-match clarified as normative —
  joined-source natural row order, top-to-bottom over `source_table`
  range. Two implementations MUST pick the same paired row when
  multiple joined rows have an equal join key.
- `grammar.ebnf` precedence disclaimer — the EBNF is non-normative;
  fixtures + spec prose win.
- `runner-protocol.md` clarifies `tags` is a runner convenience, not
  a conformance contract.

## [0.1.0] - 2026-05-08

First substantive 0.x release. Drafts the contract that a future 1.0
cut will freeze; the cut itself is deferred until external validation
accumulates — see [`spec/STABILITY.md`](./spec/STABILITY.md) "Current
state". Until 1.0, breaking changes are possible across 0.x minor
bumps. Reference docs: [`PORTERS_GUIDE.md`](./PORTERS_GUIDE.md),
[`RELEASING.md`](./RELEASING.md).

### Added — 1.0-readiness polish

- **Public API surface frozen.** `spec/STABILITY.md` "Public API
  surface" section enumerates the 13 runtime exports + 14 type
  re-exports that are stable for 1.x. Each export now carries
  `@stable` TSDoc. `src/__tests__/api-surface.test.ts` pins the
  runtime list.
- **Warning shape formalized.** `OutputFile.warnings`,
  `PreviewResult.warnings`, and `TemplateModel.warnings` are now
  `XtlWarning[]` with stable `code` (`xl3w/...`), `message`, and
  optional `location` — replacing the previous loose `string[]`.
  Two warning codes ship in 1.0: `xl3w/parser/missing-column` and
  `xl3w/filename/sanitized`.
- **Diagnostic location info.** Every cell-eval error now carries
  `(at sheet "X" cell A5)` appended to its message. Implemented via
  a new `evalCellAt(sheet, cell, ...)` wrapper in template-eval.
- **Resource limits position stated.** `spec/evaluation.md`
  "Resource Limits" section: limits are implementation-defined; the
  spec does not mandate bounds. Hosts that accept untrusted
  templates enforce their own caps.
- **Glossary** at `spec/glossary.md` — 30 core XTL terms with
  cross-links to the governing ADR / spec section.
- **Spec navigation index** at `spec/index.md` — surface ↔ ADR ↔
  fixture cross-reference table for porters and reviewers.
- **Deferral ADRs.** ADR-0019 records why date arithmetic is
  deferred to XTL 1.x; ADR-0020 does the same for locale-aware
  collation.
- **Status taxonomy.** `0000-template.md` and ADR-0004 introduce
  the `informational` status — non-normative documentation /
  audit / deferral ADRs that do not bind impl behavior.
- **`RELEASING.md`** — npm cut procedure, rc soak rule, rollback
  guide.

### Changed — 1.0-readiness polish

- **Error message wording normalized.** Capitalize first word,
  subject + verb form, no log-style `XLOOKUP:` prefixes. Two
  fixtures updated to match (067, 076). Voice rules now documented
  in `PORTERS_GUIDE.md` "Message style guide".
- **ADR-0004 reclassified** to `informational` status. The audit's
  conclusions live in the normative ADRs that followed (0007, 0009,
  0011, 0017).

## [Pre-1.0 history below]

### Added — porter and 1.0 readiness

- `PORTERS_GUIDE.md` — second-language port guide. Distinguishes
  spec-normative requirements (error codes, date UTC semantics,
  truthiness rules, reserved sheets, aggregate semantics) from
  TS-impl-incidental details (async-everywhere, WeakMap caching,
  ExcelJS workarounds), with a recommended development order keyed
  to the conformance corpus.
- `spec/grammar.ebnf` — formal EBNF grammar for `{{ ... }}` template
  block contents. Non-normative supporting material; the spec prose
  remains authoritative.
- Property-based fuzz tests
  (`src/__tests__/properties.test.ts`) — 10 invariants over the
  value model (canonicalString totality, isTruthy implications,
  compareValues totality / reflexivity / antisymmetry / sampled
  transitivity), each run over 200 random cases.
- ADR coverage matrix auto-generation
  (`conformance/coverage.md`) — every semantic ADR now has at least
  one covering fixture, and every fixture declares a `spec_section`.
  Conformance fixture 094 added to close the ADR-0011
  (reserved-sheet-name) gap.
- `npm run bench` performance baseline + reference numbers in
  `scripts/BENCH.md`. Three scenarios: wide-flat 10k row, multi-sheet
  5k×5, multi-source-join 5k×1k. A regression > 2× in any scenario
  should be investigated.

### Added

- `examples/` directory with three production-shaped templates
  (basic renewal report, sheet-per-region with list-filter,
  multi-source `@source` + `@join` + XLOOKUP + `__inputs__`). New
  npm scripts `examples:build` / `examples:run` and a vitest
  integration test pin them in CI.
- Composition conformance fixture 092 exercising
  `@source` + `@join` + `@filter` + `@sort` + `XLOOKUP` + cross-source
  `SUM` in one template; catches regressions where individually-
  correct rules interact incorrectly.
- Synthetic cross-writer Stage 2 fixture 093: `expected.xlsx` is
  the engine's output passed through
  `conformance/scripts/perturb-xlsx.mjs`, which reverses zip entry
  order, reverse-sorts XML attributes, and flips quote style on
  alternating attributes. Stage 2 passes only if the canonicalizer
  normalizes all of these (rules 1 and 3 in the runner protocol).
  The fixture's README documents the path to upgrade it into a true
  Excel-authored cross-writer test.
- CI matrix runs the conformance suite under three timezones
  (UTC, America/New_York, Asia/Seoul) so date-handling regressions
  fail at PR time. Available locally as `npm run conformance:tz`.
- 1.0 readiness tests — error-code catalog snapshot (ADR-0015),
  public API surface snapshot, and a spec-corpus lint that catches
  orphan ADRs and broken spec/ markdown links.

### Fixed

- Header cells containing only `SUM(Source[col])` /
  `XLOOKUP(..., Source[a], Source[b])` no longer trigger a data
  block. The previous `isDataExpression` heuristic detected any
  `Source[Field]` reference as iterating, so static-context
  aggregates / lookups in a header row were re-rendered once per
  data row. Source-prefixed brackets wrapped in
  `SUM`/`AVERAGE`/`AVG`/`MIN`/`MAX`/`COUNT`/`XLOOKUP` are now
  treated as static.

- **Date timezone correctness (ADR-0017).** All Date component
  extraction now uses UTC accessors so the canonical-string form
  (`YYYY-MM-DD`) round-trips identically on any host timezone.
  Previously `getFullYear`/`getMonth`/`getDate` introduced an
  off-by-one drift on non-UTC hosts. The fix touches `canonicalString`,
  `formatDate`, `today()`, `toDate()`, the renderer's strict-date
  parser, the Excel-serial-to-Date conversion, and `__inputs__` date
  validation. ADR-0017 now states UTC as normative.
- **`__sources__` value-dictionary leak.** `{{ __sources__[Customers] }}`
  used to leak the internal source descriptor; it now errors with
  `xl3/sources/not-a-dictionary`.
- **Unknown-column silent fail.** `Source[Column]` /
  `SUM(Source[Column])` / `XLOOKUP(...)` /  bare `[Column]` referencing
  an undeclared column previously aggregated to 0 / blank, masking
  typos. They now error with `xl3/source/unknown-column`. Conformance
  fixture 091 covers the SUM path.
- **Aux-sheet cleanup.** `removeAuxiliarySheets` matched only
  `_`-prefixed names; it now matches the dunder pattern from ADR-0011
  so reserved sheets don't leak into output.

### Added

- Error code coverage completed across the impl. Every spec-defined
  throw site in parser, reader, normalizer, renderer, template-eval,
  inputs, functions, and excel-document now carries an `xl3/...`
  code via `xtlError(code, message)`. Existing error fixtures (017,
  018, 019, 020, 021, 022, 032, 033, 034, 037, 042, 077, 078) gain
  `expected_error_code` assertions, joining the previously-coded
  067/072/073/076/081/082.
- ADR-0017 defines the **source value model** normatively. Source
  values are one of Missing / String / Number / Boolean / Date.
  Date canonical string form is now `YYYY-MM-DD` (midnight) or
  `YYYY-MM-DDTHH:mm:ss` (datetime), closing the ADR-0009 deferral.
  Excel error cells (`#N/A`, `#VALUE!`, `#DIV/0!`, …) read as empty
  per ADR-0007. Percentage-formatted cells continue to flow as their
  underlying Number value (50% → `0.5`); use `TEXT()` for formatted
  output. The reference impl handles `{ error }` cells in
  `parseCellValue`, extends `canonicalString` for Date, and adds a
  Date branch to `compareValues`. Conformance fixtures 087–090
  cover date concatenation, date comparison, error sentinel, and
  percentage cell flow.
- ADR-0016 locks down **ordering and sort stability**. `@sort` is
  stable; equal sort keys preserve source order. With multiple
  `@sort` directives, the **first** is the primary key and later
  sorts are tiebreakers (Excel/SQL convention). File groups and
  sheet groups within a file emit in **first-seen** order over the
  source's natural row order; the previous lexicographic sheet-group
  sort is replaced. The spec also clarifies that data blocks expand
  vertically by default (without an explicit `@repeat`). Conformance
  fixtures 083–086 cover sort stability, multi-sort priority, and
  file/sheet first-seen ordering.
- ADR-0015 adds **structured error codes** alongside the English
  messages. Spec-defined errors now carry a stable `error.code` like
  `xl3/source/undeclared` or `xl3/inputs/missing-required`. Hosts use
  the code for localization and programmatic dispatch; the English
  message remains the conformance contract. The reference impl
  exports `xtlError` / `isXtlError` / `XtlErrorCode` and wires codes
  through parser / inputs / template-eval / functions throw sites.
  Conformance protocol gains an optional `expected_error_code` in
  meta.yaml; six existing error fixtures now assert codes.
- ADR-0014 adds **`@join` block-level source pairing**. A data block
  may add one `@join SourceName on SourceName[k] = PrimarySource[k]`
  directive after `@source`. The engine pairs each primary row with
  the first matching joined row (inner-join semantics, first-match);
  unmatched primary rows are dropped. Inside the block, `[Column]` and
  `<PrimarySource>[Column]` resolve to the primary's row;
  `<JoinedSource>[Column]` resolves to the paired joined row. Multiple
  joins, left-join semantics, and multi-row matches are out of scope
  for XTL 0.1. Conformance fixtures 079–082 cover the happy path,
  inner-drop, undeclared-source error, and bad on-clause error.
- ADR-0013 adds **XLOOKUP** for cross-source lookup. Mirrors Excel's
  signature: `XLOOKUP(lookup_value, lookup_array, return_array,
  [if_not_found])`. Arrays must be `Source[Column]` from the same
  source; row-level cross-source lookup is now first-class. No-match
  without a fallback is an error with a stable diagnostic. Wildcard,
  approximate, and reverse-search modes are intentionally out of
  scope. Conformance fixtures 074–078 cover happy path, fallback,
  no-match error, source-mismatch error, and bare-bracket-arg error.
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

[Unreleased]: https://github.com/jinyoung4478/xl3/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/jinyoung4478/xl3/compare/v0.1.0-alpha.0...v0.1.0
[0.1.0-alpha.0]: https://github.com/jinyoung4478/xl3/releases/tag/v0.1.0-alpha.0
