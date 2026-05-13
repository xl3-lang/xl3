# Changelog

All notable changes to xl3 are documented here. The npm package follows
[Semantic Versioning](https://semver.org/). The XTL language version is tracked
separately in [spec/STABILITY.md](./spec/STABILITY.md).

## [Unreleased]

## [0.4.1] - 2026-05-13

Packaging-only patch release. Adds a browser-ready IIFE bundle so
hosts that prefer a `<script src="...">` integration don't need a
bundler. ESM npm entry, conformance behavior, and the spec are
unchanged.

### Added

- **IIFE browser bundle.** New `dist/xl3.bundle.iife.min.js`
  (~1 MB minified, ~300 KB gzipped) exposes `window.xl3` with all
  13 public exports (`convert`, `preview`, `analyze`, etc.).
  ExcelJS + JSZip are inlined; no external deps needed. Unminified
  `xl3.bundle.iife.js` with source maps also ships for debugging.
- **Package `exports` map** adds `./bundle` (minified) and
  `./bundle/dev` (unminified) entries, plus `unpkg` and `jsdelivr`
  fields so the CDN URL
  `https://cdn.jsdelivr.net/npm/@jinyoung4478/xl3@0.4.1/`
  resolves to the bundle by default.
- **Build script:** `npm run build:bundle` (tsup, ESM→IIFE).
  `prepublishOnly` runs it automatically.

### Usage

```html
<script src="https://cdn.jsdelivr.net/npm/@jinyoung4478/xl3@0.4.1/dist/xl3.bundle.iife.min.js"></script>
<script>
  const outputs = await xl3.convert(templateBuffer, dataBuffer);
</script>
```

The ESM `import { convert } from '@jinyoung4478/xl3'` form is
unchanged and remains the recommended path for bundler-driven
projects.

## [0.4.0] - 2026-05-12

Spec-audit minor release. Four new ADRs (0029–0032) close the
last "silent fallthrough" surfaces and pin existing
implementation behavior as normative. One new error code
(`xl3/filename/collision`) and six new conformance fixtures
(115, 116, 117, 118, 119, 120). With this release the XTL 0.1
spec audit pass is complete: 32 ADRs, 119 conformance fixtures,
all green at Stage 2.

### Added

- ADR-0032 "Niche limits and workbook pass-through behaviors".
  Documents four niche behaviors as normative without changing the
  reference impl, so future ports can't silently diverge:
  - **Strings longer than 32,767 chars** are written to OOXML
    as-is. Implementation-defined; xl3 does not enforce Excel's
    per-cell limit. Host code is responsible for upstream
    validation if Excel compatibility is required.
  - **Source headers in merged cells** are implementation-defined;
    portable templates do NOT merge header cells. Reader libraries
    differ on what they return per cell of a merged range; xl3
    reaches `xl3/source/duplicate-name` or
    `xl3/source/missing-header` accordingly.
  - **Workbook and sheet properties** (`tabColor`,
    `defaultRowHeight`, `pageSetup`, `views`, defined names, print
    areas) are preserved verbatim from template to output. Porters
    MUST preserve these unless an ADR overrides.
  - **Integer precision beyond 2^53** is implementation-defined
    within IEEE 754 limits. xl3 does not detect precision loss.
    Authors needing exact integer representation beyond 2^53 store
    values as strings.

  No new error codes. No impl change. Fixture 120 pins `tabColor`
  preservation as the most user-visible example.

- ADR-0031 "Output filename collision is an error". Two distinct
  file group keys that sanitize (per ADR-0002) to the same filename
  now raise `xl3/filename/collision` at convert time. Previously
  silently returned two `OutputFile` entries with the same filename,
  causing host code to overwrite the first when writing to disk.
  Example: Region values `Seoul/Korea` and `Seoul:Korea` both
  sanitize to `Seoul_Korea.xlsx`. Detection runs before any workbook
  is rendered. New error code, fixture 119.

- ADR-0030 "Unicode normalization in string comparison". Pins
  ADR-0009's existing "raw code-point order" behavior with explicit
  treatment of the NFC vs NFD trap (Korean, Japanese, Latin with
  diacritics). NFC `한` (U+D55C) and NFD `한` (U+1112 U+1161
  U+11AB) render identically but compare as different strings.
  Aligns with Excel-default principle (Excel does not normalize
  either). Authors with mixed-form data normalize upstream.
  Conformance fixture 118 pins it; `language.md` "Comparison
  Algorithm" and `PORTERS_GUIDE.md` "Language-specific gotchas"
  document the trap.

- ADR-0029 "Directive composition + source edge semantics". Closes
  four spec gaps in one ADR:
  - **Duplicate `@source`** in a data block now raises
    `xl3/directive/invalid-syntax`. Previously last-wins silently.
  - **Duplicate `@join`** raises the same code (multi-join remains
    out of scope per ADR-0014).
  - **Self-join** (`@join S on S[a]=S[b]` where `S` is the active
    source) raises `xl3/join/bad-on-clause`. Previously produced
    zero rows silently. Tree / hierarchy walks remain out of scope.
  - **Function name case-insensitivity** is now normatively pinned
    (`if`, `If`, `IF` all work). Fixture 116.
  - **Hidden source rows** are normatively included in iteration.
    Authors filter explicitly via `@filter` for visibility-aware
    behavior. Fixture 117.
- 4 new conformance fixtures (114–117).

### Changed

- README adds a "What's new" callout referencing the audit-pass
  completion and the changes accumulated since 0.3.0.

## [0.3.0] - 2026-05-09

Spec-audit minor release. Three new ADRs (0026, 0027, 0028) close
gaps that surfaced during a focused audit. Six new conformance
fixtures (107–113) pin the new behaviors. Replaces several
silent-fallthrough surfaces with coded errors — the
"silent-garbage-to-loud-error" theme that has driven this
audit pass.

### Changed (BREAKING within 0.x semantics)

- **Empty group key value** in a file or sheet name template now
  substitutes the literal token `(blank)` per Excel pivot
  convention (ADR-0026). Previously: file-level halted with
  `xl3/filename/empty`, sheet-level fell back to literal `Sheet`.
- **Source column name** colliding with an internal context key
  (`Rows`, `__rownum`, `__activeSource__`, `__joinedRow__`, or any
  `^__[a-z]+__$` pattern) now raises
  `xl3/source/reserved-column-name` at parse (ADR-0027). Previously
  silently shadowed (or was shadowed by) the internal value,
  producing `[object Object]` cell values.
- **Empty / malformed directive bodies** (`{{ @filter }}`,
  `{{ @source }}`, `{{ @sort foo }}`, etc.) now raise
  `xl3/directive/invalid-syntax` (ADR-0027). Previously silently
  no-opped — author saw output with the directive un-applied.
- **Unary operators on non-literal expressions** (`+5`, `--5`,
  `-[col]`, `-(expr)`) now raise `xl3/eval/unsupported-syntax`
  (ADR-0028). Previously silently rendered the literal expression
  text. Workaround for column negation: `(0 - [col])` or
  `[col] * -1`. Number literals with a leading `-` (`-5`, `-3.14`)
  remain valid.

### Changed

- Conformance fixture 019 rewritten to use a `__config__` author
  key for the empty-basename error path (the empty-group-key shape
  now flows through `(blank)` per ADR-0026).

### Added

- ADR-0028 "Literal syntax constraints + unsupported-syntax detection".
  Closes the unary-operator silent-fallthrough surface:
  - **String literals** are matched-pair `"..."` only; no escape
    sequences. Backslashes pass through literally; embed quotes via
    `__config__` cells.
  - **Number literals** support a leading `-` for negation
    (`-5`, `-3.14`).
  - **Unary operators on non-literal expressions** (`+5`, `--5`,
    `-[col]`, `-(expr)`) raise `xl3/eval/unsupported-syntax`.
    Replaces the previous silent fallthrough that output the
    literal expression text. Workaround for column negation:
    `(0 - [col])` or `[col] * -1`.
  - 1 new error code, 2 new fixtures (112, 113).

- ADR-0027 "Reserved column names + directive arg validation".
  Closes two silent-fallthrough surfaces:
  - **Reserved source column names**: `Rows`, `__rownum`,
    `__activeSource__`, `__joinedRow__`, plus any `^__[a-z]+__$`
    pattern, are rejected at parse with
    `xl3/source/reserved-column-name`. Previously such columns
    silently shadowed (or were shadowed by) renderer ctx keys,
    producing `[object Object]` cell values.
  - **Empty / malformed directive bodies**:
    `{{ @filter }}`, `{{ @sort }}`, `{{ @source }}` (and friends)
    now raise `xl3/directive/invalid-syntax` at parse instead of
    silently no-opping. Authors who think they filtered see the
    error immediately rather than wondering why output has all rows.
  - 3 new conformance fixtures (109, 110, 111).

- ADR-0026 "Empty value lifecycle in cell rendering and group keys".
  Pins two previously-undefined behaviors:
  - Single-expression cell evaluating to empty produces a cell value
    of `""` (empty string) — matches Excel's `=""` formula behavior;
    the cell is present in OOXML, value is empty, re-reading via
    xl3 reads as empty per ADR-0007.
  - File- and sheet-level group keys with empty values substitute
    the literal token `(blank)` per Excel pivot table convention
    (ADR-0023 Excel-default principle). This replaces the previous
    asymmetric behavior where file-level halt-with-error and
    sheet-level fell back to the literal `Sheet`. Real reporting
    data with sloppy rows now produces a `(blank).xlsx` bucket and
    a `(blank)` sheet instead of failing the whole conversion.

### Changed

- Conformance fixture 019 (`019-filename-empty-basename-error`) was
  rewritten to exercise the empty-basename error path via a
  `__config__` author key (which ADR-0026's `(blank)` substitution
  does NOT apply to). The original empty-group-key shape now flows
  through the `(blank)` placeholder instead of erroring.

## [0.2.0] - 2026-05-08

Spec-audit minor release. Three new ADRs (0023, 0024, 0025) close
spec gaps that surfaced during a focused audit; seven new
conformance fixtures (100–106) pin them. The notable behavior
change — division by zero now produces an Excel `#DIV/0!` error
cell instead of silently rendering `0` — is what bumps this from
patch to minor.

### Changed (BREAKING within 0.x semantics — see ADR-0025)

- **Division by zero** in arithmetic produces an Excel-style
  `#DIV/0!` error cell instead of silently rendering `0`.
  Templates whose data has a zero divisor now show `#DIV/0!`
  visibly in the cell (the workbook still renders; only the
  affected cell carries the error). Aligns with Excel's behavior
  per the Excel-default principle.
- **Wrong arity** on user-facing functions (`IF`, `ROUND`,
  `XLOOKUP`, `SUM`, etc.) now raises `xl3/eval/arity-mismatch`
  at parse / normalize time. Previously fell through to a silent
  string-fallback or generic crash.
- **Non-numeric strings in arithmetic** (`"abc" + 5`) now raise
  `xl3/eval/operand-coercion`. Previously coerced silently to 0.

### Added

- ADR-0025 "Division by zero produces an Excel #DIV/0! error cell".
  Resolves ADR-0023 §"Open question". Aligns with the Excel-default
  principle: a single bad row marks one cell with `#DIV/0!`, the
  rest of the conversion proceeds. The reference impl returns a
  typed marker (`{ __xl3_error__: '#DIV/0!' }`) from the `/` operator
  on zero divisor; the renderer emits a real ExcelJS error cell.
  Conformance fixture 106 pins the behavior. Comparable() in the
  conformance runner now extracts the error code from error cells
  so output-side fixtures can pin exact errors.
- Multiple `@filter` directives normatively compose with AND
  (language.md "Filter"). Conformance fixture 104 pins it.
- `{{ }}` whitespace rule formalized in language.md "Template
  Blocks": leading/trailing whitespace inside the delimiters is
  insignificant, string-literal whitespace is preserved.
  Conformance fixture 105 pins it.

### Added

- ADR-0024 "Function arity is part of the spec". XTL 0.1 user-facing
  functions now have a normative arity table in language.md
  "Functions" and a single source of truth in `FUNCTION_ARITY` in
  the normalizer. Calls with wrong arity raise
  `xl3/eval/arity-mismatch` at normalize time instead of falling
  through to a silent string-fallback or generic crash. Conformance
  fixtures 102 (`ROUND([x])`) and 103 (`XLOOKUP(a, b)`) pin two
  common shapes; new error code added to the catalog and snapshot
  test.

### Added

- ADR-0023 "Operator coercion + Excel-as-default principle".
  Spec gaps closed:
  - **Excel-default principle** — when XTL is silent or ambiguous,
    implementations SHOULD adopt Excel's behavior (subject to existing
    overriding ADRs like 0017 UTC dates).
  - **Arithmetic operator coercion table** — `+`, `-`, `*`, `/` now
    have an explicit table for numeric-like strings (coerced),
    Booleans (TRUE→1, FALSE→0), empty values (→0), Dates (error),
    and non-numeric strings (error). Replaces the previous
    silent-`toNumber()=0` behavior.
  - New error code `xl3/eval/operand-coercion`.
  - Conformance fixtures 100 (coercion table) + 101 (non-numeric
    string error).
