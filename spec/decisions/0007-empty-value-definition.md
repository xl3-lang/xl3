# ADR 0007 - Empty value definition

- **Status:** accepted
- **Date:** 2026-05-07
- **Spec target:** XTL 0.1 draft
- **Affects:** evaluation.md, language.md

## Context

Several XTL 0.1 features reference an "empty" notion without ever defining
it:

- `IFEMPTY(value, fallback)` — returns the fallback when `value` is "empty,
  null, or missing."
- `COUNT([field])` — counts "non-empty values."
- `evaluation.md` "Source Data Model" — "Empty data rows are skipped."
- `evaluation.md` "List Sheets" — "Ignore empty cells."
- `@filter [field] in _Sheet` — silently uses `String(value ?? '')` to test
  membership today, so a missing `field` joins the membership pool as the
  empty string.

Each call site in the reference implementation uses a slightly different
predicate. Two conformant XTL implementations could disagree on, for
example, whether `"   "` (whitespace) or `0` is empty, even though both
read the same spec.

The ambiguity is concrete:

| Value | Should it be empty? | Reference impl today | Spec says |
|---|---|---|---|
| `null`, `undefined`, missing column | yes | yes | implied |
| `""` empty string | yes | yes | implied |
| `"   "` whitespace-only | author intent says yes | no | silent |
| `0` (number) | author intent says no | no | silent |
| `false` | author intent says no | no | silent |
| Date value | no | no | silent |
| Formula returning `""` | yes | yes (via cached result) | implied |

Without a normative definition, every list-sheet membership filter, every
`IFEMPTY` fallback, every `COUNT([field])` aggregate, and every empty-row
skip is a portability hazard.

## Considered Options

**A. `null` / `undefined` / `""` only (status quo of the impl).** The
tightest definition. Cost: a leading/trailing-space cell `" "` slips past
`IFEMPTY` and renders as visible whitespace in the output, which is rarely
the author's intent. The `IFEMPTY` ergonomic regresses in exactly the
case it was added for.

**B. Strings empty after Unicode-whitespace trim, plus null/missing.**
Aligns with the spec's existing trim rule for source column names
(`evaluation.md` "Source Data Model" item 1). Numbers, including `0`, and
booleans, including `false`, remain non-empty. Dates remain non-empty.
Cost: small impl change; one observable behavior change for whitespace
rows that were previously rendered.

**C. Same as B plus the number `0` and boolean `false`.** Matches some
templating ecosystems' "falsy" intuition. Cost: gut-shot to
`COUNT([Amount])` over zero-amount rows and `IFEMPTY([Active], "no")` over
`FALSE` flags. Inconsistent with Excel's `ISBLANK` (which is "blank cell
only", not "value zero"). Reject.

**D. String-typed only — numbers/booleans/dates always non-empty,
whitespace strings still empty.** Equivalent to B once we say "an empty
string after trimming is empty." This is the recommendation.

## Decision

A value `v` is **empty** if and only if:

1. `v` is missing (the source column does not exist on this row, or the
   cell is blank), or
2. `v` is a string and, after trimming Unicode whitespace at both ends,
   has length zero.

"Unicode whitespace" matches the set recognized by ECMAScript
`String.prototype.trim` — equivalent to the Unicode-mode `\s`
character class. It includes ASCII space, tab, newlines, NBSP
(U+00A0), the ideographic space (U+3000), and other code points with
the `White_Space` property. **Zero-width characters** such as
zero-width space (U+200B) and zero-width no-break space (U+FEFF) are
**not** whitespace; a string consisting only of zero-width characters
is non-empty.

All other values — numbers (including `0`), booleans (including `false`),
dates, and non-empty strings — are **non-empty**.

This single predicate governs every spec surface that mentions emptiness:

- `IFEMPTY(value, fallback)` — returns `fallback` when `value` is empty,
  otherwise returns `value`.
- `COUNT([field])` — counts a row when its `[field]` value is non-empty.
- "Empty data rows are skipped" — a source row is empty when every cell
  in the source-table column span is empty by this predicate.
- List-sheet entry reading — list sheets drop empty cells from their
  first column. An empty source-row value never matches `@filter ... in
  _Sheet`; an empty source-row value always matches `@filter ... !in
  _Sheet` (an empty value is, by definition, not present in the list).

Spec text in `evaluation.md` is updated to add a new section, "Empty
Values," and to update "List Sheets" to reference it. Spec text in
`language.md` updates `IFEMPTY` and `COUNT([field])` to point at the new
section.

## Consequences

- The reference implementation gains a single internal `isEmpty` helper
  in `src/functions.ts`. `IFEMPTY` and `countRows` use it. The
  `data-transform.ts` `in` / `!in` branch uses it to short-circuit empty
  values. `src/reader.ts` empty-row detection uses it cell by cell.
- A source row whose every cell is whitespace-only (e.g., three cells of
  `"   "`) is now skipped before grouping and rendering. Templates that
  intentionally rendered whitespace-padded rows will see them disappear.
  This is a deliberate, signalled break for the `0.x` window.
- `IFEMPTY([Memo], "-")` now returns `"-"` for a whitespace-only Memo
  cell. Authors who want the literal whitespace can compare with `=`:
  `IF([Memo] = "  ", …)`.
- `COUNT([Amount])` over rows whose `Amount` is `0` continues to count
  every row. `0` is not empty.
- The `@filter ... in _Sheet` semantics tighten: a row missing the
  `[field]` value never matches `in`. Today the reference impl treats it
  as the string `""` and matches if `_Sheet` happens to contain the empty
  entry — which the same ADR drops anyway, since list-sheet reading also
  skips empty cells. The combined effect is that empty values never
  participate in `in` membership.
- This ADR does not define the canonical string form of non-empty
  values. ADR-0009 covers comparison and string coercion, and refines
  the list-sheet wording to reference the canonical string form defined
  there.
- The ADR does not define a value model for source cells (gap #9 in the
  reference-impl coupling audit). Excel error sentinels (`#N/A`,
  `#VALUE!`) and percentage-cell representation remain out of scope of
  XTL 0.1.

## References

- XTL 0.1 draft: `spec/language.md` "Functions / IFEMPTY"; `spec/language.md` "Aggregates"; `spec/evaluation.md` "Source Data Model"; `spec/evaluation.md` "List Sheets"
- ADR-0004: reference implementation coupling audit (this ADR closes the empty-value gap catalogued there).
- ADR-0008: truthiness for `IF` and `@filter` (a value that is empty per this ADR is falsy).
- ADR-0009: comparison and string coercion (defines the canonical string form referenced by list-sheet reading).
