# ADR 0050 — Template inputs accept XTL expressions in `default` / `label` / `description`

- **Status:** accepted
- **Date:** 2026-05-18
- **Spec target:** XTL 0.6
- **Affects:** `__inputs__` parsing (ADR-0010, ADR-0011); `readTemplateInputs()`
  return shape; cookbook 06 (runtime inputs); error-code catalog (ADR-0015)

## Context

Today, the `__inputs__` reserved sheet treats every cell in the
`default`, `label`, `description`, and `options` columns as a literal
string. An author who writes the default as

```
{{ TODAY() }}
```

gets the literal seven-character string `{{ TODAY() }}` in their host
UI's default field. The user then has to either delete the placeholder
or supply a value — the expression never evaluates.

The same trap exists for `label` and `description` (author writes
`{{ [today_iso] }}` thinking it composes; they get the placeholder
string), and for `options` (`{{ [sites] }}` does not expand into the
pipe-delimited list).

The host UI calling `readTemplateInputs()` is exactly the wrong place
to push the evaluation responsibility — every host would need to
re-implement xl3's expression language.

## Decision

`__inputs__` cells in the `default`, `label`, `description`, and
`options` columns MUST be treated as XTL templates: contiguous text
plus zero-or-more `{{ ... }}` blocks, evaluated by `readTemplateInputs()`
before the values cross the API boundary.

### Evaluation environment

The expressions are evaluated in a *constrained* context with the
following bindings available:

- **`__config__[key]`** — the author-defined `__config__` values
  parsed earlier in the same `readTemplateInputs()` call.
- **`TODAY()`** — current UTC date (ADR-0001), useful for date
  defaults.
- **`DATE(y, m, d)`** — composing literal dates (ADR-0044).
- **`UPPER`, `LOWER`, `TRIM`, `TEXT`, `IF`, `IFEMPTY`, `IFS`, `IFERROR`,
  `YEAR`, `MONTH`, `DAY`, `EOMONTH`, `EDATE`, `DATEDIF`** — pure XTL
  scalar functions.

The following bindings are **NOT** available and MUST throw:

- **`[Column]` bare brackets** — there is no source row context yet.
- **`Source[Column]` references** — sources have not been read.
- **`__sources__`** dictionary access.
- **`__inputs__[name]`** — forward reference to another input row.
  Inputs are independent declarations, not a dependency graph.
- **`ROW()`** — no repeat block exists at input-read time.
- **`SUM`, `COUNT`, `AVERAGE`, `MIN`, `MAX`, `XLOOKUP`** — these read
  source data that has not been loaded.

A use of any unavailable binding MUST throw with a stable error code
(see "Error codes" below).

### Evaluation timing

Evaluation happens once, in `readTemplateInputs()`, before the host
UI ever sees the input list. The host receives the post-evaluation
canonical string form (ADR-0009) in `InputSpec.default` /
`InputSpec.label` / `InputSpec.description`. `InputSpec.options`
receives the post-evaluation array of strings (the literal `|`
separator MUST still split the *evaluated* result).

### Coercion of evaluated values

The evaluated value is coerced to a string using ADR-0009 canonical
form. For `default`, the coerced string then flows through the
existing per-type coercion (`number` / `date` / `select`) just as it
did when the value was a literal string. In particular:

- `type=date` + `{{ TODAY() }}` → ISO 8601 `YYYY-MM-DD` (ADR-0017).
- `type=number` + `{{ 3 + 2 }}` → `"5"` (canonical number form).
- `type=select` + `{{ IF([__config__][region], "KR", "US") }}` —
  the evaluated string must be one of the declared options (existing
  ADR-0010 rule applies post-evaluation).

### What about `options` itself

When the `options` cell is a template, the *full* cell template is
evaluated to a single string, then split on `|`. An author who wants
dynamic option lists writes:

```
{{ __config__[regions] }}
```

where `__config__[regions]` is the literal string `KR|JP|US`. The
expression evaluates to that string, and `options` becomes
`["KR", "JP", "US"]`. This is consistent with how `output_file_pattern`
in `__config__` is evaluated — the cell holds a template, not a
structured value.

## Error codes (added to ADR-0015 catalog)

Two new stable error codes:

- **`xl3/inputs/forward-reference`** — thrown when an `__inputs__`
  template uses `[Column]`, `Source[Column]`, `__sources__`,
  `__inputs__[name]`, `ROW()`, or any of the aggregate / lookup
  functions (`SUM`, `COUNT`, `AVERAGE`, `MIN`, `MAX`, `XLOOKUP`).
  Message format: `__inputs__ row {N} (name "{name}") {column}
  references "{x}" which is not available at input-read time`.

