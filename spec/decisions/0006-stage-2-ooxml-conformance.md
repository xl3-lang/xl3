# ADR 0006 - Stage 2 OOXML conformance comparison

- **Status:** accepted
- **Date:** 2026-05-05
- **Spec target:** XTL 0.1 draft
- **Affects:** conformance/runner-protocol.md, conformance runners

## Context

The current JavaScript conformance runner is Stage 1: it loads generated
workbooks and expected workbooks through ExcelJS and compares worksheet names
and cell values. This made the bootstrap corpus executable quickly, but it does
not test important Excel-output behavior:

- Cell styles and number formats.
- Merged ranges and row/column structure.
- Sheet properties, views, page setup, and workbook metadata.
- Images and binary package parts.
- Exact output file structure for cases where the `.xlsx` package is part of
  the observable contract.

The runner protocol already describes canonical OOXML comparison as the target,
but it did not separate the current Stage 1 reality from the intended Stage 2
contract.

## Considered Options

**A. Keep Stage 1 as the only conformance mode.** This keeps runners simple.
Cost: implementations can pass conformance while losing layout, styles, merges,
or package structure.

**B. Make raw `.xlsx` byte comparison the final mode.** This is simple to
implement. Cost: `.xlsx` zip metadata, XML formatting, generated timestamps, and
library-specific serialization details make raw bytes too unstable.

**C. Define Stage 2 as canonical OOXML comparison.** This compares workbook
content after stripping or normalizing known volatile serialization details.
Cost: runners need a canonicalizer, and the protocol must be precise about what
is ignored.

## Decision

Adopt option C.

The conformance protocol has two comparison stages:

- **Stage 1** compares worksheet names and cell values. It is a bootstrap mode
  and must be reported as Stage 1.
- **Stage 2** compares static output workbooks after canonicalizing their OOXML
  packages. It is the target for full static-output conformance.

Stage 2 canonicalization MUST compare package contents, not zip metadata. It
MUST parse and re-serialize XML deterministically, strip only explicitly listed
volatile metadata, preserve semantically meaningful ordering, and compare binary
parts by exact bytes.

Error fixtures and dynamic fixtures are not workbook-output comparisons. Their
pass/fail rules remain `expected_error` and `expected_dynamic` regardless of
comparison stage.

## Consequences

- Implementations must report which comparison stage their conformance run uses.
- A Stage 1-only run cannot be used to claim Stage 2 conformance.
- The JavaScript runner can remain Stage 1 until a canonicalizer is implemented.
- Future fixtures that assert styles, merges, images, or package structure
  should be marked as requiring Stage 2 once the corpus has a metadata field for
  comparison stage requirements.
- Additional ADRs may refine canonicalization for specific OOXML collections if
  real fixtures expose unstable but semantically irrelevant ordering.

## References

- `conformance/runner-protocol.md`
- ADR-0004: Reference implementation coupling audit
