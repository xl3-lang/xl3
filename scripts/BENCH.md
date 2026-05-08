# Performance baseline

`npm run bench` runs three scenarios and reports the median of three
runs. The numbers below are the reference hardware baseline. A
regression of more than ~2× in any scenario should be investigated
before shipping.

## Reference baseline

Recorded 2026-05-08 on Apple M1, Node 22, no other heavy load.

| Scenario | Median |
|---|---|
| wide-flat (10k rows × 4 cols, IF + ROUND per row) | ~220 ms |
| multi-sheet (5k rows split across 5 sheet groups) | ~70 ms |
| multi-source-join (5k Renewals × 1k Customers, inner join) | ~70 ms |

## What each scenario stresses

- **wide-flat** — row-iteration hot path, single source, per-cell
  template eval. Most representative of "bulk reporting" workloads.
- **multi-sheet** — group-by + per-sheet rendering overhead.
  Sheet-name rendering and per-group context build dominate.
- **multi-source-join** — `@join` index build + per-row matched
  lookup. Tests the WeakMap-cached lookup index added for ADR-0014.

## When to update this file

Update the table above when:

- A correctness fix changes the median by more than 10% in either
  direction. Regressions of >2× are bugs; improvements of >2× are
  worth recording so they aren't lost.
- The reference hardware changes (e.g., CI runner upgrade).

Do NOT update this file every commit — the goal is a stable
reference, not a living dashboard.
