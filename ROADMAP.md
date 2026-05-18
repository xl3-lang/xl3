# Roadmap

What needs to happen for **XTL 1.0** (spec) and **xl3 1.0** (reference
implementation).

The current version is **0.6.0** (npm) targeting **XTL 0.1 (draft)**.
Breaking changes are still possible during 0.x. The 1.0 cut is gated on
the items below, not on a calendar date.

> **Deep version planning** lives in
> [`docs/internal/blueprint-to-1.0.md`](./docs/internal/blueprint-to-1.0.md)
> — gap analysis, philosophy boundary (xl3 ≠ JXLS), per-version step
> plan. This document is the elevator pitch; the blueprint is the
> rationale.
>
> **Single source of truth for 1.0 gates is the table below.** When this
> file and the blueprint conflict, this table wins; the blueprint is
> updated to match.

## What 1.0 means for xl3

The 1.0 target is **operator-readable trust**: a spec that doesn't
shift, a reference impl that doesn't surprise, and a surface small
enough that an operator can review a template without reading code.
It is **not** about feature completeness vs JXLS — xl3 intentionally
ships a smaller surface (ADR-0043 + ADR-0048). The intended audience
is **Korean operations teams that manage many customer-specific
invoice formats** (거래명세서, 정산서, 발주서); the engine
generalizes beyond this niche, but the niche is the wedge.

## 1.0 gate table (single source of truth)

Each gate has an owner, the artifact that closes it, the pass-fail
criterion, a fallback if the gate is unreachable, and the target
milestone. Per-version step plan below references these gates by ID.

| ID | Gate | Owner | Artifact | Pass criterion | Fallback | Target |
|----|------|-------|----------|----------------|----------|--------|
| G1 | Conformance corpus ≥ 140 | maintainer | `conformance/fixtures/` | `ls conformance/fixtures/ \| wc -l` ≥ 140 | — | 0.6/0.7 |
| G2 | Stage 2 OOXML canonicalization spec'd | maintainer | ADR-0006 + canonicalizer in src/ | covered by fixtures 024-027, 093 + ADR-0006 amendment | — | DONE |
| G3 | Error code catalog frozen | maintainer | `src/__tests__/error-codes.test.ts` snapshot | catalog snapshot unchanged for 30 days | — | 0.9-rc |
| G4 | JXLS boundary published | maintainer | ADR-0048 | file exists, references PORTERS_GUIDE | — | DONE |
| G5 | Deferred-impl ADRs landed | maintainer | ADR-0038 impl ✅ (2026-05-18) + ADR-0040 PE impl | ADR-0038 portion shipped (fixtures 132-135); ADR-0040 CF/DV range-extension still pending for 0.6.1 | — | 0.6 (partial) / 0.6.1 |
| G6 | Public API surface frozen | maintainer | `src/__tests__/api-surface.test.ts` snapshot | snapshot unchanged for 30 days | — | 0.9-rc |
| G7 | JSDoc examples on @stable exports | maintainer | TypeDoc output | every `@stable` symbol has `@example` block | — | 0.7-0.8 |
| G8 | Performance characterized | maintainer | `scripts/BENCH.md` | 1k/10k/100k row × 5/10/20 col matrix + memory-ceiling + parse/eval/write split published | — | 0.7 |
| G9 | Perf regression fixtures | maintainer | conformance corpus | ≥ 2 large fixtures with ratio-based assertion | — | 0.7 |
| G10 | Cross-browser smoke | maintainer | `ci.yml` | Safari + Firefox bundle-load + 1 convert() per run | — | 0.7 |
| G11 | Stage 2 in CI | maintainer | `ci.yml` | `npm run conformance:stage2` runs on every PR | — | 0.7 |
| G12 | Undecided behavior pinned (pivot/sparkline/ListObject/page break) | maintainer | conformance fixtures + ADR per item | each: fixture pinning current behavior OR ADR explicitly deferring to 1.x | defer to 1.1 with ADR | 0.6 / 0.7 |
| G13 | Second-language impl validation | external (xl3-py) | `conformance/reports/*.json` | xl3-py passes ≥ 80% Stage 1 OR ≥ 80% Stage 2, OR documented 50% skeleton in another language (Rust/Go/Java) within 12 months of all other gates closing | accept single-impl 1.0 via public ADR amending GOVERNANCE | 0.7-0.8 |
| G14 | External-contributor ADR | external | `spec/decisions/NNNN-*.md` | ≥ 1 ADR with non-maintainer as Author (≥ 60% of Context/Decision sections by line count) | 18-month time-box, then: ≥ 2 external-authored cookbook recipes OR ≥ 5 external-authored conformance fixtures | 0.8 |
| G15 | Production reference case | external (with maintainer help) | `IMPLEMENTATIONS.md` "Production users" row | ≥ 1 named user, satisfied by EITHER (a) external company with permission to list, OR (b) the maintainer's own employer running xl3 in scheduled production with a public case study | — | 0.8 |
| G16 | Maintainer set widening | maintainer | `GOVERNANCE.md` | ≥ 2 people with accept/reject rights for ADRs and impl PRs | explicit accept of single-maintainer 1.0 governance shape via amendment to GOVERNANCE | 0.8 |
| G17 | Korean cookbook i18n complete | maintainer | `website/i18n/ko/.../guides/` | all cookbook recipes have Korean translation | — | 0.6 |
| G18 | Production use case in README | maintainer | `README.md` | replaces "alpha" status with concrete production reference (tied to G15) | — | 1.0 (with G15) |
| G19 | Migration guide 0.x → 1.0 | maintainer | `docs/migration-0.x-to-1.0.md` | documents every behavior change or confirms additive-only | downgrade to CHANGELOG note if confirmed additive-only | 0.8 |
| G20 | SECURITY.md + threat model | maintainer | `SECURITY.md` + spec amendment | docs zip-bomb / oversized workbook / formula-execution stance + limits API | — | 0.7-0.8 |
| G21 | Hard limits documented (no streaming until 1.1) | maintainer | spec/evaluation.md | row / memory hard limit values + AbortSignal API documented | — | 0.7-0.8 |
| G22 | API surface — internal model types separated | maintainer | `src/index.ts` exports + STABILITY.md | only `convert`/`preview`/`analyze` + stable interfaces marked `@stable`; model/parser types marked `@experimental` or moved to `xl3/internal` | — | 0.6 (before @group impl) |
| G23 | RC soak | maintainer | git tags | RC published; ≥ 21-day soak (extended from 7 day per review feedback); 0 critical issues | — | 0.9-rc |
| G24 | "Stable quarter" post-checklist | maintainer | release calendar | 90-day window after the FINAL gate above ticks ✅; no breaking spec/API/error-code change during the window | breaking change → restart clock | between final-gate-tick and 1.0 cut |

