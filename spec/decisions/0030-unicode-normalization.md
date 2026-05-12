# ADR 0030 - Unicode normalization in string comparison

- **Status:** accepted
- **Date:** 2026-05-09
- **Spec target:** XTL 0.1
- **Affects:** ADR-0009, language.md, PORTERS_GUIDE.md

## Context

Korean, Japanese, and any Latin script with combining diacritics
has two canonical Unicode representations:

- **NFC** (precomposed): a single code point per visual character.
  Korean `한` = U+D55C (1 code point). Latin `é` = U+00E9.
- **NFD** (decomposed): a base character plus combining marks.
  Korean `한` = U+1112 + U+1161 + U+11AB (3 code points). Latin
  `é` = U+0065 + U+0301.

Both render identically in any modern text engine, but they are
different byte sequences and compare **unequal** under code-point
comparison.

ADR-0009 specifies that XTL's string comparison uses "Unicode
code-point order" — no normalization. This means:

```
NFC "한" === NFD "한"   →  false   (different code points)
@filter [Name] = "한"   →  matches only the row whose form matches
```

Where the two forms come from in real data:

- **macOS filesystem** stores filenames in NFD; copying a filename
  into a cell typically yields NFD.
- **Windows / web input** produces NFC.
- **Office365 / Excel for Windows** typically NFC.
- **Excel for Mac** can preserve either form depending on input.
- **Clipboards** propagate whatever the source had.

A typical reporting workflow mixes NFC and NFD without operators
noticing — a Korean operations team's data flowing from macOS, the
intranet web app, and a Windows-authored template easily has both
forms in one source. A `@filter [Region] = "서울"` written against
one form silently drops rows in the other form.

The reference impl already follows ADR-0009 — code-point compare
with no normalization. This ADR pins that behavior and documents
the trap so porters and authors understand it.

## Considered Options

**A. No normalization (status quo).**
Pro: matches Excel; matches current impl; no surprise mutation of
authored data; predictable. Con: silent trap for mixed-form Korean
/ Japanese / accented Latin data.

**B. Normalize to NFC before comparison.**
Pro: visually-identical strings compare equal — author-friendly.
Con: violates Excel-default principle (Excel does NOT normalize);
output data may differ from input (NFD input becomes NFC in cell
roundtrip); requires NFC implementation in every port (Unicode
data tables are ~50KB compiled).

**C. Normalize to NFC only at comparison time, preserve input form
in storage.**
Pro: comparison is author-friendly; storage is faithful. Con:
implementation complexity; subtle semantic mismatch between
"two strings compare equal" and "two strings render the same OOXML
bytes" — porters with different normalization libraries diverge.

**D. Configurable per-template flag.**
Pro: choice. Con: spec creep; group keys depend on
normalization mode which affects output grouping; introduces a
template-level config surface for one knob.

## Decision

Adopt **A** (status quo, normatively pinned). XTL 0.1 string
comparison and string operations operate on **raw Unicode code
points** as authored, without applying any normalization form.

This applies to:

- Comparison operators (`=`, `!=`, `>`, `<`, `>=`, `<=`)
- `@filter` predicates
- `@filter ... in __lists__[…]` membership checks
- `@sort` ordering
- `&` concatenation (no behavior change — already preserves bytes)
- Group key extraction for file / sheet naming
- `XLOOKUP` matching

### What this means in practice

Authors with mixed-form data have three options, none of them in
scope for XTL itself:

1. **Pre-process upstream**: normalize the source data to a single
   form (NFC is the common choice) before feeding it to xl3. Excel
   has no built-in normalize function; use the host's data
   pipeline (Python `unicodedata.normalize('NFC', s)`, JS
   `s.normalize('NFC')`, etc.).
2. **Pre-process via runtime input**: declare a normalized lookup
   value as a `__inputs__` value so the comparison happens on the
   host-prepared form. The source data still drifts, but the
   filter target is host-controlled.
3. **Accept the trap as user-visible behavior**: surface mixed
   forms in the operator UI ("3 of 117 rows had different Unicode
   normalization than expected and were excluded") so authors can
   triage.

### Why match Excel

Excel does not normalize either. `=A1=B1` in Excel returns FALSE
for NFC "한" vs NFD "한". A xl3 template that did normalize would
behave **differently from the same logic typed directly in Excel**,
which violates ADR-0023's Excel-default principle and would
surprise operators who compare results.

The choice is to make the trap visible (via this ADR + the porter
guide) rather than make it invisible-but-different-from-Excel.

### Future direction

A future ADR may introduce an opt-in normalization mode, either:

- A function like `NORMALIZE(value, "NFC")` that authors apply at
  the comparison site, or
- A template-level config flag in `__config__` that switches the
  comparison algorithm globally.

Until that ADR is drafted and accepted, comparisons are raw code
points everywhere.

## Consequences

- One conformance fixture (118) pins NFC vs NFD as **unequal** so
  no future impl change silently normalizes.
- `language.md` "Comparison Algorithm" gets a paragraph naming the
  trap.
- `PORTERS_GUIDE.md` "Language-specific gotchas" gets a fourth
  bullet (after the existing number-formatter, date-tz, and
  zero-width entries).
- No impl change required — the reference impl already follows the
  spec as written.

## References

- ADR-0009 — Comparison and string coercion (the
  no-locale-collation lineage)
- ADR-0023 — Operator coercion + Excel-default principle (the
  source of the "match Excel" rationale)
- Unicode Annex #15 (Unicode Normalization Forms)
- language.md "Comparison Algorithm"
- PORTERS_GUIDE.md "Language-specific gotchas"
