# ADR 0025 - Division by zero produces an Excel #DIV/0! error cell

- **Status:** accepted
- **Date:** 2026-05-08
- **Spec target:** XTL 0.1
- **Affects:** language.md, ADR-0009 (non-finite numbers), ADR-0017 (error cells), ADR-0023 (operator coercion)

## Context

ADR-0023 left division-by-zero as an open question. Three options
were on the table:

- **Throw** a hard `xl3/eval/division-by-zero` error.
- **Excel-style #DIV/0!** error cell in the output.
- **Empty** per ADR-0017 symmetry with how source error cells are
  read.

ADR-0023's Excel-default principle is the explicit guidance to use
when XTL is silent or ambiguous on a behavior. Excel's actual
behavior on `=A1/0` is to render the cell as `#DIV/0!`; the
formula does not crash the workbook, and downstream cells that
reference it propagate the error.

The reference impl previously returned `0` for division by zero,
silently masking author bugs.

## Considered Options

**A. Hard error, halt conversion.** Pro: surfaces author bugs
loudly. Con: a single bad row blocks the entire conversion. A
report with 5,000 rows where one row has a zero divisor would
fail to render at all. Excel's behavior is more forgiving.

**B. Excel-style `#DIV/0!` error cell in output.** Pro: matches
Excel exactly; one bad row marks one cell, not the whole render;
authors see the error visibly in the cell. Con: requires the
engine to emit a real OOXML error cell shape; downstream
operations on the error value need defined behavior (Excel
propagates; xl3 does not have formula chains to propagate
through).

**C. Empty cell.** Pro: ADR-0017 symmetry — "error cells in
source read as empty," so producing empty for an error-producing
op feels natural. Con: silently swallows the error; authors don't
see it; harder to debug.

## Decision

Adopt option **B**. Division by zero produces a real Excel
`#DIV/0!` error cell in the output. The reference impl returns a
typed marker (`{ __xl3_error__: '#DIV/0!' }`) from `functions.div`
when the divisor evaluates to zero; the renderer detects the
marker and writes ExcelJS's `{ error: '#DIV/0!' }` cell value.

### Cell value behavior

| Cell type | Output |
|---|---|
| Single-expression numeric cell | Excel error cell `{ error: '#DIV/0!' }` |
| Single-expression text-format cell (`@`) | String `"#DIV/0!"` |
| Mixed-text cell | String `"#DIV/0!"` substituted at the position |
| Inside `&` concatenation | String `"#DIV/0!"` |

`canonicalString` of the error marker returns `"#DIV/0!"` so the
marker also flows through any context that calls
`canonicalString` (concatenation, list-sheet membership, comparison
fall-through).

### What is NOT specified

- **Error propagation.** Excel propagates `#DIV/0!` through formulas:
  `=A1/0 + 5` is `#DIV/0!`. xl3 does NOT chain formulas in output;
  but if a `(1/0) + 5` expression occurs WITHIN a single template
  cell, the inner error marker fails to coerce to a finite number
  in `+`, raising `xl3/eval/operand-coercion` (per ADR-0023's
  arithmetic table — error markers are not in the coercion table).
  This is an asymmetry with Excel; documented and accepted for now.
- **Other Excel error codes** (`#NUM!`, `#VALUE!`, `#REF!`, `#NAME?`).
  XTL 0.1 only emits `#DIV/0!`; other error codes can be added by
  amendment if a future operation needs them.
- **Reading xl3-produced error cells as a source.** ADR-0017 says
  source-side error cells read as empty. This rule applies
  uniformly to error cells regardless of which writer produced
  them; an xl3 output containing `#DIV/0!` cells, when used as a
  source for a second xl3 conversion, has those cells read as
  empty.

### Conformance comparison

`comparable()` in the conformance runner now extracts the `error`
field from error-cell values, so output-side fixtures can pin
`#DIV/0!` exactly. Stage 1 fixtures with expected output containing
an error cell see both sides surface as the error code string
("#DIV/0!"), not as `null`.

This does not change ADR-0017's source-side error-cell-as-empty
behavior — that's a runtime read decision, not a comparison-layer
decision.

## Consequences

- Templates that previously silently rendered `0` for `[a]/[b]`
  with `[b]=0` now show `#DIV/0!`. Behavior change but
  Excel-aligned and visible.
- The new `XtlErrorCell` interface and `DIV_ZERO_ERROR` marker are
  exported from `functions.ts` for reference-impl wiring; ports in
  other languages SHOULD use whatever representation their Excel
  library uses for error cells (openpyxl: an error cell is a
  string-typed value with formula starting with `#`; Apache POI:
  `Cell.CellType.ERROR`).
- A future ADR may extend this scheme to other Excel error codes
  (`#NUM!` for `LN(0)`, etc.) when the operations themselves are
  added.
- `xl3/eval/operand-coercion` raised when an error marker reaches
  arithmetic is a known asymmetry with Excel's error propagation;
  documented and accepted for 0.x.

## References

- ADR-0009 — Non-finite numbers (this ADR replaces the
  "stringify to empty" stance for the specific case of div-by-zero)
- ADR-0017 — Source value model (error cells in source)
- ADR-0023 — Operator coercion + Excel-default principle (this
  ADR resolves the "open question" division-by-zero deferral)
