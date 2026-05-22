# ADR 0056 — Reading reserved-sheet system keys

- **Status:** accepted
- **Date:** 2026-05-22
- **Spec target:** XTL 0.1
- **Affects:** evaluation.md § "Template Configuration" / "Inputs",
  language.md § "Group Keys"

## Context

`evaluation.md` § "Template Configuration" pins one direction of the
system-key / author-key relationship:

> Author-defined values use any key not listed in the system table
> above. … Authors MUST NOT reuse system key names for author-
> defined values.

This says authors cannot **write** a system key as their own value.
It does not say whether a template can **read** a system key via the
generic `{{ __config__[key] }}` form.

Concretely, are these legal?

- `{{ __config__[name] }}` — read the template's display name into
  a header cell.
- `{{ __config__[output_file_pattern] }}` — read the filename
  pattern into a footer for audit.
- `{{ __config__[source_sheet] }}` — debug helper.

The reference impl's `__config__[…]` resolver does not distinguish
system from author keys; both resolve through the same dictionary.
Today this works for any key. But the spec is silent — a port that
implements separate "system" and "author" namespaces could reject
the read access, producing silent divergence.

A parallel question exists for `__inputs__`: system columns are
defined (`name`, `type`, `default`, `label`, `description`,
`options`) but the spec does not say whether `{{ __inputs__[name] }}`
resolving to the *input name string itself* (rather than the value)
is legal. (Answer: no, that is not a thing — `__inputs__[name]`
resolves to the resolved value for the input named `name`. But the
spec should state it.)

## Considered Options

**A. Reads are unrestricted; writes (declarations) are restricted.**
A template MAY read any key from `__config__` regardless of system /
author classification. Only the *declaration* side has the
constraint (author rows cannot reuse system key names). Pro: matches
current impl; gives authors a debug / audit hook. Con: tiny new
surface to maintain (system key reads are essentially free).

**B. Reads of system keys are forbidden.** Only author-defined keys
are readable; system keys are engine-private. Pro: tighter
encapsulation. Con: breaks templates that want to embed metadata
(name, description) in the rendered output; no real safety benefit
because the values are author-controlled anyway.

**C. System keys are readable but produce a warning.** Half-
measure; introduces warning noise without clear benefit.

## Decision

Adopt **A**.

### Normative rules

The `__config__[key]` reference form resolves to the cell value at
that key, regardless of whether `key` names a system slot
(`name`, `description`, `source_sheet`, `source_table`,
`output_file_pattern`, `match_pattern`) or an author-defined slot.

The author-side restriction is unchanged: authors MUST NOT *declare*
a row whose key collides with a system key name. The read side has
no such restriction.

### Reading `__inputs__[name]`

`{{ __inputs__[name] }}` resolves to the **resolved value** of the
input named `name`, coerced per its declared type. The reference
form is not a lookup into the input's declaration metadata — there
is no spec form for reading an input's `label`, `default`, or
`type` from inside a template. Hosts that need the metadata read it
via the `readTemplateInputs()` API at the host layer.

### Diagnostic clarity

Reading an undeclared key:

- `{{ __config__[undeclared] }}` raises a stable error. The
  reference impl uses `xl3/expression/unknown-name` (per ADR-0054)
  with the message:

  > Unknown `__config__` key `<key>`; not a system key and not
  > declared as an author-defined row.

- `{{ __inputs__[undeclared] }}` raises the same code with:

  > Unknown `__inputs__` reference `<name>`; no input is declared
  > with that name.

## Consequences

- `{{ __config__[name] }}` continues to work; spec now says so.
- Audit-style templates (cookbook 11: "include rendering metadata
  in output") can read system keys directly without a workaround.
- No new error code (uses `xl3/expression/unknown-name` from
  ADR-0054 for unresolved lookups).
- Conformance fixture additions:
  - `156-config-read-system-key` — `{{ __config__[name] }}` renders
    the template's display name.
  - `157-config-read-unknown-key-error` — `{{ __config__[ghost] }}`
    raises `xl3/expression/unknown-name`.

## References

- ADR-0011 — Reserved sheet naming (`__sheet__[key]` structured
  reference form)
- ADR-0050 — Template inputs as XTL expressions (`__config__`
  bindings available at input-read time)
- ADR-0054 — Bare name in cell context (the
  `xl3/expression/unknown-name` code home)
- evaluation.md § "Template Configuration"
- evaluation.md § "Inputs"
