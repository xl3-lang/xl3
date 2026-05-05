# XTL Conformance Suite

This directory holds the **conformance corpus** — the test fixtures that any implementation of XTL must pass to claim conformance. The corpus is the executable definition of XTL behavior.

## Layout

```
conformance/
├── README.md            ← this file
├── AUTHORING.md         ← how to add fixtures (avoid the JS-as-truth trap)
├── runner-protocol.md   ← how implementations should run the suite
└── fixtures/
    └── <NNN>-<slug>/
        ├── template.xlsx
        ├── data.xlsx
        ├── expected.xlsx        ← canonical expected output (single-file case)
        ├── expected/            ← OR a directory of files (multi-file group case)
        │   └── *.xlsx
        ├── no expected output   ← for expected_error fixtures
        └── meta.yaml            ← description, spec section refs, tags
```

## What "passing" means

A fixture passes if the implementation, given `template.xlsx` and `data.xlsx`, produces output(s) that match `expected.xlsx` (or the contents of `expected/`) byte-equivalently after **canonical normalization** of the OOXML zip:

- Files within the zip sorted by name
- XML attributes sorted within each element
- Insignificant whitespace collapsed
- Generator metadata stripped (creator, modifiedBy, lastModified)

(Exact canonicalization rules to be specified in [`runner-protocol.md`](./runner-protocol.md). Until then, comparison may use a higher-level value-equality check on each cell.)

An error fixture passes when the implementation reports an error containing the
fixture's `expected_error` text. Error fixtures do not include `expected.xlsx`
or an `expected/` directory.

## Versioning

Each fixture directory contains `meta.yaml` declaring the minimum spec version it requires (`spec_version: 0.1`). Implementations report which spec version they target; the suite filters fixtures accordingly.

## Status

XTL 0.1 corpus is **bootstrap state**. Fixtures should be added only for behavior already stated in [`spec/README.md`](../spec/README.md), following the same pattern used by standards projects such as CommonMark: prose defines the rule, fixtures make the rule executable, and implementations report which fixtures they pass.

The reference implementation does not make its own behavior normative. When a fixture and the implementation disagree, update the implementation or the fixture according to the spec precedence in [`spec/README.md`](../spec/README.md).
