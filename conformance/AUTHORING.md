# Authoring Conformance Fixtures

The corpus in this directory becomes the executable definition of XTL. Fixtures encoded here outlive any single implementation. Authoring them well is more important than authoring many.

## The "JS impl as ground truth" anti-pattern

The seductive shortcut is:

1. Run the JS reference implementation
2. Save its output as `expected.xlsx`
3. Commit and call it canonical

This makes the JS implementation the de-facto specification. When a Python or Go port disagrees, who's right? Whoever runs first. The spec becomes "what the JS impl does," and standardization is dead.

**Conformance must be authored from the spec, not from the implementation.**

## Authoring procedure

### For simple fixtures

1. Read the relevant section of [`spec/`](../spec/).
2. Write `template.xlsx` and `data.xlsx` by hand in Excel (or a spreadsheet editor).
3. Compute the expected output **by hand** — open Excel, open a calculator, work cell by cell. Save as `expected.xlsx`.
4. Run the reference implementation. If it disagrees with your hand-computed expected, do **not** change the expected — open an issue: either the spec is wrong, the impl is wrong, or your hand computation is wrong.

### For complex fixtures

When hand-computation is impractical (e.g., 200-row sums, multi-sheet groupings):

1. Author template and data following the spec.
2. Compute expected via two independent paths (e.g., Excel formulas + a separate script). They must agree.
3. Run reference impl; if it agrees with both independent paths, save the impl's output as expected.
4. Document in `meta.yaml`: `verified_by: [excel-formulas, manual-script]`.

### What `meta.yaml` should contain

```yaml
description: "Basic per-row substitution with [field] syntax"
spec_section: "Cell-level variables"
spec_version: 0.1
tags: [substitution, basic]
verified_by: [hand]            # or [excel-formulas, manual-script], etc.
```

## Hard rules

- **Expected outputs are authored, not generated.** If you can't hand-verify, you must independently verify. Treat `expected.xlsx` as part of the spec, not as test output.
- **Each fixture tests one concept.** Mixing repeat + filter + aggregation in one fixture makes failures hard to diagnose. Compose minimal fixtures.
- **Fixture file sizes should be tiny.** If a fixture needs 1000 rows of data, the test concept is wrong — generate small data that exercises the same property.
- **No PII or proprietary data.** Fixtures are MIT-licensed and public. Use synthetic data only.
- **Templates must be human-readable.** Avoid binary-only Excel features (custom XML, macros) in fixtures unless explicitly testing them.

## When the spec and a fixture disagree

The spec wins. Update the fixture.

## When a fixture and an implementation disagree

The fixture wins. Update the implementation.

## When you discover an under-specified case while authoring

Stop. Open an issue and update the spec first. Do not commit a fixture that depends on under-specified behavior — it freezes the under-specification into "what the corpus does," which the spec then has to match retroactively.
