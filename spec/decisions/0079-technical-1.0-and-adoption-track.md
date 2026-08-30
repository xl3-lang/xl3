# ADR 0079 - Separate the 1.0 technical cut from the 1.x adoption track

- **Status:** accepted (release process)
- **Date:** 2026-08-30
- **Spec target:** XTL 1.0 and the xl3 1.x release line
- **Affects:** `ROADMAP.md` (G13, G14, G15, G18, G24),
  `GOVERNANCE.md`, `spec/STABILITY.md`, and the internal 1.0 blueprint

## Context

The original 1.0 roadmap mixed two different kinds of evidence:

1. evidence that the language and reference implementation are stable enough
   to make a compatibility promise; and
2. evidence that an ecosystem has already formed around that promise.

G13 (a current second-language conformance report), G14 (an externally
authored ADR), G15 (a public production reference), and G18 (that reference in
the README) are valuable adoption signals. They are not, however, properties
the maintainer can complete by making the implementation safer. Keeping them
as release blockers made a technical 1.0 depend on unrelated external timing
and encouraged postponing the compatibility promise until after adoption.

That order is now counterproductive. A stable 1.0 contract is itself what
allows ports and production users to adopt without tracking 0.x churn.

The existing G24 wording also contradicted its status: it said the 90-day
window began after the final preceding gate closed while reporting a
2026-06-23 start even though external gates remained open. In addition, the
last implementation gate, G5, did not actually close until 2026-08-16. A
stability window intended to exercise the completed implementation cannot
predate that completion.

## Decision

### 1.0 is a technical stability release

The 1.0 cut is blocked by the executable contract, reference-implementation
correctness, documented support and limits, release process, and a real
stability window. It is not blocked by the rate at which unrelated people or
organizations adopt the project.

G13, G14, G15, and G18 move from the 1.0 blocking table to a public **1.x
adoption track**. Their IDs and pass criteria remain intact so historical
references and progress remain auditable. Closing them is a 1.x project
health objective and does not determine whether 1.0 may be cut.

G16 remains closed by ADR-0077's explicit single-maintainer fallback. Moving
G14 does not imply that the governance risk disappeared; it means the risk is
disclosed and monitored rather than delegated to the release clock.

### G24 measures the completed technical surface

G24 becomes the **technical stability window**. Its 90-day clock starts on
the later of:

- the date the final blocking technical/process gate closes; and
- the date of the last breaking spec, public API, or error-code change.

Adoption-track progress does not start or reset this clock. Additive API and
error-code changes remain non-breaking under the existing ROADMAP definition,
but every such change must still be logged in `spec/STABILITY.md` and pass the
full release gates.

G5 was the last blocking technical gate to close, on 2026-08-16. Therefore the
current G24 window begins on **2026-08-16** and completes on **2026-11-14** if
there is no intervening breaking change. This deliberately replaces the old
2026-06-23 / 2026-09-21 calculation: the new date gives the completed CF/DV
range-extension and outline-preservation implementation a full soak before
1.0.

### Release cut

After G24 closes, the maintainer may cut 1.0 only from a commit on which all
repository quality gates pass and there is no known critical data-loss or
security issue. A newly discovered critical issue blocks the cut even if the
calendar window has elapsed; fixing it follows the existing breaking-change
and RC-soak rules.

## Consequences

- 1.0 has no open adoption-dependent blocker.
- The earliest current 1.0 date moves to 2026-11-14, not because adoption is
  missing, but because the completed technical surface gets a genuine 90-day
  stability period.
- G13/G14/G15/G18 stay visible, measurable, and actively pursued during 1.x.
- Project users can evaluate two claims separately: "the compatibility
  contract is stable" and "the ecosystem is mature." 1.0 asserts the former,
  not the latter.
- Documentation must call out the single-maintainer and limited-public-
  production evidence honestly; the version number must not be used to imply
  those risks are solved.

