# Roadmap

What needs to happen for **XTL 1.0** (spec) and **xl3 1.0** (reference
implementation).

The current version is **0.5.1** (npm) targeting **XTL 0.1 (draft)**.
Breaking changes are still possible during 0.x. The 1.0 cut is gated on
the items below, not on a calendar date.

> **Deep version planning** lives in
> [`docs/internal/blueprint-to-1.0.md`](./docs/internal/blueprint-to-1.0.md)
> — gap analysis, philosophy boundary (xl3 ≠ JXLS), per-version step
> plan. This document is the elevator pitch; the blueprint is the
> rationale.

## What 1.0 means for xl3

The 1.0 target is **JXLS-class trust**: a spec that doesn't shift, a
reference impl that doesn't surprise, and an ecosystem big enough that
the project isn't single-maintainer-fragile. It is **not** about feature
completeness vs JXLS — xl3 intentionally ships a smaller surface
(ADR-0043 + ADR-0048).

## 1.0 readiness checklist

A 1.0 cut requires **all** of the following:

### Spec maturity

- [x] **Spec audit pass complete.** Every silent-fallthrough surface
      either errors with a stable code or is normatively pinned by an ADR.
      (Closed 2026-05-12.)
- [x] **Conformance corpus ≥ 100 fixtures.** Currently 130.
- [x] **Stage 2 OOXML canonicalization spec'd.** ADR-0006.
- [x] **Error code catalog frozen as stable contract.** ADR-0015,
      snapshot test pinning.
- [x] **JXLS boundary published.** ADR-0048 codifies the
      seven-axis deliberate divergence + the inconvenience refinement
      to ADR-0043.
- [ ] **All deferred-impl ADRs landed.** `INFORMATIONAL_ADRS` no
      longer carries ADR-0038 (`@group`/`@subtotal`) or the
      impl-pending half of ADR-0040 (CF/DV `sqref` PE).
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
- [ ] **Cross-browser smoke test.** Safari + Firefox added to the
      bundle smoke test (currently Chrome only).
- [ ] **Perf regression fixtures.** Conformance corpus carries 1-2
      large-row fixtures to catch perf regressions.

### Undecided behavior pinned

These behaviors are currently implementation-defined; 1.0 requires each
to either be normatively pinned (with a fixture) or explicitly deferred
to 1.x via ADR:

- [ ] Pivot table preservation
- [ ] Sparkline preservation
- [ ] Excel `ListObject` (structured tables)
- [ ] Page break preservation

### Documentation

- [x] **Cookbook covers the spec surface.** 17 recipes covering every
      normative directive and function.
- [x] **API reference auto-generated.** TypeDoc, 43 pages.
- [x] **Spec reading order documented.** PORTERS_GUIDE.md "Recommended
      development order."
- [x] **Korean cookbook i18n.** All 16 recipes + landing + try +
      404 translated; 17 (template-authoring) is the most recent and
      may follow in 0.6.
- [ ] **Production use case section in README.** Today the README says
      "alpha"; 1.0 swaps in concrete reference cases.
- [ ] **Migration guide 0.x → 1.0.** What's stable, what's changing,
      what's deprecated.

### Governance

- [x] **ADR process documented.** [GOVERNANCE.md](./GOVERNANCE.md).
- [x] **Backward-compatibility commitments named.** Spec versioning,
      error code stability, API snapshot.
- [ ] **More than one accepter for ADRs and impl PRs**, OR the
      single-maintainer status is explicitly accepted in `GOVERNANCE.md`
      as the 1.0 governance shape.

### Adoption signals

- [ ] **At least one production reference case.** A team using xl3 for
      real reporting work, publicly acknowledged in
      [IMPLEMENTATIONS.md](./IMPLEMENTATIONS.md) or via a case study.
- [ ] **At least one external contributor with merged work.** A
      contributor list, even a small one, demonstrates the project is
      not a single-person effort.

## Non-goals for 1.0

These are intentionally deferred. Each has an ADR explaining why:

- **Date arithmetic beyond Y/M/D/EOMONTH/EDATE/DATEDIF** — the rest of
  the family deferred per [ADR-0019 amendment](./spec/decisions/0019-deferred-date-arithmetic.md).
- **Locale-aware string collation** —
  [ADR-0020](./spec/decisions/0020-deferred-locale-collation.md).
- **Multi-join, left-join, multi-row matches** —
  [ADR-0014](./spec/decisions/0014-source-joins.md) out-of-scope section.
- **XLOOKUP wildcard / approximate / reverse search** —
  [ADR-0013](./spec/decisions/0013-xlookup-cross-source-lookup.md)
  out-of-scope section.
