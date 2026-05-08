# XTL Implementations

Implementations of the [XTL spec](./spec/). xl3 is the reference implementation.

| Language | Package | Spec version | Conformance | Notes |
|---|---|---|---|---|
| TypeScript | [`@jinyoung4478/xl3`](https://www.npmjs.com/package/@jinyoung4478/xl3) | XTL 0.1 (draft) | reference, 96/96 stage-1 fixtures, Stage 2 capable | Browser + Node >=20.12; runner via `npx xl3-conformance` |

## Adding an implementation

Read [`PORTERS_GUIDE.md`](./PORTERS_GUIDE.md) first — it distinguishes
spec-normative requirements from TS-impl-incidental details and gives
a recommended development order keyed to the conformance corpus.

To list a port here:

1. Implement enough of XTL 0.1 to pass the [conformance fixtures](./conformance/fixtures/) you target.
2. Run your impl against [`conformance/`](./conformance/) following [`conformance/runner-protocol.md`](./conformance/runner-protocol.md).
3. Open a PR adding a row to the table above with: language, package URL, spec version targeted, conformance status (full / partial / N of M fixtures).

Ports under active development are welcome — link your in-progress repo even if conformance is partial.

## Spec compliance levels

- **reference** — this implementation. Definitionally conformant for its declared spec version.
- **full** — passes all conformance fixtures for the declared spec version.
- **partial (N/M)** — passes N of M fixtures. List the categories of fixtures not yet supported.
- **draft** — early WIP, not yet running conformance.
