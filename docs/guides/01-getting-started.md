# 01 · Getting started in 5 minutes

## Scenario

You have an `.xlsx` of customer renewals. You want a one-sheet report with
the same rows, plus a "Tier" column derived from the renewal amount.

## `__config__`

| key | value |
|---|---|
| `source_sheet` | `Raw` |
| `source_table` | `1` |
| `output_file_pattern` | `renewal-report.xlsx` |

## Template cells (sheet `Report`)

| Cell | Value |
|---|---|
| A1 | `Account` |
| B1 | `Region` |
| C1 | `Renewal` |
| D1 | `Tier` |
| A2 | `{{ [Account] }}` |
| B2 | `{{ [Region] }}` |
| C2 | `{{ [Renewal] }}` |
| D2 | `{{ IF([Renewal] > 10000, "Priority", "Standard") }}` |

## Data (sheet `Raw`)

| Account | Region | Renewal |
|---|---|---:|
| Acme Logistics | Seoul | 18400 |
| Beta Works | Busan | 7200 |
| Coreon Foods | Seoul | 25100 |

## Output (`renewal-report.xlsx`, sheet `Report`)

| Account | Region | Renewal | Tier |
|---|---|---:|---|
| Acme Logistics | Seoul | 18400 | Priority |
| Beta Works | Busan | 7200 | Standard |
| Coreon Foods | Seoul | 25100 | Priority |

## Notes

- Row 2 of the template is the **data block**. xl3 expands one input row
  into one output row, preserving styles, number formats, and merges
  from the template row.
- `[Account]` is a **column reference** — xl3 resolves it to the
  `Account` column of the current source row.
- `{{ ... }}` is a **template block** — anything inside is evaluated as an
  XTL expression. Whitespace inside the braces is insignificant.
- The data block stops at the first non-blank row that doesn't contain a
  template block. Add a footer row (e.g., a "Total" cell) and it stays
  put while the data block expands above it.

See also: [`spec/language.md`](../../spec/language.md) "Template Blocks"
and "Source Columns".
