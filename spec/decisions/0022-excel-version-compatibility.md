# ADR 0022 - Excel version compatibility

- **Status:** informational
- **Date:** 2026-05-08
- **Spec target:** XTL 0.1
- **Affects:** evaluation.md, ADR-0006, ADR-0017, ADR-0021, PORTERS_GUIDE.md

## Context

xl3 reads `.xlsx` files via OOXML (ISO/IEC 29500). The format is
standardized, but the writers that produce `.xlsx` differ —
Microsoft Excel for Windows (2007+ across many sub-versions), Excel
for Mac, Excel Online, Excel Mobile, Excel 365 (with dynamic
arrays), LibreOffice Calc, Apple Numbers, Google Sheets export, and
the various headless libraries (ExcelJS, openpyxl, Apache POI,
etc.).

This ADR catalogs which Excel-version differences XTL 0.1 is
deliberately immune to, which it leaves implementation-defined,
and which authoring patterns the spec recommends users avoid for
portability. Without a consolidated answer, every adopter
rediscovers the same matrix.

This ADR does not introduce new normative behavior — it makes
explicit how XTL 0.1's existing rules interact with the Excel
version matrix, and recommends practices for templates that need
to flow across environments.

## Considered Options

**A. Defer entirely.** "Excel compatibility" is a topic, not a
decision. Pro: minimal spec churn. Con: every porter and adopter
hits the same questions about date systems, dynamic arrays, charts,
etc.

**B. Mandate one Excel version as the reference target.** Pro: max
clarity. Con: locks XTL to a single vendor's product line, and
half the existing Excel installs are not Excel 365.

**C. Catalog each axis with its current XTL position — most
"version-agnostic by design," some "implementation-defined," and a
recommended-author-practices list.** Pro: matches the actual shape
of the situation; the spec already handles most axes via existing
ADRs (cached formula reads, UTC dates, structured-ref form). Con:
requires careful enumeration; new versions may add axes we miss.

## Decision

Adopt option C. The catalog below states XTL 0.1's position on each
axis where Excel-version differences could plausibly affect output.

### Axes XTL is deliberately immune to

These are designed-in invariants. A template authored in Excel 2010
and rendered against data exported from Excel 365 produces the
same XTL output as the reverse pairing.

**Cached formula results** (per ADR-0021).
A source cell with a native Excel formula is read by its cached
result. Implementations MUST NOT evaluate the formula. Excel's
calc engine version, locale, and the new functions added in 2013 /
2016 / 2019 / 365 are therefore irrelevant — the result was
computed and serialized before xl3 saw the file.

**Date components in UTC** (per ADR-0017).
Dates extracted via UTC accessors. ExcelJS and equivalent
libraries anchor timezone-naive Excel serials at UTC midnight; xl3
reads from there. Host TZ (`TZ=Asia/Seoul`, etc.) does not affect
output. Verified by the 3-TZ CI matrix.

**Cell value types**.
String, Number, Boolean, Date have stable OOXML serialization
across all Excel versions. Empty/missing semantics are codified by
ADR-0007 against the cell value layer, not the OOXML serialization
layer.

**Stage 1 conformance**.
Cell-value comparison is the conformance default and is by design
oblivious to OOXML serialization choices. A template + data pair
that passes Stage 1 in one Excel version passes in any other.

### Axes XTL leaves implementation-defined

Reasonable Excel versions disagree here. Templates that depend on
these axes are not portable across environments.

**Date system: 1900 vs 1904.**
Excel for Windows defaults to the 1900 date system (with the
notorious Feb 29 1900 leap-year bug); Excel for Mac historically
defaulted to 1904. Both are still supported via the `date1904`
attribute in `xl/workbook.xml`. xl3 trusts ExcelJS's interpretation
of the workbook's declared system: a Date object reaching xl3 is
correct relative to the declared system. **What xl3 does NOT do:**
verify that template and data agree on the date system. If a 1900
template is rendered against 1904 data (or vice versa), serial
numbers shift by 4 years.

Recommendation: pick one date system per organization (1900 is
overwhelmingly more common), keep both template and data on it.
Declare it explicitly in the template's workbook properties so it
survives copy/paste between Excel installs.

**Dynamic arrays and spilled formulas (Excel 365+).**
`=FILTER()`, `=SORT()`, `=UNIQUE()`, `=SEQUENCE()`, etc. produce
spilled output. ExcelJS's behavior on spilled cached results is
not part of the XTL contract. Templates SHOULD NOT rely on
dynamic-array native formulas; use XTL's `@filter`, `@sort`, and
`@top` directives instead, which produce deterministic output
under all Excel versions.

