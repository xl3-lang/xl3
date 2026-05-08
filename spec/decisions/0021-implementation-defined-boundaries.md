# ADR 0021 - Implementation-defined boundaries

- **Status:** accepted
- **Date:** 2026-05-08
- **Spec target:** XTL 0.1 (1.0 cut)
- **Affects:** evaluation.md, language.md, PORTERS_GUIDE.md

## Context

XTL 0.1 has a portable conformance contract — same template + same
data → same output across implementations — but the contract is
necessarily silent on questions where reasonable implementations
diverge. Memory streaming, sync vs. async, host integration patterns,
and a handful of edge cases are not part of the conformance shape.

A porter who reads the spec straight through can encounter these
silences and reasonably guess wrong. Two ports could each be
internally consistent, both pass conformance, and still disagree on
behavior in a corner the spec never names. That is exactly the kind
of silent divergence ADR-0004's coupling audit warned against.

This ADR enumerates the deliberate gaps and classifies each as
**implementation-defined** (the spec mandates nothing; ports may
choose) or **error** (a specific behavior is required). It does not
introduce new normative behavior — it makes explicit what was already
silent.

## Considered Options

**A. Leave silences as silences.** Pro: minimal spec churn. Con: the
silences become discovery work for every porter, and divergent
choices accumulate before anyone notices.

**B. Mandate one behavior per gap (turn every silence into a MUST).**
Pro: maximum portability. Con: many of the gaps are genuine impl
choices (Python is sync, JS is async; C++ would stream where Node
loads). A blanket MUST forces ports into uneconomic shapes.

**C. Catalog the gaps with the contract for each one — most
implementation-defined, a few errors.** Pro: porters know what they
can choose vs. what is fixed. Con: requires careful enumeration; we
may miss a gap and have to amend.

## Decision

Adopt option C. The following section is the catalog. Each entry
states the spec's position; impls SHOULD document their own choice in
their README when the position is "implementation-defined."

### Memory and streaming model

**Position:** implementation-defined.

XTL does not mandate that implementations stream rows, hold the
entire source in memory, or impose any specific working-set bound.
Reference impl loads the entire source workbook into memory via
ExcelJS; ports that target larger inputs (Apache POI streaming
events, openpyxl `read_only` mode) MAY stream and SHOULD document
the row-count threshold above which they switch.

Hosts that accept untrusted templates enforce caps at the layer
above the engine. See evaluation.md "Resource Limits".

### Sync vs. async API shape

**Position:** implementation-defined.

The reference impl returns `Promise<...>` because ExcelJS is async.
A port whose Excel library is sync (openpyxl, ClosedXML) should
return values directly. PORTERS_GUIDE.md "What you MUST NOT copy"
covers this in more detail; the contract is "every value the spec
defines is computed correctly," not "every function returns a
Promise."

### Native Excel formulas in source cells

**Position:** required behavior, codified.

A source cell containing a native Excel formula (`=SUM(A1:A10)`,
`=VLOOKUP(...)`, etc.) is read by its **cached result**. The
implementation MUST use the cached result if present and MUST raise
`xl3/cell/formula-no-cache` if the cached result is missing.

Implementations MUST NOT evaluate the formula themselves. XTL is a
template engine, not a spreadsheet calculator; injecting a formula
evaluator would create version-skew between Excel's calc engine and
the port's calc engine, which immediately breaks portability.

Conformance fixtures 014 (cached present) and 018 (cached missing)
pin this.

### Native Excel formulas in template cells

**Position:** implementation-defined.

A template cell whose value is a native Excel formula (no `{{ ... }}`
delimiters) is preserved verbatim in the output. How the
implementation handles a formula whose value depends on a row that
shifted during data-block expansion is not specified — the formula
may end up referencing the wrong row. Authors should not embed
native formulas inside data blocks; use XTL aggregates / lookups
instead.

### `TEXT()` format extensions

**Position:** core table is portable; extensions are
implementation-defined.

`language.md "Text Formatting"` lists the core format tokens that
every conforming impl supports identically (`YYYY-MM-DD`, `0`,
`#,##0`, `0.00`, `#,##0.00`, plus the basic date letter set).
Implementations MAY accept additional format strings (currency
symbols, locale-specific tokens, locale month names) as extensions.

