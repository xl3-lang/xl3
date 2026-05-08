# Spec navigation index

A cross-reference table for porters and reviewers. Each row links a
language/evaluation section to the ADR(s) that define it and to the
conformance fixtures that validate it. Use this when you want to
answer "where is the binding text on X?" without grep.

The fixture column shows the lowest-numbered fixture(s); see
[`coverage.md`](../conformance/coverage.md) for the full ADR ↔ fixture
matrix.

| Surface | Spec section | Governing ADRs | Sample fixtures |
|---|---|---|---|
| Template blocks `{{ ... }}` | language.md "Template Blocks" | — | 001 |
| Source columns `[Col]` | language.md "Source Columns" | — | 001, 002 |
| Source-prefixed brackets `Source[Col]` | language.md "Source Columns"; evaluation.md "External Data Sources" | ADR-0012 | 069, 070, 071 |
| Literals (string / number / boolean) | language.md "Literals" | — | 011, 012 |
| Operators (`=`, `!=`, `>`, `<`, `>=`, `<=`, `+`, `-`, `*`, `/`, `&`) | language.md "Operators" | ADR-0009 | 058, 059, 061 |
| Comparison algorithm | language.md "Comparison Algorithm" | ADR-0009, ADR-0017 | 059–064, 087, 088 |
| Canonical string form | language.md "Canonical String Form" | ADR-0009, ADR-0017 | 061–063, 087 |
| `IF()` | language.md "IF" | ADR-0008 | 055–058 |
| `IFEMPTY()` | language.md "IFEMPTY" | ADR-0007 | 050, 051 |
| `XLOOKUP()` | language.md "XLOOKUP" | ADR-0013 | 074–078 |
| Aggregates (`SUM`/`COUNT`/`AVERAGE`/`MIN`/`MAX`) | language.md "Aggregates" | ADR-0007, ADR-0012 | 052, 070, 091 |
| `ROUND()` / `ABS()` | language.md "Numeric Functions" | — | 005, 016 |
| `TEXT()` | language.md "Text Formatting" | — | 011, 012, 016 |
| `ROW()` | language.md "Row and Date Functions" | — | 037 |
| `TODAY()` | language.md "Row and Date Functions" | ADR-0001 | 023 |
| `@filter` | language.md "Filter" | ADR-0007 (membership), ADR-0009 (comparison) | 003, 035, 054 |
| `@sort` | language.md "Sort" | ADR-0009, ADR-0016 | 036, 083, 084 |
| `@top` | language.md "Top" | — | 036 |
| `@repeat right` | language.md "Repeat Right" | — | 004 |
| `@source` | language.md "Source"; evaluation.md "External Data Sources" | ADR-0012 | 071, 072 |
| `@join` | language.md "Join"; evaluation.md "External Data Sources" | ADR-0014 | 079–082 |
| Group keys | language.md "Group Keys" | ADR-0016 | 015, 085, 086 |
| Empty values | evaluation.md "Empty Values" | ADR-0007 | 050–054 |
| Truthiness | evaluation.md (cross-ref) | ADR-0008 | 055–058 |
| Reserved sheets (dunder) | evaluation.md "Reserved Sheets" | ADR-0011 | 094 |
| `__config__` | evaluation.md "Template Configuration" | ADR-0011 | most |
| `__inputs__` | evaluation.md "Inputs" | ADR-0010, ADR-0011 | 065–068 |
| `__sources__` | evaluation.md "External Data Sources" | ADR-0011, ADR-0012 | 069–073 |
| `__lists__` | evaluation.md "List Sheets" | ADR-0007, ADR-0011 | 053, 054 |
| Source value model | evaluation.md "Source Value Model" | ADR-0017 | 087–090 |
| Source data model (zero rows, header reads) | evaluation.md "Source Data Model" | — | 028–031 |
| Cell text extraction | evaluation.md "Cell Text Extraction" | — | 013, 014 |
| Single-expression cells / numFmt coercion | evaluation.md "Single-Expression Cells" | ADR-0003 | 008–010 |
| Output filenames | evaluation.md "Output Filenames" | ADR-0002 | 006, 007, 019, 020 |
| Errors (catalog) | evaluation.md "Errors" | ADR-0015 | 017–022, 067, 072–082, 091 |
| Resource limits | evaluation.md "Resource Limits" | — | (implementation-defined; no fixtures) |
| Render phases | evaluation.md "Render Phases" | — | 002 |
| Ordering | evaluation.md "Ordering" | ADR-0016 | 083–086 |
| Stage 2 OOXML canonicalization | conformance/runner-protocol.md "Stage 2" | ADR-0006 | 024–027, 093 |
| Dynamic conformance assertions | conformance/runner-protocol.md "Dynamic" | ADR-0005 | 023 |

## Deferred surfaces

These are NOT in 1.0. The deferral ADR explains why and what a
future spec MUST address before adding the surface.

| Surface | Status | Deferral ADR |
|---|---|---|
| Date arithmetic (`EOMONTH`, `EDATE`, `DATEDIF`, …) | deferred | ADR-0019 |
| Locale-aware collation | deferred | ADR-0020 |
| Multi-`@join`, left-join, multi-row matches | deferred | ADR-0014 (out-of-scope section) |
| XLOOKUP wildcard / approximate / reverse | deferred | ADR-0013 (out-of-scope section) |
| Cross-writer Stage 2 gaps (default attrs, color hex case, namespace prefixes) | deferred | ADR-0006 amendment |
