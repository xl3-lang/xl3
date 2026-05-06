# ADR 0008 - Truthiness rules for `IF()` and `@filter`

- **Status:** accepted
- **Date:** 2026-05-07
- **Spec target:** XTL 0.1 draft
- **Affects:** language.md

## Context

`IF(condition, then, else)` is the primary conditional in XTL. `@filter
[field] op value` is the row-level companion. Both reduce to the same
sub-question: given a value or a comparison result, when do we take the
"truthy" branch?

The XTL 0.1 draft does not define this. It only says the second argument
of `IF` is returned "when the condition is true." `@filter` directives
require an operator (per the language grammar), so bare-value filtering
is currently not reachable through the parser, but `IF` accepts any
expression as a condition.

The reference implementation today applies a one-off rule:

```text
condition && condition !== 'false' && condition !== '0'
```

That is: standard JavaScript truthiness, with two extra special cases
that demote the strings `"0"` and `"false"` to falsy. The result is a
behavior that is hard to state, hard to port, and surprising:

| `condition` | Reference impl | Author intent (no spec) |
|---|---|---|
| `false` (boolean) | falsy | falsy |
| `0` (number) | falsy | falsy |
| `1` (number) | truthy | truthy |
| `""` (empty string) | falsy | falsy |
| `"hello"` (string) | truthy | truthy |
| `"0"` (string) | **falsy** (special-cased) | truthy in Excel; ambiguous in XTL |
| `"false"` (string) | **falsy** (special-cased) | truthy in Excel; ambiguous in XTL |
| `"   "` (whitespace) | truthy | falsy if we want `IF([memo], …)` to read as "memo is set" |
| `null` / `undefined` / missing | falsy via `??` upstream | falsy |

ADR-0007 already tightened "empty" to include whitespace-only strings.
Without an explicit truthiness rule, `IF([memo], "had memo", "no memo")`
returns the truthy branch for a whitespace-only Memo cell — directly
contradicting the empty predicate that just landed.

## Considered Options

**A. JavaScript truthiness (status quo of `condition &&`).** Easy to
implement in JS. Cost: portable to other languages only by accident; the
two `"0"` / `"false"` special cases are not portable at all.

**B. Excel-style truthiness:** non-zero numbers truthy, all strings
truthy regardless of content, only the boolean `FALSE` and the number
`0` are falsy. Cost: surprises authors who write `IF([memo], …)`
expecting an emptiness check; conflicts with the ADR-0007 semantics
where `"   "` is empty.

**C. Truthiness rooted in ADR-0007 (recommended).**

- `false` is falsy.
- The number `0` is falsy.
- A value that is empty per ADR-0007 is falsy. (This covers missing
  values, `""`, and whitespace-only strings — the spec value model;
  `null` / `undefined` are host-language artifacts that map onto
  "missing.")
- Any other value is truthy. There is no special case for `"0"` or
  `"false"`.

Cost: rejects the impl's `condition !== '0'` and `condition !== 'false'`
behavior. Authors who depend on stringly-typed flag values today (`"0"`
or `"false"`) must compare explicitly: `IF([flag] = "1", …)`. No fixture
or impl test asserts the special cases, so the break is contained.

**D. Make `IF` require a comparison expression as its condition; bare
values are an error.** Most disciplined. Cost: large ergonomic
regression; common patterns like `IF([active], …)` against a Boolean
column would require `IF([active] = TRUE, …)`. Reject.

## Decision

Adopt option C. A value used as a condition is **truthy** unless it is
one of:

- The Boolean `false`.
- The number `0`.
- A value that is empty per [ADR-0007](./0007-empty-value-definition.md)
  (missing, `""`, or a whitespace-only string).

There is no special-case treatment of the strings `"0"` or `"false"`.
Strings are truthy whenever they have non-whitespace content.

`IF(condition, then, else)` returns `then` when `condition` is truthy,
otherwise `else`. The same rule applies to any future Boolean-valued
context the spec adds.

Comparison expressions (`=`, `!=`, `>`, `<`, `>=`, `<=`) evaluate to a
Boolean and are truthy iff the comparison holds. ADR-0009 defines the
comparison algorithm itself.

## Spec text changes

- `language.md` "Functions / IF" — replace the one-line description with
  the rule above and link the empty-values section.

## Impl changes

- `src/functions.ts` — add an `isTruthy(v)` helper that encodes the
  three falsy cases. `IF(condition, then, else)` becomes a one-liner
  using it.
- `src/template-eval.ts` — the `{{ if … }} … {{ end }}` block path is
  unreferenced by any fixture, test, doc, or example in the repo. The
  Go-template-style `if`/`end` syntax was never spec-blessed and
  duplicates the role of `IF()`. The path is removed in this commit and
  flagged in this ADR's Consequences. The `if` keyword routing in
  `src/normalizer.ts` is also removed since it has no remaining
  consumer.

## Consequences

- A whitespace-only Memo cell now follows ADR-0007: `IF([Memo], "y",
  "n")` returns `"n"`. Previously it returned `"y"`.
- A stringly-typed flag of `"0"` or `"false"` is now truthy.
  Authors who used those literals as falsy must rewrite using an explicit
  comparison: `IF([flag] = "1", …)` or `IF([flag] != "0", …)`. No
  fixture, test, README, or example used the special cases, so the break
  is contained.
- The unreachable `{{ if condition }}…{{ end }}` block syntax is
  removed from the reference implementation. Any future block-style
  conditional belongs in a dedicated ADR; XTL 0.1 has only `IF()`.
- This ADR does not change the comparison algorithm; that is ADR-0009.

## References

- ADR-0007: empty value definition (a value that is empty is falsy under
  this ADR).
- ADR-0009: comparison and string coercion (defines how comparison
  expressions produce Boolean results that flow into truthiness).
- XTL 0.1 draft: `spec/language.md` "Functions / IF" and "Operators".
