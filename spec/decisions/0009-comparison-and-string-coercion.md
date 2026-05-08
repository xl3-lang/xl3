# ADR 0009 - Comparison operators and string coercion for `&`

- **Status:** accepted
- **Date:** 2026-05-07
- **Spec target:** XTL 0.1 draft
- **Affects:** language.md, evaluation.md
- **Extended-By:** [ADR-0017](./0017-source-value-model.md) — closes the deferred Date canonical string form (`YYYY-MM-DD` / `YYYY-MM-DDTHH:mm:ss`, UTC accessors) and adds the Date branch to the comparison algorithm. Read the two ADRs together as the comparison/value-model contract.

## Context

Comparison and concatenation share a sub-problem: how does XTL coerce
values so that two operands can be compared, ordered, or stringified?
The XTL 0.1 draft does not say. The reference implementation today uses
three different rules, none of them spec-aligned:

- `=` and `!=` inside `IF` (`functions.ts:eq/ne`): pure string equality
  via `String(a) === String(b)`.
- `>`, `<`, `>=`, `<=` inside `IF` (`functions.ts:gt/lt/ge/le`):
  `toNumber(a) <op> toNumber(b)`, where `toNumber` falls back to `0`
  silently for non-numeric strings.
- `=`, `!=`, `>`, `<`, `>=`, `<=` inside `@filter`
  (`data-transform.ts`): a fast path that compares numerically when both
  sides parse as numbers, otherwise falls back to string comparison.
- `@sort` (`data-transform.ts:compareValues`): numeric-or-`localeCompare(a,
  b, 'ko')` — a hardcoded Korean collation that has no spec basis.
- `&` concatenation (`functions.ts:concat`): `String(p ?? '')` — host-
  language defaults. `String(true)` is `"true"`, not `"TRUE"`. `String(new
  Date())` is host-timezone dependent.

These rules disagree:

- `IF([Status] = "0", …)` (string-eq) and `@filter [Status] = 0`
  (numeric path) can take different branches over the same row.
- A Korean-locale sort puts `["Acme", "가나"]` in a different order than
  a code-point sort.
- `[active] & " (" & [count] & ")"` produces `"true (0)"` in JavaScript
  but `"TRUE (0)"` in a future port that follows Excel.

Each disagreement is a portability hazard. Two conformant implementations
that follow the spec word-for-word can produce different output for the
same template + data.

## Considered Options

**A. All comparisons string-only.** Cost: `[date1] > [date2]` and `[amount]
> 100` would be lexicographic. Useless for amounts; misleading for dates.

**B. Single bothNumeric fast path with string fallback (the impl's
`@filter` path).** Pros: matches author intent for amount comparisons,
falls back gracefully. Cost: `"foo" > "0"` is lexical (true), which
surprises authors expecting an error or a numeric coercion. Different
rules for `IF` and `@filter` remain a divergence vector.

**C. Strict numeric for ordering operators; comparison of mixed types is
an error.** Most disciplined. Cost: rejects accidental string-vs-number
comparisons, but in practice authors mix types unintentionally
(`Amount` sometimes arrives as a string from CSV-like inputs). Errors at
that point are noisy.

**D. Excel-style coercion table:** numbers compare numerically, dates
compare as serials, strings compare lexicographically (case-sensitive
Unicode code-point order), Booleans compare with `FALSE < TRUE`,
ambiguous mixed-type cases fall back to canonical string form. Most
prescriptive; most portable. Cost: the spec gains a small but real
"comparison algorithm" surface area.

For string coercion of `&`, the candidates are simpler:

**E. Host-language `String()` (status quo).** Cost: dates and floats are
host-dependent. Booleans render lowercase in JavaScript, uppercase in
Excel.

