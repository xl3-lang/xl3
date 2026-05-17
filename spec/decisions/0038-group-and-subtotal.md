# ADR 0038 - `@group` and `@subtotal` directives

- **Status:** accepted
- **Date:** 2026-05-18
- **Spec target:** XTL 0.x
- **Affects:** language.md (Directives), evaluation.md (Source Data
  Model), ADR-0015 (error catalog)

## Context

Korean B2B operations templates — 거래명세서 (transaction
statements), 정산서 (settlement sheets), 발주서 (purchase orders) —
almost universally interleave per-customer or per-month subtotal
rows with line-item rows inside a single data block:

```
Acme    Widget A    10,000
Acme    Widget B     5,000
        Subtotal    15,000
Beta    Widget A    20,000
        Subtotal    20,000
        Grand Total 35,000
```

JXLS solves this with `jx:each(groupBy=...)` plus a summary
cell-range marker. XTL 0.x has no equivalent surface: `@source`,
file-per-group, and sheet-per-group split the data across files
or sheets, but cannot interleave a subtotal row *inside* a single
data block.

Authors today work around the gap by pre-aggregating in the data
workbook or by post-processing the rendered file — both break the
"template is the handover artifact" thesis. The gap is a HIGH-
priority lesson the prior art has paid for; absorbing it is exactly
the case ADR-0034 Corollary 1 + Corollary 2 describe.

Per ADR-0034 Corollary 1, this ADR adopts the JXLS-tested
*behavior* (group boundary rows with scoped aggregates) without
adopting JXLS's syntax (cell-comment directives, `groupBy=` keyword
arguments, summary cell-range markers). The XTL surface is two new
template-expression directives in the existing `{{ @name … }}` form.

## Considered Options

**A. New `@group` + `@subtotal` directives (chosen).** Clean XTL-
native surface; composes with existing `@filter`/`@sort`/`@source`/
`@join`; multi-level groupings expressed by listing multiple keys
or stacking `@subtotal` rows at different visual rows.

**B. Compound `@repeat down groupBy [Key]` syntax.** One directive,
fewer concepts. Overloads `@repeat`, which today only describes
*shape* of expansion (down / right N); adding row-set partitioning
to the same directive conflates orthogonal concerns.

**C. Per-cell aggregate placeholders only.** Already possible with
`SUM([Amount])` in trailing rows. Misses the use case: the
subtotal row must emit *once per group boundary*, not once at the
end of the block.

**D. Reject the feature.** Conflicts with the absorption framework:
B1 in `docs/internal/jxls-absorption-plan.md` is HIGH-value real-
world coverage, and ADR-0034 Corollary 2 specifies the right
response is an XTL-native redesign, not rejection.

## Decision

Adopt **A**. Add `@group` and `@subtotal` to the directive set
defined by `spec/language.md` § "Directives".

### `@group`

```text
@group [Key]
@group [Key1], [Key2], …, [KeyN]
```

A data block MAY contain at most one `@group` directive. It
declares one or more **grouping keys** (column references) that
partition the active row set into groups. With *N* keys, grouping
is *N*-level nested: rows are grouped first by `[Key1]`, then within
each `[Key1]`-group by `[Key2]`, and so on.

Group identity is computed by the **value-equality rule** from
ADR-0009: keys compare equal when they compare equal under the
spec's comparison algorithm (string coercion for cross-type, empty-
aware for missing). Two rows with the same key sequence belong to
the same innermost group.

Group order is the **encounter order** of each key value in the
row set *after* `@filter` and `@sort` have applied. `@group` does
not itself reorder rows. Authors who want a specific group order
MUST `@sort` by the same keys as `@group`, in the same order.

`@group` with no key list raises `xl3/group/missing-key`.

### `@subtotal`

A `@subtotal` row is a row inside the data block that contains one
or more `{{ @subtotal <aggregate> }}` expressions. At render time
the row is emitted at every group boundary — once after the last
data row of each group at the row's enclosing nesting level.

