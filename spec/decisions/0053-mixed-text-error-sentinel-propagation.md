# ADR 0053 — Mixed-text propagation of Excel error sentinels

- **Status:** accepted
- **Date:** 2026-05-22
- **Spec target:** XTL 0.1
- **Affects:** language.md § "Arithmetic", evaluation.md § "Source
  Value Model", ADR-0017, ADR-0025

## Context

`language.md` § "Arithmetic" pins the rendering of `#DIV/0!` in
three positions: numeric single-expression cell (real Excel error
cell), text-format single-expression cell (the string `"#DIV/0!"`),
and mixed-text / `&` concatenation (the string `"#DIV/0!"`
substituted at the position). That paragraph covers division by
zero per ADR-0025.

It does NOT cover the other six Excel error sentinels — `#N/A`,
`#VALUE!`, `#REF!`, `#NAME?`, `#NUM!`, `#NULL!`. These never arise
from a spec-conformant operation *as the operation's result*
(XLOOKUP no-match raises `xl3/xlookup/no-match`, etc.), but they
DO appear when:

- A source cell contains the error directly (Excel pre-populated).
- A formula cell's cached result is one of the sentinels.

ADR-0017 says such source values flow as **empty** per ADR-0007:
they participate in `IFEMPTY`, `COUNT([field])`, and the comparison
algorithm as empty. That is well-defined for the *read* side.

What is missing is the *write* side: if an author writes
`{{ IFEMPTY([cell-that-is-N/A], "missing") }}`, the result is
`"missing"` (good, defined by ADR-0017). But if they write
`{{ [cell-that-is-N/A] }}` in a numeric-formatted single-expression
cell, what is the rendered output? The empty-on-read rule says it
flows as empty; ADR-0007 says empty stringifies to `""`; numFmt
coercion of `""` to a number is `xl3/cell/numfmt-coercion` per
ADR-0026. That is the *current* impl behavior, but it is not
explicitly stated.

The mixed-text case is even less clear. `Order date: {{ [cell-N/A] }}`
— is the empty value rendered as `""` (so the cell reads
`"Order date: "`), or as the sentinel string (so the cell reads
`"Order date: #N/A"`)?

ADR-0025 set the precedent for `#DIV/0!`. This ADR completes the
matrix for the other six.

## Considered Options

**A. Treat all seven sentinels uniformly via the empty-value rule.**
A source-side error reads as empty (ADR-0017). In mixed-text it
contributes `""` to the rendered string. In a numeric single-
expression cell it raises `xl3/cell/numfmt-coercion`. Most
consistent with ADR-0017.

**B. Pass through the sentinel string in mixed-text only.** A
source `#N/A` reads as empty for IFEMPTY/COUNT semantics, but when
substituted in a mixed-text cell, the literal sentinel string
appears. Pro: matches Excel display intuition (an error stays
visible). Con: split semantics — the same value behaves one way for
predicates, another for rendering.

**C. Carry the sentinel as a tagged error value that propagates
through expressions.** A `#VALUE!` source flows through `+`, `&`,
comparisons as an "error" type. This is what Excel does internally.
Pro: most Excel-faithful. Con: large new typing surface; needs an
error-arithmetic table; out of scope for 0.1.

## Decision

Adopt **A** (uniform empty-value treatment).

### Normative rules

The six error sentinels `#N/A`, `#VALUE!`, `#REF!`, `#NAME?`,
`#NUM!`, `#NULL!` — when read from a source cell or as a formula
cell's cached result — read as the **empty value** per ADR-0017
and ADR-0007. This is unchanged from ADR-0017.

For the write side:

1. **Single-expression cells.** When the cell value is empty and
   the template cell has a number/date numFmt, coercion fails per
   ADR-0026 with `xl3/cell/numfmt-coercion`. When the template cell
   has the text format `@` or no format, the cell renders as the
   empty string `""`. (No change from current ADR-0026 contract;
   this ADR makes it explicit that the contract covers all seven
   sentinels.)
2. **Mixed-text cells.** An empty value (including any of the seven
   sentinels read from source) contributes the empty string `""` at
   its position in the rendered string. `Order date: {{ [na] }}`
   with `[na] = #N/A` renders as `Order date: ` (with the trailing
   space preserved).
