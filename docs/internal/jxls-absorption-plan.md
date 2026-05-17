# JXLS absorption plan

> **Operating principle (ADR-0034):**
> Borrow JXLS's experience, not its syntax. Prior-art engines'
> *decisions* are an asset; their *decision form* (cell-comment
> directives, library-as-spec, JEXL, escape hatches) is an
> anti-pattern relative to XTL's thesis.

This is a working doc, not user-facing spec. Captures the
categorized backlog from the JXLS-strategy conversation
(2026-05-17).

## Category A — Absorb (edge cases worth importing as ADRs)

These are behaviors JXLS has tested for ~10 years that XTL is
currently silent on. Each becomes an ADR + conformance fixture.
No new XTL syntax. The choice each ADR makes may or may not match
JXLS — what matters is that XTL stops being silent.

| # | Item | xl3 current state | Target ADR | Priority |
|---|---|---|---|---|
| A1 | Data-row merged cells (vertical/horizontal) | Implicit: ExcelJS broadcasts master to slaves | **ADR-0035** | HIGH — follow-up to ADR-0033 |
| A2 | Image anchor behavior across `@repeat` row expansion | Images preserved in `cloneWorksheet`; `spliceRowsPreservingMerges` does not adjust image anchors | ADR-0036 row | HIGH |
| A3 | Conditional formatting preservation + range extension | Pass-through via ExcelJS load→save; ranges do **not** auto-extend across `@repeat` | ADR-0036 row | HIGH |
| A4 | Chart data range expansion across `@repeat` | ExcelJS chart support is incomplete; charts likely lost on round-trip | ADR-0036 row | LOW — deferred |
| A5 | Named range / defined names | Pass-through via ExcelJS; not extended across `@repeat` | ADR-0036 row | MEDIUM |
| A6 | Print area + repeating header rows | Pass-through; not extended across `@repeat` | ADR-0036 row | MEDIUM |
| A7 | Freeze pane / split | Pass-through via `views` (already in `cloneWorksheet:71`) | ADR-0036 row | LOW — already works |
| A8 | Sheet protection / cell locking | Pass-through via ExcelJS | ADR-0036 row | LOW — already works |
| A9 | Data validation (dropdowns, ranges) | Pass-through via ExcelJS; ranges not extended | ADR-0036 row | MEDIUM |
| A10 | Cell comments (notes) | Pass-through via ExcelJS | ADR-0036 row | LOW — already works |

**Strategy:** consolidate A2–A10 into one matrix ADR (ADR-0036)
rather than nine separate ADRs. A1 gets its own ADR (ADR-0035)
because it is the natural follow-up to ADR-0033 and has impl
implications.

## Category B — Deferred (features worth reimplementing in XTL syntax later)

These are JXLS features that *could* fit XTL's thesis if
redesigned in XTL-native syntax. Holding indefinitely; not in
scope before 1.0.

| # | JXLS feature | Possible XTL form | Why deferred |
|---|---|---|---|
| B1 | `groupBy` + subtotal rows | `{{ @group [Customer] }} ... {{ @subtotal SUM([Amount]) }}` | Real value, but multi-source/grouping already covers most cases via file/sheet grouping (ADR-0012) |
| B2 | `jx:link` (dynamic hyperlink) | Use Excel's native `HYPERLINK()` function inside `{{ ... }}` | Excel's `HYPERLINK()` already covers this; no new directive needed |
| B3 | `outlineLevel` (row grouping) | `{{ @outline N }}` | Rarely used in operations templates |
| B4 | Dynamic cell styling based on data | `{{ @style ... }}` | Risk of undermining "Excel stays Excel" — should stay author-controlled via conditional formatting |
| B5 | `jx:multisheet` (sheet-per-group) | Already covered by file/sheet grouping (ADR-0012) | Already done |

## Category C — Rejected (incompatible with thesis)

Named here so the question stays settled. Each becomes a
*rejected*-status ADR if/when someone proposes it.

| # | JXLS choice | Why rejected for XTL | Rejection ADR |
|---|---|---|---|
| C1 | Cell-comment directives (`jx:each` in cell comments) | Breaks "template is the handover artifact" — invisible in Excel UI | ADR-0034 Corollary 3 (informational) |
| C2 | JEXL / non-Excel expression language | Breaks "Excel syntax inside Excel" — operators learn second mini-language | ADR-0034 Corollary 3 |
| C3 | `lastCell="D2"` boundary coords | Boilerplate for inferable info | ADR-0034 Corollary 3 |
| C4 | Java/host custom commands (Turing-complete escape hatch) | Cannot survive porting; undermines spec | ADR-0034 Corollary 3 |
| C5 | Library-as-spec | Already explicit anti-pattern per `PORTERS_GUIDE.md:28-30` | ADR-0034 Corollary 3 |
| C6 | Dynamic image insertion (`jx:image` — data-driven image from a column/path) | Out of scope: vendor templates rarely need this; image preservation (template image survives) is enough; opens binary-asset pipeline that breaks browser flow | **ADR-0037 (rejected)** |

## Sequence

1. ✅ ADR-0034 informational — relationship principle
2. ✅ Absorption-plan doc (this file)
3. ⏳ ADR-0035 accepted — data-row merge cells + impl + fixture
4. ⏳ ADR-0036 mixed — template feature preservation matrix
5. ⏳ ADR-0037 rejected — dynamic image insertion
6. *Future ADRs:* one B item per quarter if/when adoption pressure makes a B item necessary. Each preceded by a deferred-status ADR with explicit scope.

## How this doc evolves

When an item moves from A → ADR, mark it `→ ADR-NNNN` in the
table. When a B item gets promoted out of deferred status, move
it to a new section. When a C item gets challenged (real
adoption pressure surfaces the question), the rejection ADR can
be revisited — see `GOVERNANCE.md` § "Disagreements".

This doc lives in `docs/internal/` because it is the
maintainer's working backlog, not normative spec. The normative
artifacts are the ADRs themselves.