```text
{{ @group [Region], [Customer] }}
{{ [Region] }} {{ [Customer] }} {{ [Item] }} {{ [Amount] }}
{{ "Customer subtotal" }}                   {{ @subtotal SUM([Amount]) }}
{{ "Region subtotal"  }}                    {{ @subtotal SUM([Amount]) }}
```

#### Aggregate scoping

The aggregate inside `@subtotal` operates over the **rows of the
current group only** at the `@subtotal` row's nesting level — not
over the full data block, and not over a different group's rows.

#### Nesting-level inference

A `@subtotal` row's nesting level is the **innermost** `@group` key
level for which a literal text cell on the same row contains a
column-reference-free string that disambiguates intent, OR, when no
such cell is present, the level is inferred from the row's position
relative to other `@subtotal` rows in the block:

1. The **first** `@subtotal` row encountered (topmost in row order)
   binds to the innermost group key (`[KeyN]`).
2. Each subsequent `@subtotal` row binds to the next-outer key.
3. There MUST NOT be more `@subtotal` rows than `@group` keys.

The grand total over all rows is expressed by the *outermost*
`@subtotal` row — its boundary fires once, at the end of the data
block, because the outermost group's boundary is the end of the
data.

This implicit binding keeps the surface declarative. A future ADR
MAY introduce explicit binding (`{{ @subtotal SUM([Amount]) on
[Region] }}`) if real fixtures show the implicit form is
insufficient; until then the row-order rule is the contract.

#### Supported aggregates

`@subtotal` accepts exactly these aggregate functions as its body:

- `SUM(<column-ref>)`
- `COUNT()` or `COUNT(<column-ref>)`
- `AVERAGE(<column-ref>)`
- `MIN(<column-ref>)`
- `MAX(<column-ref>)`

The column reference inside the aggregate follows the same form as
elsewhere (`[Column]`, `Source[Column]`). The cross-source rule
from ADR-0012 still applies: `Source[Column]` inside a `@subtotal`
operates on the named source's full row set; the *group scoping*
described above only applies to the active source's columns.

A `@subtotal` body that is not one of these five aggregates raises
`xl3/subtotal/bad-aggregate`. Arbitrary expressions (e.g.,
`SUM([Amount]) * 1.1`, `IF(...)`, raw column references) are
deferred.

#### Literal cells on a `@subtotal` row

A `@subtotal` row MAY contain literal-text cells, static formulas,
or other `{{ ... }}` expressions that do NOT reference the current
row's columns. These are rendered verbatim on each emission of the
subtotal row. This is how a row like
`{{ "Subtotal:" }} | {{ @subtotal SUM([Amount]) }}` produces the
label + value pair the example in Context shows.

A `@subtotal` row MUST NOT reference a current-row data column
(`[Column]` outside an aggregate) — there is no "current row" at a
group boundary. Such a reference raises the existing
`xl3/expression/unknown-name`-class error, treated like any out-of-
scope column reference.

### Boundary emission rules

1. `@subtotal` rows emit *after* the last data row of the group at
   their nesting level.
2. Nested groups emit inner subtotals before outer ones at any
   boundary where multiple groups end simultaneously (e.g., the
   last row of a region is also the last row of the last customer
   in that region: customer subtotal emits first, then region
   subtotal).
3. **Empty groups are skipped.** A group whose data rows are all
   empty (per ADR-0007 § Empty Values, computed after the merge-
   broadcast rule of ADR-0035) yields neither data rows nor a
   `@subtotal` row.
4. **Single-group case** — if a `@group` key has only one distinct
   value, the subtotal still emits at that group's boundary. This
   is degenerate but predictable and matches the "grand total via
   outermost subtotal" expectation when the dataset happens to
   contain one outer-group value.

### Composition with other directives

Per ADR-0029 § "Composition rules", the directive order inside a
block is:

1. `@source` (at most one)
2. `@join` (at most one)
3. `@filter` (any number, AND-composed)
4. `@sort` (any number)
5. `@group` (at most one) — **NEW**
6. `@top` (at most one)
7. `@repeat`

