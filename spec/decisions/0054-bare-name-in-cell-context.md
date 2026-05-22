# ADR 0054 — Bare name in cell context

- **Status:** accepted
- **Date:** 2026-05-22
- **Spec target:** XTL 0.1
- **Affects:** language.md § "Source Columns" / "Group Keys",
  evaluation.md, error catalog (ADR-0015)

## Context

`language.md` § "Source Columns" says:

> Bare names such as `{{ Customer }}` are not source column
> references in cells. Bare names are reserved for sheet and file
> group keys.

This pins the *non-meaning* (bare names ≠ column refs in cells) but
not the *error contract*. What actually happens when an author
writes `{{ Customer }}` in a data cell?

The grammar's `primary_expr` production allows `literal`,
`function_call`, `bracket_field`, `source_bracket_field`,
`reserved_ref`, and parenthesized `expression`. A bare identifier
`Customer` (no parens) does NOT match `function_call` (needs `()`)
and does NOT match any other primary. The grammar therefore rejects
it as a parse error — but the spec does not say which error code,
and the reference impl currently treats unmatched bare names as
literal pass-through (the entire `{{ Customer }}` block evaluates
as the string `"Customer"` or falls through to "unknown name"
depending on the parser branch).

A parallel ambiguity exists for the filename pattern:
`{{ Customer }}_report.xlsx`. Per language.md § "Group Keys", a
filename MAY contain a bare group key. If `Customer` is not
declared as a group key (no `output_file_pattern` group-key
binding) and not a runtime input, what is the error?

Three silent fallthroughs identified in the reference impl
(`src/template-eval.ts`):

1. Bare identifier in a cell expression → falls through to
   `evalExpression`'s "treat as literal string" branch, producing
   the literal string `"Customer"` in output. Author thinks they
   referenced a column; they got a static label.
2. Bare identifier in a sheet name pattern → resolves to the
   group-key value if declared, else silently treats as literal.
3. Bare identifier in a filename pattern → same as sheet name.

All three are user-hostile silences in the ADR-0027 / ADR-0029
audit-pass theme.

## Considered Options

**A. Raise a stable error for any unresolved bare name.** A bare
identifier in a cell that does not resolve to a declared input,
group key (for filename / sheet name), or `__config__` author key
raises `xl3/expression/unknown-name`. Pro: fail-loud, matches
ADR-0027's "convert silent fallthrough into a coded error" pattern.
Con: a new error code.

**B. Treat any bare name as a literal string by spec.** Spec the
current impl behavior as the contract: `{{ Customer }}` in a cell
evaluates to the literal `"Customer"`. Pro: zero impl change. Con:
this is the user-hostile silence; locks it in.

**C. Reject at parse only in cells; allow in sheet/file patterns.**
Bare names error in cells, resolve to group keys in patterns.
Pro: matches the existing "Bare names are reserved for sheet and
file group keys" prose. Con: needs context-dependent parsing —
parser must know which scope it's in.

## Decision

Adopt **A** with the cell vs pattern split implicit in resolution
context.

### Normative rules (added to language.md § "Source Columns")

A bare identifier inside a template block resolves in this order:

1. **Filename pattern context** (the `output_file_pattern` value).
   Resolves to a declared file-group key if one exists. Otherwise
   resolves to a runtime input value (`__inputs__[name]` shorthand).
   Otherwise resolves to a `__config__` author-defined value
   (`__config__[name]` shorthand). Otherwise raises
   `xl3/expression/unknown-name`.
2. **Sheet name pattern context** (the sheet's template name).
   Same order: sheet-group key, then runtime input, then config
   author value. Otherwise raises `xl3/expression/unknown-name`.
3. **Data cell context.** Bare identifiers in data cells resolve
   in the same order as filename/sheet patterns: enclosing file
   group key → enclosing sheet group key → `__inputs__[name]`
   shorthand → `__config__[name]` shorthand. Bare identifiers do
   NOT resolve to source columns (column references in cells MUST
   use the explicit `[Column]` bracket form). If a bare identifier
   in a cell does not match any of the resolution sources, the
   parser raises `xl3/expression/unknown-name`.

The shorthand resolution is consistent across all three contexts.
The behavior change vs. pre-ADR is: previously, unmatched bare
identifiers in data cells silently fell through to the string
fallback (literal "Department"); now they raise.

Existing fixtures and templates that use `{{ GroupKey }}` in data
cells to reference the active file/sheet group's value (e.g.,
fixtures 006, 007 in the conformance corpus) continue to work —
the bare name resolves through the group-key chain. The ADR is
specifically targeted at typo-class silences ("user wrote bare
name expecting a column reference and got the literal string").

### Error code

New stable code: `xl3/expression/unknown-name`. Per ADR-0015
append-only catalog. Diagnostic substring (stable for fixtures):

> Unknown name `<ident>` — bare identifiers in cell expressions
> must be `[Column]`, `__config__[key]`, `__inputs__[name]`, or a
> function call. For sheet / file patterns, declare `<ident>` as a
> group key.

The same code covers shape (1)/(2)/(3) — the message disambiguates
context.

### Why not silent fallthrough

The shape-1 silence ("bare `{{ Customer }}` in cell becomes literal
`Customer`") is the same user-hostile pattern as the ADR-0027
empty-directive case: the author thinks they got data; they got a
label. The fix is one-token: `{{ [Customer] }}`. The cost of
loudness is paid back by the saved debug time.

## Consequences

- Templates that wrote `{{ Customer }}` in a cell expecting a
  column value now error at parse time with an actionable
  diagnostic. Migration: rename to `{{ [Customer] }}`.
- One new error code added to ADR-0015 catalog and snapshot.
- The "bare name shorthand in sheet/file patterns" path remains
  unchanged in observable behavior; the resolution order is now
  written down.
- Conformance fixture additions:
  - `149-bare-name-in-data-cell-error` — `{{ Foo }}` in a data
    cell raises `xl3/expression/unknown-name`.
  - `150-bare-name-in-filename-resolves-to-input` — `{{ month }}` in
    `output_file_pattern` resolves to the `__inputs__[month]`
    value when no `month` group key exists.
  - `151-bare-name-in-filename-unknown-error` — `{{ Foo }}` in
    `output_file_pattern` with no `Foo` input, config key, or
    group key raises `xl3/expression/unknown-name`.

## References

- ADR-0011 — Reserved sheet naming (`__sheet__` pattern; the
  bracket-vs-bare distinction)
- ADR-0015 — Stable error codes (catalog append)
- ADR-0027 — Reserved column names + directive validation (the
  silent-fallthrough → coded-error pattern this ADR mirrors)
- language.md § "Source Columns" (the "bare names not column refs"
  prose this ADR converts to an error)
- language.md § "Group Keys" (filename pattern with bare names)
- `src/template-eval.ts`
