# ADR 0043 - Excel-native preference principle

- **Status:** process-normative
- **Date:** 2026-05-18
- **Spec target:** XTL 0.x (process)
- **Affects:** future function / directive additions; ADR governance
  pipeline; retroactive notes on ADR-0003 (TEXT format table), ADR-0019
  amendment (date arithmetic), ADR-0039 (HYPERLINK), and the XTL
  function surface as a whole

> **Status note.** This ADR was first labeled `informational` because
> it does not change runtime behavior, then briefly relabeled
> `accepted` to reflect its MUST obligations on future ADR authors.
> After the 2026-05-18 reviewer pass, ADR template `0000-template.md`
> gained a fifth status — `process-normative` — for exactly this
> case: accepted and binding on future ADR authors, but not on
> runtime impl. ADR-0034 stays informational because it carries only
> SHOULD-level obligations; this ADR's process gate is stricter.

## Context

The XTL function and directive surface has grown additively since
0.1 draft. The Excel template-engine genre (JXLS, xltpl, etc.)
has a well-stocked function catalog, and the temptation when
comparing surfaces is to add whatever the prior art has. ADR-0034
named this temptation and proposed three corollaries; this ADR
adds a fourth.

A late audit of the existing surface — driven by the maintainer
asking "isn't `TEXT()` for visual formatting just doing what cell
`numFmt` already does?" — surfaced that several functions XTL
ships have a redundant Excel-formula path the author can take
instead:

- Visual cell formatting → cell `numFmt`
- Static hyperlinks → `=HYPERLINK("...", "...")` Excel formula
- Per-row date component extraction (output cell) → `=YEAR(B2)`
  Excel formula
- String case conversion (output cell) → `=UPPER(B2)` Excel
  formula

The reference impl's renderer preserves cell formulas verbatim
when no `{{ ... }}` substitution applies, so an Excel formula
authored in the template cell stays a formula in the output. Excel
re-calculates at open time. **No XTL function call needed.**

The question this ADR settles: *when is a new XTL function
warranted?*

## Principle

> **A new XTL function or directive is warranted only when its
> evaluation must happen *before* rendering — i.e., during data
> shaping, group keying, filter / sort / `__inputs__` evaluation,
> or output-filename composition.**
>
> **If the same computation can be done by an Excel formula in the
> output cell — and the result only matters at workbook-display
> time — XTL must not duplicate it. The author writes the formula
> directly; the renderer preserves it; Excel evaluates at open.**

The principle is a *gate* on additions. It does not retroactively
remove anything (0.x compatibility), but it does:

1. Provide a normative test for every future "should we add X?"
   ADR — see "How to apply" below.
2. Document the *intended* boundary so authors and porters
   understand which path to take.
3. Surface the cases where an existing XTL function is the *only*
   path versus where it overlaps an Excel-native path.

### What counts as "before rendering"

"Before rendering" includes any phase of `convert()`, `preview()`,
`analyze()`, and `readTemplateInputs()` that evaluates XTL
expressions. Excel cannot run during any of these phases — the
workbook either hasn't been written yet (`convert()`) or won't be
written at all (`preview()` / `analyze()` / `readTemplateInputs()`).

These are the cases an Excel formula *cannot* handle, so XTL must:

- **Directive evaluation:** `@filter`, `@sort`, `@top`, `@group`,
  `@subtotal` operate on the data block before any cell is
  written. Excel cannot reach into "the rows xl3 is about to
  render."
- **Source aggregation:** `SUM([Amount])`, `COUNT([X])`,
  `AVERAGE([X])`, `MIN`/`MAX` operate over the data block's rows.
  Excel doesn't know which rows xl3 will produce.
- **Cross-source lookup:** `XLOOKUP` operates across
  `__sources__` declarations. Excel has no `__sources__` concept.
- **Filename and group-key composition:** `output_file_pattern`,
  `__sheet_name_pattern__` use `{{ ... }}` expressions that
  determine *which file/sheet* a row lands in. There is no cell
  for Excel to evaluate a formula in.
- **`__inputs__` coercion and validation:** values from the host
  flow through XTL types (ADR-0010) before any cell is touched.
- **Context functions:** `ROW()` (current repeat-block index),
  `TODAY()` (UTC at render time) — meaningful only at render
  time.

### What counts as "after rendering"

These cases the author can defer to Excel:

- Visual number / date formatting on a cell → `numFmt`
- Static or per-row link with a known label / URL pattern →
  cell formula `=HYPERLINK(url, label)` (where `url` and `label`
  may themselves be substituted `{{ [Col] }}` references that
  produce strings)
- Math on values already in the output (rounding, exponents,
  remainder) → cell formula `=ROUND(B2, 2)`, `=MOD(B2, 7)`
- String case conversion on values already in the output →
  cell formula `=UPPER(B2)`
- Type tests on output cells → cell formula `=ISBLANK(B2)`
- Date component extraction from output cells → cell formula
  `=YEAR(B2)`, `=NETWORKDAYS(B2, C2)`
- Statistical / financial functions over a known cell range —
  Excel native, formula authored directly

## How to apply

A new XTL function / directive proposal passes this principle when
**at least one** of the following holds:

1. **Used in a directive predicate.** The function appears
   inside `@filter`, `@sort`, `@top`, `@group`, or `@subtotal`.
   These directives evaluate before render time; the function
   must be an XTL function.
2. **Aggregates over source data.** The function reads multiple
   rows of a source.
