# ADR 0020 - Deferred: locale-aware collation

- **Status:** accepted
- **Date:** 2026-05-08
- **Spec target:** XTL 0.1 (deferral); locale collation lands no earlier than XTL 1.x
- **Affects:** STABILITY.md "What 1.0 does NOT include"; ADR-0009; future ADR for the actual collation surface

## Context

ADR-0009 specifies that string comparison and `@sort` use **Unicode
code-point order** when the operands fall through to the string
fallback. This is fast, deterministic, and locale-independent — but
it produces ordering that surprises users in many natural languages:

- Korean: code-point order separates jamo from precomposed syllables
  in unexpected ways. Users expect 가나다 order (which Hangul
  precomposed code points happen to mostly preserve, but is not
  the same as code-point sort for mixed strings).
- Japanese: kana ordering is locale-defined (gojuon vs iroha vs
  Unicode). Code-point order matches none of these intuitively.
- Latin scripts with diacritics: `é` sorts after `z` in code-point
  order; users expect it near `e`.
- Locales that fold case: ICU's "es" (Spanish) sorts `ll` after `l`
  but as a digraph; code-point sort does not.

The earlier reference impl had a hardcoded `localeCompare(_, 'ko')`
which ADR-0009 explicitly removed because it was non-portable
(different JS runtimes return different orderings) and
non-implementable in non-JS ports without dragging in ICU.

Hosts that need locale-aware sort today must sort upstream (in the
source workbook or in a pre-processing step) before feeding rows
into the template.

## Considered Options

**A. Ship a `@sort [field] asc locale=ko` directive in 1.0.**
Pro: matches user expectations; uses ICU under the hood. Con:
binds every conforming impl to ICU (or an equivalent), which is a
heavy dependency for ports in languages that don't have it
built-in. Specifying the locale identifier set is its own ADR
(BCP 47? ISO 639? ICU collation IDs?).

**B. Defer locale collation to a future ADR; document the upstream
sort workaround in 1.0.**
Pro: 1.0 stays portable across runtimes without external collation
libraries. Con: locale-sensitive templates need an upstream step.

**C. Add a non-normative `locale=` hint that implementations MAY
honor.**
Pro: incremental. Con: makes output non-portable across impls,
which contradicts the "same template + same data → same output"
contract.

## Decision

Adopt option B. XTL 1.0 keeps Unicode code-point order as the only
normative collation. A future ADR may introduce locale-aware
collation as an opt-in extension; until then, hosts that need it
sort upstream.

If and when a future ADR adds locale collation, it MUST address:

1. The locale identifier syntax (likely BCP 47 — `ko-KR`, `ja-JP`,
   etc.).
2. How impls without ICU fall back (error vs. silent code-point
   fallback).
3. Whether the directive is `@sort [f] asc locale=ko` or a separate
   `@collation` directive.
4. Conformance fixtures with hand-computed expected order under
   ICU's "default" collation for several locales.

## Consequences

- Templates with mixed-script data sort by code points. Authors
  whose users expect locale-aware order must pre-sort or accept
  the visual mismatch.
- The 1.0 portability claim — same template, same data, same output
  on any host — remains intact precisely because no locale
  dependency exists.
- A 1.x release adding opt-in locale collation does not bump the
  spec major version. A template that does not use the opt-in
  directive remains conformant.

## References

- ADR-0009 — Comparison and string coercion (Unicode code-point order)
- `spec/language.md` "Comparison Algorithm"
- `STABILITY.md` "What 1.0 does NOT include"
