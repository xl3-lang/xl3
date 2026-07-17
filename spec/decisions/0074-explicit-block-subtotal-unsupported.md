# ADR 0074 — group + subtotal is unsupported in explicit `@block` mode (amends ADR-0038)

- **Status:** accepted
- **Date:** 2026-07-17
- **Spec target:** XTL 0.1
- **Affects:** language.md (§ "Group + Subtotal", § "Data Blocks"); ADR-0038 (group + subtotal); ADR-0068 / ADR-0069 (explicit `@block` mode); impl (`parser.ts`); error-codes catalog (`error-codes.ts`, `types.ts`); conformance fixture
- **Amends:** ADR-0038
- **Issue:** #69

## Context

The group + subtotal feature (ADR-0038: `@group` + `@subtotal`) is wired
only into **implicit** single-block detection. `src/parser.ts` records
`subtotalRowOffsets` exclusively in the implicit-path branch; the
**explicit-`@block`** builder (ADR-0068) constructs its blocks separately
and never populates that field. The renderer's grouped path emits subtotal
rows only from `block.subtotalRowOffsets`.

Consequently a sheet that mixes an explicit `@block` declaration with
`@group` / `@subtotal` rendered **with the subtotal band silently dropped**
— no error, no subtotal rows, plausible-looking output. This is the same
class of silent failure ADR-0073 (#66) removed for the implicit path, and
was found during the #68 review.

## Considered Options

**A. Reject group + subtotal in explicit mode with a clear error
(chosen).** Turns the silent drop into a loud, actionable parse-time error.
Small, spec-conformant with the 0.x scope-discipline stance (many
compositions are intentionally deferred), and consistent with ADR-0073's
"silent → error" principle.

**B. Wire the feature into the explicit-`@block` builder.** Medium-sized
change (`@group` detection + `subtotalRowOffsets` computation per explicit
block, plus renderer interaction with multi-block geometry). Deferred:
explicit `@block` + group/subtotal is not a demonstrated need, and the
combined geometry (multiple blocks each with their own group boundaries)
warrants its own design.

**C. Leave it silent.** Rejected — silent wrong output is the worst
outcome for a template author (the ADR-0073 lesson).

## Decision

Adopt **A**. On a sheet that uses one or more explicit `@block`
directives, encountering a `@group` directive or any `@subtotal` cell
raises **`xl3/subtotal/explicit-block-unsupported`** at parse time, naming
which construct triggered it.

Group + subtotal remains fully supported in **implicit** block mode (a
sheet with no `@block` directive). Authors who need group + subtotal use
implicit detection; authors who need explicit multi-block layout do not
combine it with group + subtotal in XTL 0.x.

## Consequences

- **Impl:** `parser.ts` tracks a sheet-level `@subtotal` flag and, when
  explicit mode is active, throws before building explicit blocks.
- **Catalog:** additive — one new error code
  (`xl3/subtotal/explicit-block-unsupported`), none removed or renamed.
  Backwards-compatible; does not reset the G3 gate.
- **Behavior compatibility:** no template that renders correctly today
  changes. The only affected templates produced spec-unsupported output
  (a silently dropped subtotal band); they now error.
- **Conformance:** `161-explicit-block-subtotal-unsupported` — a sheet with
  `@block` + `@subtotal` raises `xl3/subtotal/explicit-block-unsupported`.
- **Not committed:** this ADR does not preclude a future ADR adding real
  explicit-block group/subtotal support (Option B); it makes the current
  gap explicit and safe until then.

## References

- ADR-0038 — `@group` + `@subtotal` directives
- ADR-0068 — explicit `@block` rectangles
- ADR-0069 — per-block directive scoping
- ADR-0073 — `@subtotal` mixed-row / silent-failure principle
- ADR-0015 — Stable error codes
- Issue #69