**F. Defined canonical string form per type.** Empty values stringify to
`""`, Booleans to `"TRUE"` / `"FALSE"`, numbers to ECMA-262 shortest
round-trippable representation, strings to themselves. Dates remain
implementation-defined for XTL 0.1; portable templates should not rely
on date concatenation. Cost: small impl change; eliminates two of three
divergence vectors. ADR-0009 cannot pin date concatenation without a
value-model ADR (gap #9 in the impl audit), so we mark it explicitly
deferred.

## Decision

Adopt **D for comparison** plus **F for `&`**, unified into a single
algorithm both `IF` and `@filter` use.

### Canonical string form

The canonical string form of a value is:

- An empty value (per ADR-0007): the empty string `""`.
- A Boolean: `"TRUE"` or `"FALSE"` (uppercase).
- A finite number: the shortest decimal representation that uniquely
  identifies the value, using `.` as the decimal separator and no
  scientific notation for magnitudes between `1e-4` and `1e21`. Integers
  omit the trailing decimal point. (This matches the ECMAScript
  `Number.prototype.toString` behavior in the cited range.)
- A string: the string itself.
- A date: implementation-defined in XTL 0.1; portable templates SHOULD
  NOT rely on date concatenation or string fallback comparison of dates.
  Use `TEXT()` instead.

Non-finite numbers (`NaN`, `Infinity`, `-Infinity`) cannot arise from
spec-conformant operations. If they appear, they stringify to `""`
(empty), so they propagate the same way an empty value would.

### Comparison algorithm

Comparison operators in `IF()` and `@filter` apply, in order:

1. **Both empty** (per ADR-0007): operands are equal. `=` is true; `!=`
   is false; `>` and `<` are false; `>=` and `<=` are true.
2. **Exactly one empty:** `=` is false; `!=` is true. For ordering,
   the empty value is *less than* any non-empty value.
3. **Both numeric:** if both operands are numbers, or both are strings
   that parse as finite numbers via the rule "trim, then `Number()`
   without producing `NaN`," compare numerically. Numeric comparison
   uses IEEE 754 equality, not canonical-string equality, so
   `0.1 + 0.2 = 0.3` is **false**. Templates that need tolerance MUST
   round explicitly via `ROUND()`.
4. **Both Booleans:** compare with `FALSE < TRUE`.
5. **Otherwise:** compare canonical string forms using Unicode
   code-point order. No locale-aware collation is applied.

`@sort` uses the same algorithm.

### `&` concatenation

`&` stringifies each operand to its canonical string form and joins them
in order. The result is always a string. `&` never produces a non-string
result.

## Spec text changes

- `language.md` adds a new section, **"Comparison and String Coercion"**,
  immediately after "Operators" and before "Functions". It defines
  canonical string form, the comparison algorithm in numbered order,
  and the `&` rule.
- `language.md` "Operators" gains a one-line cross-reference to the new
  section.
- `evaluation.md` "List Sheets" updates "Each cell is converted to a
  string" to "Each cell is converted to its canonical string form per
  [Comparison and String Coercion](../language.md#comparison-and-string-coercion)."

## Impl changes

- `src/functions.ts` exports `canonicalString(v)` and `compareValues(a,
  b)` helpers. `concat` uses `canonicalString`. `eq`, `ne`, `gt`, `lt`,
  `ge`, `le` use `compareValues`.
- `src/data-transform.ts` uses the same shared `compareValues` for both
  `evalFilter`'s comparison branch and `@sort`. The hardcoded
  `localeCompare(_, 'ko')` is removed.
- No public API of the package changes.

## Consequences

- Templates that today rely on Korean-locale sort ordering for mixed
  Latin+CJK data will see a code-point ordering instead. Within the
  Hangul Syllables block (`U+AC00`..`U+D7A3`), code-point order matches
  initial-consonant collation for many cases — but mixed scripts
  (`["가나", "Acme"]`) now order ASCII first. This is a deliberate break
  of an arbitrary impl choice that had no spec basis.
- `IF([flag] = "0", …)` and `@filter [flag] = 0` now follow the same
  algorithm; both numeric (when both operands parse as finite numbers)
  or both string-fallback.
- `[active] & " (" & [count] & ")"` against `Active = TRUE` and `Count =
  0` now produces `"TRUE (0)"`. Existing fixtures using `&` (none in
  the bootstrap corpus) remain unaffected because they only concatenate
  strings.
- Dates remain a known gap. A future "value model" ADR will define
  date-side semantics, including canonical date strings and date
  ordering. Templates that need date-stamped filenames should use
  `{{ TEXT(TODAY(), "YYYY-MM-DD") }}` (already covered by ADR-0001 and
  ADR-0005).
- `compareValues` does not warn or error on mixed types when neither
  operand is empty, both numeric, or both Boolean. The fall-through to
  canonical string ordering is total. A separate ADR may revisit if
  authors hit this often enough to want a strict-mode check.
- The Unicode minus sign (U+2212) is **not** parsed as a number by the
  "trim, then `Number()`" rule. A row whose Amount string is `"−5"`
  (U+2212) compared against the number `-5` falls through to
  canonical-string comparison and does not match. Authors pasting from
  Word/PDF should normalize to ASCII `-` (U+002D) upstream.

## References

- ADR-0007: empty value definition (rules 1, 2 of the comparison
  algorithm and the canonical string form for empty values).
- ADR-0008: truthiness rules (consumers of the Boolean comparison
  result).
- XTL 0.1 draft: `spec/language.md` "Operators"; `spec/evaluation.md`
  "List Sheets".
- ADR-0004: reference implementation coupling audit (this ADR closes the
  comparison-operator and string-coercion gaps catalogued there).