- **`xl3/inputs/runtime-only-fn`** — reserved for future XTL
  functions that have render-time-only semantics (currently only
  `ROW()` falls here, and it is folded into `forward-reference` for
  the message; the code is reserved so future render-time-only
  functions get a precise code without breaking the
  `forward-reference` contract).

Both codes are append-only per ADR-0015.

## Side-effects considered

1. **`__inputs__` order matters now (in a small way).** If an author
   ever writes `default: {{ __config__[foo] }}`, then `__config__`
   must be parsed before `__inputs__`. Current parser order already
   satisfies this (`readConfigSheet` runs first in `parseTemplate`,
   and `readTemplateInputs()` likewise calls it first). No code
   change needed beyond keeping that order.

2. **Backward compatibility for literal `{{` strings.** An existing
   template might have `label: literal-{{-text` thinking the curly
   braces are literal. This is breaking: pre-0.6 the curly braces
   are literal; post-0.6 they parse as a template block start.

   The empty-template-block guard (`xl3/parser/empty-block`,
   ADR-0021) covers `{{ }}` exactly, but ambiguous shapes like
   `{{ x` (no closing) currently produce literal pass-through. We
   keep that behavior: a string with `{{` followed by no `}}` is a
   literal. The breaking case is narrow: a closed `{{ ... }}` block
   in an `__inputs__` cell that the author *intended* as literal
   text. Authors who genuinely need literal `{{` may write the
   characters in two separate cells or post-process in the host —
   this is consistent with how `__config__` already handles the
   same case (no escape mechanism since 0.1).

   Migration note in CHANGELOG: "If you had literal `{{ ... }}` in
   `__inputs__` default / label / description / options cells,
   they now evaluate as expressions. Most authors will not be
   affected — the prior behavior was widely surprising (see ADR
   context)."

3. **Visible eval error in the host UI.** A typo like
   `{{ TDAY() }}` (function-name typo) throws at input-read time
   rather than silently passing through. This is the right
   trade-off: the failure mode is loud, actionable, and points
   to the exact `__inputs__` cell. Pre-0.6 silent pass-through
   was confusing — users saw the placeholder in the UI and could
   not tell whether the function name was wrong or whether the
   expression simply was not supported.

4. **No change to `__inputs__` row order semantics.** Rows remain
   independent declarations. The carve-out from forward-reference
   means an `__inputs__` cell cannot reference another input row.
   That is intentional: if cross-input coupling becomes a real
   need, it gets its own ADR.

5. **Conformance fixture** — fixture 131
   (`131-inputs-with-xtl-default`) pins:
   - `default: {{ TODAY() }}` (type=date) → evaluated to render-time
     ISO date.
   - `label: {{ __config__[region] }} 거래명세서` → "KR 거래명세서".
   - Forward-reference error case: a `default: {{ [Column] }}` row
     throws `xl3/inputs/forward-reference`.

## Why this passes the ADR-0043 / ADR-0048 gates

Per ADR-0043 the function surface used here (`TODAY`, `DATE`, etc.)
already lives in XTL, and the new behavior is *not* a new function —
it is a change in *where* existing functions can be called. The
specific case (`__inputs__` defaulting and labeling) is enumerated
in ADR-0043's "What counts as 'before rendering'" list, item
"`__inputs__` coercion and validation."

Per ADR-0048 axis 1 (Excel formula syntax over JEXL), evaluating the
template-expression syntax that already lives in cells in the rest
of the workbook *inside* `__inputs__` cells is the consistency move:
authors learn one expression language, not two — they would have
expected this to work all along.

## Migration / version impact

This change is a 0.6 feature. The CHANGELOG entry under "Breaking"
calls out the literal-`{{ ... }}` edge case (very rare per author
review). The `__inputs__` cookbook (06-runtime-inputs.md) gains a
new section "Computed defaults and labels."

## References

- ADR-0010 — `__inputs__` schema (which this ADR amends)
- ADR-0011 — Reserved-sheet rules
- ADR-0015 — Error code catalog (append-only)
- ADR-0017 — Date canonical form
- ADR-0043 — Excel-native preference principle (which lists
  `__inputs__` coercion as a render-time-critical case)
- ADR-0044 — Function batch accepted (provides TODAY, DATE, etc.
  this ADR makes available in input cells)
- `docs/guides/06-runtime-inputs.md` — Cookbook recipe updated to
  show computed-default usage
- Conformance fixture `131-inputs-with-xtl-default`
