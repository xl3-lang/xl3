# 05 · One sheet per group

## Scenario

Same renewal report, one file, but with a separate sheet for each region.
Plus a "non-renewable" sheet that filters to a specific list of statuses.

## Approach: name the template sheet with a group key

The template sheet name is the sheet template. xl3 expands one sheet per
distinct group key value, using the template's contents.

```text
Template sheet name:  Region-{{ [Region] }}
```

xl3 reads the literal name `Region-{{ [Region] }}`, groups source rows
by `Region`, and emits one sheet per region with the resolved name:
`Region-Seoul`, `Region-Busan`, etc.

## `__config__`

| key | value |
|---|---|
| `source_sheet` | `Raw` |
| `source_table` | `1` |
| `output_file_pattern` | `regions.xlsx` |

## Template (sheet name `Region-{{ [Region] }}`)

| Cell | Value |
|---|---|
| A1 | `Account` |
| B1 | `Renewal` |
| A2 | `{{ [Account] }}` |
| B2 | `{{ [Renewal] }}` |
| A3 | `Total` |
| B3 | `{{ SUM([Renewal]) }}` |

## Data

| Account | Region | Renewal |
|---|---|---:|
| Acme | Seoul | 18400 |
| Beta | Busan | 7200 |
| Coreon | Seoul | 25100 |

## Output (`regions.xlsx`)

- Sheet `Region-Seoul`: Acme, Coreon, Total=43500.
- Sheet `Region-Busan`: Beta, Total=7200.

## Filter a sheet to a named list

A common shape: one sheet per group, plus an "all renewals < $5k" sheet
filtered to a status list. Use `__lists__`:

```text
__lists__:
  status_active: ["Active", "Renewing"]
  status_inactive: ["Cancelled", "Lapsed"]
```

Then in a sheet template:

```text
Template sheet name: At-Risk
A1: Account | B1: Status | C1: Renewal
A2: {{ @filter [Status] in __lists__[status_active] }}{{ @filter [Renewal] < 5000 }}{{ [Account] }}
B2: {{ [Status] }}
C2: {{ [Renewal] }}
```

Multiple `@filter` directives in one block compose with AND. Each
filter narrows the previous result.

## Notes

- Sheet name sanitization follows Excel's 31-char limit + forbidden
  chars (`[ ] / \ ? *`). Sanitized values that collide are
  implementation-defined per ADR-0021 — keep group keys distinct upstream.
- Empty group key → literal `(blank)` per ADR-0026.
- Sheet order is first-seen per ADR-0016.
