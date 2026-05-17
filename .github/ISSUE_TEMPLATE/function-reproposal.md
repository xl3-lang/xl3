---
name: Function re-proposal
about: Propose adding (or re-adding) a function to the XTL function table — gated by ADR-0043
title: 'Function: <NAME>'
labels: ['function-reproposal', 'needs-adr']
---

<!--
Per ADR-0043 (Excel-native preference principle), XTL only adds a
function when its evaluation must happen BEFORE the workbook is
written. "I would like it" or "Excel has it" is not enough — there
has to be a render-time-critical use case the Excel-formula path
cannot reach.

ADR-0045 lists the functions already rejected once. Re-proposing
any of them requires demonstrating such a case.
-->

## Which function

`FUNCTION_NAME(args...)`

Excel-native equivalent (if any): `=EQUIV(...)`

## Render-time-critical use case

Which of the five ADR-0043 "before-rendering" categories does this
function satisfy?  (Tick at least one — the proposal is rejected
otherwise.)

- [ ] **Directive predicate** — used in `@filter`, `@sort`, `@top`,
      `@group`, or `@subtotal`.
- [ ] **Source aggregation** — operates over rows of a source.
- [ ] **Render-time scalar feeding XTL** — used in
      `output_file_pattern`, `__sheet_name_pattern__`,
      `__inputs__` defaulting, or `__config__` value composition.
- [ ] **Cross-source** — reads or writes across multiple
      `__sources__` declarations.
- [ ] **Context-dependent** — value depends on render state
      (`ROW()`, `TODAY()`, active source).

## Concrete template + data showing the gap

Provide a small (≤30 lines) template + source-data sketch where the
Excel-formula path *does not work*. Example shapes:

```text
# template.xlsx
__config__:
  source_table = 1
  output_file_pattern = {{ FUNCTION_NAME(...) }}_report.xlsx
Report:
  A1: {{ [Column] }}
  A2: {{ @filter FUNCTION_NAME([X]) > 0 }}
  ...

# raw.xlsx
Customer | Amount | ...

# What I want to happen, but can't because Excel formula can't reach this position:
...
```

## What I tried as a workaround

- [ ] Host-side pre-processing in `__inputs__`
- [ ] Excel formula in an output cell (didn't work because …)
- [ ] Author-side normalization in the source workbook
- [ ] Other

## Anything else