Templates that use only the core table are portable. Templates that
use extensions are NOT portable across ports and SHOULD NOT appear
in the conformance corpus. The conformance runner does not assert
output for fixtures that use extension formats; fixture 029
documents this boundary.

### Merge cells and row expansion

**Position:** required behavior, codified.

When a data block expands and shifts subsequent rows, merge ranges
that overlap or sit below the expansion point MUST be preserved
relative to their new row positions. Specifically:

- Merges that originally spanned rows entirely above the data block
  are unchanged.
- Merges that originally spanned rows entirely below the data block
  shift down by `(rendered_rows - template_rows)`.
- Merges that overlap the data-block range are
  **implementation-defined** in detail — reference impl preserves
  the merge by re-applying it after splice; ports MAY preserve,
  drop, or split. Templates SHOULD avoid merges that span data-block
  boundaries.

### `__config__` author-defined keys

**Position:** required behavior.

`__config__` carries reserved keys (`name`, `source_sheet`,
`source_table`, `output_file_pattern`, `match_pattern`) plus an
arbitrary set of **author-defined keys** that the template may
reference via `{{ __config__[mykey] }}`. Author keys are read as
strings (no type coercion at parse time); they MUST NOT collide with
reserved key names. The set of reserved keys is normative; everything
else is author-defined.

This pattern lets templates centralize a constant ("report title",
"report quarter") in one place without making it a runtime input.

### Empty source data (zero rows)

**Position:** implementation-defined output, no error.

A source workbook with the source_table headers but zero data rows
is valid. A data block over zero rows expands to zero rendered rows;
static cells in the surrounding sheet still render once. The output
file IS produced — empty data does not error.

Aggregate functions over zero rows return `0` (`SUM`, `COUNT`,
`AVERAGE`) or empty string (`MIN`, `MAX`); this is normative per
fixture 052.

### Sheet-name collisions after group-key sanitization

**Position:** implementation-defined.

Two distinct group keys whose rendered sheet names collapse to the
same string (after sanitizeSheetName per ADR-0011 / language.md)
produce a collision. The reference impl skips the second occurrence
silently; ports MAY error, suffix-disambiguate, or skip.

Templates SHOULD pick group keys whose values cannot collide after
Excel's 31-char-and-no-`[]:\\/?*` constraint.

### Empty template block `{{   }}`

**Position:** error.

A template block with no content (whitespace-only between `{{` and
`}}`) is a parse error. Implementations SHOULD raise
`xl3/parser/empty-block` (a reserved code, currently emitted by the
reference impl as a generic parse error). Conformance fixture
coverage is implicit — no existing fixture uses empty blocks; ports
SHOULD verify their behavior matches the reference impl.

### Non-template, non-reserved sheets in input template

**Position:** implementation-defined.

A template workbook may contain sheets that are neither sheet
templates (i.e., not referenced by `output_file_pattern` or sheet
templates) nor reserved (`__config__` etc.). The reference impl
copies them through to output unchanged. Ports MAY copy, strip, or
warn. Authors SHOULD assume "passes through" for portability.

## Consequences

- Porters get a single page with every gray-area answer, instead of
  discovering them through fixture failures.
- Test coverage for the "error" entries (native-formula no-cache,
  empty template block) is already in place via fixtures 018 and the
  parser. Test coverage for the "implementation-defined" entries is
  intentionally absent — the conformance corpus must NOT assert
  specific behavior in these areas.
- Future ADRs MAY tighten an entry from "implementation-defined" to
  "required" if a real divergence between two ports causes pain.
  Loosening (required → implementation-defined) would be breaking
  and requires a major spec bump.

## References

- ADR-0004 — Reference impl coupling audit (informational)
- ADR-0011 — Reserved sheet naming
- ADR-0014 — `@join` (gives an example of out-of-scope explicit
  enumeration)
- evaluation.md "Resource Limits"
- evaluation.md "Single-Expression Cells"
- PORTERS_GUIDE.md "What you MUST NOT copy from the TS impl"