- Division-by-zero behavior is left as an open question in ADR-0023
  pending a follow-up ADR (options: throw, Excel-style `#DIV/0!`
  cell, or empty). Reference impl preserves prior behavior (returns
  0) until decided.

## [0.1.1] - 2026-05-08

Patch release rolling up everything that landed since `0.1.0` was
published to npm. Includes one impl crash fix surfaced by the new
boundary fixtures, the xl3-py issue #1 batch (5 findings), the
ADR-0021/0022 documentation expansion, and the `@jinyoung4478/xl3`
scoped name (which was effective with the 0.1.0 publish but
documented here for completeness across the changelog timeline).

### Fixed

- Empty `{{ }}` template block (whitespace-only between delimiters)
  previously crashed with a generic `TypeError` from
  `getFunction(undefined).toUpperCase()`. ADR-0021 specified it as
  a parse error in prose; the impl now matches by raising
  `xl3/parser/empty-block` at parse time. Fixture 099 pins the
  behavior.

### Added

- Conformance fixtures pinning two of the implementation-defined
  boundaries documented by ADR-0021:
  - 097 — native Excel formula in a static template cell (not inside
    a data block) is preserved verbatim, with cached result reading
    back via Stage 1 `comparable`.
  - 099 — empty `{{ }}` template block (whitespace-only between
    delimiters) raises `xl3/parser/empty-block` at parse time.
    Previously the impl crashed with a generic `TypeError` from
    `getFunction(undefined).toUpperCase()`; ADR-0021 specified the
    behavior in prose but no fixture pinned it. Now it does, and the
    impl emits a coded error.
- New stable error code `xl3/parser/empty-block` in the catalog.

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

[Unreleased]: https://github.com/jinyoung4478/xl3/compare/v0.4.1...HEAD
[0.4.1]: https://github.com/jinyoung4478/xl3/compare/v0.4.0...v0.4.1
[0.4.0]: https://github.com/jinyoung4478/xl3/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/jinyoung4478/xl3/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/jinyoung4478/xl3/compare/v0.1.1...v0.2.0
[0.1.1]: https://github.com/jinyoung4478/xl3/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/jinyoung4478/xl3/compare/v0.1.0-alpha.0...v0.1.0
[0.1.0-alpha.0]: https://github.com/jinyoung4478/xl3/releases/tag/v0.1.0-alpha.0
