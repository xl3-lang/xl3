# ADR 0035 - Data-row merged cell semantics

- **Status:** accepted
- **Date:** 2026-05-17
- **Spec target:** XTL 0.1
- **Affects:** evaluation.md (Source Data Model), ADR-0033 (header-side
  companion)

## Context

ADR-0033 settled merged-cell semantics for the **header row** of a
source table: horizontally-merged slaves are transparent (one
logical column at the master). It deliberately deferred the
question of merged cells in **data rows** (rows below the header).

Real-world Korean operations templates use merges heavily in data
rows too:

- Vertical merges in a "Customer" column to indicate "these N
  rows belong to one customer" — common in transaction
  statements (거래명세서) and settlement sheets (정산서).
- Horizontal merges in a "Note" column spanning into adjacent
  columns for a multi-column free-text memo.
- 2D merges for grouped sub-sections inside an order form.

The de-facto behavior today (inherited from how ExcelJS
materializes merged cells: every cell in the merge returns the
master's value) is:

- For a vertical merge `A2:A4 = "Acme"`, the reader yields three
  data rows, each with `Customer = "Acme"`.
- For a horizontal merge `B2:C2 = "memo"`, columns `Note` and
  `Amount` both receive `"memo"` for that row.

This was never normatively pinned. A second-language port that
uses openpyxl (which leaves slaves as `None`) would see different
data and pass conformance only by accident.

Per ADR-0034 Corollary 1, this is an absorption-of-experience
moment: name the behavior, choose it deliberately, pin it with a
fixture. The chosen rule may or may not match JXLS; what matters
is that XTL stops being silent.

## Considered Options

**A. Master broadcasts to every slave (current).** Visual
fidelity with what Excel displays; deterministic; simple
implementation contract for ports ("read master's value at every
cell in the merge"); matches the merged-header rule from ADR-0033
when applied to data rows.

**B. Master-only; slaves read as empty.** "A vertical merge means
one logical record." Pro: closer to what some authors intend (an
N-row vertical merge → one source row). Con: changes the row
count of a source as a function of merge state — silent data loss
when the author didn't realize the merge was there; column-wise
inconsistency (Customer is one record, but Amount has three
distinct values, so the row count cannot be unified).

**C. Implementation-defined.** Worst option — silent cross-impl
drift on data shape. Explicitly disallowed by ADR-0034.

**D. Error out.** Forces the author to unmerge. User-hostile for
vendor-provided templates; same objection as ADR-0033 § Context.

## Decision

Adopt **A**: master broadcasts to every slave in source data rows.

### Normative behavior

When reading source data rows below the header row:

1. A data cell's value is the cell's own value when the cell is
   not merged or is the merge master.
2. A data cell's value is the merge master's value when the cell
   is a slave (regardless of whether the merge is horizontal,
   vertical, or 2D).
3. Empty-data-row skip (`evaluation.md` § "Empty Values") is
   computed *after* merge broadcast: a row is empty only when
   every cell — including those filled by merge broadcast — is
   empty.
4. The number of data rows yielded by a source equals the number
   of non-empty rows in the source-table range. A vertical merge
   spanning *N* rows yields *N* data rows, each sharing the
   master's value at that column.

### Authors' options

Authors who want a vertical merge to count as "one logical
record" rather than *N* records SHOULD unmerge the source data
region. This is an authoring choice, not an engine inference.

### Why broadcast over master-only

The "what you see in Excel is what you get" principle. A user
opening the source workbook in Excel sees the merged region
displaying the master's text in every cell — the engine's
behavior should match that visual model. Master-only would create
a silent semantic divergence between what the source author saw
and what the engine read.

This is the same principle ADR-0033 applies on the header side:
**visual fidelity is the source-of-truth tie-breaker**.

### Interaction with ADR-0033

ADR-0033 says: in the header row, horizontal-merge slaves are
*transparent* (no column contribution, no duplicate check). That
asymmetry with this ADR is intentional:

- Headers define *structure* (column names). A merged header
  visually represents one logical column; treating each slave as
  a separate column would create N duplicate columns named the
  same thing — the inverse of what the author meant.
- Data rows carry *values*. A merged data cell visually
  represents one value present in every cell of the merge;
  broadcasting matches the visual.

The two rules are not contradictory — they are the same
"visual-fidelity" principle applied to two different shapes of
information.

## Consequences

- Source row counts are predictable from merge geometry: vertical
  merges expand the row count; horizontal merges do not.
- ExcelJS-based ports get correct behavior for free (cell.value
  already returns master text for slaves). Ports based on
  libraries that surface slaves as `None` (openpyxl) MUST
  explicitly read the merge master.
- This ADR is a **read-side** decision. The output writer's
  treatment of merges in the **template** is unchanged: template
  merges are preserved verbatim (`evaluation.md` § "Styles and
  Workbook Structure").
- No new error code; no new directive. The decision is purely
  semantic.
- Conformance fixture 122 (`122-source-data-row-merge-broadcast`)
  pins the rule across vertical, horizontal, and 2D merges.

## References

- ADR-0033 — Merged source-table headers (header-side companion)
- ADR-0034 — Relationship to prior-art template engines
  (Corollary 1: absorb experience)
- ADR-0017 — Source value model
- `evaluation.md` § "Source Data Model" / "Empty Values"
