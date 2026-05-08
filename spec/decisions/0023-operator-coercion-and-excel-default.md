# ADR 0023 - Operator coercion + Excel-as-default principle

- **Status:** accepted
- **Date:** 2026-05-08
- **Spec target:** XTL 0.1
- **Affects:** language.md, ADR-0009, ADR-0017, error-codes.ts

## Context

Two distinct gaps surfaced during a spec audit:

1. **Mixed-type operator behavior is unspecified.** ADR-0009 covers
   the comparison operators in detail, but the arithmetic operators
   (`+`, `-`, `*`, `/`) and the concatenation operator (`&`) have no
   normative table for what happens when operands are mixed types
   (string + number, Date + number, Boolean + string, etc.). The
   reference impl silently coerced via `toNumber()` which returns 0
   for non-numeric strings, masking author bugs.

2. **No general principle for ambiguity resolution.** When the spec
   is silent on a behavior, every porter has to infer or guess.
   Without a principle, the inferences accumulate as silent
   divergence.

This ADR resolves both. It declares Excel as the default reference
when XTL is ambiguous, then applies that principle to operator
coercion.

## Considered Options — operator coercion

**A. Coerce silently, defaulting to 0 / empty.**
Reference impl behavior pre-ADR. Pro: never errors mid-render. Con:
hides author bugs. `[textcolumn] + [number]` silently produces
`number` because text coerces to 0.

**B. Type-strict, throw on any mismatch.**
Pro: catches bugs early. Con: very strict — `"10" + 5` is a common
shape that Excel handles fine.

**C. Excel-aligned: coerce numeric-like strings, error on
non-numeric.** Pro: matches author mental model from Excel. Con:
needs explicit table.

## Considered Options — ambiguity principle

**P-A. Spell out every behavior.** Pro: complete. Con: every porter
needs every detail; spec gets very long.

**P-B. Adopt Excel as the default reference.** Pro: most authors come
from Excel, mental model is familiar. Con: Excel's behavior itself
is sometimes weird (1900 leap year bug, locale-specific format
strings); we still need explicit ADRs where Excel diverges from
what XTL wants (e.g., XTL's UTC date discipline differs from
Excel's locale-naive defaults).

**P-C. Adopt JS as the default reference.** Pro: matches reference
impl native behavior. Con: porters in non-JS languages would have
to re-implement JS quirks (`"10" + 5 === "105"`); Excel-shaped
templates would behave surprisingly.

## Decision

Adopt option **C** for operator coercion and option **P-B** for
ambiguity resolution.

### Excel-as-default principle (normative)

Where the XTL 0.1 spec is silent or ambiguous on a behavior,
implementations SHOULD adopt Excel's behavior. Where Excel's
behavior is itself locale-, version-, or platform-dependent (locale
collation, 1904 date system, dynamic-array spill semantics, etc.),
the deferring ADRs apply (ADR-0006/0017/0019/0020/0022). When in
doubt, file an issue rather than diverge silently.

This principle does NOT override existing ADRs. The XTL UTC date
discipline (ADR-0017) is the spec's chosen behavior even though
Excel itself defaults to local serials; the principle resolves
ambiguity, not contradiction.

### Operator coercion table

#### Arithmetic: `+`, `-`, `*`, `/`

Both operands MUST coerce to a finite number. Coercion rules:

| Operand type | Coerced value |
|---|---|
| Number (finite) | itself |
| Boolean | 1 (TRUE) or 0 (FALSE) |
| Empty (per ADR-0007) | 0 |
| String that parses as a finite number | parsed number |
| String that does not parse as a number | error |
| Date | error (no Excel-serial conversion in xl3) |
| Anything else | error |

Coercion failure raises `xl3/eval/operand-coercion` with the offending
operator and operand surface form in the message.

The string parsing rule matches ADR-0009's "trim, then `Number()`
without producing `NaN`" — comma is treated as a thousands separator
(`"1,234"` → 1234), no scientific notation in literals, no leading
`+`. The Unicode minus U+2212 is not parsed as a sign (per ADR-0009
amendment).

Examples:

| Expression | Result |
|---|---|
| `1 + 2` | 3 |
| `"10" + 5` | 15 |
| `"1,234" + 1` | 1235 |
| `TRUE + 1` | 2 |
| `[empty] + 5` | 5 |
| `"abc" + 5` | error `xl3/eval/operand-coercion` |
| `[date] + 1` | error `xl3/eval/operand-coercion` |

#### Concatenation: `&`

Always succeeds. Each operand stringifies via canonical string form
per ADR-0009/0017. The result is always a string. No type errors.

#### Comparison: `=`, `!=`, `>`, `<`, `>=`, `<=`

Defined by ADR-0009's comparison algorithm. Mixed types fall through
to the canonical-string-form code-point comparison. No coercion
errors.

### Open question — division by zero

Division by zero deliberately remains undecided in this ADR. Three
options under consideration:

- **Throw.** A new `xl3/eval/division-by-zero` error halts conversion.
  Aligns with strict-error principle.
- **Excel-style error sentinel.** Render the cell as a `#DIV/0!`
  error cell (per ExcelJS's `{ error: '#DIV/0!' }` shape). Aligns
  with Excel-default principle and keeps non-DIV0 cells from being
  blocked by one bad row.
- **Empty.** Current reference impl returns 0; per ADR-0017, error
  cells in source read as empty, so producing empty for DIV0 in
  output is symmetric.

A follow-up ADR will pick one. Until then the reference impl
preserves the pre-ADR behavior (returns 0) so 0.1.x users see no
new failures, but the behavior is not normatively pinned.

## Consequences

- Templates that previously silently produced 0 from `"abc" + 5` now
  error with a clear code. This is technically a behavior change but
  fixes a class of silent author bugs.
- Porters get an explicit table for the arithmetic operators rather
  than reading the reference impl.
- The Excel-default principle gives porters a fallback heuristic
  for any unspecified behavior they encounter. ADR-0022 already
  catalogs the version-axis ambiguities; this ADR raises the
  default beyond that.
- Empty-as-zero coercion may surprise users whose data has empty
  cells (`[a] + [b]` with `[b]` empty produces `[a]`). This is
  Excel-compatible and matches author intuition; documented.
- `xl3/eval/operand-coercion` is added to the ADR-0015 catalog and
  the snapshot test.

## References

- ADR-0009 — Comparison operators (already specifies fall-through)
- ADR-0015 — Stable error codes
- ADR-0017 — Source value model
- ADR-0021 — Implementation-defined boundaries
- ADR-0022 — Excel version compatibility
- language.md "Operators"
