# XTL Stability Policy

## Current state

XTL is at version **0.1**, with a 1.0 release candidate published as
`xl3@1.0.0-rc.1` on npm. The 0.1 spec surface is the 1.0 surface; the
rc cycle is for catching impl-side bugs and porter-side ambiguities
before the contract freezes for the 1.x line.

## During 0.x

- Spec breaking changes are documented in the affected ADR(s) and reflected in the conformance corpus before the next minor release.
- The reference implementation (`xl3` on npm) follows SemVer for its own API; spec breakages bump the spec minor version.
- Implementations should declare which spec version they target (e.g., `XTL 0.2 partial`, `XTL 0.3 full`).

## At 1.0

- The spec freezes for backwards-compatible evolution only.
- Breaking spec changes require XTL 2.0 with public discussion and a migration guide.
- The reference implementation follows SemVer strictly.

## Path to 1.0

The 1.0 cut closes XTL's first portability contract. The intent is
that any conforming implementation produces identical output (Stage
1) and identical canonical OOXML (Stage 2) for the frozen fixture
corpus, on any host timezone, locale, or byte order.

### Public API surface (xl3 reference impl)

The TypeScript reference impl freezes the following 13 runtime
exports at 1.0. Adding a new export is backwards-compatible;
removing or renaming any of them is a 2.0-only change.

**Conversion entry points**

- `convert(template, source, options?) → Promise<OutputFile[]>`
- `preview(template, source, options?) → Promise<PreviewResult>`
- `readTemplateInputs(template) → Promise<InputSpec[]>`
- `analyze(template) → Promise<ParsedTemplate>`
- `analyzeModel(template) → Promise<TemplateModel>`
- `packageZip(files) → Promise<Blob>`

**Lower-level helpers**

- `readConfigSheet(workbook) → ConfigResult`
- `writeConfigSheet(workbook, meta) → void`
- `readInputsSheet(workbook) → InputSpec[]`
- `batchMatch(...)` — file-pattern matching helper
- `toTemplateModel(parsed) → TemplateModel`

**Error helpers (ADR-0015)**

- `xtlError(code, message) → XtlError`
- `isXtlError(value) → boolean`

**Type re-exports** also frozen at 1.0:
`TemplateMeta`, `TemplateModel`, `ParsedTemplate`, `OutputFile`,
`PreviewResult`, `PreviewSource`, `ConvertOptions`, `InputSpec`,
`InputType`, `SourceSpec`, `XtlError`, `XtlErrorCode`, `XtlWarning`,
`XtlWarningCode`.

The snapshot test in `src/__tests__/api-surface.test.ts` pins the
runtime list and fails CI on silent changes. New exports require
deliberately updating the snapshot AND a CHANGELOG entry.

### What 1.0 freezes

Surface area covered by the following ADRs is part of the 1.0
contract. Breaking changes require an XTL 2.0 cut.

- ADR-0001 — `TODAY()` UTC semantics
- ADR-0002 — output filename sanitization
- ADR-0003 — numFmt-driven coercion
- ADR-0005 — dynamic conformance assertion protocol
- ADR-0006 — Stage 2 canonical OOXML comparison (rules 1-8 + the
  amendment listing the gap items)
- ADR-0007 — empty-value predicate
- ADR-0008 — truthiness rules
- ADR-0009 + ADR-0017 — comparison algorithm and source value
  model (read together as one contract)
- ADR-0010 + ADR-0011 — runtime inputs and reserved sheet naming
- ADR-0012 — multi-source data model
- ADR-0013 — XLOOKUP cross-source lookup
- ADR-0014 — `@join` block-level pairing (single inner join,
  deterministic first-match)
- ADR-0015 — structured error reporting (`xl3/...` codes + English
  conformance messages)
- ADR-0016 — ordering and sort stability

ADR-0004 is informational (reference-impl coupling audit) and not
part of the spec contract.

### What 1.0 does NOT include

The following are intentionally deferred. Adding them is
backwards-compatible and does not require a new spec major.

- Multiple `@join` directives in a single block, `@join … left`
  semantics, multi-row joined matches (ADR-0014 explicit
  out-of-scope list).
- XLOOKUP wildcard, approximate, and reverse-search modes
  (ADR-0013 explicit out-of-scope list).
- Locale-aware string collation. Sort uses Unicode code-point
  order; hosts that need locale collation pre-sort upstream.
- Date/datetime arithmetic functions (no `EOMONTH`, `EDATE`,
  `DATEDIF`, etc.).
- Cross-writer canonicalization for the gap items in ADR-0006
  amendment (default attribute equivalence, color hex case,
  namespace prefix bindings).
- A normative wire format for inputs, sources, or outputs beyond
  the host API surface in ADR-0010 / ADR-0012.

### Conformance baseline

The 1.0 conformance corpus is the union of fixtures tagged with
`spec_version: "0.1"` plus any added before the 1.0 cut. The corpus
must pass:

1. Stage 1 cell-value comparison.
2. Stage 2 canonical OOXML comparison for fixtures declaring
   `comparison_stage: 2`.
3. Stage 1 under at least three timezones (`UTC`,
   `America/New_York`, `Asia/Seoul`) — the reference repo's CI
   workflow runs this matrix; ports SHOULD do the same.

A 1.0-claiming implementation MUST report its conformance run
against this corpus and MUST NOT skip fixtures except those
declared at a higher comparison stage than its runner supports.

## Core vs. extensions

The spec distinguishes:

- **Core** — language features required for conformance. Summarized in [`README.md`](./README.md) and defined in [`language.md`](./language.md) and [`evaluation.md`](./evaluation.md). Breaking changes here are spec-version events.
- **Extensions** — implementation-specific or domain-specific additions. May vary across implementations. Documented in implementation READMEs, not in the spec.

Implementations MAY add extensions but MUST NOT silently change core semantics.

For example, implementations may support additional `TEXT()` formats beyond the
XTL 0.1 core table. Such formats are extensions: portable templates should not
depend on them, and conformance fixtures do not require identical output for
them.

## Conformance corpus versioning

The conformance corpus version tracks the spec version. A fixture added in spec 0.3 is tagged accordingly; implementations declare which fixtures they pass and, in turn, which spec version they conform to.

## Deprecation policy (post-1.0)

When a feature is to be removed in a future major version:

1. The feature is marked **deprecated** in the spec for at least one minor version before removal.
2. Conformance fixtures using the deprecated feature gain a `deprecated` tag.
3. Implementations are encouraged to emit warnings when the deprecated feature is used.
4. Removal happens in the next major (e.g., deprecated in 1.3 → removed in 2.0).
