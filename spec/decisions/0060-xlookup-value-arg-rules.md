# ADR 0060 — `XLOOKUP` value-argument cross-source rules

- **Status:** accepted
- **Date:** 2026-05-22
- **Spec target:** XTL 0.1
- **Affects:** language.md § "XLOOKUP", ADR-0013

## Context

ADR-0013 and language.md § "XLOOKUP" pin the constraints on the
*array* arguments:

- `lookup_array` and `return_array` MUST be source-prefixed
  bracket references (`Source[Column]`), not bare brackets.
- `lookup_array` and `return_array` MUST reference the **same**
  source.
- `xl3/xlookup/bare-bracket` covers `lookup_array` /
  `return_array` being a bare `[Column]`.
- `xl3/xlookup/source-mismatch` covers the cross-source array case.

The constraints on the `lookup_value` (first arg) and the optional
4th-arg fallback are NOT pinned. Concrete shapes whose semantics
are silent in the spec:

1. `XLOOKUP([Account], Customers[Account], Customers[Name])` —
   `lookup_value` is a bare bracket against the active source.
   Reference impl: works (per-row evaluation).
2. `XLOOKUP(Customers[Account], Customers[Account], Customers[Name])` —
   `lookup_value` is a `Source[Column]` of the **same** source as
   the arrays. Semantically degenerate (always matches), but legal?
3. `XLOOKUP(Renewals[Account], Customers[Account], Customers[Name])` —
   `lookup_value` is a `Source[Column]` of a **different** source
   than the arrays. Cross-source lookup-value position. Reference
   impl resolves this to the *current row of the source named by
   the lookup_value* — which only works inside a `@source Renewals`
   block. Outside such a block, it errors with
   `xl3/source/row-cross-block`.
4. `XLOOKUP("FIXED-K", Customers[Account], Customers[Name])` —
   `lookup_value` is a literal string. Works.
5. `XLOOKUP([a], Customers[Account], Customers[Name], Other[Default])` —
   fallback (4th arg) is a `Source[Column]` of a different source.
   Reference impl resolves it per the active-source rule (same as
   `lookup_value`): if `Other` is the active source of the
   surrounding block, OK; if not, `xl3/source/row-cross-block`.
   The pattern is only "real" when the author either (a) places
   the XLOOKUP inside an `@source Other` block where Other is
   active, or (b) uses a literal / scalar fallback rather than a
   cross-source row-level reference.

The asymmetry between the *array* arguments (cross-source forbidden,
bare-bracket forbidden) and the *value* arguments (any expression
goes) is current impl behavior but unwritten.

## Considered Options

**A. Pin `lookup_value` and fallback as full expressions; existing
`xl3/source/row-cross-block` covers misuse.** Adopted. Matches
current impl; reuses the existing cross-block error code for the
cross-source-without-active-block case.

**B. Restrict `lookup_value` and fallback to literals and active-
source bare brackets.** Pro: simpler mental model. Con: too
restrictive — case 5 above (cross-source fallback) is a real
pattern (e.g., fall back to a default-table value when the primary
lookup misses).

**C. Allow only bare-bracket lookup_value.** Pro: forces the
"per-row" reading. Con: rejects literal-key lookups (case 4), which
are a real pattern.

## Decision

Adopt **A**.

### Normative rules (added to language.md § "XLOOKUP")

The `lookup_value` (first arg) and the optional `fallback` (fourth
arg) of `XLOOKUP` are **full expressions** per the XTL expression
grammar. Permitted shapes include:

- Literals — `"Acme"`, `42`, `TRUE`.
- Bare bracket — `[Column]` resolves to the active source's row's
  column.
- Source-prefixed bracket — `Source[Column]` follows the existing
  active-source rule (ADR-0012):
  - When `Source` is the active source of the surrounding block, it
    resolves to the current row.
  - When `Source` is NOT the active source, the reference raises
    `xl3/source/row-cross-block`.
- Function calls — `IF(...)`, `TEXT(...)`, `__config__[k]`, etc.
- Operator expressions — `[a] & [b]`, `[date] + 1` (subject to
  ADR-0023's operator-coercion rules).

There is NO `lookup_value`-vs-`lookup_array` source coupling. The
arrays MUST share a source (per ADR-0013); the `lookup_value` MAY
come from any source where it has an active row, or be a literal /
computed expression.

The same expression rules apply to the optional fallback (4th arg).

### Fallback evaluation order (lazy)

The fallback (4th arg) is evaluated **lazily** — only when the
lookup returns no match. A side-effect-bearing fallback like
`{{ XLOOKUP([k], A[k], A[v], 1/0) }}` does NOT raise `#DIV/0!`
when the lookup matches; the fallback expression is never
evaluated.

This matches Excel's `XLOOKUP` and `IFERROR` short-circuit
semantics. A future ADR may pin lazy evaluation for `IF` / `IFS` /
`IFERROR` explicitly; until then the lazy rule is XLOOKUP-specific
per this ADR.

### Why not couple value-arg source to array source

Excel's `XLOOKUP` allows any value as the lookup key. The Korean
operations templates use cross-table lookups specifically because
the *value* comes from one table and the *result* from another
(`[CustomerCode]` from the iterating Orders block, looked up in
Customers). Coupling the value source to the array source would
break this canonical pattern.

The array-source constraint exists for a different reason:
`lookup_array` and `return_array` must be aligned row-by-row,
which is only well-defined when they come from the same source's
rows.

### Diagnostic refinement

When `lookup_value` is `Source[Column]` and `Source` is not the
active block's source, the existing `xl3/source/row-cross-block`
error fires with the existing message ("row-level reference to a
non-active source's column"). Message context now mentions
`XLOOKUP` argument position; the code is unchanged.

## Consequences

- No new error code.
- Spec gains clarity on the value-arg vs array-arg asymmetry.
- Conformance fixture additions:
  - `166-xlookup-cross-source-value-arg-valid` — XLOOKUP whose
    lookup_value is `Renewals[Account]` inside `@source Renewals`
    and whose arrays are `Customers[…]`; resolves correctly per
    row.
  - `167-xlookup-value-arg-outside-active-source-error` — same
    XLOOKUP outside `@source Renewals` raises `xl3/source/row-
    cross-block`.
  - `168-xlookup-fallback-cross-source-valid` — fallback is
    `Defaults[Value]`, evaluated in the active source's row context;
    correctly resolves when Defaults is also active or when the
    fallback is a literal.

## References

- ADR-0012 — Multi-source data model (`Source[Column]` semantics
  + active-source rule)
- ADR-0013 — XLOOKUP (array-arg constraints)
- ADR-0023 — Operator coercion + Excel-default principle
- ADR-0029 — Directive composition and source edges
- ADR-0059 — Aggregate function argument shape (companion
  argument-shape ADR)
- language.md § "XLOOKUP"
