# XTL — Excel Template Language

**Version:** 0.1 (draft)
**Status:** Pre-1.0. Breaking changes possible. See [STABILITY.md](./STABILITY.md).
**License:** [CC-BY-4.0](./LICENSE)

XTL is a declarative language for transforming Excel workbooks using Excel workbooks as templates. Template expressions, directives, group splits, filters, and aggregations live inside the template workbook itself.

Both inputs and outputs are Office Open XML `.xlsx` files, making XTL independent of any single implementation's spreadsheet library.

## Documents

- [Language](./language.md) — template syntax, expressions, functions, directives, and group keys.
- [Evaluation](./evaluation.md) — source data model, reserved sheets (`__config__`, `__inputs__`, `__lists__`), render phases, cell semantics, and errors.
- [Stability](./STABILITY.md) — versioning, conformance, and compatibility policy.
- [License](./LICENSE) — XTL spec license.

## Conformance Precedence

When the spec prose, the conformance corpus, and an implementation disagree:

1. **Spec prose** wins.
2. **Conformance fixtures** win over implementations.
3. **Implementations** are last and MUST be updated to match.

This precedence keeps multiple implementations aligned without making the TypeScript reference implementation the de-facto specification.

## Core 0.1 Features

XTL 0.1 core includes:

- Source column references with bracket syntax: `{{ [Customer] }}`.
- Excel-style functions: `IF`, `IFEMPTY`, `SUM`, `COUNT`, `AVERAGE`, `MIN`, `MAX`, `ROUND`, `ABS`, `TEXT`, `ROW`, and `TODAY`.
- Data directives: `@filter`, `@sort`, `@top`, and `@repeat right`.
- List sheet filters with `_`-prefixed sheets: `@filter [Customer] in _IncludedCustomers`.
- Sheet and file grouping.
- `__config__` metadata, including `source_sheet`, `source_table`, and `output_file_pattern`.
- Single-expression cell type preservation and template-format-based coercion.

## Reference Implementation

The TypeScript reference implementation lives in [`../src/`](../src/). It is useful for validating the draft, but it is not normative. When this spec and the implementation disagree, the implementation is wrong.
