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

## Scope of the language surface

XTL deliberately ships a smaller function and directive set than
Excel's full catalog. The rule (ADR-0043): a function lives in XTL
only when its evaluation must happen *before* the workbook is
written — for `@filter` / `@sort` / `@group` predicates, source
aggregates, cross-source `XLOOKUP`, filename / sheet patterns, or
`__inputs__` defaulting. Anything Excel can compute at workbook-open
time goes in an output-cell formula and xl3 preserves it verbatim
(ADR-0046).

Background and the rationale for which functions are in / out are
in:
- [ADR-0043 Excel-native preference principle](./decisions/0043-excel-native-preference.md)
- [ADR-0044 Function batch accepted](./decisions/0044-function-batch-accepted.md)
- [ADR-0045 Function batch rejected](./decisions/0045-function-batch-rejected.md)
- [ADR-0046 Cell formula preservation contract](./decisions/0046-cell-formula-preservation.md)
- [ADR-0047 ISBLANK as IFEMPTY alias](./decisions/0047-isblank-as-ifempty-alias.md)

## Conformance Precedence

The **spec prose is the contract**. The **conformance corpus is the
executable check** of the contract. Both must agree; when they
diverge, file a bug.

In strict precedence order:

1. **Spec prose** ([`language.md`](./language.md),
   [`evaluation.md`](./evaluation.md), plus `accepted` /
   `process-normative` ADRs in [`decisions/`](./decisions/)) is the
   normative contract.
2. **Conformance fixtures** ([`../conformance/fixtures/`](../conformance/fixtures/))
   are the executable check. A fixture passing on an impl that
   violates spec prose is a bug — the fixture is under-asserting.
   A fixture failing on an impl that matches spec prose is a bug —
   either in the impl or in the fixture's expected output.
3. **Implementations** are last and MUST be updated to match.

This precedence keeps multiple implementations aligned without
making the TypeScript reference implementation the de-facto
specification.

[`../PORTERS_GUIDE.md`](../PORTERS_GUIDE.md) carries the porter-
facing version of this precedence; the two MUST stay in sync.

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
