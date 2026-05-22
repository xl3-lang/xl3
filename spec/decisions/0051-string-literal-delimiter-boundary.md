# ADR 0051 — String literals and template-block delimiter boundary

- **Status:** accepted
- **Date:** 2026-05-22
- **Spec target:** XTL 0.1
- **Affects:** language.md (Template Blocks, Literals), grammar.ebnf,
  ADR-0021, ADR-0028, normalizer

## Context

Audit of the reference implementation (`src/normalizer.ts:3`) found
that the template-block tokenizer is a single non-greedy regex —
`/\{\{(.*?)\}\}/g` — that is **not aware of string literals**. As a
consequence, the first `}}` encountered after a `{{` always closes
the block, even when that `}}` sits inside a `"..."` literal.

Concrete shapes that silently fall through today:

1. `{{ "abc}}def" }}` — block closes at the first `}}` inside the
   string. The lexer hands `expression = ` (or a truncated form)
   downstream; the remainder `def" }}` flows back into the cell as
   literal text. Author intent — a string containing `}}` — is
   unreachable.
2. `{{ TEXT(x, "MM}}DD") }}` — same shape. The format-string `MM}}DD`
   is impossible to express.
3. `{{ "x{{y" }}` — block opens at the leftmost `{{`. The inner `{{`
   appears inside the matched expression. The next regex iteration
   re-scans from after the cell's first `}}` and may try to open a
   second, overlapping block. Output is silently wrong.
4. `{{ "{{nested}}" }}` — nested-looking shapes are impossible to
   author because `{{` inside the string is consumed as a separator
   by the outer regex on the next scan pass.

