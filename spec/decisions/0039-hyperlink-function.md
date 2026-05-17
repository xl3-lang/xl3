# ADR 0039 - HYPERLINK() function

- **Status:** accepted
- **Date:** 2026-05-18
- **Spec target:** XTL 0.1
- **Affects:** `spec/language.md` § "Functions" (function table + a
  new "Hyperlink" subsection), `src/functions.ts`, the cell-writer
  path that materializes a function return value into an ExcelJS
  cell, `src/error-codes.ts` (reuses `xl3/eval/type-mismatch` from
  ADR-0019's amendment).

## Context

Operations reports routinely need clickable links inside a rendered
spreadsheet — "see invoice", "open profile", "download statement",
"go to ERP record". The current XTL function table omits any way to
produce a clickable cell from a template expression. Authors who
want a hyperlink today have two unsatisfying options:

1. Pre-bake the hyperlink into the template cell. Works for static
   URLs only; fails the common case where the URL is per-row
   (`/invoice/{id}`).
2. Hand-write an Excel `=HYPERLINK(...)` formula in the cell and
   rely on Excel to recalculate when the file is opened. This
   leaks formula evaluation out of XTL into Excel, conflicts with
   ADR-0017's "the rendered cell holds the rendered value" model,
   and fails any consumer that reads the file without
   recalculation (some viewers, headless converters, downstream
   sources).

Excel ships `HYPERLINK(url, [friendly_name])` as a built-in. JXLS
solves the same authoring need with a non-Excel `jx:link` directive.
Per ADR-0034 Corollary 2, when prior art has a *feature* XTL lacks,
the right response is to design an XTL-native form that uses Excel
syntax rather than import the prior-art directive. Excel already has
the function we want; XTL just has to evaluate it.

## Considered Options

**A. Add `HYPERLINK(url, label)` as an XTL function (chosen).**
Excel-native name; no new directive surface; composes with `&` for
per-row URL construction; the cell writer translates the return
value to ExcelJS's `{ text, hyperlink }` cell shape.

**B. Add a new `@link` directive.** Pro: directive-shape parallels
`@repeat` / `@filter`. Con: invents new XTL surface for what is
already a one-line Excel function. Per ADR-0034 Corollary 2 the
preferred form is Excel-native function over directive when the
function exists and fits. Rejected.

**C. Native Excel formula passthrough only** (`{{ "=HYPERLINK(..." }}`
escape hatch). Pro: zero new function surface. Con: requires authors
to escape `{{ ... }}` substitution, leaves the rendered cell holding
a formula not a value, and breaks consumers that don't recalculate
on open. Not ergonomic. Rejected.

**D. Make `label` optional, defaulting to the URL.** Excel's native
signature is `HYPERLINK(url, [friendly_name])` with the label
optional. Pro: matches Excel exactly. Con: ADR-0024 arity validation
is strictest when arity is fixed; templates that meant to provide
a label but typoed the second arg would silently render the URL as
the label. Rejected in favor of required-both; the URL-as-label
behavior is recovered by passing the URL as both arguments
explicitly. Reconsider in a later ADR if authors push back.

## Decision

Adopt **A**. Add `HYPERLINK(url, label)` to the XTL 0.1 function set.

### Signature

```text
HYPERLINK(url, label)
```

- **Arity.** `2` (both arguments required). Added to the
  `FUNCTION_ARITY` table per ADR-0024.
- **`url`** MUST be a String value. Empty-after-trim (per ADR-0007
  empty rules), Missing, or a non-String kind raises
  `xl3/eval/type-mismatch` (the code added in ADR-0019's amendment).
- **`label`** MUST be a String value. An empty `label` is permitted
  and produces a cell whose visible text equals the URL.
- **Return.** A hyperlink value. The cell writer materializes this
  as the rendered cell's value+hyperlink pair (see Implementation
  notes below). The visible text is `label` (or `url` when `label`
  is empty); the hyperlink target is `url`.

### Semantics (normative)

- `HYPERLINK` MAY appear anywhere a String-returning function may
  appear. When it appears at the top level of a `{{ ... }}`
  expression in a cell, the rendered cell is a hyperlink cell.
- When `HYPERLINK` appears as a sub-expression inside another
  function call or operator (e.g., `&`, `IF`'s branches), its
  hyperlink character is **lost**; only the visible text survives
  into the parent expression. The cell writer attaches the
  hyperlink only when the top-level value of the cell expression
  is a hyperlink. This matches Excel's behavior: a nested
  `HYPERLINK` inside another formula is a text value to that
  formula.
- Hyperlinks are not Date / Number / Boolean values for the
  purposes of ADR-0017's value model. They are a render-time cell
  shape, produced by this function alone. No predicate (`ISLINK`)
  is introduced.

### Implementation notes (informational)

ExcelJS represents a hyperlink cell as
`{ text: label, hyperlink: url }` on `cell.value`. The cell writer
MUST detect a hyperlink return value at the top level of a cell's
template expression and write the cell as the
`{ text, hyperlink }` pair, not as a string. When `label` is empty,
the writer uses the URL as the text so the cell remains visible.
Cells written this way inherit the template cell's style; if the
template cell's font does not have hyperlink styling, the renderer
SHOULD apply Excel's default hyperlink style (`Hyperlink` named
style) so the link is visually identifiable.

## Use Cases

Per-row invoice link, Korean B2B operations:

```text
{{ HYPERLINK("https://erp.example.com/invoice/" & [InvoiceId], "보기") }}
```

The cell shows "보기" and clicks through to the per-row invoice URL.
String concatenation uses `&` per ADR-0009.

Customer profile link with a fallback label when the name is empty:

```text
{{ HYPERLINK([ProfileUrl], IFEMPTY([CustomerName], "프로필")) }}
```

Static documentation link in a report footer:

```text
{{ HYPERLINK("https://docs.example.com/report-glossary", "용어 설명") }}
```

## Consequences

- Templates can express clickable cells inline. The previous
  workarounds (pre-baked URLs, raw Excel formulas) remain valid
  for the cases they covered; this is additive.
- Cell writer gains one new code path: detect hyperlink return at
  the top level of a cell expression, write the
  `{ text, hyperlink }` pair on the rendered cell.
- No new error code. `xl3/eval/type-mismatch` (added in ADR-0019's
  amendment) covers empty / wrong-kind arguments. `xl3/eval/arity-
  mismatch` covers the 1-arg or 3-arg-call case via the
  `FUNCTION_ARITY` table.
- Conformance corpus grows by one fixture exercising: (a) a
  static-URL hyperlink cell, (b) a per-row hyperlink with `&`
  concatenation, (c) the empty-`label` URL-as-label case, (d) a
  nested-`HYPERLINK`-loses-link case, (e) a non-String `url`
  error case.
- Future work: an optional one-arg form (option D above) and an
  `ISLINK` predicate remain candidates for a later ADR if real
  templates report the need.

## References

- ADR-0034 Corollary 2 — reimplement features in XTL syntax, not
  import them. This ADR is the first feature absorbed via that
  corollary; the inspiration is JXLS's `jx:link`, the surface is
  Excel-native `HYPERLINK`.
- ADR-0009 — Comparison and string coercion; `&` operator used in
  the per-row URL idiom.
- ADR-0017 — Source value model; hyperlink is a render-time cell
  shape, not a new value kind.
- ADR-0019 (amendment) — adds `xl3/eval/type-mismatch` used by
  this ADR.
- ADR-0024 — Function arity; `HYPERLINK` joins the
  `FUNCTION_ARITY` table at `(2, 2)`.
- `docs/internal/jxls-absorption-plan.md` § Category B (item B2)
  — promotes from "deferred" to accepted in this ADR.
- `spec/language.md` § "Functions".