| Directive | Interaction with `@group` |
|---|---|
| `@filter` | Filters apply **before** grouping. Filtered-out rows are not in any group. |
| `@sort` | Sorts apply before grouping. `@sort` *within* a group is automatic when sort keys differ from group keys. Sorts that would *reorder* groups across each other are undefined; authors SHOULD `@sort` by the same keys as `@group`, in the same order, to fix group order. |
| `@source` | Each `@source` block has its own grouping scope. A `@group` in one block does not affect another. |
| `@join` | Joined-row columns participate in grouping like primary-row columns. Group keys MAY reference joined columns. |
| `@top` | Applies **after** grouping at the row level: it limits the data-row count of the block, counted across all groups in encounter order. Subtotal rows are emitted only for groups whose data rows survived the `@top` cut. (A future ADR may add per-group `@top`.) |
| `@repeat` | `@group` is incompatible with `@repeat right` (right-expansion has no row-boundary concept). Combination raises `xl3/directive/invalid-syntax`. Default down-expansion is supported. |

### Error catalog additions

Per ADR-0015, three new error codes:

- `xl3/group/missing-key` — `@group` directive with no key list.
- `xl3/subtotal/outside-group` — `@subtotal` expression in a block
  with no `@group`, or `@subtotal` rows in excess of the `@group`
  key count.
- `xl3/subtotal/bad-aggregate` — `@subtotal` body is not one of
  `SUM`, `COUNT`, `AVERAGE`, `MIN`, `MAX`, or its argument is not
  a column reference of the allowed form.

Diagnostic substrings (stable for fixtures):

- `@group requires at least one column key`
- `@subtotal requires an active @group directive`
- `@subtotal at row N has no matching @group level`
- `@subtotal accepts SUM, COUNT, AVERAGE, MIN, MAX only`

## Consequences

- Templates can express per-customer / per-month subtotal rows
  inside a single data block, closing the highest-value gap in
  Category B of the JXLS absorption backlog (B1 in
  `docs/internal/jxls-absorption-plan.md`).
- The aggregate set is intentionally narrow. Composite expressions
  (`SUM([A]) - SUM([B])`, `IF(...)`) are deferred; the spec stays
  small and the fixture corpus stays tractable.
- `@group` adds a new pass between filter/sort and top/repeat in
  the block-evaluation pipeline. Renderer impls must thread group
  context through aggregate evaluation so each `@subtotal`
  evaluates against its current group's row set, not the block's.
- **Implementation pending.** The reference impl does not yet ship
  `@group` / `@subtotal`. A follow-up commit will land:
  1. Parser additions for the two directives (block-level
     `@group`, row-level `@subtotal`).
  2. Group boundary detection in the row-expansion pass.
  3. Group-scoped aggregate evaluation.
  4. Conformance fixture(s) pinning the Korean
     invoice/settlement use cases, including:
     - single-level group with one subtotal row,
     - two-level group with inner + outer subtotals,
     - grand-total-via-outermost-subtotal,
     - empty-group skip,
     - composition with `@filter` + `@sort`.
- Until the impl lands, the spec is binding for any port and for
  future-impl planning; the reference impl SHOULD raise
  `xl3/directive/invalid-syntax` for `@group` / `@subtotal` so
  authors get a clear "not yet supported" signal rather than a
  silent no-op.
- This ADR does **not** introduce the explicit-binding form
  (`@subtotal … on [Key]`), per-group `@top`, or composite-
  expression `@subtotal` bodies. Those are future-ADR territory.

## References

- ADR-0012 — Multi-source data model (`@source`, cross-source
  aggregate rule)
- ADR-0029 — Directive composition and source edges (ordering,
  duplicate-detection pattern)
- ADR-0034 — Relationship to prior-art template engines
  (Corollary 1 + Corollary 2: absorption framework)
- ADR-0015 — Structured error reporting (error-code catalog)
- ADR-0007 — Empty value definition (empty-group skip)
- ADR-0009 — Comparison and string coercion (group-key equality)
- ADR-0035 — Data-row merge cells (merge-broadcast before empty
  check)
- `docs/internal/jxls-absorption-plan.md` § Category B (B1)
- `spec/language.md` § "Directives"
- `spec/evaluation.md` § "Source Data Model"
