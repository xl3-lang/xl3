# Roadmap

What needs to happen for **XTL 1.0** (spec) and **xl3 1.0** (reference
implementation).

The current version is **0.4.1** (npm) targeting **XTL 0.1 (draft)**.
Breaking changes are still possible during 0.x. The 1.0 cut is gated on
the items below, not on a calendar date.

## 1.0 readiness checklist

A 1.0 cut requires **all** of the following:

### Spec maturity

- [x] **Spec audit pass complete.** Every silent-fallthrough surface
      either errors with a stable code or is normatively pinned by an ADR.
      (Closed 2026-05-12.)
- [x] **Conformance corpus ≥ 100 fixtures.** Currently 119.
- [x] **Stage 2 OOXML canonicalization spec'd.** ADR-0006.
- [x] **Error code catalog frozen as stable contract.** ADR-0015,
      snapshot test pinning.
- [ ] **Second independent implementation passes ≥ 80% Stage 1
      fixtures.** Forces external validation of every normative claim.
      Current: xl3-py (draft) — see [IMPLEMENTATIONS.md](./IMPLEMENTATIONS.md).
- [ ] **At least one ADR has been driven by an external contributor.**
      Tests that the governance process described in [GOVERNANCE.md](./GOVERNANCE.md)
      works in practice, not just on paper.

### Impl maturity

- [x] **Public API surface snapshot-pinned.** `src/__tests__/api-surface.test.ts`.
- [x] **CI matrix covers Node 20 + 22, three time zones.** UTC,
      America/New_York, Asia/Seoul.
- [x] **Bundle smoke test in CI.** IIFE bundle exercised on every PR.
- [ ] **No unresolved `@stable` symbols missing JSDoc examples.** Each
      public function has an `@example` block.
- [ ] **Performance characterized.** A documented benchmark for typical
      report sizes (1k / 10k / 100k rows × 5-20 columns). Currently
      `scripts/bench.mjs` exists but results aren't published.

### Documentation

- [x] **Cookbook covers the spec surface.** 15 recipes covering every
      normative directive and function.
- [x] **API reference auto-generated.** TypeDoc, 43 pages.
- [x] **Spec reading order documented.** PORTERS_GUIDE.md "Recommended
      development order."
- [ ] **Korean guides i18n.** Currently English-only; Korean home +
      converter only.
- [ ] **Production use case section in README.** Today the README says
      "alpha"; 1.0 swaps in concrete reference cases.

### Governance

- [x] **ADR process documented.** [GOVERNANCE.md](./GOVERNANCE.md).
- [x] **Backward-compatibility commitments named.** Spec versioning,
      error code stability, API snapshot.
- [ ] **More than one accepter for ADRs and impl PRs.** Currently the
      maintainer signs off everything. The 1.0 cut requires the
      maintainer set to widen so that a single person's unavailability
      doesn't stall the project.

### Adoption signals

- [ ] **At least one production reference case.** A team using xl3 for
      real reporting work, publicly acknowledged in
      [IMPLEMENTATIONS.md](./IMPLEMENTATIONS.md) or via a case study.
- [ ] **At least one external contributor with merged work.** A
      contributor list, even a small one, demonstrates the project is
      not a single-person effort.

## Non-goals for 1.0

These are intentionally deferred. Each has an ADR explaining why:

- **Date arithmetic functions** (`EOMONTH`, `EDATE`, `DATEDIF`) —
  [ADR-0019](./spec/decisions/0019-deferred-date-arithmetic.md).
- **Locale-aware string collation** —
  [ADR-0020](./spec/decisions/0020-deferred-locale-collation.md).
- **Multi-join, left-join, multi-row matches** —
  [ADR-0014](./spec/decisions/0014-source-joins.md) out-of-scope section.
- **XLOOKUP wildcard / approximate / reverse search** —
  [ADR-0013](./spec/decisions/0013-xlookup-cross-source-lookup.md)
  out-of-scope section.
- **Cross-writer Stage 2 fixtures beyond `093`** —
  [ADR-0006](./spec/decisions/0006-stage-2-ooxml-conformance.md) amendment.

These remain candidates for **XTL 1.1, 1.2, 1.x** based on demand.

## Path to 1.0

The remaining checkboxes are gated mainly on **external validation**
rather than internal work. The single-maintainer project has done what
it can do alone (audit pass, conformance, docs). The next phase is
sociological:

1. **xl3-py reaches 80%+ Stage 1.** Forces every normative claim through
   a second implementation. Spec gaps surface as fixture failures.
2. **First production user.** Real usage finds the patterns the synthetic
   fixtures missed.
3. **First external ADR.** A contributor proposes a normative change,
   the governance process runs end to end.
4. **Maintainer set widens.** At least one additional reviewer.

When (1)–(4) land, the remaining checkboxes mostly close themselves
(reference case from the production user, Korean i18n if a Korean
adopter contributes, etc.). 1.0 is cut once the checklist above is
complete and the project has run at 0.x for at least one quarter
post-checklist-completion.

## How to help close items

| Item | How to help |
|---|---|
| Second-language port at 80%+ | Contribute to [xl3-py](https://github.com/jinyoung4478/xl3-py), or start a new port (Rust, Java, Go). See [PORTERS_GUIDE.md](./PORTERS_GUIDE.md). |
| First external ADR | Pick a deferred item, draft an ADR in `spec/decisions/`. See [GOVERNANCE.md](./GOVERNANCE.md) "How changes enter the project." |
| Production reference case | Use xl3 internally, share what worked / didn't. Drop a row in [IMPLEMENTATIONS.md](./IMPLEMENTATIONS.md) if appropriate. |
| Korean guides i18n | Korean translation of any guide recipe is welcome as an individual PR. |
| Benchmarks published | Run `npm run bench` on representative templates, share results. |

## How this roadmap evolves

This document is living. As items close they move to `[x]`. As new items
are identified (from xl3-py findings, production adoption, etc.) they
get added. Cuts and additions are discussed via the same ADR/issue
process as everything else.
