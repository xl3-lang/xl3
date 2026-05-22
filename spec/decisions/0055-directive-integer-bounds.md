# ADR 0055 — Directive integer arguments: positive-integer bounds

- **Status:** accepted
- **Date:** 2026-05-22
- **Spec target:** XTL 0.1
- **Affects:** grammar.ebnf, language.md § "Top" / "Repeat Right",
  ADR-0027

## Context

`grammar.ebnf` defines:

```
top_directive    = "@top" , integer ;
repeat_directive = "@repeat" , "right" , [ integer ] ;
integer          = digit_seq ;
digit_seq        = digit , { digit } ;
```

The integer production therefore allows `0`. The grammar has no
explicit upper bound (which is correct — it is a parsing surface,
not a semantic constraint). But it also has no statement that `0`
is *semantically* invalid.

`language.md` § "Top" says "Keeps the first N rows after filters and
sorts." For `N = 0`, the meaning is ambiguous: "the first zero rows"
could mean "produce zero rendered rows" (one reasonable
interpretation) or "the default is no truncation" (another
reasonable interpretation given `0` often means "unset" in CLI
conventions).

`language.md` § "Repeat Right" says "the column span per repeated
record; when omitted, the column span is `1`." A value of `0` is
similarly ambiguous.

The reference impl (`src/directive-parser.ts:185-198`) rejects both
via `n <= 0` and falls through to the generic
`xl3/directive/invalid-syntax`:

```
function parseTop(body: string): Directive | null {
  const n = parseInt(body, 10);
  if (isNaN(n) || n <= 0) return null;
  ...
}

function parseRepeat(body: string): Directive | null {
  const match = body.match(/^right(?:\s+(\d+))?$/i);
  if (!match) return null;
  const colSpan = match[1] ? parseInt(match[1], 10) : 1;
  if (colSpan <= 0) return null;
  return { kind: 'repeat', direction: 'right', colSpan };
}
```

The impl rejects `0`, but the spec does not. The grammar
silently allows `0`. The error message is the generic
`xl3/directive/invalid-syntax` rather than a precise
"integer must be ≥ 1" diagnostic.

This is a small surface, but it leaves three rough edges:

1. `@top 0` is grammar-legal but impl-rejected — no spec sentence
   says which is canonical.
2. The `digit_seq` production trivially admits `00`, `007`, etc. —
   leading zeros are unstated.
3. Negative integers are excluded by `digit_seq` (no `-` prefix in
   integer position), but no normative sentence says so.

## Considered Options

**A. Grammar-level: replace `integer` in directive positions with a
new `positive_integer` production.** Pro: parser-level rejection;
no semantic ambiguity. Con: grammar surface grows by one production.

**B. Prose-level: keep `integer` in grammar, add a "MUST be ≥ 1"
sentence to language.md.** Pro: minimal grammar change. Con:
"semantics rejects what grammar accepts" is the same shape that
ADR-0027 audited as user-hostile.

**C. Status quo (impl checks, spec silent).** Worst — silent
divergence between grammar and impl.

## Decision

Adopt **A**.

### Grammar changes

Add a new production:

```
positive_integer
    (* A non-empty sequence of decimal digits whose parsed value is
     * ≥ 1. Leading zeros are NOT permitted (`05` is a parse error).
     * Used in directive arguments where 0 / negative makes no sense. *)
    = non_zero_digit , { digit } ;

non_zero_digit
    = "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" ;
```

Update directive productions to use it:

```
top_directive    = "@top" , positive_integer ;
repeat_directive = "@repeat" , "right" , [ positive_integer ] ;
```

`integer` continues to exist (used by `number_literal`'s digit
sequences); `positive_integer` is additive.

### Normative prose (added to language.md)

- § "Top": "`@top N` keeps the first N rows after filters and sorts.
  N MUST be a positive integer (≥ 1). `@top 0`, `@top -5`, and
  `@top 05` are parse errors raising `xl3/directive/invalid-syntax`."
- § "Repeat Right": "`@repeat right N` (and the default-`1` form
  `@repeat right`) requires N to be a positive integer (≥ 1).
  `@repeat right 0` and `@repeat right -3` are parse errors raising
  `xl3/directive/invalid-syntax`."

### Why ≥ 1 and not ≥ 0

A `@top 0` block produces zero rendered rows, but the rest of the
sheet still renders. Authors who want to test the "no data" path
typically use an empty source workbook (already a tested shape per
ADR-0021 § "Empty source data"); `@top 0` would be a strictly
weaker tool that adds a second code path for the same outcome.
Reject the redundancy.

A `@repeat right 0` block has no semantic meaning at all (zero-
width per-record span). Reject.

### Diagnostic message

When `parseTop` / `parseRepeat` rejects on the bound:

> `@top` integer must be ≥ 1; got `0`
> `@repeat right` column span must be ≥ 1; got `0`

The error code remains `xl3/directive/invalid-syntax` per ADR-0027
(single-code-for-directive-parse-failures policy). The message
substring is stable for fixtures.

### Implementation note — leading-zero detection

The reference impl previously used `parseInt(body, 10)` which
accepts leading zeros (`parseInt("05", 10) === 5`). The new
`positive_integer` production REQUIRES that leading-zero forms be
rejected, so an impl MUST add an explicit pre-check before
delegating to `parseInt`:

```js
if (!/^[1-9][0-9]*$/.test(body.trim())) {
  throw xtlError('xl3/directive/invalid-syntax',
    `@top integer must be ≥ 1 and have no leading zeros; got "${body}"`);
}
```

A pure `parseInt`-based check is insufficient. Ports MUST add the
shape pre-check to match the grammar.

## Consequences

- Templates with `@top 0` or `@repeat right 0` (none observed in
  the production corpus) now error at parse with a precise
  diagnostic.
- `grammar.ebnf` gains the `positive_integer` production; the new
  directive productions reference it.
- Conformance fixture additions:
  - `153-top-zero-error` — `@top 0` raises
    `xl3/directive/invalid-syntax` with the "must be ≥ 1" substring.
  - `154-repeat-right-zero-error` — `@repeat right 0` raises the
    same.
  - `155-top-leading-zero-error` — `@top 05` raises the same.
- No new error code. Diagnostic substring is the contract.

## References

- ADR-0021 — Implementation-defined boundaries (the "spec-explicit
  vs. impl-implicit" pattern this ADR closes)
- ADR-0027 — Reserved column names + directive validation (the
  silent-fallthrough audit-pass theme)
- grammar.ebnf § `top_directive`, `repeat_directive`, `integer`
- language.md § "Top", "Repeat Right"
- `src/directive-parser.ts` § `parseTop`, `parseRepeat`
