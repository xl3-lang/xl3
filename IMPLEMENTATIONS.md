# XTL Implementations

Implementations of the [XTL spec](./spec/). xl3 is the reference implementation.

| Language | Package | Spec version | Conformance | Notes |
|---|---|---|---|---|
| TypeScript | [`xl3`](https://www.npmjs.com/package/xl3) | XTL 0.1 (draft) | reference, 26/26 fixtures, Stage 2 capable | Browser + Node >=18; runner via `npx xl3-conformance` |

## Adding an implementation

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
