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

## Amendment (2026-05-08): canonicalizer scope and gaps

The reference canonicalizer (`canonicalizeXlsx` /  `canonicalizeXml`)
currently implements rules 1-8 from
[`conformance/runner-protocol.md`](../../conformance/runner-protocol.md#stage-2-output-comparison)
and passes the existing Stage 2 fixtures (024–027). Three known gaps
remain that future cross-writer fixtures may expose:

1. **Equivalent attribute defaults.** OOXML defines defaults for many
   boolean attributes (e.g., `applyFont="0"`, `customHeight="0"`).
   Different writers may serialize the default form, omit the
   attribute entirely, or write the explicit value. The current
   canonicalizer does not normalize defaults beyond the explicit
   page-setup list (rule 5). Cross-writer drift here is treated as
   a difference today.
2. **Color hex case.** `<color rgb="FF000000"/>` and `rgb="ff000000"`
   refer to the same color; OOXML does not mandate case. The
   canonicalizer compares them as strings.
3. **Namespace prefix bindings.** Distinct prefixes bound to the
   same namespace URI are semantically equivalent but compare as
   different strings.

These gaps are intentionally left as "treated as differences" until a
real fixture surfaces a non-volatile case. When that happens, expand
the canonicalizer + the runner protocol's rule list together; do not
silently relax rules in implementations.

Fixture 093 ("synthetic cross-writer Stage 2") exercises rules 1 and
3 by perturbing the engine's own output (attribute order, quote
style, zip entry order) and asserting the canonicalizer normalizes
the difference. This is not a substitute for a Microsoft Excel save
— a real third-party writer produces the gap items above which
this synthetic perturbation does not generate. See
`conformance/fixtures/093-…/README.md` for the upgrade workflow.

The canonicalizer is **not** a general-purpose XML C14N tool: it does
not perform DTD/entity resolution, normalize element ordering for
collections beyond those explicitly noted in the runner protocol, or
rewrite namespaces semantically. Implementations targeting Stage 2
SHOULD reuse the rule list verbatim rather than build a domain-
agnostic canonicalizer.

## References

- `conformance/runner-protocol.md`
- ADR-0004: Reference implementation coupling audit