### Definitions (testable)

- **External contributor (G14):** not in `GOVERNANCE.md` maintainer set
  AND not in `Co-authored-by` history of merged ADR commits at PR open
  time. Drive-by typo edits do not count; named Author in ADR
  front-matter; authored ≥ 60% of Context/Decision sections by line
  count.
- **Breaking change (G24, G23):** any change to (a) public API
  surface snapshot, (b) error code catalog (rename/removal/repurpose),
  (c) ADR `accepted` → `rejected` or contradicting status flip.
  Patch releases and additive ADRs do NOT reset the quarter clock.
- **Critical bug fix (G23 RC exception):** (a) silent data loss in
  `convert()`, (b) error code catalog inconsistency between docs and
  runtime, OR (c) an `accepted` ADR's MUST that cannot be implemented
  as written. Maintainer cites which of (a)/(b)/(c) in the PR.
- **Data-loss test (G24 testable form):** corpus has a dedicated
  `data-loss/` fixture group (≥ 8 fixtures) exercising silent-
  stringify, numFmt drop, formula rewrite, and date round-trip paths;
  all pass on the reference impl.
- **Quarter clock start (G24 vs G23):** the 90-day quarter starts on
  the day the LAST gate ticks ✅. RC publication does NOT start the
  clock; the clock must have started BEFORE RC publication. If a
  breaking change happens during RC soak, both the soak (G23) and the
  quarter (G24) reset.

## Per-version step plan

Gate-based, not date-based. Calendar estimates have been removed —
each milestone closes when its listed gates close.

### 0.6.0 — Deferred-impl, narrow scope

Theme: close the highest-impact deferred-impl gate cleanly.

Gates closed: **G5** (`@group`/`@subtotal` impl only — the rest of
ADR-0040 PE moves to 0.6.1), **G17** (Korean cookbook 16/17 missing
translations), **G22** (API surface cleanup before @group exposes
new internal types).

The previous "single 0.6.0 with everything" plan was scoped too
ambitiously per the engineering-feasibility review. ADR-0038 impl
alone is a full pipeline insertion (new directive, group-boundary
state machine, transform-pass partition, renderer rewrite,
group-scoped aggregate eval). Splitting 0.6.0 keeps the milestone
shippable.

### 0.6.1 — Rest of deferred-impl