**Cross-writer OOXML drift (Stage 2).**
ADR-0006 amendment lists three known gap items the canonicalizer
does not yet normalize: default-attribute equivalence (Microsoft
Excel emits `applyFont="0"` where ExcelJS omits it),
color-hex case (`FF000000` vs `ff000000`), and namespace prefix
bindings. A template authored in Microsoft Excel and a template
authored in ExcelJS may produce byte-different OOXML for the same
content. Stage 1 conformance is unaffected; Stage 2 is the
arena where this matters. Conformance fixture 093 is the scaffold
for closing this; until it is exercised against a real
Excel-authored expected.xlsx, the gap is documented but unresolved.

**`TEXT()` format-string extensions** (per ADR-0021).
Core format tokens (`YYYY-MM-DD`, `0`, `#,##0`, `0.00`,
`#,##0.00`, the basic date letter set) are portable. Locale
identifiers like `[$-409]`, currency symbols, and Excel 365's new
tokens are implementation-defined extensions. Templates that need
portability use only core tokens.

**Charts, images, pivot tables, conditional formatting in
templates.**
xl3 preserves these elements verbatim from input to output but
does NOT recompute references after a data block expands. A chart
referencing `Sheet1!$A$2:$A$10` will still reference that range
even if the data block grew the rendered table to row 50. Use
charts/pivots only against ranges that don't shift, or recompute
them outside xl3 (in Excel, after rendering).

**Native (non-XTL) Excel formulas in template cells** (per
ADR-0021).
A template cell whose value is a native Excel formula (no
`{{ ... }}` delimiters) is preserved verbatim. Whether such a
formula's range references survive the data-block row shift is
unspecified. Authors SHOULD not embed native formulas inside data
blocks — use XTL aggregates / lookups instead.

### Out of scope (file-format level)

**`.xlsm` (macro-enabled workbooks).**
xl3 does not accept xlsm input. Macros are a security and
portability risk that the engine has no business interpreting.

**`.xlsb` (binary workbook format).**
Not standardized via OOXML; Excel-only. xl3 does not parse it.

**Older `.xls` (binary BIFF).**
Pre-2007, deprecated by Microsoft. xl3 does not parse it.

**Excel-encrypted / DRM-protected workbooks.**
Not in scope. Hosts unlock these upstream before passing buffers
to xl3.

### Authoring guidance for portable templates

1. **Pick one Excel environment per organization** — ideally the
   same major Excel version everyone uses to author and consume.
2. **Use only XTL's `{{ ... }}` template syntax** for cells whose
   value depends on data. Native Excel formulas in template cells
   render verbatim and won't shift their references when data
   blocks expand.
3. **Stick to `TEXT()` core formats** for date and number
   formatting. Locale-specific format codes are non-portable.
4. **Avoid charts, pivots, and conditional formatting** that
   reference data-block ranges; their references won't shift.
5. **Date system: 1900** — workbook properties default. Don't
   bring 1904 templates into a 1900 organization (or vice versa).
6. **No dynamic-array native formulas** in templates. XTL's
   `@filter`/`@sort`/`@top` directives are the portable shape.
7. **No xlsm**, no xlsb, no encrypted workbooks. xl3 only
   accepts plain xlsx.

## Consequences

- Adopters get a single page documenting the matrix instead of
  rediscovering it during integration.
- The catalog is enumerative — new Excel versions may introduce
  axes we have not foreseen (Excel 365 already added dynamic
  arrays mid-flight). Future ADRs amend this one as new
  axes appear.
- Most axes resolve to "use existing XTL features and you'll be
  fine"; the catalog primarily redirects users away from native
  Excel features that xl3 cannot guarantee across versions.
- The cross-writer Stage 2 gap (ADR-0006 amendment) is the only
  axis where xl3's own implementation has a real un-checked
  liability. Closing fixture 093 closes that liability.

## References

- ADR-0006 — Stage 2 OOXML conformance (cross-writer canonicalizer scope)
- ADR-0017 — Source value model (Date UTC discipline)
- ADR-0021 — Implementation-defined boundaries (native formulas, TEXT extensions)
- evaluation.md "External Data Sources", "Resource Limits"
- PORTERS_GUIDE.md "Language-specific gotchas" (Date timezone trap)
- conformance/fixtures/093-stage2-excel-authored-expected (cross-writer fixture scaffold)
