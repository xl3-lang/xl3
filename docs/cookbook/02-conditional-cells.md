# 02 · Conditional cells

## Scenario

Show different cell values based on the row's data. Two patterns: pick
between two values (`IF`), and substitute when the source is missing
(`IFEMPTY`).

## `IF` — pick between two values

```text
{{ IF([Renewal] > 10000, "Priority", "Standard") }}
{{ IF([Region] = "Seoul", "Local", "Remote") }}
{{ IF([Owner] != "", [Owner], "Unassigned") }}
```

Comparison operators: `=`, `!=`, `>`, `<`, `>=`, `<=`. The third
argument (the "else") is required — XTL has no implicit empty branch.

## `IFEMPTY` — substitute for missing values

```text
{{ IFEMPTY([Owner], "Unassigned") }}
{{ IFEMPTY([Notes], "—") }}
```

`IFEMPTY(value, fallback)` returns `fallback` when `value` is empty
(missing, null, or a whitespace-only string). Zero and `false` are NOT
empty — use `IF` for those.

## Truthiness rules (`IF` condition)

- **Empty** values (missing, whitespace-only string) are falsy.
- The strings `"0"` and `"false"` are **truthy** — they are non-empty
  strings, period. To treat `"0"` as falsy, compare explicitly:
  `IF([Amount] != "0", ...)`.
- Number `0` and Boolean `false` are falsy.
- Dates are always truthy.

## Combine with `&` for derived text

```text
{{ "Tier-" & IF([Renewal] > 10000, "A", "B") & "-" & [Region] }}
```

`&` is string concatenation. Operands stringify via the canonical
form ([`spec/language.md`](../../spec/language.md) "Canonical String
Form").

## Notes

- `=` and `!=` use XTL's comparison fallthrough: numeric on
  number-or-numeric-strings, Boolean on Booleans, timestamp on Dates,
  raw code-point order otherwise. No locale collation.
- Nested `IF` works:
  `IF(a, "X", IF(b, "Y", "Z"))`. Excel-familiar; deep nesting is hard to
  read — consider splitting into helper cells or pre-computing upstream.
