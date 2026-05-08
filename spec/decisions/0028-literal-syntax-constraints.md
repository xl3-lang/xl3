# ADR 0028 - Literal syntax constraints + unsupported-syntax detection

- **Status:** accepted
- **Date:** 2026-05-09
- **Spec target:** XTL 0.1
- **Affects:** language.md, grammar.ebnf, ADR-0023

## Context

A spec audit found three under-specified shapes in expression
literals and unary-operator handling:

### #1 — String literal escape

The grammar says "no escape sequences in XTL 0.1" but the impl
silently accepts unbalanced quotes. `"hello"world"` parses as
`hello"world` (the trailing quote is consumed somewhere), and
`"hello \"world\""` outputs literal `hello \"world\"` because
backslashes pass through. There is no normative way to embed a `"`
inside a string literal.

### #2 — Unary operators on non-literal expressions

`-5` works (sign-prefixed number literal). `-[X]`, `+5`, `--5`,
`-(expr)` all silently fall through to bare-string return,
producing `"-[X]"`, `"+5"`, etc. as cell values. Excel handles all
of these (`=-A1`, `=+A1`, `=--A1`); xl3 does not.

### #3 — `+` as a unary prefix

Excel accepts `=+A1` (no-op identity). xl3 silently treats it as
the literal string `+A1`.

## Considered Options

**A. Fix all three properly (parser change).** Add unary `+`/`-` as
proper expression prefixes; add Excel-style `""` escape inside
string literals. Pro: feature-complete. Con: parser change, tricky
to get right, expands surface for 1.0.

**B. Document constraints; throw on detected silent garbage.** Spec
says: number literal `-N` valid; unary on expressions / column refs
NOT supported in 0.x; string `"..."` is matched-pair only with no
escape. Impl detects the unsupported patterns at the bare-string
fallthrough and throws `xl3/eval/unsupported-syntax`. Pro: small
change, fail-loud. Con: authors who want `=-A1` shape have to write
`(0 - [A])`.

**C. Document; do not detect.** Pro: zero impl change. Con: silent
garbage continues; users debug for hours.

## Decision

Adopt **B**.

### String literal constraints

Per `grammar.ebnf` and language.md "Literals":

- A string literal is a `"`-delimited matched pair: `"foo"`.
- No escape sequences (`\"`, `\\`, etc.). Backslashes pass through
  literally.
- If the contents need to include a `"`, use `__config__` or
  `__inputs__` to hold the value (cell content can include any
  character) and reference it via `{{ __config__[key] }}`.
- An unbalanced or duplicated quote (`"a"b"`, `"a` etc.) is
  unsupported. Behavior is implementation-defined — the reference
  impl accepts the first matched pair and treats the remainder as
  literal text appended; future tightening may make it an error.

### Number literal constraints

- A signed number literal `-N` or `N` (where N is a digit sequence,
  optionally with a decimal point) is valid at parse position.
- Unary `+` is NOT supported. `+5` raises
  `xl3/eval/unsupported-syntax`.
- Double negation `--5` is NOT supported. Raises the same error.
- Unary minus on a column reference (`-[X]`), reserved-sheet
  reference (`-__config__[k]`), or sub-expression (`-([X]+1)`) is
  NOT supported. All raise `xl3/eval/unsupported-syntax`.
- Workaround: write `(0 - [X])` or `[X] * -1` for column negation.

### Detection

The reference impl detects `^\+`, `^--`, and `^-\s*[\[(]` patterns
at the bare-string fallthrough in `evalExpression` and throws
`xl3/eval/unsupported-syntax` with the offending expression in the
message. Number literals (`-5`, `42`) are handled by `parseFloat`
before this check, so they don't hit the trap.

### Why not full unary support

Adding unary `+`/`-` as proper expression prefixes is a clean
parser change but expands the 1.0 surface. The 0.x stance is "spec
is locked when fixtures pass; implementations either match or
extend." A future ADR can make unary operators normative; until
then, they're either explicitly unsupported (raise) or don't match
(literal text) — this ADR picks "raise" so silent failures stop.

## Consequences

- Templates that wrote `+5` (where `5` would have been correct) or
  `-[X]` (expecting Excel-style negation) now error at preview /
  convert time. Author-fix is one-line each.
- The 0.x grammar is explicit about no-escape strings and
  literal-only signs, simplifying porter parser implementation.
- One new error code added to the ADR-0015 catalog and snapshot.
- Conformance fixtures pin two cases: 112 (signed literal works),
  113 (unsupported unary on column ref errors).

## References

- ADR-0023 — Operator coercion + Excel-default principle (the
  Excel-default rationale that motivates a future unary upgrade)
- grammar.ebnf — Number literal and string literal productions
- language.md "Literals"
