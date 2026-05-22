# ADR 0057 — `__lists__[name]` outside `@filter in` / `!in`

- **Status:** accepted
- **Date:** 2026-05-22
- **Spec target:** XTL 0.1
- **Affects:** evaluation.md § "List Sheets", language.md § "Filter",
  error catalog (ADR-0015)

## Context

`evaluation.md` § "List Sheets" pins the legal use site:

> `__lists__[name]` is a list array. It is valid only inside
> `@filter ... in` and `@filter ... !in`; using it elsewhere is an
> error.

That sentence ends in "is an error" without naming the error code.
Eight illegal use sites currently silently or inconsistently fail:

1. `{{ __lists__[fruits] }}` in a cell — what type?
2. `{{ [Item] = __lists__[fruits] }}` — list as `=` RHS
3. `{{ IF(__lists__[x], …) }}` — list as IF condition
4. `{{ SUM(__lists__[x]) }}` — list to aggregate
5. `{{ XLOOKUP("k", __lists__[x], Source[Col]) }}` — list as
   lookup array
6. `@filter [field] = __lists__[x]` — list with `=` comparison
7. `@sort __lists__[x]` — list as sort key
8. `@top __lists__[x]` — list as top count (already grammar-
   rejected; positive_integer per ADR-0055)

The reference impl handles cases 1–7 via the generic
`evalExpression` path; the list array stringifies via `String([...])`
to a comma-joined form, which is silently wrong. Case 8 is a parse
error per ADR-0055.

The existing `xl3/lists/missing-reference` code is for "the named
list doesn't exist." This ADR adds the companion code for "the list
is used outside its legal position."

## Considered Options

**A. New stable error code `xl3/lists/invalid-use`.** Single code
covers all seven shapes. Diagnostic message names the use site.
Pro: matches ADR-0015 stable-code pattern. Con: one new code.

**B. Reuse `xl3/lists/missing-reference`.** Pro: no new code. Con:
"missing reference" and "wrong position" are different bugs;
splitting helps host UX.

**C. Reuse `xl3/expression/unknown-name`** (per ADR-0054). Pro:
no new code; treats the misplaced list as "you can't use that name
here." Con: lists ARE a name (they exist), just used wrong. Code
semantics drift.

## Decision

Adopt **A**.

### New error code

`xl3/lists/invalid-use` — raised when a `__lists__[name]` reference
appears outside `@filter <field> in <list>` or `@filter <field> !in
<list>` positions.

Diagnostic substring (stable for fixtures):

> `__lists__[<name>]` is a list array and may only be used as the
> RHS of `@filter ... in` or `@filter ... !in`. Got: `<use site
> description>`.

### Detection points

The validator must reject the form at parse-normalize time, before
expression evaluation. Detection covers all seven shapes:

- Bare reference in a cell expression (case 1): the normalizer
  detects `__lists__[…]` not inside a `@filter in/!in` directive
  body and raises.
- As an operand of any non-`in`/`!in` operator (cases 2, 6): the
  expression parser raises when it encounters the list reference
  outside the directive's value position.
- As a function argument (cases 3, 4, 5): the function-call parser
  rejects `__lists__[…]` arguments. Functions whose grammar accepts
  arrays do not exist in XTL 0.1; `SUM`/`XLOOKUP` take column refs
  (per ADR-0059), not list arrays.
- As an `@sort` key (case 7): `@sort` accepts only `bracket_field`
  per `grammar.ebnf`; this is already a parse error
  (`xl3/directive/invalid-syntax`). When the malformed body is
  exactly `__lists__[…]`, the parser MAY upgrade the message to
  `xl3/lists/invalid-use` for clarity; the conformance corpus does
  not differentiate.

### Why not a generic catch-all

`xl3/lists/invalid-use` is intentionally distinct from
`xl3/expression/unknown-name`. The list exists (so "unknown" is
misleading) but is used in a slot where arrays are not allowed.
Hosts that localize error messages can render the two cases
differently — "no such list" vs. "list cannot be used here."

## Consequences

- One new error code added to ADR-0015 catalog and snapshot.
- Conformance fixture additions:
  - `158-lists-in-cell-error` — `{{ __lists__[x] }}` in a data cell
    raises `xl3/lists/invalid-use`.
  - `159-lists-as-eq-rhs-error` — `@filter [a] = __lists__[x]` raises
    the same.
  - `160-lists-in-function-error` — `{{ SUM(__lists__[x]) }}` raises
    the same.
- Reference impl change: small — add a `__lists__[…]` scan to the
  expression normalizer and raise the new code when the reference
  appears outside a directive's `in`/`!in` value position.

## References

- ADR-0011 — Reserved sheet naming (`__lists__` declaration)
- ADR-0015 — Stable error codes (catalog append)
- ADR-0027 — Reserved column names + directive validation (the
  silent-fallthrough → coded-error pattern)
- ADR-0054 — Bare name in cell context (companion
  `xl3/expression/unknown-name` for "name does not exist")
- evaluation.md § "List Sheets"
- language.md § "Filter"
