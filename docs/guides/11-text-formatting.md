# 11 · TEXT() formatting

## Scenario

Money should look like money (`$#,##0.00`), dates should be locale-clean
(`yyyy-mm-dd`), percentages should not have eight decimals
(`0.0%`). XTL's `TEXT(value, format)` does the rendering.

## Currency

```text
{{ TEXT([Amount], "$#,##0.00") }}     → "$1,200.00"
{{ TEXT([Amount], "[$₩-ko-KR] #,##0") }} → "₩ 1,200"
{{ TEXT([Amount], "#,##0;(#,##0)") }} → negatives in parens
```

## Dates

```text
{{ TEXT([OrderDate], "yyyy-mm-dd") }}      → "2026-05-12"
{{ TEXT([OrderDate], "yyyy-mm") }}          → "2026-05"
{{ TEXT([OrderDate], "mmm d, yyyy") }}      → "May 12, 2026"
{{ TEXT(TODAY(), "yyyy-mm-dd") }}            → today in UTC (per ADR-0001)
```

`TODAY()` returns today-in-UTC. If the operator's timezone matters,
pass the date as a `__inputs__` value rather than calling `TODAY()`.

## Percentages

```text
{{ TEXT([Margin], "0.0%") }}     → "12.3%" (Margin is 0.1234)
{{ TEXT([Rate], "0%") }}          → "8%"
```

## Mixing with concatenation

```text
{{ "Total: " & TEXT(SUM([Amount]), "$#,##0") }}    → "Total: $43,500"
{{ "Run: " & TEXT(TODAY(), "yyyy-mm-dd") }}          → "Run: 2026-05-12"
```

The `&` operator strings the result of `TEXT()` together with literals
and other text. Useful for header rows, filenames, sheet names.

## When NOT to use TEXT()

For most cells, the simpler path is the **template cell's `numFmt`**:

- Author the cell with format `$#,##0.00` in Excel.
- Reference the raw number: `{{ [Amount] }}`.
- xl3 preserves the cell format on output.

This keeps the cell typed as a number — Excel can still sum it, filter
it, etc. `TEXT()` forces a string-typed cell. Use `TEXT()` when:

- You need the formatted value inside a string concatenation.
- You need a format the cell's `numFmt` can't express.
- The output is going somewhere that won't apply the cell's format
  (e.g., a CSV consumer).

## Supported formats

xl3 supports the core Excel format table. Formats outside the core
table are implementation-defined per ADR-0021 — keep `template.xlsx`
portable by sticking to the conventional Excel tokens.

## Spec pointers

- [`spec/language.md`](../../spec/language.md) "TEXT" + the core format
  table.
- ADR-0001 (`TODAY()` is UTC).
- ADR-0017 (date value model).
- ADR-0021 (custom format strings are impl-defined).
