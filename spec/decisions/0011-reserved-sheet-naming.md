# ADR 0011 - Reserved sheet naming and unified reference

- **Status:** accepted
- **Date:** 2026-05-07
- **Spec target:** XTL 0.1 draft
- **Affects:** evaluation.md, language.md, ADR-0010

## Context

XTL 0.1 currently overloads the leading-underscore prefix in three
distinct ways:

1. **Reserved system sheets** — `_config` (and, with ADR-0010,
   `_inputs`).
2. **User-defined list sheets** — `_fruits`, `_allowed`, …
3. **User variables inside `_config`** — keys like `_title`, `_month`.

Operators reading the workbook tabs cannot tell which leading-`_` sheet
is xl3-internal and which is template-author data. References like
`{{ _month }}` (config user var) sit next to `{{ _fruits }}` (list
sheet membership) which sits next to `{{ [Customer] }}` (source
column) without the prefix carrying a clear semantic.

ADR-0009 also revealed adjacent friction: every "look up a value by
name" site uses different syntax. `Customers[Account]` (proposed in
ADR-0012) is structured-ref syntax; `_month` is bare-prefix syntax;
`_fruits` is a sheet name embedded inside a directive. Three forms,
three mental models.

This ADR consolidates both problems before further multi-source work
(ADR-0012+) lands on top of the current overload.

## Considered Options

**A. Status quo.** Keep `_config`/`_inputs` reserved; keep arbitrary
`_<name>` list sheets; keep `_<name>` user-variable rows. Cost:
ambiguity persists; future ADRs accumulate around it.

**B. Distinct prefix for reserved sheets only.** Reserved becomes
`__config`/`__inputs` (leading `__`); user list sheets stay `_<name>`.
Cost: only solves part of the overload; user-variable rows still use
`_<name>` inside `_config`; visual distinction asymmetric (prefix-only
suggests "private", not "deliberate convention").

**C. Wrapped reserved naming + aggregated lists + structured-ref
unification (chosen).** Reserved sheets are dunder-wrapped:
`__config__`, `__inputs__`, `__sources__` (ADR-0012 placeholder),
`__lists__`. User list sheets are aggregated into `__lists__` columns.
User variables inside `__config__` lose their `_` prefix. Every
"look up by name" site uses Excel structured-ref form
`__sheet__[key]`. Cost: largest mechanical migration; pre-1.0 break.

**D. Aggregate user lists, keep single-`_` reserved naming.** Same as
C but keep `_config`/`_inputs`/`_sources`/`_lists`. Cost: leaves the
visual overload between reserved sheets and any future user-named
`_<x>` workbook sheets unresolved.

## Decision

Adopt option C.

### Reserved sheet names are dunder-wrapped

| Sheet | Purpose |
|---|---|
| `__config__` | Single configuration object — engine metadata + author-defined values |
| `__inputs__` | Runtime input declarations (collection; ADR-0010) |
| `__sources__` | External data source declarations (collection; reserved for ADR-0012) |
| `__lists__` | Author-defined membership lists (collection — columns are lists) |

The pattern `__name__` is the *recognition rule*: any sheet whose
name matches `^__[a-z]+__$` (lowercase letters between dunder
wrappers) is xl3-defined. Authors MUST NOT create sheets with that
shape; engines MAY warn or error on unrecognized matches.

All other sheet names — including those starting with a single `_` —
are user-defined and belong to template content (rendered output,
hidden helper data, etc.). The single-`_` prefix has no special
meaning in this ADR.

### `__config__` shape and references

`__config__` keeps its column-A=key, column-B=value shape. System
keys (`name`, `description`, `source_sheet`, `source_table`,
`output_file_pattern`, `match_pattern`) drive engine behaviour. Every
other key is an author-defined value, accessible from cells via:

```
{{ __config__[title] }}
{{ __config__[month] }}
```

The author no longer prefixes user-variable keys with `_`. Authors
MUST NOT reuse the system key names for user values (collision is an
error at parse time).

### `__inputs__` references

`__inputs__` keeps the ADR-0010 schema: header row of `name`, `type`,
`default`, `label`, `description`, `options`. Resolved input values
are referenced from cells via:

```
{{ __inputs__[month] }}
{{ __inputs__[region] }}
```

The `_<name>` cell-reference syntax for inputs is retired.

### `__lists__` shape and references

`__lists__` is a single sheet. Row 1 is the header — each header cell
is the name of one list. Below row 1, each column holds the list's
values. Empty cells are skipped per ADR-0007.

```
__lists__:
| fruits | allowed_status | excluded_regions |
|--------|----------------|------------------|
| apple  | open           | test             |
| banana | pending        | internal         |
| cherry | reviewing      |                  |
```

References from filter directives:

```
{{ @filter [Fruit] in __lists__[fruits] }}
{{ @filter [Status] !in __lists__[allowed_status] }}
```

`__lists__[name]` is a list array. It is valid only inside `@filter
... in/!in`. Using it elsewhere (in `IF`, in `&`, as a single-cell
expression) is an error.

User-named single-`_` list sheets (`_fruits`, `_allowed`, …) are
retired entirely. Templates that previously used them migrate by
moving values into a column of `__lists__`.

### Structured-ref form is the unified pattern

After this ADR, every "look up a value by name" site uses Excel
structured-ref syntax:

| Site | Form | Returns |
|---|---|---|
| Source column (current row) | `[Account]`, `Customers[Account]` (ADR-0012) | scalar |
| Config / user variable | `__config__[title]` | scalar |
| Resolved runtime input | `__inputs__[month]` | scalar |
| List membership | `__lists__[fruits]` (in `@filter`) | array |

The `_<name>` reference syntax is fully retired. The single-letter
prefix `_` no longer carries semantic in cell expressions.

## Consequences

- The reference grammar shrinks: one form (`Sheet[key]` /
  `[column]`) covers all named lookups.
- Tab-bar visual: any `__name__` sheet is xl3-internal; everything
  else is template content. Operators learn one rule.
- Templates that authored `_<name>` user variables, list sheets, or
  cell references must migrate. The reference impl ships only the
  new forms; the old ones produce parse errors with stable
  diagnostic substrings:
  - `Reserved sheet "_config" was renamed to "__config__"`
  - `User-defined list sheets are no longer supported; move values to a column of __lists__`
  - `_<name> reference is no longer supported; use __config__[name], __inputs__[name], or __lists__[name]`
- ADR-0010's `_inputs` references are corrected throughout to
  `__inputs__`. Conformance fixtures 065–068 are migrated.
- Conformance fixtures 003, 040, 045, 054 (single-`_` list sheets)
  are migrated to `__lists__`.
- The pre-existing `_config` user-variable example in
  evaluation.md is rewritten to use `__config__[title]` form.
- ADR-0012 (multi-source) and later land cleanly: `Customers[Account]`
  reads naturally next to `__config__[title]` because both are
  structured refs. No further special-case syntax needed.

## References

- ADR-0007 (empty value): unchanged; still governs `__lists__` cell
  skipping.
- ADR-0008 (truthiness): unchanged.
- ADR-0009 (comparison and string coercion): the `__sheet__[key]`
  forms participate in `=`, `!=`, `>`, `<`, `&` per the same
  algorithm.
- ADR-0010 (runtime inputs): renamed reserved sheet from `_inputs`
  to `__inputs__`; cell references updated.
- ADR-0012 (multi-source data model — placeholder): will introduce
  `Source[Column]` cell references that share the structured-ref
  parser path with this ADR's `__sheet__[key]`.
- `spec/evaluation.md` "Template Configuration", "Inputs", "List
  Sheets" — all rewritten to match this ADR.
