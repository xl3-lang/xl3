# Conformance Runner Protocol

Defines the contract between the conformance corpus and any XTL implementation that wants to claim conformance.

## What a runner is

A **conformance runner** is a small program that:

1. Iterates over fixtures in `conformance/fixtures/`
2. Invokes the implementation under test on each fixture's `template.xlsx` + `data.xlsx`
3. Compares the implementation's output to the fixture's `expected.xlsx` (or `expected/` directory)
4. Reports pass / fail / skip per fixture in a standard format

Each implementation provides its own runner (since invocation is language-specific), but all runners produce comparable output.

## Fixture loading

A runner discovers fixtures by enumerating subdirectories of `conformance/fixtures/`. Each subdirectory is named `<NNN>-<slug>/` (e.g., `001-basic-substitution`).

For each fixture, the runner reads:

- `template.xlsx` — input template
- `data.xlsx` — input source data
- `expected.xlsx` (single-output case) **or** `expected/` directory of `.xlsx` files (multi-file group case)
- `meta.yaml` — fixture metadata

Error fixtures omit `expected.xlsx` and `expected/`. They declare
`expected_error` in `meta.yaml`; the expected result is that the implementation
reports an error whose message contains the declared text.

Dynamic fixtures omit `expected.xlsx` and `expected/`. They declare
`expected_dynamic` in `meta.yaml`; the expected result is computed by the runner
from the runner-start timestamp and the declared assertion rules. Dynamic
fixtures are reserved for behavior that is explicitly time-dependent in the
spec, such as `TODAY()`.

## Required `meta.yaml` fields

```yaml
description: string         # one-line human description
spec_section: string        # the spec section this fixture exercises
spec_version: string        # minimum XTL version (e.g., "0.1")
tags: [string, ...]         # filter tags (e.g., [substitution, repeat, aggregate])
```

Optional fields:

```yaml
verified_by: [hand | excel-formulas | manual-script | reference-impl]
expected_warnings: [string, ...]   # warnings the impl should emit
expected_error: string             # expected error message substring; no expected output is required
expected_dynamic: string           # dynamic assertion kind; no expected output is required
comparison_stage: 1 | 2            # minimum comparison stage for static-output fixtures; default is 1
skip_reason: string                # if fixture is currently broken
```

Stage-gating metadata:

- `comparison_stage` applies only to static-output fixtures. It defaults to
  `1`. Use `2` only when the fixture asserts workbook content that Stage 1
  cannot observe, such as styles, merges, package parts, or binary media.
- `expected_error` fixtures and `expected_dynamic` fixtures do not use workbook
  comparison stages for pass/fail. A runner still reports the active run stage,
  but these fixtures keep their own error or dynamic assertion rules.
- `expected_dynamic` requires `dynamic_cells` for the currently defined
  `utc_today` assertion kind. Static-output and error fixtures omit
  `dynamic_cells`.

A runner MUST mark an `expected_error` fixture as:

- `pass` when the implementation reports an error containing `expected_error`
- `fail` when the implementation succeeds
- `fail` when the implementation reports a different error

`expected_error` and `expected_dynamic` are mutually exclusive.

## Dynamic assertions

Dynamic assertions make render-time behavior testable without committing a
stale `expected.xlsx`. A runner MUST capture a single runner-start timestamp
before executing the first fixture and use that timestamp for every dynamic
fixture in the run. This avoids midnight-boundary differences between fixtures
within the same report.

XTL 0.1 defines one dynamic assertion kind:

```yaml
expected_dynamic: utc_today
dynamic_cells:
  - sheet: Report
    cell: A2
    format: YYYY-MM-DD
```

For `utc_today`, the expected value for each listed cell is the UTC calendar
date from the runner-start timestamp, formatted with the listed XTL `TEXT()`
date format. The implementation output MUST contain the expected string value
at each listed sheet/cell coordinate.

A runner MUST mark an `expected_dynamic` fixture as:

- `pass` when the implementation succeeds and every listed dynamic cell matches
- `fail` when the implementation reports an error
- `fail` when any listed dynamic cell differs from the computed expected value

Runners that do not implement a declared `expected_dynamic` kind MUST mark the
fixture as `skip` and include a reason. They MUST NOT report it as passed.

## Comparison stages

The conformance protocol has two comparison stages:

