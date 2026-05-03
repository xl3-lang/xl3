# Contributing to xl3

xl3 is the reference TypeScript implementation of the [XTL spec](./spec/). This file covers contribution paths for both the implementation and the spec.

During the 0.x phase, the project is maintained by a single author. Contributions are welcome but the bar for spec changes is high — XTL aims to be a stable, language-neutral standard.

## Quick start

```bash
git clone https://github.com/jinyoung4478/xl3.git
cd xl3
npm install
npm test
```

## Three kinds of contributions

### 1. Implementation bugs (this repo, `src/`)

Reference-impl bugs that disagree with the spec are always welcome. Steps:

1. Open an issue with a minimal reproduction (template.xlsx + data.xlsx + observed vs expected output).
2. If you have a fix, send a PR with a regression test in `src/__tests__/`.

If the bug is "impl matches the spec but the spec is wrong," see (3).

### 2. Spec questions and clarifications (`spec/`)

The spec is normative. If you find under-specified behavior:

1. Open an issue tagged `spec`.
2. If the answer is small (typo, clarification), a PR is welcome.
3. If the answer requires a design decision, the maintainer will draft an ADR in [`spec/decisions/`](./spec/decisions/).

### 3. Conformance fixtures (`conformance/fixtures/`)

The conformance corpus is the executable definition of XTL. Fixtures here outlive any single implementation. **Read [`conformance/AUTHORING.md`](./conformance/AUTHORING.md) before authoring.**

The cardinal rule: **expected outputs are authored from the spec, not generated from the JS implementation.** A fixture that just records what the JS impl does freezes the impl as the de-facto spec — exactly what XTL is trying to avoid.

### 4. Ports to other languages

Other-language implementations are welcome and tracked in [IMPLEMENTATIONS.md](./IMPLEMENTATIONS.md). To list a port:

1. Implement against the spec, not against the JS impl.
2. Run your impl through the conformance corpus following [`conformance/runner-protocol.md`](./conformance/runner-protocol.md).
3. Open a PR adding a row to `IMPLEMENTATIONS.md`.

## Coding conventions (TypeScript impl)

- TypeScript strict mode is on; PRs must typecheck (`npm run typecheck`).
- Tests are in `src/__tests__/`. Run with `npm test`.
- New features need tests. Bug fixes need regression tests.
- Avoid adding runtime dependencies unless necessary. Current deps: `exceljs`, `jszip`.

## Commit messages

Use [Conventional Commits](https://www.conventionalcommits.org/) where applicable:

- `feat:` — new feature in the impl
- `fix:` — bug fix in the impl
- `spec:` — change to spec text under `spec/`
- `conformance:` — change to fixture corpus or runner protocol
- `docs:` — README, CONTRIBUTING, etc.
- `chore:` — tooling, CI, deps
- `test:` — tests-only change in the impl

Breaking changes get `!` (e.g., `feat!: rename count to rowcount`).

## Spec changes during 0.x

Spec breaking changes are allowed in 0.x but must:

1. Be motivated by an ADR in [`spec/decisions/`](./spec/decisions/) with `status: accepted`.
2. Bump the spec minor version (`0.1` → `0.2`).
3. Land alongside fixture updates in `conformance/fixtures/`.

After 1.0, breaking spec changes require XTL 2.0 with a migration guide.

## Releasing (maintainer only)

1. Resolve all in-flight ADRs targeted for the release.
2. Update `CHANGELOG.md`.
3. Bump version in `package.json`.
4. `npm publish` (gated by `prepublishOnly` running typecheck + tests + build).
5. Tag the commit (`git tag v0.1.0 && git push --tags`).

## Code of conduct

Be respectful. Disagreement on technical decisions is welcomed; personal attacks are not.