- **Dynamic image insertion** — [ADR-0037](./spec/decisions/0037-rejected-dynamic-image-insertion.md).
- **Runtime cell mutation** — [ADR-0042](./spec/decisions/0042-rejected-runtime-cell-mutation.md).
- **Functions rejected per ADR-0043 gate** — math expansion, type
  tests (except `ISBLANK` per ADR-0047), NOW / WEEKDAY etc., conditional
  aggregates, TEXT() format-token expansion. See
  [ADR-0045](./spec/decisions/0045-function-batch-rejected.md).
- **Streaming output / SXSSF analog.** Deferred to 1.1+.
- **Template compile caching API.** Deferred to 1.1+.
- **PDF / HTML output.** Out of scope; xl3 is xlsx-in, xlsx-out.
- **Cross-writer Stage 2 fixtures beyond `093`** —
  [ADR-0006](./spec/decisions/0006-stage-2-ooxml-conformance.md) amendment.

These remain candidates for **XTL 1.1, 1.2, 1.x** based on demand.

## Per-version step plan

The path to 1.0 is broken into four pre-release milestones plus the RC
cycle. Each is gate-based, not date-based.

### 0.6.0 — Deferred-impl cleanup (~6–8 weeks)

**Theme:** close the gap between accepted spec and implemented behavior.

- F1 `@group` + `@subtotal` parser + renderer + conformance fixture
- F2 CF/DV `sqref` auto-extension impl (ADR-0040 PE part)
- F4/F7 pivot table + page break behavior pinned by fixture
- Korean translation of cookbook 16 + 17
- One Korean B2B invoice production-shaped example using `@group`/`@subtotal`

### 0.7.0 — Performance + xl3-py 80% (~3 months)

**Theme:** earn the ROADMAP "performance characterized" + "second impl"
checkpoints.

- Perf benchmarks published in `scripts/BENCH.md` (1k / 10k / 100k rows)
- Perf regression fixtures added to corpus
- xl3-py reaches ≥ 80% Stage 1 (port maintainer's responsibility)
- Memory profile published
- Safari + Firefox smoke test in CI
- Examples gallery expanded to 6+ production-shaped templates

### 0.8.0 — External validation (~3 months, sociological)

**Theme:** the work that requires people, not code.

- At least one ADR authored by a non-maintainer
- One production reference case listed in `IMPLEMENTATIONS.md`
- Migration guide 0.x → 1.0 drafted
- Maintainer set widening (target: one additional reviewer)
- Production case study writeup

### 0.9.0-rc.x — Pre-1.0 freeze (~1 month)

**Theme:** lock everything down.

- Spec freeze (new ADRs deferred to 1.1 unless critical bug fix)
- Public API surface frozen (snapshot test is the gate)
- Error code catalog frozen
- RC published with `--tag rc`
- 7-day soak with no critical issues

### 1.0.0 — Final cut

All checklist items above ✅, RC clean, 0.x has had ≥ 1 quarter of
stable behavior since the checklist became complete.

## Path to 1.0 — what to expect

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
4. **Maintainer set widens.** At least one additional reviewer (or
   explicit accept of single-maintainer 1.0).

When (1)–(4) land, the remaining checkboxes mostly close themselves
(reference case from the production user, perf published as production
characterization, etc.). 1.0 is cut once the checklist above is
complete and the project has run at 0.x for at least one quarter
post-checklist-completion.

## How to help close items

| Item | How to help |
|---|---|
| Second-language port at 80%+ | Contribute to [xl3-py](https://github.com/jinyoung4478/xl3-py), or start a new port (Rust, Java, Go). See [PORTERS_GUIDE.md](./PORTERS_GUIDE.md). |
| First external ADR | Pick a deferred item, draft an ADR in `spec/decisions/`. See [GOVERNANCE.md](./GOVERNANCE.md) "How changes enter the project." |
| Production reference case | Use xl3 internally, share what worked / didn't. Drop a row in [IMPLEMENTATIONS.md](./IMPLEMENTATIONS.md) if appropriate. |
| Korean cookbook 16+17 i18n | Translate the two newest recipes (the rest are done). |
| Benchmarks published | Run `npm run bench` on representative templates, share results. |
| Cross-browser smoke | Add Safari + Firefox to the bundle smoke test. |
| Function re-proposal | If you need a function rejected per ADR-0045, file the [`Function re-proposal`](https://github.com/jinyoung4478/xl3/issues/new?template=function-reproposal.md) issue template. |

## How this roadmap evolves

This document is the public elevator pitch. The deeper
[`docs/internal/blueprint-to-1.0.md`](./docs/internal/blueprint-to-1.0.md)
carries the gap analysis, philosophy boundary, and per-version
rationale. As items close, both documents are updated. As new gaps
surface, both add them.

Cuts and additions to the 1.0 checklist are discussed via the same
ADR/issue process as everything else.
