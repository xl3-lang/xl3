# ADR 0063 — `__inputs__` `options` pipe-split rules

- **Status:** accepted
- **Date:** 2026-05-22
- **Spec target:** XTL 0.1
- **Affects:** evaluation.md § "Inputs", ADR-0010, ADR-0050

## Context

`evaluation.md` § "Inputs" defines the `options` column:

> Pipe-separated allowed values, e.g. `Seoul|Busan|Daegu`.

And ADR-0050 § "What about `options` itself":

> When the `options` cell is a template, the *full* cell template
> is evaluated to a single string, then split on `|`.

Three boundary shapes are unpinned:

1. **Single value, no pipe.** `options = "Seoul"` — one option only.
   Is this a valid declaration? (Yes intuitively, but the prose
   says "pipe-separated" without specifying minimum count.)
2. **Empty elements from doubled pipes.** `options = "a||b"` —
   pipe-split produces `["a", "", "b"]`. Is the empty middle
   element an allowed `"select"` value? Is it dropped?
3. **Leading/trailing whitespace per element.** `options = "Seoul |
   Busan | Daegu"` — pipe-split produces `["Seoul ", " Busan ", "
   Daegu"]`. Are these trimmed?

The reference impl (`src/inputs.ts`) does not trim and does not
drop empties. Host UIs receive the array `["Seoul ", " Busan ", "
Daegu"]` and render them as-is, leading to "why is there a space in
my dropdown?" reports.

A related parallel question: case-sensitivity of the host-side
`select` match. ADR-0010 says "host value MUST equal one of the
declared `options` after canonical-string-form normalization."
Canonical string form does not change case. So `Seoul` ≠ `seoul`.
This is current impl behavior, but the case-sensitivity stance is
not explicit.

## Considered Options

For empty elements:

- **A. Drop empty elements after trim.** `"a||b"` → `["a", "b"]`.
  `"a|b|"` → `["a", "b"]`. Pro: most intuitive ("trailing pipe was
  a typo"); host UIs get clean lists. Con: a user who deliberately
  declared an "empty" option (none) loses it.
- **B. Preserve empty elements as `""`.** `"a||b"` → `["a", "",
  "b"]`. Pro: faithful to the literal string. Con: "" as a UI
  option is almost never wanted; pairs poorly with ADR-0007 empty-
  value semantics (select value of "" would round-trip as required).
- **C. Raise on empty elements.** Fail loudly. Pro: catches typos.
  Con: rejects legitimate single-value declarations only if they
  have a trailing pipe accidentally.

For element whitespace:

- **D. Trim each element.** `"Seoul | Busan"` → `["Seoul", "Busan"]`.
  Pro: pleasant author experience. Con: legitimate option values
  with leading/trailing spaces become impossible.
- **E. Preserve each element verbatim.** Authors strip whitespace
  themselves. Pro: faithful. Con: silent author bug.

For case-sensitivity:

- **F. Case-sensitive match.** Current impl. Adopted.
- **G. Case-insensitive match.** Pro: forgiving. Con: ambiguous if
  options list has near-duplicates differing only by case.

## Decision

Adopt **A** + **D** + **F**.

### Normative rules (added to evaluation.md § "Inputs")

After ADR-0050 evaluation of the `options` cell to a single string:

1. **Split** the string on the literal `|` character. The split
   character is not configurable; authors who need `|` in an
   option value cannot use the `select` type.
2. **Trim** each resulting element of leading and trailing Unicode
   whitespace (per the ADR-0007 empty-value rule's whitespace set).
3. **Drop** elements that are empty per ADR-0007 after trim.
4. **Reject** the declaration when fewer than one option survives
   the drop. Empty options list raises `xl3/inputs/missing-options`
   (existing code from ADR-0010).
5. **Single-option declarations are valid.** An options string with
   no `|` (e.g., `"Seoul"`) splits to `["Seoul"]` and is a valid
   one-option select.
6. **Duplicate options are preserved.** `"a|a|b"` → `["a", "a",
   "b"]`. The duplicate is the author's choice; host UIs MAY
   collapse for display. The spec does not enforce uniqueness
   because a deliberate UX choice (sorting groups of identical
   labels) might want duplicates.
7. **Empty-string option is intentionally inexpressible.** XTL 0.1
   does not provide an escape sequence for an empty option slot
   (e.g., authoring a select with `["a", "", "b"]` as the option
   list). The trim+drop rule always removes empties. Authors who
   need an "empty / none" choice declare an explicit non-empty
   sentinel option (e.g., `"(none)|Seoul|Busan"`) and interpret it
   downstream in the template. A future ADR may add an escape
   syntax if real demand emerges.

### Host-value match (clarification)

`select`-type input value matching from the host:

1. The host-supplied value is normalized to its **canonical string
   form** per ADR-0009.
2. The match against `options` is **case-sensitive**.
3. The match is **exact** — no partial / prefix matching.

A failed match raises `xl3/inputs/select-option` (existing code).

### Why not preserve verbatim

Authoring an `options` cell as `"  Seoul   |Busan|   Daegu  "`
is far more common than authoring a deliberately whitespace-padded
option value. The trim rule cleans up real-world typos and aligns
with the broader spec posture (trim column names, trim list-sheet
cells per ADR-0007). Authors with legitimate whitespace-bearing
options use a different type (`text` with a validation function)
or strip the whitespace in their host.

## Consequences

- Templates with `options = "Seoul | Busan"` now produce
  `["Seoul", "Busan"]` (cleaner dropdowns). Templates relying on
  preserved whitespace in options change behavior — no real-world
  template in the corpus does this.
- Templates with stray double pipes (`"a||b"`) now produce `["a",
  "b"]` instead of three elements.
- Conformance fixture additions:
  - `175-options-single-value-valid` — `options = "Seoul"` is a
    one-option select.
  - `176-options-empty-elements-dropped` — `options = "a||b|"`
    yields `["a", "b"]`.
  - `177-options-element-whitespace-trimmed` — `options = " a | b "`
    yields `["a", "b"]`.
  - `178-options-all-empty-error` — `options = "||"` raises
    `xl3/inputs/missing-options`.
  - `179-options-duplicate-preserved` — `options = "a|a|b"` yields
    `["a", "a", "b"]`.
- No new error code (reuses `xl3/inputs/missing-options` and
  `xl3/inputs/select-option`).

## References

- ADR-0007 — Empty value definition (the trim-then-drop rule)
- ADR-0010 — `__inputs__` schema
- ADR-0050 — Template inputs as XTL expressions (the `options`-as-
  template behavior this ADR refines)
- evaluation.md § "Inputs"
