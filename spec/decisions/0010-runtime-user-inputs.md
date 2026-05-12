# ADR 0010 - Runtime user inputs

- **Status:** accepted
- **Date:** 2026-05-07
- **Spec target:** XTL 0.1 draft
- **Affects:** evaluation.md, language.md
- **Superseded-By (partial):** [ADR-0011](./0011-reserved-sheet-naming.md) — renames the reserved sheet to `__inputs__` and replaces `{{ _<name> }}` with `{{ __inputs__[name] }}`. Semantics, the type system, host API, and error catalog from this ADR remain authoritative.

> **Note (2026-05-07):** ADR-0011 renamed the reserved sheet `_inputs`
> → `__inputs__` and replaced the `{{ _<name> }}` cell-reference
> syntax with `{{ __inputs__[name] }}`. The decision text below
> reflects the original 0010 wording; the current spec is in
> `evaluation.md` and the impl uses the renamed forms.

## Context

A common pattern in operator workflows is "the same template every
month, with one or two values that change per run": the report month,
a region selector, an approval code, an exchange-rate threshold.

XTL 0.1 already supports `_<name>` user variables declared in the
`_config` sheet. Those values are static — they live inside the
template file and require an author to edit the workbook for each run.
For values that legitimately change per run, this forces operators to
either (a) keep editing `_config`, which defeats the "templates are
the handover artifact" property, or (b) maintain N copies of the
template, one per month.

There is no spec support today for a template to *declare* "I need
this value at runtime" so a host UI can ask the operator. The reference
implementation's `convert()` and `preview()` accept only the template
buffer and the source buffer.

This ADR closes that gap.

## Considered Options

**A. Status quo.** Authors edit `_config` for every run, or maintain
template copies. Cost: contradicts the "approved template, file-based
handoff" identity.

**B. Free-form runtime variables, no declaration.** `convert()` accepts
an arbitrary `inputs: Record<string, unknown>` that is merged into the
expression context; the template references them via `{{ _name }}` and
missing values become empty per ADR-0007. Cost: no introspection — a
host UI cannot know what to ask for, what type to render, or whether a
value is required.

**C. Declare in `_config` rows.** Reuse the `_config` key/value sheet
with extended columns: column A is the key, column B the type, column
C the default, column D the label. Cost: `_config` is conventionally a
key/value table; adding parallel columns conflates two record shapes.
Verbose to declare more than two attributes.

**D. Dedicated `_inputs` sheet.** A reserved sheet name with a header
row and one row per input. Columns: `name`, `type`, `default`, `label`,
`description`. Cost: one more reserved sheet name, but consistent with
the existing reserved-sheet pattern (`_config`, list sheets).

**E. Implicit inputs.** Auto-detect any `{{ _name }}` reference that
does not resolve in `_config` as a runtime input. Cost: cannot carry
type, label, default, or required information; reduces every input to
free-form text.

## Decision

Adopt option D. A new reserved sheet name `_inputs` declares the
runtime inputs a template requires. The sheet's first row is a header;
each subsequent row declares one input.

### Sheet shape

`_inputs` row 1 holds these column names (case-insensitive,
order-sensitive at minimum for `name` and `type`; later columns are
optional and identified by header text):

| Column | Required | Meaning |
|---|---|---|
| `name` | yes | Input name. Must be a non-empty string. The value flows into the expression context as `_<name>`. |
| `type` | yes | One of `text`, `number`, `date`, `select`. |
| `default` | no | If non-empty, used when the host omits the input. The default value is parsed by the input's `type`. |
| `label` | no | Human-facing prompt text. Hosts SHOULD use it as the form label. |
| `description` | no | Optional longer-form help. |
| `options` | no | Required when `type = select`. Pipe-separated allowed values, e.g. `Seoul|Busan|Daegu`. |

Additional columns are reserved and MUST be ignored by 0.1
implementations.

An input is **required** if its row has no `default`. A required input
that is omitted by the host is an error.

### Reference syntax

A template references an input the same way it references a `_config`
user variable: `{{ _name }}` (bare name, since `[name]` is the
source-column-reference syntax). The expression context resolves
`_name` to the runtime input value if provided, otherwise to the
input's `default`, otherwise reports a missing-input error before
rendering begins.

### Type coercion

Inputs are coerced from host-supplied values using the same rules that
govern source-cell coercion (ADR-0009 and ADR-0003):

- `text` — passes the host string through unchanged. Booleans and
  numbers from the host are stringified via canonical string form
  (ADR-0009).
- `number` — host value is parsed via "trim, then `Number()` without
  producing `NaN`." Failure is an error.
- `date` — host value is coerced to a date by the same rules used for
  date-format cells (ADR-0003). Failure is an error.
- `select` — host value MUST be exactly equal (canonical string form,
  ADR-0009) to one of the declared `options`. Failure is an error.

After coercion, the input value lives in the expression context with
the same value model as a source cell — it can flow into `IF()`,
`@filter`, `&`, comparisons, and `TEXT()` like any other value.

### Naming and conflicts

- Input names MUST NOT collide with `_config` user variable names. If
  both are declared with the same `_name`, this is an error at parse
  time.
- Input names are case-sensitive (matching ADR-0007 source column
  rules).
- Input names MUST consist of letters, digits, and `_`. Other
  punctuation is reserved.

### Implementation surface

The reference implementation extends:

- `parseTemplate` (and `analyze`, `analyzeModel`, `preview`) to expose
  `inputs: InputSpec[]` as part of the parsed model.
- `convert(template, source, options)` and
  `preview(template, source, options)` to accept
  `options.inputs?: Record<string, unknown>`.
- Errors include the offending input name and reason.

Hosts (browser converters, CLI tools, internal portals) call
`preview()` to introspect the inputs, render their UI, then call
`convert()` with the collected values.

## Consequences

- Templates that today work without any `_inputs` sheet keep working.
  The new sheet is opt-in; absence means zero runtime inputs and the
  existing API surface still applies.
- The host API is one optional argument richer; existing call sites
  pass nothing and behave as before.
- Hosts that ignore `inputs` cannot run templates that declare
  required inputs without a default. Such templates document their
  dependency by their declarations.
- Templates can move per-run knobs out of `_config` and into
  `_inputs`. The migration path is mechanical: copy the row, set a
  type, add a default if the value is optional.
- This ADR does not introduce a UI specification. Hosts decide how to
  render forms (browser, CLI prompt, web hook, …); the spec only
  defines the declaration and the contract.
- This ADR does not introduce dynamic prompts (a value computed from
  another input or from the source data). Inputs are independent.
- Date values rendered into cells follow ADR-0003 numFmt coercion;
  numeric values follow ADR-0009. The reference impl re-uses the
  existing single-expression-cell coercion path so dates can flow into
  date-formatted cells without extra work.
- Sheet-name conflicts: `_inputs` is now reserved alongside `_config`.
  Templates that previously named a list sheet `_inputs` would have
  hit list-sheet semantics; renaming to a non-conflicting `_<name>`
  is the migration.

## References

- ADR-0007 (empty values): governs the empty-value branch of input
  coercion.
- ADR-0009 (comparison and string coercion): governs canonical string
  form for `text` / `select` and the `number` parsing rule.
- ADR-0003 (numFmt coercion is MUST): governs the `date` coercion
  rule.
- ADR-0004 (reference impl coupling audit): the API surface change
  is additive and behind the host boundary; no new impl-only
  workaround is created.
- `spec/evaluation.md` "Template Configuration" gains a new "Inputs"
  section that defines the `_inputs` sheet.
