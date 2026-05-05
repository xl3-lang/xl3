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
skip_reason: string                # if fixture is currently broken
```

A runner MUST mark an `expected_error` fixture as:

- `pass` when the implementation reports an error containing `expected_error`
- `fail` when the implementation succeeds
- `fail` when the implementation reports a different error

## Output comparison

Comparison is performed on **canonicalized** OOXML. The minimum canonicalization rules:

1. Files within the zip MUST be compared by content, not by zip metadata (timestamps, compression).
2. XML files MUST be compared after parsing and re-serializing in canonical order.
3. The following fields are stripped before comparison (they reflect generator metadata, not content):
   - `cp:lastModifiedBy`, `dc:creator`, `cp:created`, `dcterms:modified`
   - Any `<calcPr>` `calcId` attribute (Excel calc engine version)
4. Insignificant whitespace within text runs is preserved (it can be semantically meaningful).
5. Cell `r` (reference) attributes MUST match exactly; cell ordering within `<row>` MUST match.

A reference canonicalizer implementation is provided in the JS reference impl as `xl3 conformance canonicalize <input.xlsx>` (planned).

## Runner CLI conventions

Implementations should expose a runner with this minimal interface:

```
<runner> [--fixture-dir=<path>] [--filter=<tag>] [--spec-version=<x.y>] [--report=json|text]
```

JSON report format:

```json
{
  "implementation": "xl3-js",
  "version": "0.1.0-alpha.0",
  "spec_version": "0.1",
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
