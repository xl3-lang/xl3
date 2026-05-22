# ADR 0052 — Cell expression classification: single vs mixed text

- **Status:** accepted
- **Date:** 2026-05-22
- **Spec target:** XTL 0.1
- **Affects:** evaluation.md § "Single-Expression Cells" / "Mixed
  Text Cells", language.md § "Template Blocks", renderer

## Context

`evaluation.md` defines two cell kinds:

> *Single-Expression Cells* — A cell whose complete content is one
> template expression
>
> *Mixed Text Cells* — A cell containing literal text around one
> or more expressions

These prose definitions leave two boundary cases ambiguous:

1. **Surrounding whitespace.** A cell whose value is `  {{ [X] }}  `
   (leading/trailing whitespace, no other text). Is the "complete
   content" the trimmed value (single-expression) or the raw value
   (mixed-text — "literal text around" the block)?
2. **Adjacent blocks with no separator.** A cell whose value is
   `{{ [X] }}{{ [Y] }}` — two blocks abutting, no literal text
   between them. The prose says mixed-text requires "literal text
   around"; with no literal text, neither definition cleanly fits.

The reference impl picks an answer for both — `isSingleExpression`
at `src/renderer.ts:756` is `/^\{\{\s*((?:(?!\}\}).)+)\s*\}\}$/`:

- Anchored `^...$` → ANY surrounding text disqualifies single-
  expression status. `  {{ X }}` is mixed-text.
- Single block only → adjacent blocks are mixed-text.

But this is unwritten. A second port could reasonably trim the cell
first (treating `  {{ X }}  ` as single-expression) or could let
adjacent blocks count as single (concatenating their results).
Different choices change observable output because single-expression
cells preserve evaluated value type and apply numFmt-aware coercion,
while mixed-text cells always render as canonical strings.

## Considered Options

**A. Trim then classify.** Strip leading/trailing whitespace from
the cell before checking single-expression shape. Single block with
surrounding whitespace becomes single-expression. Pro: matches
intuitive author mental model ("I just added a space, why did my
number format break?"). Con: silently masks authoring mistakes;
introduces an asymmetric rule (whitespace stripped, but `{{X}}{{Y}}`
still mixed-text).

**B. Anchored match — surrounding ANYTHING disqualifies.** Match
the reference impl exactly: cell must be `{{...}}` with no
surrounding characters of any kind. Pro: predictable; symmetric;
preserves the visual signal "this cell does NOT have anything but
the placeholder, so the renderer treats it specially." Con: an
accidentally-added trailing space silently changes output shape.

**C. Hybrid — trim, then anchored.** Trim leading/trailing
whitespace per the template-block whitespace-insignificance rule
(language.md § "Template Blocks") then apply anchored match. So
`  {{ X }}  ` is single-expression but `text {{ X }}` is mixed-text
and `{{X}}{{Y}}` is mixed-text. Pro: extends the in-block whitespace-
insignificance rule consistently outward to cell-level; matches
author intuition. Con: introduces a new trim point; reference impl
behavior changes.

## Decision

Adopt **C** (trim then anchored).

### Normative classification rule

A cell is a **single-expression cell** if and only if, after
trimming Unicode whitespace from the start and end of the cell's
text-extracted value (per `evaluation.md` § "Cell Text Extraction"),
the result matches exactly one template block:

```
^\{\{ <expression> \}\}$
```

with no characters before `{{` or after `}}`. The `<expression>`
body is itself trimmed of leading/trailing whitespace per
language.md § "Template Blocks".

Otherwise the cell is a **mixed-text cell** (including the case
where the cell contains zero template blocks — in which case it is
a static cell, a sub-kind of mixed-text that produces the verbatim
value).

Concrete classifications:

| Cell content | Kind |
|---|---|
| `{{ [X] }}` | single-expression |
| `  {{ [X] }}  ` (surrounding whitespace only) | single-expression |
| `{{ [X] }}{{ [Y] }}` (adjacent blocks, no separator) | mixed-text |
| `text {{ [X] }}` | mixed-text |
| `{{ [X] }} {{ [Y] }}` (separated by single space) | mixed-text |
| `\n{{ [X] }}\n` (surrounding newlines only) | single-expression |
| literal `{{ "abc" }}` with stray trailing tab | single-expression |
| (any cell with zero `{{` blocks) | mixed-text / static |

The whitespace trimmed for classification purposes does NOT change
the value written when the cell is mixed-text; if a cell *is*
mixed-text, the surrounding whitespace is part of the rendered
string.

### Adjacent-block diagnostic (informational)

Adjacent template blocks (`{{ X }}{{ Y }}`) are not erroneous — they
just classify as mixed-text. The two results concatenate via
canonical string form per ADR-0009. This is the same output an
author would get with a single explicit `&`-joined expression:

```text
{{ [X] }}{{ [Y] }}     ≡     {{ [X] & [Y] }}
```

The single-expression equivalent (`{{ [X] & [Y] }}`) preserves
numFmt coercion for the underlying value when applicable; the
adjacent form does not (mixed-text always renders as string per
evaluation.md). Authors who care about cell numFmt coercion SHOULD
use the explicit `&` form.

### Implementation note (non-normative)

The reference impl's `isSingleExpression` regex MUST be applied to
the cell text **after** trimming. The current implementation does
not trim before applying the regex; this ADR is a behavior change.
The conformance corpus pins the new behavior via fixture 144.

## Consequences

- A cell of `  {{ [Amount] }}` with `numFmt = "#,##0.00"` now renders
  as a number with the thousands-separator formatting applied. Prior
  to this ADR the impl silently treated it as mixed-text and
  rendered a canonical-string number with no grouping. This is a
  behavior change for templates with stray whitespace; the new
  behavior is the more-helpful interpretation and matches Excel's
  treatment of leading/trailing spaces in formulas.
- A cell of `{{ [X] }}{{ [Y] }}` (no separator) is normatively
  mixed-text; the result is the canonical-string concatenation.
  This was the prior reference-impl behavior, now pinned.
- evaluation.md gains two sentences in "Single-Expression Cells"
  pinning the trim-then-match rule and one sentence in "Mixed Text
  Cells" pinning the adjacent-blocks case.
- Conformance fixture additions:
  - `144-single-expression-with-surrounding-whitespace` — leading +
    trailing whitespace around a single block; numFmt applies.
  - `145-adjacent-blocks-mixed-text` — `{{ [A] }}{{ [B] }}` renders
    as canonical-string concatenation; numFmt does NOT apply.
- No new error codes. Both shapes are valid; the ADR only pins
  classification.

## References

- ADR-0009 — Comparison and string coercion (canonical string
  form for mixed-text rendering)
- ADR-0023 — Operator coercion + Excel-default principle (the
  "single-expression preserves type, mixed-text collapses to
  string" asymmetry)
- ADR-0021 — Implementation-defined boundaries (the "empty
  template block is error" precedent for cell-shape classification)
- evaluation.md § "Single-Expression Cells" / "Mixed Text Cells"
- language.md § "Template Blocks" (in-block whitespace-
  insignificance)
- `src/renderer.ts` § `isSingleExpression`
