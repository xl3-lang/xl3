# ADR 0034 - Relationship to prior-art template engines

- **Status:** informational
- **Date:** 2026-05-17
- **Spec target:** XTL 0.x (process)
- **Affects:** governance + future-ADR framing

## Context

XTL was not built in a vacuum. Several mature spreadsheet-template
engines predate it — JXLS (Java, ~10 years), xltpl (Python),
jxls-js, openpyxl-templates, and SheetJS-based scaffolds. Each has
absorbed real-world edge cases (image anchoring, conditional
formatting expansion, page-break handling, multi-sheet expansion,
chart range extension) that a new entrant cannot rediscover
quickly without paying the same years of bug-fix tax.

The temptation when designing a new engine is to either:

1. Adopt an existing syntax wholesale ("XTL is JXLS-compatible"),
   inheriting both the experience and the syntax.
2. Treat prior art as a competitor and ignore it.

Both lead to bad outcomes for XTL:

- Adopting prior-art syntax wholesale means making one
  implementation's library behavior the de-facto specification —
  exactly the anti-pattern `PORTERS_GUIDE.md` and ADR-0006's
  conformance precedence are designed to avoid.
- Ignoring prior art means re-discovering the same surprises
  (merge handling, image positioning, conditional-format extents)
  the hard way, while burning author trust on each surprise.

The goal of this ADR is to name the working principle XTL uses to
relate to prior art, so future ADRs can cite it instead of
relitigating the question each time.

## Principle

> **Borrow the experience, not the syntax.**
>
> Prior-art engines' *decisions* (which edge cases need answers,
> what those answers look like in practice) are an asset. Their
> *decision form* (cell-comment directives, library-as-spec,
> impl-specific expression languages) is an anti-pattern relative
> to XTL's thesis.

Three corollaries follow:

### Corollary 1 — Absorb edge cases, not features

When a prior-art engine has solved a behavioral edge case that
XTL is silent on (merged-header reads, image anchor through row
expansion, conditional-format range extension, merged data rows,
named-range preservation, etc.), the right response is:

1. Write an XTL ADR covering the same edge case.
2. Choose XTL's answer — usually similar to prior art's answer,
   sometimes deliberately different.
3. Pin the answer with a conformance fixture.
4. Do **not** copy the prior-art syntax that surfaces the case.

### Corollary 2 — Reimplement features in XTL syntax, not import them

When a prior-art engine has a *feature* XTL lacks (dynamic
subtotals, multi-sheet group expansion, etc.), the right response
is:

1. Decide whether the feature fits XTL's thesis (Excel-native
   syntax, template-as-contract, spec-driven).
2. If yes, design an XTL-native directive (`@subtotal`, `@group`,
   etc.) that uses Excel formula semantics, not the prior-art
   expression language.
3. If no, write a *rejected* ADR documenting why XTL deliberately
   does not adopt the feature, so the question stays settled.

### Corollary 3 — Some prior-art choices are explicitly out of scope

Several JXLS-style design choices are incompatible with XTL's
thesis and should be rejected with named ADRs rather than left
ambiguous:

- **Cell-comment directives** (`jx:each` in cell comments).
  Conflicts with "template is the handover artifact" — directives
  must be visible when opening the file in Excel.
- **Non-Excel expression languages** (JEXL, MVEL, etc.).
  Conflicts with "Excel syntax inside Excel" — authors should not
  need to learn a second mini-language for directive arguments.
- **Library-as-spec** (the Java library's behavior is the
  contract). Conflicts with conformance precedence — the spec
  prose and fixture corpus are the contract, the impl is
  fourth-place.
- **Explicit boundary coordinates** (`lastCell="D2"` in JXLS).
  Conflicts with declarative-first design — boundaries that can
  be inferred should be inferred.
- **Turing-complete escape hatches** (Java custom commands,
  arbitrary host callbacks). Conflicts with portability — escape
  hatches cannot survive a port to another language.

## How this ADR is used

Future ADRs that absorb prior-art lessons SHOULD cite this ADR
in their References, in the form:

> Per ADR-0034 Corollary 1, this ADR adopts the JXLS-tested
> behavior for X without adopting JXLS's syntax for it.

Future ADRs that reject prior-art features SHOULD cite this ADR
in their Context, in the form:

> Per ADR-0034 Corollary 3, cell-comment directives are
> out-of-scope for XTL.

This ADR is **informational** — it does not bind impl behavior
directly. Its job is to make the relationship to prior art
explicit and consistent across future decisions.

## Consequences

- Future "should we adopt X from JXLS?" questions have a default
  answer: absorb the experience, design XTL-native syntax,
  document the decision.
- The conformance corpus grows by absorbing prior-art-tested
  cases, not by mirroring prior-art APIs.
- Rejection ADRs become first-class citizens, not loose notes —
  see ADR-0037 (dynamic image insertion) for the first rejection
  driven by this principle.

## References

- ADR-0006 — Stage 2 OOXML conformance (conformance precedence)
- `PORTERS_GUIDE.md` § "What you MUST match" / "What you MUST NOT copy"
- `GOVERNANCE.md` § "How changes enter the project"
- ADR-0035 (data-row merge cells) — first absorption following this ADR
- ADR-0036 (template feature preservation matrix) — first batch absorption
- ADR-0037 (rejected: dynamic image insertion) — first rejection following this ADR
