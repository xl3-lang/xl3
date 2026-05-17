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
| A1 | Data-row merged cells (vertical/horizontal) | ✅ **ADR-0035 landed** + fixture 122 | **ADR-0035** | HIGH — done |
| A2 | Image anchor behavior across `@repeat` row expansion | ✅ pinned by ADR-0036 (P) | ADR-0036 row | HIGH — done |
| A3 | Conditional formatting preservation + range extension | ⏳ ADR-0036 (P) for preservation; **ADR-0040 promotes to PE** (impl pending) | ADR-0036 + ADR-0040 | HIGH — spec done, impl pending |
| A4 | Chart data range expansion across `@repeat` | ⏸️ ADR-0036 marks D (deferred). Revisit when Stage 2 conformance reaches charts | ADR-0036 row | LOW — deferred |
| A5 | Named range / defined names | ✅ ADR-0036 (P) + fixture 123 | ADR-0036 row | MEDIUM — done |
| A6 | Print area + repeating header rows | ✅ ADR-0036 (P) | ADR-0036 row | MEDIUM — done |
| A7 | Freeze pane / split | ✅ ADR-0036 (P) | ADR-0036 row | LOW — done |
| A8 | Sheet protection / cell locking | ✅ ADR-0036 (P) | ADR-0036 row | LOW — done |
| A9 | Data validation (dropdowns, ranges) | ⏳ ADR-0036 (P); **ADR-0040 promotes to PE** (impl pending) | ADR-0036 + ADR-0040 | MEDIUM — spec done, impl pending |
| A10 | Cell comments (notes) | ✅ ADR-0036 (P) + fixture 123 | ADR-0036 row | LOW — done |

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
| B1 | `groupBy` + subtotal rows | ✅ **ADR-0038 landed** (spec). Surface: `{{ @group [Key] }}` + `{{ @subtotal SUM(...) }}`. Impl pending — parser/renderer changes are non-trivial. | **PROMOTED → A-like** |
| B2 | `jx:link` (dynamic hyperlink) | ✅ **ADR-0039 landed** — `HYPERLINK(url, label)` function + impl + fixture 125 | **PROMOTED → done** |
| B3 | `outlineLevel` (row grouping) | ✅ **ADR-0040** adds preservation (P) to the matrix. Impl: `cloneWorksheet` copies `row.outlineLevel`. | **PROMOTED → done** |
| B4 | Dynamic cell styling based on data | `{{ @style ... }}` | Risk of undermining "Excel stays Excel" — should stay author-controlled via conditional formatting |
| B5 | `jx:multisheet` (sheet-per-group) | Already covered by file/sheet grouping (ADR-0012) | Already done |
| B6 | Date arithmetic (EOMONTH, EDATE, DATEDIF, YEAR, MONTH, DAY) | ✅ **ADR-0019 amendment landed** + impl + tests + fixture 126 | **PROMOTED → done** |
| B7 | Multi-line cell text (`\n` preservation) | ✅ **ADR-0041 landed** + fixture 127. Likely zero-code-change; pinned as normative. | **PROMOTED → done** |

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
| C7 | Runtime cell mutation (`jx:updateCell` — modify existing cell value during render, separate from `{{ }}` substitution) | Substitution via `{{ }}` already covers the use case; runtime mutation makes templates ambiguous and depends on evaluation order, conflicting with "template is the handover artifact" | **ADR-0042 (rejected)** |

## Sequence

1. ✅ ADR-0034 informational — relationship principle
2. ✅ Absorption-plan doc (this file)
3. ✅ ADR-0035 accepted — data-row merge cells + impl + fixture 122
4. ✅ ADR-0036 mixed — template feature preservation matrix + fixtures 123/124
5. ✅ ADR-0037 rejected — dynamic image insertion
6. ✅ **ADR-0038 accepted** — `@group` + `@subtotal` (spec only; impl pending)
7. ✅ **ADR-0019 amendment** — promote 6 date arithmetic functions; impl + fixture 126
8. ✅ **ADR-0039 accepted** — `HYPERLINK(url, label)` function; impl + fixture 125
9. ✅ **ADR-0040 accepted** — CF/DV range PE extension + outline level preservation (CF/DV impl pending; outline impl landed)
10. ✅ **ADR-0041 accepted** — multi-line cell text; pin + fixture 127
11. ✅ **ADR-0042 rejected** — runtime cell mutation
12. ✅ **ADR-0043 informational** — Excel-native preference principle (the gate)
13. ✅ **ADR-0044 accepted** — UPPER/LOWER/TRIM/IFERROR/IFS/DATE + impl + fixture 128
14. ✅ **ADR-0045 rejected** — math/type-test/NOW/conditional-aggregate/TEXT-token-expansion bundle
15. ✅ **Cookbook 16** — "XTL function vs Excel formula" recipe
16. **Next:** ADR-0038 impl (parser + renderer for `@group`/`@subtotal`); ADR-0040 impl (CF/DV `sqref` extension at `spliceRowsPreservingMerges` time).

## How this doc evolves

When an item moves from A → ADR, mark it `→ ADR-NNNN` in the
table. When a B item gets promoted out of deferred status, move
it to a new section. When a C item gets challenged (real
adoption pressure surfaces the question), the rejection ADR can
be revisited — see `GOVERNANCE.md` § "Disagreements".

This doc lives in `docs/internal/` because it is the
maintainer's working backlog, not normative spec. The normative
artifacts are the ADRs themselves.