3. **`&` concatenation.** Same as mixed-text — each operand
   stringifies via canonical string form (ADR-0009), and empty
   stringifies to `""`.
4. **`#DIV/0!` exception preserved (ADR-0025).** Division by zero
   *during XTL evaluation* is the only sentinel that the engine
   itself can produce. It does NOT read as empty — it is an
   evaluation-time error sentinel. ADR-0025's three-way table
   continues to apply:
   - Numeric single-expression cell → real `#DIV/0!` error cell.
   - Text-format single-expression cell or mixed-text cell or `&`
     position → the string `"#DIV/0!"` substituted at the position.
   - Inside a further arithmetic operator → `xl3/eval/operand-
     coercion`.

The asymmetry is intentional: the **six source-side sentinels**
flow as empty (uniform), while the **one engine-produced sentinel**
(`#DIV/0!`) is the Excel-visible string. Authors who want to mark
a source-side `#N/A` visibly in output wrap with
`IFEMPTY([col], "N/A")` per the existing pattern.

### Warning requirement (normative)

Because the read-side empty-flow rule silently suppresses error
sentinels at the rendering layer (a `#N/A` cell becomes an empty
string in mixed-text), implementations MUST emit a warning the
first time each error sentinel is encountered per source column.
The warning carries the source name, the column name, the row
index, and the sentinel value. Warnings MUST NOT change output
semantics (evaluation.md § "Errors"); they exist to surface data-
quality issues that the empty-flow rule would otherwise hide.

The warning emission is normative; the warning *transport*
(stderr, structured warning array on the result, host callback)
is implementation-defined. Hosts that need to fail on warnings
opt into that policy at the host layer.

`#DIV/0!` produced by engine evaluation (the one engine-produced
sentinel, per ADR-0025) does NOT trigger the warning — it is an
expected outcome of a template-authored division-by-zero, not a
data-quality signal.

### Why not pass through the sentinel string in mixed-text

Option B's split semantics — "empty for predicates, sentinel for
rendering" — is the most surprising shape for authors. An author
who writes `Order date: {{ [date] }}` does not expect `Order date:
#N/A` to flow through to the output — they expect either an empty
trailing position (defined by the empty-value rule) or a clean
"missing" marker (which they author themselves with `IFEMPTY`). The
spec picks the predictable rule and gives authors the
`IFEMPTY([col], "missing")` workaround.

## Consequences

- The rendering behavior of all seven Excel error sentinels in
  every cell shape (single-expression numeric, single-expression
  text, mixed-text, `&` concat) is now fully specified.
- No new error code. `xl3/cell/numfmt-coercion` (ADR-0026) already
  covers the single-expression-numeric path; ADR-0025 already
  covers `#DIV/0!`.
- Conformance fixture additions:
  - `146-source-error-sentinel-mixed-text` — a source cell with
    `#N/A` rendered in a `Status: {{ [val] }}` mixed-text cell
    produces `Status: `.
  - `147-source-error-sentinel-ifempty-marker` — same source cell
    with `{{ IFEMPTY([val], "missing") }}` renders `missing`.
  - `148-source-error-sentinel-numfmt-coercion-error` — same source
    cell in a `{{ [val] }}` single-expression with `numFmt =
    "#,##0"` raises `xl3/cell/numfmt-coercion`.
- Reference impl change: none. This ADR documents and pins existing
  behavior; the rules are derived from the composition of ADR-0017
  + ADR-0026 + ADR-0009.
- Porters using a library that surfaces the error-cell sentinel
  differently (e.g., openpyxl returns the string `"#N/A"` directly)
  MUST add a read-side normalization that maps the seven sentinels
  to the empty value before downstream evaluation.

## References

- ADR-0007 — Empty value definition (the read-side rule)
- ADR-0009 — Comparison and string coercion (canonical string form
  for empty)
- ADR-0017 — Source value model (error cells → empty)
- ADR-0025 — Division by zero (the one engine-produced sentinel)
- ADR-0026 — Empty value lifecycle (numFmt coercion of empty)
- language.md § "Arithmetic" (the `#DIV/0!` mixed-text rule)
- evaluation.md § "Source Value Model"
