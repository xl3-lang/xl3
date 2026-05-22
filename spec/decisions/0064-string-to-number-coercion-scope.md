# ADR 0064 — String-to-number coercion: scientific-notation scope

- **Status:** accepted
- **Date:** 2026-05-22
- **Spec target:** XTL 0.1
- **Affects:** language.md § "Arithmetic" / "Comparison and String
  Coercion", ADR-0009, ADR-0023, ADR-0028

## Context

The XTL spec has TWO parsing surfaces for numbers:

1. **Literal parsing** (per ADR-0028 / grammar.ebnf
   `number_literal`):

   ```
   number_literal = [ "-" ] , digit_seq , [ "." , digit_seq ] ;
   ```

   No scientific notation, no leading `+`, no Unicode minus, no
   hex / octal / binary.

2. **Coercion from strings during operator evaluation** (ADR-0009 /
   ADR-0023 "trim, then `Number()` without producing `NaN`"):

   ```
   "1,234" → 1234       (thousands-separator accepted)
   "10"    → 10
   "1e5"   → ???         (← unpinned)
   "0x10"  → ???         (← unpinned)
   "Infinity" → ???      (← unpinned)
   ```

The asymmetry between (1) and (2) is intentional — literals are
authored by the template author (tight control) while coerced
strings come from source data (loose, real-world strings). But the
exact shapes the coercion accepts are pinned only for the cases
ADR-0009 mentioned ("1,234" thousands separator, no Unicode minus).
The other shapes inherit `Number()` semantics implicitly:

- `Number("1e5")` → `100000`. So `"1e5" + 1` works as 100001
  today.
- `Number("0x10")` → `16`. So `"0x10" + 1` works as 17 today.
- `Number("Infinity")` → `Infinity`. The "without producing `NaN`"
  rule passes; but `Infinity` is non-finite, which ADR-0023's
  arithmetic table rejects (Date / "anything else" → error).
  Reference impl: errors on coerce.
- `Number("")` → `0`. ADR-0007 makes empty values flow as 0 in
  arithmetic; ADR-0009 makes the empty string explicitly empty
  per the canonical-string-form rule. Cross-checked: consistent.

The grammar bans scientific notation in literals because authors
who write `1e5` in a template usually mean a typo. But source data
from CSV exports, financial systems, or scientific instruments
often contains `"1e5"` legitimately. The current impl-defined "any
`Number()` shape works" behavior is more lenient than the literal
rule, which is the *intended* asymmetry — just unwritten.

## Considered Options

**A. Pin: "trim, then `Number()` without producing `NaN`" accepts
all `Number()`-parseable strings except those producing infinity.**
Adopted. Documents the impl behavior. Authors with `"1e5"` in
source data get it parsed as 100000.

**B. Restrict coercion to the literal shape (decimal, optional sign,
optional fractional part).** Pro: symmetry with literals. Con:
breaks real-world source data with scientific or hex notation.

**C. Restrict to literal shape *plus* thousands separator.** Pro:
matches the "explicit Excel-compatible" shape; thousands separator
is the one extension ADR-0009 already names. Con: still rejects
scientific notation, which is real-world.

## Decision

Adopt **A**.

### Normative rules (added to language.md § "Comparison and String
Coercion" and § "Arithmetic")

The string-to-number coercion rule "trim, then `Number()` without
producing `NaN`" (ADR-0009 / ADR-0023) accepts the following
shapes:

- Decimal integers: `"42"`, `"-42"`.
- Decimal with fractional part: `"3.14"`, `"-3.14"`.
- Thousands-separator decimals (commas): `"1,234"`, `"-1,234.56"`.
- Scientific notation: `"1e5"`, `"-1.5e-3"`, `"1.5E10"`. Both `e`
  and `E` are accepted. (Excel accepts this in numeric coercion;
  ADR-0023's Excel-default principle applies.)

The following shapes are NOT accepted and raise
`xl3/eval/operand-coercion`:

- `"+5"` (leading `+`).
- Unicode minus prefix `"−5"` (U+2212).
- Hex / binary / octal prefixes: `"0x10"`, `"0b101"`, `"0o17"`.
  These shapes are JavaScript `Number()` extensions that Excel
  does NOT accept; per ADR-0023's Excel-default principle they are
  excluded from XTL coercion. Implementations that pass strings
  through to `Number()` (the reference impl included) MUST add an
  explicit pre-check that rejects these prefixes.
- Strings producing `±Infinity`: `"Infinity"`, `"-Infinity"`,
  values that overflow IEEE 754.
- Empty strings (per ADR-0007 — flow as empty, then coerce to 0
  in arithmetic, not as the empty string's `Number("")` value).
- Strings with trailing non-numeric characters: `"5px"`, `"5 abc"`.
- Multi-line strings (the rule trims only leading/trailing
  whitespace; internal LF leaves a multi-line string that
  `Number()` typically rejects, but the rule explicitly rejects).

The result of a successful coercion is the IEEE 754 double value.

### Why accept scientific notation but reject in literals

The asymmetry is by design:

- **Literal `1e5`** is almost always a typo (author meant `1e5` as
  a variable name, or `100000`). The grammar rejection forces the
  author to write `100000` explicitly.
- **Coerced `"1e5"`** comes from data, often a CSV exported from a
  scientific instrument or a financial system that wrote
  exponential notation. Rejecting it would force an upstream
  pre-process step; accepting it matches Excel's own coercion
  (Excel parses `"1e5"` as 100000 in numeric contexts).

This is the ADR-0023 Excel-default principle in action.

### Why reject `Infinity`

ADR-0009 says non-finite numbers cannot arise from spec-conformant
operations and stringify to `""` if they do. A coercion that
*produces* `Infinity` from a source string would violate that
invariant. Reject at the coercion site so the invariant is
maintained downstream.

## Consequences

- Templates with source data containing `"1e5"`, `"0x10"`, etc.
  now have spec-defined behavior. Reference impl already does this
  via `Number()`; the spec catches up.
- The `xl3/eval/operand-coercion` error message now lists the
  specific reason (e.g., "produced Infinity" vs "leading `+` not
  allowed") for clearer author diagnostics.
- Conformance fixture additions:
  - `180-coerce-scientific-notation` — `"1e5" + 1` evaluates to
    100001.
  - `181-coerce-hex-prefix-rejected` — `"0x10" + 1` raises
    `xl3/eval/operand-coercion` (Excel does not accept hex
    prefixes).
  - `182-coerce-infinity-rejected` — `"Infinity" + 1` raises
    `xl3/eval/operand-coercion`.
  - `183-coerce-leading-plus-rejected` — `"+5" + 1` raises
    `xl3/eval/operand-coercion`.
  - `184-coerce-trailing-text-rejected` — `"5px" + 1` raises
    `xl3/eval/operand-coercion`.
- No new error code.

## References

- ADR-0009 — Comparison and string coercion (the "trim, then
  Number()" rule this ADR refines)
- ADR-0023 — Operator coercion + Excel-default principle (the
  Excel-default justification for scientific notation acceptance)
- ADR-0028 — Literal syntax constraints (the asymmetric rule this
  ADR documents)
- language.md § "Arithmetic" / "Comparison and String Coercion"
