# 04 · One file per group

## Scenario

You have a renewal report and want one `.xlsx` per region instead of one
big file. Operators can hand each region's file directly to that region's
team.

## `__config__`

| key | value |
|---|---|
| `source_sheet` | `Raw` |
| `source_table` | `1` |
| `output_file_pattern` | `{{ [Region] }}.xlsx` |

The group key is whatever you reference in `output_file_pattern`. xl3
groups source rows by the resolved value of that pattern and emits one
file per distinct value.

## Data (sheet `Raw`)

| Account | Region | Renewal |
|---|---|---:|
| Acme | Seoul | 18400 |
| Beta | Busan | 7200 |
| Coreon | Seoul | 25100 |

## Output

Two files:

- `Seoul.xlsx` — contains Acme + Coreon rows.
- `Busan.xlsx` — contains Beta.

## Multi-key file grouping

```text
output_file_pattern = {{ [Region] }}-{{ [Tier] }}.xlsx
```

Group key becomes the tuple `(Region, Tier)`. Distinct tuples → distinct
files. `Seoul-A.xlsx`, `Seoul-B.xlsx`, `Busan-A.xlsx`, etc.

## Filename sanitization

xl3 sanitizes filenames per ADR-0002: replaces `/ \ : * ? " < > |` with
`_`, collapses runs of `_`, and trims trailing `.` / spaces. If two
distinct group values sanitize to the same filename — `Seoul/Korea` and
`Seoul:Korea` both become `Seoul_Korea.xlsx` — xl3 raises
`xl3/filename/collision` per ADR-0031 instead of silently overwriting.

## Empty group key

If a row has an empty value for the group key, xl3 substitutes the
literal `(blank)` per Excel pivot convention (ADR-0026). The file lands
in `(blank).xlsx`.

## Notes

- File order is first-seen per ADR-0016 — the order rows appear in the
  source.
- For sheet-level grouping (one sheet per region in one file) see
  [Recipe 05](./05-sheet-per-group.md).
