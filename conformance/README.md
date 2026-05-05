# XTL Conformance Suite

This directory holds the **conformance corpus** — the test fixtures that any implementation of XTL must pass to claim conformance. The corpus is the executable definition of XTL behavior.

## Layout

```
conformance/
├── README.md            ← this file
├── AUTHORING.md         ← how to add fixtures (avoid the JS-as-truth trap)
├── runner-protocol.md   ← how implementations should run the suite
└── fixtures/
    └── <NNN>-<slug>/
        ├── template.xlsx
        ├── data.xlsx
        ├── expected.xlsx        ← canonical expected output (single-file case)
        ├── expected/            ← OR a directory of files (multi-file group case)
        │   └── *.xlsx
        ├── no expected output   ← for expected_error fixtures
        ├── no static expected   ← for expected_dynamic fixtures
        └── meta.yaml            ← description, spec section refs, tags
```

## What "passing" means

A static-output fixture passes if the implementation, given `template.xlsx` and
`data.xlsx`, produces output(s) that match `expected.xlsx` (or the contents of
`expected/`). Stage 1 runners may compare higher-level worksheet/cell values.
Stage 2 runners compare byte-equivalent workbook content after **canonical
normalization** of the OOXML zip:

- Files within the zip sorted by name
- XML serialized in deterministic canonical form
- Text-run whitespace preserved
- Generator metadata stripped (creator, modifiedBy, lastModified)

See [`runner-protocol.md`](./runner-protocol.md) for the comparison stage and
canonicalization rules.

An error fixture passes when the implementation reports an error containing the
fixture's `expected_error` text. Error fixtures do not include `expected.xlsx`
or an `expected/` directory.

A dynamic fixture passes when the implementation's output matches the dynamic
assertions declared by `expected_dynamic` in `meta.yaml`. Dynamic fixtures do
not include `expected.xlsx` or an `expected/` directory.

## Versioning

Each fixture directory contains `meta.yaml` declaring the minimum spec version it requires (`spec_version: 0.1`). Implementations report which spec version they target; the suite filters fixtures accordingly.

Static-output fixtures may also declare `comparison_stage`. The field defaults
to `1`; fixtures that require canonical OOXML comparison declare
`comparison_stage: 2`.

## Fixture Catalog

The XTL 0.1 bootstrap corpus currently contains these fixtures:

| ID | Fixture | Contract |
|---|---|---|
| 001 | `bracket-substitution` | Single bracketed source-column expressions render one output row per source row. |
| 002 | `if-function` | `IF(condition, then, else)` evaluates comparisons inside the current data row. |
| 003 | `list-sheet-filter` | `@filter [field] in _ListSheet` keeps matching rows and removes the list sheet from output. |
| 004 | `repeat-right-default` | `@repeat right` without an explicit count defaults to `colSpan = 1`. |
| 005 | `round-half-away-from-zero` | `ROUND()` uses Excel-style half-away-from-zero rounding. |
| 006 | `filename-forbidden-chars` | Forbidden filename characters are replaced with `_`. |
| 007 | `filename-reserved-name` | Windows reserved device basenames get a single trailing `_`. |
| 008 | `numfmt-numeric-string-coercion` | Numeric template formats coerce numeric strings to numbers. |
| 009 | `numfmt-date-string-coercion` | Date template formats coerce date-like strings to date values. |
| 010 | `numfmt-text-format-coercion` | Text format `@` coerces a single-expression value to a string. |
| 011 | `text-date-format` | `TEXT(date, "YYYY-MM-DD")` returns a string using XTL date tokens. |
| 012 | `text-number-format` | `TEXT(number, format)` supports the minimum XTL 0.1 numeric format subset. |
| 013 | `rich-text-template-expression` | Rich-text template cells are parsed by concatenating text runs before expression detection. |
| 014 | `source-formula-cached-result` | Source formula cells use cached results and are not recalculated by XTL. |
| 015 | `source-sheet-prefix-first-match` | `source_sheet` prefix patterns select the first matching worksheet in workbook order. |
| 016 | `text-number-negative-rounding` | Numeric `TEXT()` formats round negative `.5` boundaries half away from zero. |
| 017 | `source-sheet-prefix-no-match-error` | Missing `source_sheet` prefix matches report a stable error. |
| 018 | `source-formula-missing-cached-result-error` | Source formula cells without cached results report a stable error. |
| 019 | `filename-empty-basename-error` | Filename sanitization reports an error for an empty basename. |
| 020 | `filename-length-overflow-error` | Filename sanitization reports an error above the 255-byte limit. |
| 021 | `numfmt-number-coercion-error` | Numeric template formats report an error when coercion fails. |
| 022 | `numfmt-date-coercion-error` | Date template formats report an error when coercion fails. |
| 023 | `today-utc-dynamic` | `TODAY()` renders the runner-start UTC date through a dynamic assertion. |
| 024 | `stage2-merge-preservation` | Stage 2 comparison verifies merged ranges below expanded data blocks are preserved. |
| 025 | `stage2-style-numfmt-preservation` | Stage 2 comparison verifies rendered cells preserve template style and numFmt. |

## Status

XTL 0.1 corpus is **bootstrap state**. Fixtures should be added only for behavior already stated in [`spec/README.md`](../spec/README.md), following the same pattern used by standards projects such as CommonMark: prose defines the rule, fixtures make the rule executable, and implementations report which fixtures they pass.

The reference implementation does not make its own behavior normative. When a fixture and the implementation disagree, update the implementation or the fixture according to the spec precedence in [`spec/README.md`](../spec/README.md).

Fixtures for XTL 0.1 core behavior avoid implementation-defined extensions such
as `TEXT()` formats outside the minimum table in [`spec/language.md`](../spec/language.md).
