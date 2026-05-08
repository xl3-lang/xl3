# ADR 0024 - Function arity is part of the spec

- **Status:** accepted
- **Date:** 2026-05-08
- **Spec target:** XTL 0.1
- **Affects:** language.md, error-codes.ts, normalizer

## Context

Each XTL 0.1 user-facing function has a stated argument shape, but
arity was not normatively enforced. The reference impl had a
function-by-function chain of `if (name === 'IF' && args.length === 3)`
checks; calls with wrong arity fell through to a generic handler that
emitted `NAME arg1 arg2 ...` which the eval layer then either
silently degraded into a literal string or crashed at the first
operand resolution.

Real-world consequence: a template author who writes
`{{ ROUND([Amount]) }}` (forgetting the second arg `places`) gets
either a literal string `"ROUND(...)"` in the output cell or a
generic crash, with no indication that the function call shape is
wrong. xl3-py issue #1 found a similar shape (the `=` operator
falling through silently).

## Considered Options

**A. Validate arity at the point of dispatch (eval time).**
Pro: catches the call exactly when it is invoked. Con: by eval
time the operand sub-expressions are already resolved, so error
location is muddier; the reference impl's existing
function-by-function `if` chain partly does this already and is
clearly insufficient.

**B. Validate arity at normalize time, against a single arity
table.** Pro: single source of truth, error happens early
(template parsing / preview), porters can read the table. Con:
the table needs maintenance when functions are added.

**C. No validation; document arity as guidance only.** Pro:
zero impl change. Con: continues the silent-degrade behavior;
xl3-py-style "spec said one thing, impl did another" findings
will keep surfacing.

## Decision

Adopt option **B**. The reference impl gets a single
`FUNCTION_ARITY` table in the normalizer; calls whose name appears
in the table but whose arg count is outside `[min, max]` raise
`xl3/eval/arity-mismatch` at normalize time. Names not in the
table pass through unchanged, preserving room for impl-specific
extensions.

### XTL 0.1 user-facing function arity table

| Function | Min | Max | Notes |
|---|---|---|---|
| `IF` | 3 | 3 | condition, true-value, false-value |
| `IFEMPTY` | 2 | 2 | value, fallback |
| `IFBLANK` | 2 | 2 | alias for `IFEMPTY` |
| `ROUND` | 2 | 2 | value, places |
| `ABS` | 1 | 1 | value |
| `TEXT` | 2 | 2 | value, format |
| `ROW` | 0 | 0 | no args |
| `TODAY` | 0 | 0 | no args |
| `XLOOKUP` | 3 | 4 | `(value, lookup, return)` or `(value, lookup, return, fallback)` |
| `SUM` | 1 | 1 | column ref |
| `AVERAGE` | 1 | 1 | column ref |
| `AVG` | 1 | 1 | alias for `AVERAGE` |
| `MIN` | 1 | 1 | column ref |
| `MAX` | 1 | 1 | column ref |
| `COUNT` | 0 | 1 | 0 = current block row count; 1 = non-empty values in column |
| `CONCAT` | 1 | ∞ | variadic |

### Error shape

Error message format:

```
<NAME>: expected <expected> argument(s), got <actual>
```

Examples:

- `ROUND: expected 2 arguments, got 1`
- `XLOOKUP: expected 3 or 4 arguments, got 2`
- `IF: expected 3 arguments, got 2`

The function name is uppercase in the error regardless of the
template author's casing (function names are case-insensitive per
language.md).

### What is NOT validated

Function calls whose name is not in `FUNCTION_ARITY` pass through.
Two reasons:

1. Tagged intermediate forms emitted by the normalizer (`sourceCell`,
   `sourceRows`, `index`, `len`, etc.) look like function calls but
   are not user-facing; they have their own validity rules.
2. Implementation-specific function extensions (per ADR-0021's TEXT
   extension and CONCAT) may exist; rejecting unknown names would
   close that door.

The eval layer still degrades to a string fallback for unknown
names — that behavior is unchanged. A future ADR may tighten this
("unknown function name in a function-call shape is an error") if
real templates start hitting it.

## Consequences

- Wrong-arity templates fail loudly at preview/convert time with a
  clear, code-tagged message instead of degrading silently.
- The `FUNCTION_ARITY` table is the single place to update when XTL
  adds a function. Porters consult the table to validate their
  parser without re-reading the normalizer.
- `xl3/eval/arity-mismatch` is added to the ADR-0015 catalog and
  the snapshot test.
- Conformance fixtures pin two of the most-likely-to-hit cases:
  `ROUND` with 1 arg, `XLOOKUP` with 2 args.

## References

- ADR-0013 — XLOOKUP (already specifies 3 or 4 args)
- ADR-0015 — Stable error codes
- ADR-0023 — Operator coercion (similar "fail loudly" principle)
- xl3-py issue #1 — silent fallthroughs are bug-prone
- language.md "Functions"