3. **Composes a render-time scalar that flows back into XTL.**
   Examples: filename pattern, sheet name pattern, `__inputs__`
   defaulting, `__config__` value lookup.
4. **Cross-source.** Reads or writes across multiple
   `__sources__`.
5. **Context-dependent.** Returns a value that depends on render
   state (row index, render time, active source).

A proposal that meets *none* of these is deferred to Excel-formula
authorship in the output cell.

## Retroactive review of the existing surface

The functions below were **accepted before this ADR existed**.
They are grandfathered (no removal in 0.x). The 🟡 marker
indicates *where the principle, if applied today, would prefer
the Excel-formula path* — not that the function failed any gate.
Authors and cookbook recipes use the marker as guidance, not as
a deprecation warning.

| Function / directive | Render-time critical? | Notes |
|---|---|---|
| `IF`, `IFEMPTY` | ✅ Used in `@filter`, cell substitution | core |
| `SUM`, `COUNT`, `AVERAGE`, `MIN`, `MAX` | ✅ Source aggregation | core |
| `ROUND`, `ABS` | ✅ Used in `@filter` / `@sort` predicates | core |
| `TEXT(value, format)` | 🟡 String-result; cell `numFmt` covers visual formatting | document choice |
| `ROW`, `TODAY` | ✅ Render context | core |
| `XLOOKUP` | ✅ Cross-source | core |
| `YEAR`, `MONTH`, `DAY` | 🟡 Useful in `@filter`; redundant for cell output | document choice |
| `EOMONTH`, `EDATE` | 🟡 Useful in `@filter` and filename; redundant for cell output | document choice |
| `DATEDIF` | 🟡 Same | document choice |
| `HYPERLINK(url, label)` | 🟡 Per-row dynamic URLs; static URLs use Excel formula | document choice |
| `IFERROR` (ADR-0044) | 🟡 Only catches XTL error-cell markers (e.g., `#DIV/0!`); thrown `xtlError` cases not catchable. Cell-output use can be `=IFERROR(B2/C2, 0)`. Render-time-critical use: filename-pattern guards. | document choice |
| `UPPER`/`LOWER`/`TRIM` (ADR-0044) | 🟡 Cell output has `=UPPER(B2)` / `=LOWER(B2)` / `=TRIM(B2)`. Render-time-critical use: filename / sheet patterns where Excel cannot reach. | document choice |
| `IFS` (ADR-0044) | 🟡 Cell output has `=IFS(...)`. Render-time-critical use: filename patterns + filter-context conditional value selection. | document choice |
| `DATE` (ADR-0044) | 🟡 Cell output has `=DATE(...)`. Render-time-critical use: composing dates from `__inputs__` components for filename / `@filter`. | document choice |
| `@filter`, `@sort`, `@top`, `@repeat`, `@source`, `@join` | ✅ Render-time data shaping | core |
| `@group`, `@subtotal` (ADR-0038) | ✅ Interleaved subtotal rows Excel cannot place | core |

The 🟡 rows are *cases where an Excel-formula alternative exists
for some uses*. The XTL function stays available; cookbook recipe
guides the author to the right path.

## Forward decisions

This ADR is paired with two follow-up ADRs that apply the
principle to the most recent Tier-1 proposal queue:

- **ADR-0044 (accepted)** — function additions that pass the test:
  `UPPER`, `LOWER`, `TRIM`, `IFERROR`, `IFS`, `DATE(y, m, d)`.
  Each is justified by directive use, `__inputs__` composition, or
  guarded XLOOKUP — cases Excel formula cannot reach.
- **ADR-0045 (rejected)** — function proposals that fail the test:
  `SQRT`, `POWER`, `MOD`, `INT`, `ISBLANK`, `ISNUMBER`, `ISTEXT`,
  `ISERROR`, `NOW`, `WEEKDAY`, `WEEKNUM`, `NETWORKDAYS`, `SUMIF`,
  `COUNTIF`, `AVERAGEIF`, and proposed expansions of the `TEXT()`
  format token table. All can be done as Excel formulas in the
  output cell, or as cell `numFmt` for visual formatting.

## Consequences

- Future ADRs proposing a function or directive MUST cite this
  ADR in their Context section and explain which of the five
  "render-time critical" categories the proposal satisfies.
- The cookbook gains a new recipe (Cookbook 16, "XTL function
  vs Excel formula") with concrete side-by-side examples.
- ADR-0034 grows an effective fourth corollary: *prefer the
  Excel-native path when one exists*. This is consistent with
  Corollary 2 (reimplement features in XTL syntax, not import
  them) — *if Excel already has the syntax, no reimplementation
  is needed*.
- The XTL function surface stays small by construction. Porters
  benefit: fewer functions to implement.
- Authors get clearer guidance on where to put logic — and a
  simpler mental model than JXLS's broad function exposure.

## References

- ADR-0034 — Relationship to prior-art template engines
  (the absorption framework this ADR extends)
- ADR-0003 — `TEXT()` format token table (intentionally minimal
  per this principle)
- ADR-0019 amendment — date arithmetic (per this principle,
  authorial choice noted)
- ADR-0036 — Template feature preservation matrix (output-cell
  formula preservation is what makes this principle workable —
  see `pageSetup`, `formula` cell handling)
- ADR-0044 — accepted function additions per this principle
- ADR-0045 — rejected function additions per this principle
- README § "Why xl3 exists" / § "Excel syntax inside Excel"
- `docs/guides/16-xtl-vs-excel-formula.md` (new cookbook recipe)
