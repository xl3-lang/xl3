# XTL Implementations

Implementations of the [XTL spec](./spec/). xl3 is the reference implementation.

| Language | Repo | Package | Spec version | Conformance | Notes |
|---|---|---|---|---|---|
| TypeScript | [`jinyoung4478/xl3`](https://github.com/jinyoung4478/xl3) | [`@jinyoung4478/xl3`](https://www.npmjs.com/package/@jinyoung4478/xl3) | XTL 0.1 (draft) | reference; **157/157** fixtures pass (151 Stage 1 + 6 Stage 2 only) | Browser + Node ≥ 20.12; runner via `npx xl3-conformance`; 3-TZ matrix in CI |
| Rust (WASM) | [`jinyoung4478/xl3-rs`](https://github.com/jinyoung4478/xl3-rs) | [`xl3-core`](https://crates.io/crates/xl3-core) + [`xl3-wasm`](https://www.npmjs.com/package/xl3-wasm) | XTL 0.1 (draft) | **partial 119/148** Stage 1 | Pure-Rust acceleration core (calamine + rust_xlsxwriter) wrapped for browser / Node hosts. Drives xl3 0.9.0's opt-in `engine: 'wasm'` path. Outstanding gaps: HYPERLINK function, shared formulas, ~20 validation error sites |
| Python | [`jinyoung4478/xl3-py`](https://github.com/jinyoung4478/xl3-py) | _(unpublished)_ | XTL 0.1 (draft) | **draft**, in development | Tracked alongside the reference impl; drop a `--report=json` artifact under [`conformance/reports/`](./conformance/reports/) and `npm run conformance:dashboard` will pick it up |

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