ADR-0028 already pins string-literal *internal* rules ("no escape
sequences, matched pair only"); ADR-0021 already pins `{{ }}` as a
parse error. **Neither addresses the delimiter-recognition boundary
inside a string literal**, and `grammar.ebnf` is explicit that
delimiter scoping is *out* of scope ("the block delimiters
themselves … are described in evaluation.md") — yet evaluation.md is
also silent on this surface. This is the largest remaining silent
fallthrough in the lexer.

A parallel ambiguity exists for `column_name` (allowed to contain
`}`, `}}`, `{`, `{{` per `grammar.ebnf`): a column header named
`A}}B` would, at a different parse layer, also collide with the
delimiter scan. The reference impl is unaffected because column
names are read from data cells (not template-block contents), but
the spec should name the interaction.

## Considered Options

**A. Pin "first `}}` wins" as normative; document the workaround.**
The lexer scans for `}}` without string-literal awareness. Authors
who need a literal `}}` or `{{` inside a value hold it in
`__config__` / `__inputs__` and reference it via
`{{ __config__[key] }}`. Mirrors ADR-0028's `"`-inside-string stance.
Smallest impl change; aligns with the "template is the handover
artifact" thesis (the cell content must be straightforwardly
readable).

**B. String-literal-aware tokenizer.** Make the lexer track quote
state so `}}` inside `"..."` does not close the block. Pro: authors
can express `}}` in values directly. Con: every port has to
reimplement the same state machine; ADR-0028's "no escape sequences"
stance means `"..."` cannot itself contain `"`, so quote tracking is
simpler than full Excel, but still non-trivial; one new ADR-shaped
surface to maintain.

**C. Detect ambiguity and raise.** Lex normally (option A), but if
the *normalized* expression body contains an unbalanced `"`, raise
`xl3/parser/unbalanced-quote` instead of silent acceptance. Pro:
fail-loud per ADR-0027 / ADR-0029 audit theme. Con: a user who
writes `{{ "abc}}def" }}` does not "see" the block boundary error —
they see "unbalanced quote" which is the *symptom*, not the cause.

## Decision

Adopt **A + C combined**:

1. **First `}}` wins** is normative. The block delimiter scanner
   makes a single left-to-right pass and is NOT string-literal-aware.
2. **Detect and raise on unbalanced literals** to convert silent
   fallthrough into a stable error.

### Normative rules (added to `evaluation.md` § "Template Blocks")

A template block is opened by the substring `{{` and closed by the
**first** subsequent substring `}}` in cell-text order. The block
delimiter scanner MUST NOT track quote, bracket, or parenthesis
state — the lexical boundary is purely textual.

This means:

- A `}}` sequence inside a `"..."` string literal CLOSES the block.
- A `{{` sequence inside a `"..."` string literal does NOT
  re-open a nested block; it appears in the expression body
  verbatim and triggers a parse error from the expression parser
  (`{{` is not a valid token in XTL expression grammar).
- Authors who need a literal `}}`, `{{`, or `{` `}` pair inside a
  rendered value MUST hold the value in `__config__[key]` or
  `__inputs__[name]` (cell content can contain any character) and
  reference it via `{{ __config__[key] }}`. This mirrors the
  `"`-inside-string workaround pinned by ADR-0028.

### Detection — `xl3/parser/unbalanced-literal`

After block extraction, an expression body whose `"` character count
is odd raises `xl3/parser/unbalanced-literal` BEFORE expression
parsing proceeds. Diagnostic substring (stable for fixtures):

> Template block contains an unbalanced string literal; `}}` inside
> `"..."` does not close the block. Use `__config__` for values
> containing literal `}}` or `{{`.

This catches the most common silent-fallthrough shape:
`{{ "abc}}def" }}` parses as a block containing ` "abc` (one quote,
unbalanced) → raise. The author sees the actionable cause, not the
downstream "unexpected token" symptom.

The error is also raised for the inverse — an expression body whose
trailing characters include an unmatched closing `"` from a literal
that crossed an erroneously-detected delimiter.

### Precedence vs. ADR-0028 unbalanced quote

ADR-0028 § "String literal constraints" left unbalanced or
duplicated quote shapes (`"a"b"`, `"a`) as **implementation-
defined**. This ADR introduces a more specific error
(`xl3/parser/unbalanced-literal`) for the same shape, fired from a
deterministic odd-quote-count check at the parser front-end.

Precedence rule: an expression body whose `"` count is odd raises
`xl3/parser/unbalanced-literal` BEFORE expression parsing
proceeds, in **all** implementations. This tightens ADR-0028's
"implementation-defined" stance to a uniform error code. ADR-0028
remains the source of truth for *what* the violation is; this ADR
adds *which code* fires.

An impl that previously accepted `{{ "a"b" }}` (treating it as
"first matched pair, rest literal") now errors. The author-fix is
either to balance the quotes or hold the value in `__config__`.

### Column-name interaction

`column_name` per `grammar.ebnf` may contain `{`, `}`, `{{`, and
even `}}` as part of the column name itself (column names exclude
only `]`, CR, LF). Such names exist in source data cells and are
read correctly during source-header extraction — the data-cell
reader is independent of the template-block delimiter scanner.

BUT: such a column **cannot be referenced from a template block
using the bracket form**. The expression `{{ [A}}B] }}` parses as
block body ` [A` (the outer scanner closes at the first inner
`}}`) followed by literal text `B] }}`, which is silently wrong.
The "first `}}` wins" rule (the ADR-0051 decision) makes any
column whose header text contains `}}` unreachable via the
`[Column]` shorthand.

Authors with such a column MUST rename upstream. Recommended fix:
strip `}}` from the header in the source workbook before
conversion. The reference impl emits a warning when a source
header contains `}}` (warnings MUST NOT change output semantics
per evaluation.md § "Errors"); ports SHOULD do the same.

A column whose header text contains `{` (but not `}}`) is
reachable: `{{ [A{B] }}` — the outer scanner closes at the
trailing `}}` and the bracket-field regex consumes the `{` as part
of the column name. Only the `}}` substring inside a column name
is problematic.

## Consequences

- Templates that authored `{{ "abc}}def" }}` (extremely rare; no
  known production template does this — the JXLS / cookbook corpus
  uses `__config__` for arbitrary literals) now error loudly at
  parse time with a precise diagnostic. The same author-fix applies
  as ADR-0028: hold the value in `__config__`.
- One new error code (`xl3/parser/unbalanced-literal`) added to
  the ADR-0015 catalog and snapshot.
- The grammar's silent stance ("delimiters not modeled here") gains
  a normative companion clause in evaluation.md.
- Conformance fixtures pin three cases:
  - `141-string-literal-with-embedded-delimiter-error` — `{{ "a}}b" }}`
    raises `xl3/parser/unbalanced-literal`.
  - `142-string-literal-with-embedded-open-delimiter-error` —
    `{{ "x{{y" }}` raises the same error (the `{{` inside the
    matched body fails the expression parser; the unbalanced-quote
    pre-check catches it first because the body is `{{ "x` — odd
    quote count).
  - `143-config-workaround-for-literal-braces` — a `__config__`
    key holding the literal string `}}-marker-{{` renders verbatim
    through `{{ __config__[key] }}`.
- Reference impl change is small: add a `countUnescapedQuotes`
  helper, run it on each extracted block body, throw the new code
  when odd.
- Porters MUST implement the same scanner shape (first-`}}`-wins)
  and the same unbalanced-quote pre-check. A more aggressive port
  that implements option B (literal-aware tokenizer) is a strict
  superset — it would accept more shapes — but the conformance
  corpus only asserts the option A baseline.

## References

- ADR-0021 — Implementation-defined boundaries (empty-block error
  precedent)
- ADR-0027 — Reserved column names + directive validation (the
  "convert silent fallthrough into a coded error" pattern)
- ADR-0028 — Literal syntax constraints (the `"`-inside-string
  workaround precedent this ADR mirrors)
- ADR-0029 — Directive composition (audit-pass theme)
- grammar.ebnf § "Lexical convention" and § "string_literal"
- `src/normalizer.ts` § `TEMPLATE_BLOCK_RE`
- evaluation.md § "Template Blocks"
