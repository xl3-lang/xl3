# ADR 0042 - Rejected: runtime cell mutation (`jx:updateCell` style)

- **Status:** rejected
- **Date:** 2026-05-18
- **Spec target:** XTL 0.1 (rejection; no spec change)
- **Affects:** ADR-0034 (Corollary 3 application)

## Context

JXLS exposes `jx:updateCell` — a directive that modifies the
value of an existing cell during rendering, distinct from
substitution via `{{ ... }}`. The directive targets a cell
coordinate, supplies a value (often computed from a JEXL
expression), and optionally supplies a predicate gating when the
update fires. The same shape appears in several JXLS forks
under different names (`jx:setCell`, `jx:writeCell`).

The natural XTL spelling would be something like:

```text
{{ @update D5 = SUM([Amount]) WHEN [Status] = "FINAL" }}
```

or a function-form variant:

```text
{{ @update D5 [Total] }}
```

This ADR records the decision **not** to ship that feature in
XTL 0.1, 0.x, or on the roadmap to 1.0. The rejection is
deliberate, not an oversight.

Per ADR-0034 Corollary 3, this is the next feature-level
rejection ADR following ADR-0037 (dynamic image insertion).

## Considered Options

**A. Ship `@update` (or equivalent) matching JXLS's
`jx:updateCell`.** A new directive that, during render,
overwrites the value at an explicit coordinate.

**B. Reject — keep templates declarative.** Adopted below.
Author-side substitution (`{{ ... }}` written *in the cell that
should change*) covers the use cases without introducing
runtime mutation semantics.

**C. Defer (no decision yet).** Leaves the question open and
recurring.

## Decision

Adopt **B**. Runtime cell mutation is **out of scope** for XTL
0.1 and **not on the roadmap** to 1.0.

### Why rejected

Five distinct objections, each sufficient on its own:

#### 1. Conflicts with "template is the handover artifact"

README § "Why xl3 exists" pins the thesis: the template is the
handover artifact — it can be reviewed, versioned, archived, and
passed to the next operator *without asking them to read the
automation code*. A directive that modifies cells the author
wrote as static (no `{{ }}` markers) makes the template
ambiguous in exactly the way the thesis forbids: the reader
cannot tell, from the template alone, what the output will
contain without simulating execution.

Substitution via `{{ ... }}` is the inverse: every cell that
might change in the output carries a visible marker. A user
opening the template in Excel sees, by inspection, which cells
are dynamic and which are static. Runtime mutation breaks that
invariant.

#### 2. Substitution already covers the use case

Every use case `jx:updateCell` solves — conditional cell
values, computed totals, status-dependent labels — is already
expressible by writing the expression in the cell that should
hold the value:

- "If status is FINAL, show the total; else blank" →
  `{{ IF([Status] = "FINAL", SUM([Amount]), "") }}` in the
  target cell.
- "Stamp a different label depending on a flag" →
  `{{ IF([Flag], "Approved", "Pending") }}` in the cell.
- "Compute a value from multiple columns" → the formula goes
  in the cell.

The author makes the intent **explicit by where they write it**.
`@update D5 = …` from a different cell hides intent: the reader
of cell D5 sees a static "0" and has no signal that some other
cell will overwrite it.

#### 3. Cross-impl complexity is high

A faithful `@update` would need to:

- Parse target-cell coordinates (absolute, relative, or named).
- Evaluate predicate expressions in the same evaluation model
  as the rest of XTL.
- Order updates against the rest of substitution (does the
  update fire before or after `@repeat` expansion? what if the
  target cell is inside an expanded block?).
- Resolve conflicts when multiple `@update` directives target
  the same cell.

Each port (xl3-py, future Rust/Go) would replicate all four —
significantly more state than substitution, which evaluates
each cell independently. ADR-0034 Corollary 1 asks for cheap
absorption; this is the opposite.

#### 4. Encourages templates to depend on evaluation order

Runtime mutation tends to chain: "after cell A updates, cell B
reads A's new value, then cell C reads B's new value." Once
that chain forms, evaluation order is **observable** — the
template's output depends on the order in which the engine
visits cells. Substitution avoids this entirely: each `{{ ... }}`
is a pure function of source data, and order is internal to the
engine.

ADR-0016 (ordering and stability) explicitly limits the surfaces
on which order is observable — output filename ordering, row
ordering — precisely so authors don't write templates that
silently break when the engine optimizes traversal. Runtime
mutation would re-introduce the exact class of bug ADR-0016 is
designed to prevent.

#### 5. No demand signal

Korean operations templates (거래명세서, 정산서, 발주서, 인보이스
— the originating audience for XTL) have not surfaced a single
case where substitution is insufficient and runtime mutation is
the natural answer. Conditional cell content is handled by
`IF()` in the cell; computed totals by `SUM()` in the cell;
status labels by string-formula substitution. Adding `@update`
would be a speculative feature — paying ~500 lines per port for
a use case nobody has reported.

Future production users *might* surface such a case. If they
do, this ADR can be reopened per `GOVERNANCE.md` §
"Disagreements" — but the bar is concrete evidence, not
analogy with JXLS.

### What is *not* rejected

- Substitution via `{{ [Col] }}` writing the column's value
  into the cell. **Supported** since 0.1.
- Conditional cell content via `{{ IF(condition, then, else) }}`.
  **Supported** since 0.1.
- Computed totals via `{{ SUM([Amount]) }}` and the rest of the
  function table. **Supported** since 0.1 per ADR-0024.
- Multi-output via file-per-group / sheet-per-group (`@file` /
  `@sheet`). **Supported** since 0.1 per ADR-0012.
- Future reconsideration if production users report runtime
  cell mutation as a real blocker, with a specific use case
  that substitution provably cannot express. A reopening would
  need to address all five objections above.

## Consequences

- Future proposers of runtime-mutation features can cite this
  ADR to know the bar (overcome all five objections) before
  drafting.
- No new directive, no new function, no new evaluation phase in
  0.1.
- No conformance fixture is added — rejected ADRs do not need
  fixtures; the rejection IS the contract.
- `docs/internal/jxls-absorption-plan.md` Category C gains an
  item linking to this ADR.
- Listed in `INFORMATIONAL_ADRS` of
  `src/__tests__/spec-coverage.test.ts` so the ADR↔fixture
  coverage check passes.

## References

- ADR-0034 — Relationship to prior-art template engines
  (Corollary 3: some prior-art choices are explicitly out of
  scope)
- ADR-0037 — Rejected: dynamic image insertion (precedent
  rejection following the same structure)
- ADR-0016 — Ordering and stability (the surfaces this ADR
  protects from order-dependence)
- ADR-0024 — Function arity (where `IF`, `SUM`, etc. live; the
  substitute-side answer to mutation's use cases)
- README § "Why xl3 exists" (the thesis the rejection protects)
- `GOVERNANCE.md` § "Disagreements" (revisability)
