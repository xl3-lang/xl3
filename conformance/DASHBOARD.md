# Conformance dashboard

_Generated 2026-05-18T02:59:29.998Z by `conformance/scripts/dashboard.mjs`. Do not hand-edit; regenerate with `node conformance/scripts/dashboard.mjs`._

## Reference implementation

**xl3-js** 0.1.0-alpha.0 — 134/134 pass (100.0%); 0 fail, 0 error, 0 skip

## External implementations

_No external port reports under `conformance/reports/`. Drop a JSON report from any port that implements `--report=json` and re-run this script to add it._

## Breakdown by ADR (reference impl)

| ADR | Fixtures | Pass | Fail | Skip | Error |
|---|---:|---:|---:|---:|---:|
| ADR-0001 | 1 | 1 | 0 | 0 | 0 |
| ADR-0002 | 2 | 2 | 0 | 0 | 0 |
| ADR-0003 | 3 | 3 | 0 | 0 | 0 |
| ADR-0005 | 1 | 1 | 0 | 0 | 0 |
| ADR-0006 | 5 | 5 | 0 | 0 | 0 |
| ADR-0007 | 6 | 6 | 0 | 0 | 0 |
| ADR-0008 | 4 | 4 | 0 | 0 | 0 |
| ADR-0009 | 8 | 8 | 0 | 0 | 0 |
| ADR-0010 | 5 | 5 | 0 | 0 | 0 |
| ADR-0011 | 2 | 2 | 0 | 0 | 0 |
| ADR-0012 | 7 | 7 | 0 | 0 | 0 |
| ADR-0013 | 5 | 5 | 0 | 0 | 0 |
| ADR-0014 | 4 | 4 | 0 | 0 | 0 |
| ADR-0016 | 4 | 4 | 0 | 0 | 0 |
| ADR-0017 | 4 | 4 | 0 | 0 | 0 |
| ADR-0019 | 1 | 1 | 0 | 0 | 0 |
| ADR-0021 | 2 | 2 | 0 | 0 | 0 |
| ADR-0023 | 2 | 2 | 0 | 0 | 0 |
| ADR-0024 | 2 | 2 | 0 | 0 | 0 |
| ADR-0025 | 1 | 1 | 0 | 0 | 0 |
| ADR-0026 | 2 | 2 | 0 | 0 | 0 |
| ADR-0027 | 3 | 3 | 0 | 0 | 0 |
| ADR-0028 | 2 | 2 | 0 | 0 | 0 |
| ADR-0029 | 4 | 4 | 0 | 0 | 0 |
| ADR-0030 | 1 | 1 | 0 | 0 | 0 |
| ADR-0031 | 1 | 1 | 0 | 0 | 0 |
| ADR-0032 | 1 | 1 | 0 | 0 | 0 |
| ADR-0033 | 2 | 2 | 0 | 0 | 0 |
| ADR-0035 | 1 | 1 | 0 | 0 | 0 |
| ADR-0036 | 1 | 1 | 0 | 0 | 0 |
| ADR-0038 | 4 | 4 | 0 | 0 | 0 |
| ADR-0039 | 1 | 1 | 0 | 0 | 0 |
| ADR-0041 | 1 | 1 | 0 | 0 | 0 |
| ADR-0043 | 2 | 2 | 0 | 0 | 0 |
| ADR-0044 | 1 | 1 | 0 | 0 | 0 |
| ADR-0046 | 1 | 1 | 0 | 0 | 0 |
| ADR-0047 | 1 | 1 | 0 | 0 | 0 |
| ADR-0050 | 1 | 1 | 0 | 0 | 0 |
| *(no ADR)* | 41 | 41 | 0 | 0 | 0 |

## How to add a port

1. Make your port emit a JSON report in the format documented in [`conformance/runner-protocol.md`](./runner-protocol.md) "JSON report format".
2. Save it under `conformance/reports/<impl>-<version>.json`.
3. Run `node conformance/scripts/dashboard.mjs` from the repo root to regenerate this file.