Gates closed: **G5** completion (ADR-0040 PE: CF/DV `sqref`
extension), pivot/page-break behavior fixtures toward **G12**.

### 0.7.0 — Performance + external validation begins

Gates closed: **G8** (perf benchmarks), **G9** (perf regression
fixtures), **G10** (cross-browser), **G11** (Stage 2 in CI),
**G20** (SECURITY.md draft), **G21** (hard limits).

Progress toward: **G13** (xl3-py).

Relabel: `alpha` → `beta` after G8 publishes and xl3-py reaches
≥ 50% Stage 1.

### 0.8.0 — Sociological gates

Gates closed: **G14** (external ADR), **G15** (production case),
**G16** (maintainer widening or explicit single-maintainer
acceptance), **G19** (migration guide), **G20** completion.

This milestone is the long one. The plan is to ship 0.8.x patches
during the recruitment period rather than wait silently.

### 0.9.0-rc.x — Pre-1.0 freeze

Gates closed: **G3**, **G6**, **G7**, **G23** (≥ 21-day RC soak).

After G23 starts, the quarter clock for G24 begins (it must have
ticked while G3/G6/G7/etc. were closing — see definitions above).

### 1.0.0 — Final cut

Gate closed: **G24** (90-day quarter complete after last gate
ticked).

## Recruitment and outreach

Sociological gates (G13/G14/G15/G16) require people, not code. The
project has two distinct recruitment surfaces:

### Korean operations audience (G15, future cookbook contributors)

Channels: Korean developer communities (Naver Café, Kakao 오픈톡,
LinkedIn KR), internal company / vendor template-author surveys.
Each minor release publishes a Korean-language post tied to the
release moment (0.6 = `@group`/`@subtotal` demo for invoice
subtotal patterns; 0.7 = perf numbers; 0.8 = case study).

### English OSS audience (G13, G14)

Channels: HN, lobste.rs, r/excel, conference CFPs (JSConf, EuroPython
for xl3-py). Each major moment ships with one specific external
artifact:

- 0.7.0 release: "Show HN: xl3 0.7 — 100k-row Excel template engine"
- 0.8.0 release: case study + xl3-py conformance dashboard
- 1.0.0 release: spec + multi-impl validation

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
- **Streaming output / SXSSF analog.** Deferred to 1.1+. **At 1.0,
  hard memory/row limits are documented (G21) instead.**
- **Template compile caching API.** Deferred to 1.1+.
- **PDF / HTML output.** Out of scope; xl3 is xlsx-in, xlsx-out.
- **Cross-writer Stage 2 fixtures beyond `093`** —
  [ADR-0006](./spec/decisions/0006-stage-2-ooxml-conformance.md) amendment.

These remain candidates for **XTL 1.1, 1.2, 1.x** based on demand.

## How to help close items

| Item | How to help |
|---|---|
| G13 second-impl ≥ 80% | Contribute to [xl3-py](https://github.com/jinyoung4478/xl3-py), or start a new port (Rust, Java, Go). See [PORTERS_GUIDE.md](./PORTERS_GUIDE.md). |
| G14 external ADR | Pick a deferred item (pivot table preservation, page-break, ADR-0045 carved-out function), draft an ADR in `spec/decisions/`. See [GOVERNANCE.md](./GOVERNANCE.md) "How changes enter the project." A few "starter ADR stubs" are available as `good-first-ADR` issues on GitHub. |
| G15 production case | Use xl3 internally, share what worked / didn't. Drop a row in [IMPLEMENTATIONS.md](./IMPLEMENTATIONS.md) if appropriate. The maintainer's own employer (Snack24h) qualifies if it ships a public case study. |
| G17 Korean cookbook 16+17 i18n | Translate the two newest recipes (the rest are done). |
| G8 benchmarks | Run `npm run bench` on representative templates, share results. |
| G10 cross-browser | Add Safari + Firefox to the bundle smoke test. |
| Function re-proposal | If you need a function rejected per ADR-0045, file the [`Function re-proposal`](https://github.com/jinyoung4478/xl3/issues/new?template=function-reproposal.md) issue template. |

## How this roadmap evolves

This document is the public elevator pitch + the gate table is the
single source of truth. The deeper
[`docs/internal/blueprint-to-1.0.md`](./docs/internal/blueprint-to-1.0.md)
carries the gap analysis, philosophy boundary, and per-version
rationale. As gates tick, both documents update. As new gaps surface,
both add them.

Cuts and additions to the 1.0 gate table are discussed via the same
ADR/issue process as everything else.