- **Stage 1: cell-value comparison.** The runner compares worksheet names and
  non-auxiliary cell values after loading `.xlsx` files through a spreadsheet
  library. This stage intentionally ignores styles, merges, page setup,
  embedded media, formulas beyond cached values, and package structure. It is
  sufficient for the XTL 0.1 bootstrap corpus while canonical OOXML comparison
  is being specified and implemented.
- **Stage 2: canonical OOXML comparison.** The runner compares generated `.xlsx`
  files after canonicalizing their OOXML packages. This is the target for full
  static-output conformance because it can catch layout, style, merge, sheet
  structure, and package regressions that Stage 1 cannot see.

Error fixtures and dynamic fixtures are not workbook-output comparisons. They
keep their `expected_error` and `expected_dynamic` pass/fail rules regardless of
comparison stage.

Reports SHOULD identify the comparison stage used for each run. An
implementation MUST NOT claim Stage 2 conformance from a Stage 1-only run.
Static-output fixtures MAY declare `comparison_stage` in `meta.yaml`. A runner
MUST skip a fixture whose declared comparison stage is greater than the runner's
active stage.

## Stage 2 output comparison

Comparison is performed on **canonicalized** OOXML. The minimum canonicalization rules:

1. Files within the zip MUST be compared by content, not by zip metadata
   (timestamps, compression, entry order, or compression level).
2. Package part names MUST match after canonicalization. Missing or extra
   workbook parts are differences unless a later ADR marks the part volatile.
3. XML files MUST be compared after parsing and re-serializing with deterministic
   namespace declarations, attribute order, quote style, and empty-element
   representation.
4. XML element order MUST be preserved unless a later ADR explicitly marks a
   specific element collection as unordered. Relationship files are ordered
   package data, not sets, until such a rule exists.
5. The following fields are stripped before comparison (they reflect generator metadata, not content):
   - `cp:lastModifiedBy`, `dc:creator`, `dcterms:created`, `dcterms:modified`
   - Any `<calcPr>` `calcId` attribute (Excel calc engine version)
   - Generated sheet ids and sheet part filenames when they can be resolved
     through workbook relationships and sheet names
   - Default page setup values that ExcelJS may add or omit (`copies="1"`,
     `firstPageNumber="1"`, `useFirstPageNumber="1"`)
6. Insignificant whitespace within text runs is preserved (it can be semantically
   meaningful).
7. Cell `r` (reference) attributes MUST match exactly; cell ordering within
   `<row>` MUST match.
8. Binary package parts, such as images, MUST be compared by exact bytes.

The JS reference runner includes a Stage 2 canonicalizer for conformance
comparison. It is intentionally scoped to the OOXML produced by supported XTL
fixtures plus the normalization rules above; it is not a general-purpose XML
canonicalization library. In particular, it does not claim full XML C14N
support, DTD/entity processing, semantic namespace rewriting, or application
specific unordered-collection rules beyond those explicitly listed here.
Fixtures that need additional OOXML equivalence rules should update this
protocol first.

## Runner CLI conventions

Implementations should expose a runner with this minimal interface:

```
<runner> [--fixture-dir=<path>] [--filter=<tag>] [--spec-version=<x.y>] [--comparison-stage=1|2] [--report=json|text]
```

JSON report format:

```json
{
  "implementation": "xl3-js",
  "version": "0.1.0-alpha.0",
  "spec_version": "0.1",
  "comparison_stage": 1,
  "results": [
    {
      "fixture": "001-basic-substitution",
      "status": "pass",
      "duration_ms": 12
    },
    {
      "fixture": "007-aggregate-sum",
      "status": "fail",
      "duration_ms": 8,
      "diff": "cell B5: expected 1234, got 1234.0"
    }
  ],
  "summary": {
    "total": 42,
    "passed": 40,
    "failed": 1,
    "skipped": 1
  }
}
```

## Reporting conformance

An implementation reports its conformance level by linking to a public conformance run. The expected form:

```
xl3-py 0.2.0 — XTL 0.1 conformance: 38/42 (passes filter, repeat, aggregate; fails image-clone, _config-pattern-match, two date-edge cases)
```

The repo's [`IMPLEMENTATIONS.md`](../IMPLEMENTATIONS.md) lists known impls and their conformance levels.
