# ADR 0062 — `__inputs__` `default = ""` semantics

- **Status:** accepted
- **Date:** 2026-05-22
- **Spec target:** XTL 0.1
- **Affects:** evaluation.md § "Inputs", ADR-0010, ADR-0050

## Context

`evaluation.md` § "Inputs" describes the `default` column:

> If non-empty, used when the host omits the input. The default
> value is parsed by the input's `type`.

Two boundary shapes are not fully pinned:

1. **`default` cell is empty (blank).** The input row has no
   default value; the input is **required**. Hosts MUST supply a
   value. This is implicit in "If non-empty, used" but not
   spelled out.

2. **`default` cell holds the literal empty string `""`.** Per
   ADR-0028, a string literal `""` is a valid XTL string. Per
   ADR-0050, the `default` cell is evaluated as XTL. The post-
   evaluation result is the empty string.

   Is the post-evaluation empty string the same as "no default"
   (required)? Or is it a default of "" (optional, default to empty
   string for `type = text`; error for `type = number` /
   `type = date`; selecting nothing for `type = select`)?

The reference impl (`src/inputs.ts`) treats both cases identically
— "If non-empty after evaluation, used; otherwise required." The
ADR-0007 empty-value rule (a string of zero length or only
whitespace is empty) governs.

Two-real-world author paths cross this:

- A required-string input where the host should always supply a
  value: leave `default` blank.
- An optional-string input where blank is meaningful: there is
  currently NO way to declare "default = empty string, but it is
  optional." Both shapes (blank cell, `""` literal) collapse to
  "required."

A separate, smaller question: when `type = text` with
`default = "   "` (whitespace-only literal, evaluated as `""` per
trim semantics), is the input required (empty) or has it a default
of `""` (literal empty string)?

## Considered Options

**A. Unify: post-evaluation empty value (per ADR-0007) means
required.** Adopted. Matches current impl. Simple rule; no special
case.

**B. Distinguish blank cell from `""` literal.** Treat `""` as
"defaults to empty string, optional." Pro: gives authors an
"optional empty string" tool. Con: introduces a non-empty-but-
empty distinction; the ADR-0007 rule says they are the same. Spec
churn for a marginal case.

**C. Reject `""` literal in default cells.** Force authors to
either leave it blank (required) or supply a non-empty default.
Pro: removes ambiguity. Con: rejects a valid XTL expression in a
specific cell, which is inconsistent with ADR-0050.

## Decision

Adopt **A**.

### Normative rules (added to evaluation.md § "Inputs")

After ADR-0050 XTL evaluation of the `default` cell:

1. If the **post-evaluation canonical-string-form** value is empty
   per ADR-0007 (missing, `""`, or whitespace-only string), the
   input is **required**. Hosts MUST supply a value; omitting
   raises `xl3/inputs/missing-required`.
2. Otherwise the post-evaluation string is the default. The
   default flows through the per-type coercion (number / date /
   select) per the existing rules.

The shapes "blank cell," `default = ""`, `default = "   "`, and
`default = {{ "" }}` are all equivalent: they all mean "required."

Author intent of "default to empty string, optional" is NOT
expressible in XTL 0.1. Authors who need that semantic use:

- For `type = text`: a placeholder default (`default = " "` won't
  work — whitespace-only is also empty). Use a single non-printing
  character if absolutely necessary; the spec does not endorse this
  workaround.
- For `type = select`: declare an `options` value like `"|none|…"`
  and treat empty selection upstream — but the spec already pins
  that `select` requires the value to match an option.

A future ADR may introduce an explicit "optional" flag (`required =
false` column) if the corpus shows real demand.

### `type = select` empty-string default

Per ADR-0010, a `type = select` input with a non-empty default
requires the default to match one of the declared `options`. With
this ADR, a "default = empty" means required; the select-value
validation still applies once the host supplies a value.

## Consequences

- No behavior change in the reference impl; this ADR documents and
  pins the existing rule.
- The "optional empty-string default" use case is explicitly
  unsupported. Cookbook 06 will note the limitation.
- Conformance fixture additions:
  - `172-input-default-empty-literal-required` — a row with
    `default = ""` and no host-supplied value raises
    `xl3/inputs/missing-required`.
  - `173-input-default-whitespace-only-required` — `default = "   "`
    behaves the same.
  - `174-input-default-evaluates-to-empty-required` — `default = {{
    IF(TRUE, "", "fallback") }}` post-evaluates to `""` and behaves
    as required.

## References

- ADR-0007 — Empty value definition (the canonical empty rule)
- ADR-0010 — `__inputs__` schema
- ADR-0050 — Template inputs as XTL expressions (default cell
  evaluation)
- evaluation.md § "Inputs"
