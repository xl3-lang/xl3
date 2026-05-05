# XTL Stability Policy

## Current state

XTL is at version **0.1 (draft)**. The spec, conformance corpus, and reference implementation are all pre-1.0. Breaking changes are possible.

## During 0.x

- Spec breaking changes are documented in the affected ADR(s) and reflected in the conformance corpus before the next minor release.
- The reference implementation (`xl3` on npm) follows SemVer for its own API; spec breakages bump the spec minor version.
- Implementations should declare which spec version they target (e.g., `XTL 0.2 partial`, `XTL 0.3 full`).

## At 1.0

- The spec freezes for backwards-compatible evolution only.
- Breaking spec changes require XTL 2.0 with public discussion and a migration guide.
- The reference implementation follows SemVer strictly.

## Core vs. extensions

The spec distinguishes:

- **Core** — language features required for conformance. Summarized in [`README.md`](./README.md) and defined in [`language.md`](./language.md) and [`evaluation.md`](./evaluation.md). Breaking changes here are spec-version events.
- **Extensions** — implementation-specific or domain-specific additions. May vary across implementations. Documented in implementation READMEs, not in the spec.

Implementations MAY add extensions but MUST NOT silently change core semantics.

For example, implementations may support additional `TEXT()` formats beyond the
XTL 0.1 core table. Such formats are extensions: portable templates should not
depend on them, and conformance fixtures do not require identical output for
them.

## Conformance corpus versioning

The conformance corpus version tracks the spec version. A fixture added in spec 0.3 is tagged accordingly; implementations declare which fixtures they pass and, in turn, which spec version they conform to.

## Deprecation policy (post-1.0)

When a feature is to be removed in a future major version:

1. The feature is marked **deprecated** in the spec for at least one minor version before removal.
2. Conformance fixtures using the deprecated feature gain a `deprecated` tag.
3. Implementations are encouraged to emit warnings when the deprecated feature is used.
4. Removal happens in the next major (e.g., deprecated in 1.3 → removed in 2.0).
