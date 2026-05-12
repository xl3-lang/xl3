---
name: Conformance fixture proposal
about: Propose a new conformance fixture for an under-tested spec area
labels: conformance, fixture
---

## What spec behavior needs a fixture

<!-- Section, ADR, or function/directive name. Be specific. -->

## Why the existing corpus is insufficient

<!--
Examples:
- "ADR-0012 has 7 fixtures but none exercise SUM() over a multi-source
  named source after @join."
- "Fixture 069 covers Source[Col], but `Source[Col]` with a column name
  containing spaces isn't tested anywhere."
- "ADR-0029 §X.Y says A, but I can't find a fixture that would fail if
  the impl drops to B."
-->

## Proposed fixture

<!--
Sketch the shape: template cells, data rows, expected output (or
expected_error). One fixture per issue please. Use the structure of an
existing fixture from `conformance/fixtures/NNN-...` as a template.
-->

### Template cells

| Cell | Value |
|---|---|
| A1 | ... |

### Data

| Col | ... |
|---|---|
| ... | ... |

### Expected

<!-- Either an `expected.xlsx` cell map, or an `expected_error` substring. -->

## Spec links

<!-- ADR-XXXX, language.md section, evaluation.md section. -->

## Notes

<!-- Anything else: porter concerns, related fixtures, alternative shapes. -->
