# ADR 0027 - Reserved column names + directive arg validation

- **Status:** accepted
- **Date:** 2026-05-09
- **Spec target:** XTL 0.1
- **Affects:** evaluation.md, language.md, ADR-0011, ADR-0012

## Context

Two distinct silent-fallthrough surfaces, bundled because they share
the same shape ("expected validation, got silent garbage"):

### #1 — Source column names colliding with internal context keys

The reference impl's row-eval context contains internal keys
beyond the source's columns:

- `Rows` — the current data block's row array (used by `COUNT()`,
  `len .Rows`)
- `__rownum` — the 1-based index inside the current data block
- `__activeSource__` — current `@source` block target
- `__joinedRow__` — paired row from `@join`
- `__config__` / `__inputs__` / `__sources__` / `__lists__` — the
  reserved sheet contexts

When a source column name collides with one of these, the row-data
spread either shadows the internal key (breaking `Rows`,
`__config__`, etc. inside the block) or is shadowed by it (making
the column unreachable via `[Column]`).

Example: a source with a column named `Rows`. Authors write
`{{ [Rows] }}` expecting the column value; the renderer's spread
order makes `Rows` resolve to the internal `dataRows` array, which
stringifies to `"[object Object],[object Object]"` in the output.
Pure silent garbage, no diagnostic.

### #2 — Empty / malformed directive bodies

`{{ @filter }}`, `{{ @sort }}`, `{{ @top }}`, `{{ @source }}`,
`{{ @repeat }}`, `{{ @join }}` (and variants with malformed bodies)
were silently ignored. `parseDirective` returned `null` for any
body it couldn't parse; the parser treated the cell as not a
directive row, the directive never applied, and the cell's content
flowed through unchanged.

Concrete shapes that fell through:

- `{{ @filter }}` — author thinks they filtered, no filter applied
- `{{ @source }}` — `@source` directive missing the source name,
  block defaults to `default` source
- `{{ @sort }}` — no field, no sort applied
- `{{ @top }}` — no count, no truncation
- `{{ @join Customers on x[k] = y[k] }}` — neither `x` nor `y`
  matches the joined source, silently no-op

All of these produced "everything ran fine" output that didn't
match author intent.

## Considered Options

For #1 (reserved column names):

- **A. Reject at parse.** Author renames the column upstream.
- **B. Auto-namespace at row-eval.** Internal keys get a prefix
  the user can't write (`__xl3_internal_*`). Pro: any column name
  works. Con: breaks the existing `len .Rows` / `__config__[k]`
  template syntax that authors rely on.
- **C. Document the collision and keep silent shadowing.** Worst
  option; user-hostile.

For #2 (directive validation):

- **D. Throw a single coded error for any failed directive parse.**
- **E. Throw fine-grained errors per directive type / failure
  reason** (`xl3/filter/missing-arg`, `xl3/sort/missing-field`,
  etc.). Pro: more helpful diagnostics. Con: error-code surface
  bloats; most failures share the same root cause (malformed
  body).
- **F. Keep silent.** Worst option; user-hostile.

## Decision

#1 — Adopt **A** (reject reserved column names at parse).
#2 — Adopt **D** (single `xl3/directive/invalid-syntax` code).

### Reserved column names

The following source column names are reserved and MUST be rejected
by `readHeaders` (or equivalent) at parse time with
`xl3/source/reserved-column-name`:

- `Rows`
- `__rownum`
- `__activeSource__`
- `__joinedRow__`
- Any name matching the regex `^__[a-z]+__$` (defensive: future
  additions to the internal context space won't conflict with
  user data)

The reserved set is the union of:

1. xl3-internal context keys the renderer adds to row data
   (`Rows`, `__rownum`, `__activeSource__`, `__joinedRow__`).
2. Reserved sheet ctx names (`__config__`, `__inputs__`,
   `__sources__`, `__lists__`) — already covered by the
   `^__[a-z]+__$` pattern check.

Authors who hit this error rename the column upstream (the most
common offender is `Rows`, which maps cleanly to `Items` /
`Records` / `Entries` / etc.).

### Directive validation

When a cell expression is recognized as a directive
(`isDirectiveExpression` matches `@filter|@sort|@top|@repeat|@source|@join`)
but `parseDirective` cannot parse the body, the parser MUST raise
`xl3/directive/invalid-syntax` with the offending expression in
the message.

This single coded error covers:

- `@filter` (no body)
- `@filter [field]` (no operator/value)
- `@sort` (no body) and `@sort foo` (no bracket)
- `@top` (no count) and `@top abc` (non-numeric)
- `@source` (no name) and `@source __config__` (reserved name)
- `@repeat` (no direction)
- `@join` (no body or malformed `on` clause)

The previous behavior — silent ignore — was the same as a parse
failure; this ADR just makes it visible.

### Why one code, not many

The error message names the directive and quotes the offending
expression, which is enough for an author to find and fix the
issue. Splitting into 6+ codes would bloat the catalog without
adding diagnostic power.

If a future shape needs distinct dispatch (a host wants different
UX for "missing arg" vs. "reserved name"), this ADR can be amended
to split the code; until then a single code keeps the surface
small.

## Consequences

- Templates that previously silently fell through on bad directives
  now error loudly. Author-fix work is identical (correct the
  directive); the difference is errors are visible at preview time
  instead of latent in output.
- Templates that previously silently lost data on `Rows`-named
  columns now error at parse. Author-fix work is one rename
  upstream.
- Two new error codes added to the ADR-0015 catalog and snapshot.
- Conformance fixtures pin both: 109 (reserved column name), 110
  (empty `@filter`), 111 (empty `@source`).

## References

- ADR-0011 — Reserved sheet naming (`^__[a-z]+__$` pattern lineage)
- ADR-0012 — Multi-source data model (introduces `__activeSource__`,
  `__joinedRow__`)
- ADR-0015 — Stable error codes
- ADR-0024 — Function arity (similar "fail loudly" pattern)
