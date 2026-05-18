# 17 · Template-authoring display

## Common situation

You open your `template.xlsx` in Excel to edit. You see:

- A cell `=VLOOKUP("Acme", Data!A:B, 2, FALSE)` showing `#N/A`.
- A cell `=Data!B2 + 100` showing `#VALUE!`.
- A cell formatted as currency `₩#,##0` showing `{{ [Amount] }}`
  as plain text.
- A data-validation alert popping up when you click into a
  placeholder cell.

**None of these is a bug.** When xl3 renders the template, all
of them disappear:

- The Data sheet's placeholders get replaced with real values.
- The VLOOKUP finds "Acme" in column A.
- The `+100` works because the cell is now a number.
- The currency format applies to the substituted number.
- Validation rules apply to the actual value.

This recipe explains *why* the template view shows what it
shows, and what to do about it if you find it noisy. (ADR-0049
is the spec contract behind this.)

## Why placeholders display as literal text

When the template has a cell value `{{ [Amount] }}` formatted
as `#,##0.00`, Excel sees a non-numeric string in a number cell.
Excel's behavior:

- Display the text as-is (no auto-formatting).
- Don't show a "Number stored as text" green triangle (the
  heuristic requires numeric-looking content; `{{ ... }}` is
  obviously non-numeric).
- Don't error out (it's a plain string, not a malformed formula).

The cell shows `{{ [Amount] }}` in your edit view. After xl3
renders, the same cell shows `1,234.56` (or whatever the value
× format combination produces).

**This is intentional.** Visible placeholders make the template
*self-documenting*: you can see which cells are dynamic vs which
are fixed without running anything. A reviewer can open the file
and read the contract directly.

## Why dashboard formulas show errors (and how to clean them up)

A dashboard sheet often has formulas like:

```excel
=VLOOKUP("Acme", Data!A:B, 2, FALSE)
=Data!B2 + 100
=AVERAGE(Data!B:B)
=SUMPRODUCT((Data!A:A="VIP") * Data!B:B)
```

Opening the template (before render), these reference the Data
sheet's placeholder rows. Lookups don't find matches (strings
don't match the literal key); arithmetic on a string returns
`#VALUE!`. Result: a sea of red cells in the dashboard during
authoring.

### Fix: wrap with `IFERROR`

The Excel-native answer. One line per formula, learned in
seconds.

```excel
=IFERROR(VLOOKUP("Acme", Data!A:B, 2, FALSE), "—")
=IFERROR(Data!B2 + 100, 0)
=IFERROR(AVERAGE(Data!B:B), 0)
=IFERROR(SUMPRODUCT((Data!A:A="VIP") * Data!B:B), 0)
```

Pre-render template view: clean (`—`, `0`).
Post-render output: real values (xl3 doesn't touch the formula
text per [ADR-0046](../../spec/decisions/0046-cell-formula-preservation.md);
Excel recalculates at open time and the wrapper becomes invisible).

### Which formulas need the wrap

| Formula | Template-view error? | Wrap? |
|---|---|---|
| `=SUM(Data!B:B)` | No — SUM ignores text in ranges, returns 0 | Optional |
| `=SUMIF(Data!A:A, "VIP", Data!B:B)` | No — returns 0 if no matches | Optional |
| `=COUNTIF(Data!A:A, "VIP")` | No — returns 0 | Optional |
| `=AVERAGE(Data!B:B)` | **Yes** — `#DIV/0!` if no numbers | Yes |
| `=VLOOKUP("key", Data!..., ...)` | **Yes** — `#N/A` if no match | Yes |
| `=INDEX(...,MATCH("key",Data!A:A,0))` | **Yes** — `#N/A` | Yes |
| `=Data!B2 + N` (cell-level arithmetic) | **Yes** — `#VALUE!` | Yes |
| `=Data!B2 & " text"` (text concat) | No — string concat with placeholder works | No |
| `=COUNTA(Data!A:A)` | No — counts non-blank cells, placeholders count | No |

**Rule of thumb:** wrap anything that returns `#N/A`, `#VALUE!`,
or `#DIV/0!` against a placeholder row. The aggregate-style
functions (`SUM`, `COUNT*`, `SUMIF*`) tolerate text and don't
need the wrap.

## Verifying the rendered output

You don't have to deduce the rendered output from the template
view. Three quick paths:

### 1. xl3.io playground

Drop `template.xlsx` + sample `data.xlsx` (or use the bundled
samples) into [xl3.io](https://xl3.io). You see the rendered
workbook in seconds.

### 2. `preview()` API in your host

If you're embedding xl3 in a TypeScript host:

```ts
import { preview } from '@jinyoung4478/xl3';

const result = await preview(templateBuffer, dataBuffer);
console.log(result.sources);   // detected source rows
console.log(result.files);     // output files and sheets
console.log(result.warnings);  // any non-fatal issues
```

`preview()` runs the same parse + early-evaluation phases as
`convert()` but doesn't produce the workbook bytes — useful for
host-side validation before kicking off the full render.

### 3. Quick CLI smoke test

```bash
# Build the example workbooks (if you want fresh samples)
npm run examples:build

# Render one and inspect
node -e "
import('@jinyoung4478/xl3').then(async ({ convert }) => {
  const fs = await import('node:fs/promises');
  const tpl = await fs.readFile('./template.xlsx');
  const data = await fs.readFile('./data.xlsx');
  const outs = await convert(tpl.buffer, data.buffer);
  for (const o of outs) await fs.writeFile('rendered-' + o.filename, o.data);
})
"
```

Open `rendered-*.xlsx` to see the real output.

## Data validation alerts during authoring

If you set a validation rule like "must be a number between 0
and 100" on a column, then click into a placeholder cell during
authoring, Excel pops the validation alert ("This value doesn't
match the rule").

Options:

- **Set validation style to `Warning` or `Information`** instead
  of `Stop` — the alert still appears but doesn't block editing.
- **Place validation on a non-placeholder cell that gets
  propagated to data rows.** xl3's preservation (ADR-0036 §8)
  carries the rule through to expanded rows.
- **Accept the click-time alert** — it disappears once xl3
  substitutes the real value, and operators viewing the
  rendered file never see it.

## What xl3 deliberately does NOT do

This is the contract from [ADR-0049](../../spec/decisions/0049-template-display-vs-render-output.md):

1. xl3 does **not** pre-substitute placeholders with sample
   values for the template view. (That would lose the visual
   placeholder signal.)
2. xl3 does **not** maintain two separate `numFmt`s per cell
   ("template-view format" vs "render format"). (Extra spec
   surface, marginal gain.)
3. xl3 does **not** auto-wrap your dashboard formulas with
   `IFERROR`. (Would change formula text in ways ADR-0046
   forbids; would silently swallow real author mistakes.)

The author owns the template view; the engine owns the rendered
output. They are different things by design.

## See also

- [ADR-0049 — Template-display vs render-output: intentional asymmetry](../../spec/decisions/0049-template-display-vs-render-output.md)
- [ADR-0046 — Cell formula preservation contract](../../spec/decisions/0046-cell-formula-preservation.md)
- [Cookbook 16 — XTL function vs Excel formula](./16-xtl-vs-excel-formula.md)
- [`preview()` API documentation](../api/functions/preview.md)
