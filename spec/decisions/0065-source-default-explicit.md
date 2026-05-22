# ADR 0065 — `@source default` explicit reference

- **Status:** accepted
- **Date:** 2026-05-22
- **Spec target:** XTL 0.1
- **Affects:** evaluation.md § "External Data Sources", language.md
  § "Source"

## Context

`evaluation.md` § "External Data Sources" introduces the implicit
`default` source:

> The implicit **default** source — declared via `source_sheet` and
> `source_table` rows in `__config__` — is always named `default`.
> It cannot be redeclared in `__sources__`.

And language.md § "Source":

> Without `@source`, the active source is the default `source_sheet`
> configured in `__config__`.

Both spec the implicit case ("no `@source` → default"). Neither
states whether the explicit form `@source default` is legal.

The reference impl handles `@source default` correctly — it
resolves to the implicit source. But a porter reading the spec
without testing could reasonably:

- Reject `@source default` because "default" is a reserved name
  (the spec says it cannot be declared in `__sources__`; conflating
  "cannot declare" with "cannot reference").
- Accept it (current impl).
- Treat it as a no-op (the same as omitting `@source`).

Without a normative sentence, two ports could diverge.

A second, smaller question: case sensitivity. `@source DEFAULT` vs
`@source default` vs `@source Default`. The directive-name parsing
is case-insensitive per ADR-0029, but the *source-name argument* is
the actual source identifier. Reference impl: source-name match is
case-sensitive. So `@source DEFAULT` errors with
`xl3/source/undeclared`. Not pinned.

## Considered Options

**A. Accept `@source default` as a synonym for the implicit case.**
Adopted. Matches current impl; gives authors an explicit form when
they want to be unambiguous about the source.

**B. Reject `@source default` as a parse error.** Pro: prevents
authors from typing it when they don't need to (the spec already
says "rarely written explicitly"). Con: too strict; valid code in
a port that accepts it would error in another.

**C. Treat as a warning ("you don't need this").** Half-measure.
Rejected.

## Decision

Adopt **A**.

### Normative rules (added to evaluation.md § "External Data Sources")

The explicit form `@source default` is legal. It is equivalent to
omitting the `@source` directive: both make the active source the
implicit `default` source declared via `source_sheet` /
`source_table` in `__config__`.

Authors MAY use `@source default` for clarity (e.g., inside a
multi-source template where most blocks have explicit `@source`
directives and the author wants the default-source blocks to also
read explicitly).

### Source-name case sensitivity

Source-name arguments to directives (`@source`, `@join`) and
inside `Source[Column]` references are **case-sensitive**. The
implicit source is named `default` (lowercase) per ADR-0012;
`@source DEFAULT` raises `xl3/source/undeclared`.

This matches the spec's general posture (column names are case-
sensitive per evaluation.md § "Source Data Model"; the `__config__`
key match is case-insensitive but column / source identifiers are
case-sensitive).

Author convention SHOULD use the same case as the declared
`__sources__` row's `name`. The reference impl does not warn on
case mismatch — the failure mode is the `xl3/source/undeclared`
error.

### Why not reject the explicit form

The spec already accepts `@source SomeSource` for any declared
source. Rejecting `default` would create an asymmetry — "this
directive accepts source names, except the one you most commonly
mean." The explicit form costs nothing to support and makes the
template more readable in multi-source contexts.

## Consequences

- `@source default` is now spec-pinned as legal.
- `@source DEFAULT` (or any non-`default` casing) raises
  `xl3/source/undeclared`. This was current impl behavior; spec
  now says so.
- Conformance fixture additions:
  - `186-source-default-explicit-valid` — `@source default` block
    behaves identically to a block with no `@source`.
  - `187-source-default-case-mismatch-error` — `@source DEFAULT`
    raises `xl3/source/undeclared`.

## References

- ADR-0012 — Multi-source data model (`default` source origin)
- ADR-0014 — `@join` (source-name reference precedent)
- ADR-0029 — Directive composition (function name case-
  insensitivity contrasted with source-name case sensitivity)
- evaluation.md § "External Data Sources"
- language.md § "Source"
