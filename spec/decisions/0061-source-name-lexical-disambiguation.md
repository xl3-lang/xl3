# ADR 0061 — Source name lexical disambiguation

- **Status:** accepted
- **Date:** 2026-05-22
- **Spec target:** XTL 0.1
- **Affects:** grammar.ebnf, evaluation.md § "External Data
  Sources", language.md § "Literals"

## Context

`grammar.ebnf`:

```
source_name = letter , { letter | digit | "_" } ;
```

Source names are letter-led identifiers. The grammar allows ANY
letter-led identifier as a declared source name — including names
that collide with XTL function names (`IF`, `SUM`, `TODAY`, …) and
boolean literals (`TRUE`, `FALSE`).

Concrete collision cases:

1. A `__sources__` row declares a source named `IF`. A cell writes
   `{{ IF[Account] }}` (the source-prefixed bracket reference).
   The grammar's `primary_expr` allows `function_call` or
   `source_bracket_field`. The token sequence `IF` followed by `[`
   is ambiguous to a one-token-lookahead parser without context:
   - `IF(` → function call.
   - `IF[` → source-prefixed bracket.

   Lookahead resolves it (`[` vs `(` after the identifier), but the
   spec doesn't say so.

2. A `__sources__` row declares a source named `TRUE`. A cell
   writes `{{ TRUE }}` — bare identifier. The grammar's `primary_
   expr` includes `literal` (which includes `boolean_literal =
   "TRUE" | "FALSE"`). Without a bracket, `TRUE` is a literal. The
   source name `TRUE` is never reachable as a bare identifier — only
   as `TRUE[Column]`. Author confusion: "I declared source TRUE,
   why doesn't `{{ TRUE }}` use it?"

3. A `__sources__` row declares a source named `xlookup` (case-
   sensitive name on the declaration side, but XTL function lookup
   is case-insensitive per ADR-0029). The cell `{{ xlookup(…) }}`
   resolves to the function. The cell `{{ xlookup[Col] }}` resolves
   to the source. The function call shadowed by `xlookup` as a
   bare identifier is a non-issue because `xlookup` alone is not
   valid syntax.

The reference impl handles all three correctly via lookahead — `[`
after an identifier means source-prefixed bracket; `(` means
function call; nothing means literal / bare-identifier-error. But
the spec does not enumerate the rule.

## Considered Options

**A. Forbid source names that collide with reserved tokens.** Add a
declaration-time check: a `__sources__` row whose name matches a
known function name (case-insensitive) or a boolean literal raises
`xl3/source/reserved-name`. Pro: zero parse ambiguity. Con: a
porter adding a new function (per ADR-0044) would need to also
update the source-name reserved-word list, and existing templates
with legitimate source names like `Date` (a real DATE function per
ADR-0044) could break.

**B. Lookahead disambiguation; document the rule.** Adopted. The
parser distinguishes `Identifier[` (source-prefixed bracket),
`Identifier(` (function call), and bare `Identifier` (literal or
error per ADR-0054). The conflict-prone bare-name case (#2 above)
is impossible: bare identifiers never resolve to source names, only
to literals, group keys, inputs, or config keys.

**C. Status quo (impl handles, spec silent).** The current state.
Risk: a different port could fail to handle the lookahead the same
way.

## Decision

Adopt **B**.

### Normative rules (added to grammar.ebnf § "Notes and
ambiguities")

When a letter-led identifier appears in an expression position,
the parser MUST disambiguate by the token immediately following:

1. `Identifier(` — function call (`function_call`). Function names
   are case-insensitive per ADR-0029. The lookup is against the
   union of XTL core functions (ADR-0024 catalog) plus any
   implementation-registered extensions (per ADR-0021 § "TEXT()
   format extensions" precedent). An identifier that matches no
   registered function falls through to the pre-ADR-0021 behavior
   pinned by ADR-0024 § "What is NOT validated" (the eval layer's
   string fallback). This ADR does NOT introduce a new error code
   for unknown function names; ADR-0024's extension story is
   preserved.
2. `Identifier[` — source-prefixed bracket reference
   (`source_bracket_field`). The identifier is then matched
   against the declared sources (`__sources__` + implicit
   `default`) case-sensitively. If unmatched, raises
   `xl3/source/undeclared`.
3. `Identifier` (no following `(` or `[`) — bare identifier. Per
   ADR-0054:
   - In cell context: raises `xl3/expression/unknown-name` unless
     `Identifier` is a boolean literal (`TRUE` / `FALSE`, case-
     insensitive per `boolean_literal` grammar).
   - In filename / sheet-name pattern context: resolves to group
     key / input / config-author-key per ADR-0054 order.

A source declared with a name that collides with a known function
name (e.g., `__sources__` row `name = IF`) is legal — the parser
distinguishes by trailing token. Author convention SHOULD avoid the
collision for readability, but the spec does not forbid it.

### `boolean_literal` precedence over source name

The bare `TRUE` / `FALSE` token (case-insensitive) is ALWAYS a
boolean literal in expression position, even when a source named
`TRUE` or `FALSE` is declared. The source is only reachable via the
bracket form `TRUE[Column]`. This matches the grammar (literals
appear in `primary_expr` before bracket / source forms in the
disambiguation order).

Authors SHOULD NOT name sources `TRUE`, `FALSE`, or any of the
function names from the ADR-0024 / ADR-0044 catalogs. The spec does
not raise an error, but tooling MAY warn.

### Why not forbid by declaration (option A)

Forbidding name collisions at declaration creates a coupling
between the source-name validator and the function catalog. ADR-
0044 documents the function-batch process; every batch would force
a spec-level update to the source-name reserved-word list. The
lookahead rule is more durable: it works regardless of what
functions exist.

## Consequences

- No new error code. The disambiguation rule is purely a grammar /
  parser clarification.
- grammar.ebnf § "Notes and ambiguities" gains the disambiguation
  rule.
- Conformance fixture additions:
  - `169-source-name-collides-with-function` — declare a source
    `name = IF`; `{{ IF[Col] }}` resolves to the source,
    `{{ IF(1, 2, 3) }}` resolves to the function.
  - `170-bare-true-is-literal-not-source` — declare a source
    `name = TRUE`; `{{ TRUE }}` is the boolean literal,
    `{{ TRUE[Col] }}` is the source reference.
- ADR-0024's extension-pass-through behavior for unknown function
  names is unchanged. Implementations that want stricter
  diagnostics MAY emit a warning on unknown function names per
  evaluation.md § "Errors" (warnings MUST NOT change output
  semantics).

## References

- ADR-0011 — Reserved sheet naming (the `__sheet__` vs `Source`
  lookahead pattern)
- ADR-0012 — Multi-source data model (source name production
  origin)
- ADR-0024 — Function arity (the function catalog this ADR
  decouples source names from)
- ADR-0029 — Function name case-insensitivity
- ADR-0044 — Function batch accepted (the source-name reserved-
  list churn this ADR avoids)
- ADR-0054 — Bare name in cell context
- grammar.ebnf § `source_name`, § "Notes and ambiguities"
