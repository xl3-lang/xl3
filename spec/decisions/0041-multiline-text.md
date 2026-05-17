# ADR 0041 - Multi-line cell text

- **Status:** accepted
- **Date:** 2026-05-18
- **Spec target:** XTL 0.1
- **Affects:** evaluation.md § "Source Value Model"

## Context

Some source workbooks contain cells whose value is a string
containing one or more newline characters — multi-line free-text
memos, address blocks, multi-paragraph product descriptions, and
the like. In Excel these are authored via Alt+Enter and stored
as a single string-typed cell value with embedded `\n`
characters. The cell's `wrapText` alignment attribute controls
whether the line breaks are *displayed* as wraps.

JXLS handles multi-line cells natively — the embedded newlines
survive the render and reach the output workbook intact.

xl3's current behavior is *implicit* and undocumented:

- ExcelJS reads such cells as JavaScript strings containing the
  literal newline character.
- The substitution path (`{{ [Col] }}`) writes the string
  through to the output cell unchanged.
- The output cell inherits `wrapText` from the template cell
  (per ADR-0036, item "alignment" is preserved-verbatim).

This works — but it is not pinned. A second-language port that
uses a different reader library could silently:

- Strip `\n` characters as whitespace normalization.
- Split the value at `\n` into multiple strings and lose all
  but the first.
- Normalize CRLF differently from LF.

Per ADR-0034 Corollary 1, this is an absorb-the-experience
moment: name the behavior, choose it deliberately, pin it. The
implementation cost is approximately zero (likely already correct
in the reference impl); the value is preventing a port from
silently losing data.

## Considered Options

**A. Pin "preserve newlines verbatim" as normative.** Adopted
below. Zero impl change expected; one conformance fixture
exercises the path.

**B. Normalize newlines to a single space (or strip).** Common
in CSV pipelines, but wrong here — Excel users authored the
newlines deliberately via Alt+Enter, and the output file is
expected to look like the source content. Silent data
mutation.

**C. Leave implementation-defined.** Worst option per ADR-0034.
Each port chooses; cross-impl drift on free-text content.

## Decision

Adopt **A**. The following rules are normative.

### Read-side rules

1. A source-data cell whose value is a string containing one or
   more LF characters (`\n`, U+000A) MUST be read as a single
   string with the LF characters preserved at their original
   positions.
2. CRLF sequences (`\r\n`, U+000D + U+000A — Windows line
   endings) MUST be normalized to LF on read.
3. Lone CR characters (`\r`, U+000D — legacy Mac line endings)
   MUST be normalized to LF on read.
4. After normalization, no other transformation is applied to
   newlines: surrounding whitespace is preserved, blank lines
   between newlines are preserved, and trailing newlines are
   preserved.

### Substitution rules

5. A multi-line string passed through `{{ [Col] }}` to the
   output workbook MUST be written to the output cell with all
   LF characters preserved exactly as read.
6. The output cell's `wrapText` attribute is governed by
   ADR-0036 (preserve verbatim from the template cell), and is
   independent of whether the value happens to contain
   newlines. If the template cell was authored with
   `wrapText: true`, the output cell will visually wrap. If
   not, the lines are still present in the cell value and
   Excel's display behavior depends on its own rendering rules.
7. The engine MUST NOT add or remove `wrapText` based on
   content. Author-controlled, not engine-inferred.

### Function and operator rules

8. Functions and operators that take a string-typed argument
   see the literal LF characters as part of the string. In
   particular:
   - `TEXT(value, format)` formats the value to a string; if the
     result contains LF it is preserved.
   - String concatenation (`&` / `CONCAT()` / etc., once
     specified) joins the strings character-for-character,
     including any LFs.
   - String length functions (not yet specified by XTL 0.1; see
     ADR-0024 for the function arity table) MUST treat LF as a
     single character, not as a record separator.
9. No function MUST treat a multi-line string as multiple values.
   `{{ [Memo] }}` writes one cell containing the multi-line
   string; it does not expand into one row per line.

## Consequences

- Conformance fixture 127 (`127-multiline-cell-text`) exercises:
  - LF-only multi-line read (preserved).
  - CRLF multi-line read (normalized to LF).
  - Bare-CR multi-line read (normalized to LF).
  - Multi-line value substituted into an output cell with
    `wrapText: true` (visual wrap preserved).
  - Multi-line value substituted into an output cell with
    `wrapText: false` (line breaks present in value; display
    behavior left to Excel).
- The reference impl is expected to need **zero** code change.
  The CRLF/CR → LF normalization may already happen at the
  ExcelJS layer; if not, a small read-side normalization step
  is added. Verification is via the fixture.
- A port using openpyxl, xlnt, or similar library MUST verify
  the four normalization cases above and add explicit
  normalization where the library does not provide it.
- This ADR does not say anything about *template* cells whose
  value is a multi-line literal (e.g., a template cell
  containing `"Hello\nWorld"` with no `{{ }}` substitution).
  Those are handled by the existing "template cell value
  preserved verbatim" rule (ADR-0036 item "cell style and
  value") — newlines in template literals survive for the same
  reason newlines in source values survive: nobody asked the
  engine to mutate them.

## References

- ADR-0017 — Source value model (the document this ADR amends)
- ADR-0034 — Relationship to prior-art template engines
  (Corollary 1: absorb experience without copying syntax)
- ADR-0036 — Template feature preservation matrix
  (`wrapText` survival via cell-style preservation)
- ADR-0024 — Function arity (future string functions land here)
- `docs/internal/jxls-absorption-plan.md` (multi-line text
  absorption item)
- `evaluation.md` § "Source Value Model"
