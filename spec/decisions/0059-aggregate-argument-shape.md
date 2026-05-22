# ADR 0059 — Aggregate function argument shape

- **Status:** accepted
- **Date:** 2026-05-22
- **Spec target:** XTL 0.1
- **Affects:** language.md § "Aggregates" / "Functions", error
  catalog (ADR-0015)

## Context

`language.md` § "Aggregates" describes `SUM`, `COUNT`, `AVERAGE`,
`MIN`, `MAX`, and `XLOOKUP` with examples that all use the form
`SUM([col])` or `SUM(Source[col])`. The function-table arity row
for these says "column ref" / "0 or 1 args" but the grammar
production for `function_call` is generic:

```
function_call = function_name , "(" , [ argument_list ] , ")" ;
argument_list = value_arg , { "," , value_arg } ;
value_arg     = expression ;
```

The grammar therefore admits `SUM(1 + 2)`, `SUM("hello")`,
`SUM(IF([a], 1, 0))`, `SUM(__config__[k])`, and similar non-column-
ref bodies. The aggregate cannot meaningfully iterate a non-array
expression, but the spec does not say so.

The reference impl's aggregate dispatcher silently falls through:
`SUM(1 + 2)` evaluates as `3` for each iterated row and sums to
`3 * row_count`. Author intent — they wanted a sum over a column —
is silently undefined.

ADR-0038 § "Supported aggregates" pins the aggregate body for
`@subtotal` exclusively (`xl3/subtotal/bad-aggregate`). The non-
`@subtotal` cell-level call surface inherited the same constraint
implicitly but not explicitly.

## Considered Options

**A. Pin: aggregate args MUST be a single bracket-field or
source-prefixed bracket-field reference (or empty for `COUNT()`).**
Adopted. Reject `SUM(literal)`, `SUM(expression)`, `SUM(function(…))`
with a stable code.

**B. Allow expressions; evaluate the expression per row, then
aggregate the result.** This is Excel's array-formula behavior in
spirit. Pro: more expressive. Con: massive new surface (per-row
sub-evaluation, error propagation, type widening), and the
reference impl doesn't do it today — would be a feature add.

**C. Status quo (silent fallthrough).** Worst — silent author bug.

## Decision

Adopt **A**.

### Normative rules (added to language.md § "Aggregates")

The single argument to `SUM`, `AVERAGE` (and its `AVG` alias),
`MIN`, `MAX`, and the 1-arg form of `COUNT` MUST be a column
reference of one of these two shapes:

- `[Column]` — active source's column (bare bracket).
- `Source[Column]` — explicit source-prefixed column.

Any other shape raises `xl3/eval/bad-aggregate-arg`. The diagnostic
substring (stable for fixtures):

> `<FN>` requires a column reference as its argument (`[Column]` or
> `Source[Column]`); got `<offending expression>`.

The same constraint applies to `@subtotal` aggregates per ADR-0038;
the `xl3/subtotal/bad-aggregate` code is preserved for `@subtotal`
context, while the new `xl3/eval/bad-aggregate-arg` code covers
non-`@subtotal` cell-level aggregate calls.

### `COUNT()` is unrestricted

`COUNT()` (zero-arg form, "row count of the active block") is
unchanged. `COUNT([col])` is restricted to the same column-ref
shape.

### `XLOOKUP` is governed by its own ADRs

`XLOOKUP`'s arity (3 or 4) and source-mismatch rules are pinned by
ADR-0013. The `lookup_array` and `return_array` arguments MUST be
`Source[Column]` per `xl3/xlookup/bare-bracket` / `xl3/xlookup/
source-mismatch`. The `lookup_value` (first arg) and the optional
fallback (fourth arg) remain full expressions — that is `XLOOKUP`-
specific (see ADR-0060). This ADR does not change `XLOOKUP`.

### Why not allow `SUM([a] + [b])`

The shape `SUM([a] + [b])` is a real author wish (sum of a
per-row computed column). Excel solves it with helper columns or
array formulas. XTL 0.x picks the smaller, predictable surface:
authors add a helper column upstream in the source workbook, or
compute the per-row value in a non-aggregate cell first. A future
ADR may add per-row computed aggregates if the corpus shows real
demand; until then, reject.

## Consequences

- Templates that wrote `SUM(1)`, `SUM("foo")`, `SUM([a] * 2)`, or
  similar now error at parse time with a precise diagnostic. The
  fix is one upstream helper column or a separate cell expression.
- One new error code added to ADR-0015 catalog and snapshot.
- Conformance fixture additions:
  - `163-aggregate-literal-arg-error` — `{{ SUM(1) }}` raises
    `xl3/eval/bad-aggregate-arg`.
  - `164-aggregate-expression-arg-error` — `{{ SUM([a] + [b]) }}`
    raises the same.
  - `165-count-zero-arg-valid` — `{{ COUNT() }}` returns the row
    count (regression guard).

## References

- ADR-0013 — XLOOKUP (`Source[Column]` requirement for lookup
  arrays)
- ADR-0024 — Function arity (the precedent for argument-shape
  errors)
- ADR-0038 — `@subtotal` aggregate body restrictions
- language.md § "Aggregates" / "Functions"
- evaluation.md § "External Data Sources" (the `Source[Column]`
  shape origin)
