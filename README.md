# xl3

> Excel conversion, inside Excel, in Excel syntax.
> Keep recurring Excel transformation rules inside workbook templates.

**Status:** alpha · XTL spec 0.1 (draft) · breaking changes possible until 1.0

xl3 is technically capable but in its formative phase as a project: a single
maintainer, no production reference cases yet, governance just documented.
The audit pass closed every silent-fallthrough surface (32 ADRs, 119 fixtures,
all green at Stage 2), so the language surface is stable enough for early
adopters. **Early adopter feedback is the most useful contribution right
now** — see [ROADMAP.md](./ROADMAP.md) for what's blocking 1.0 and
[GOVERNANCE.md](./GOVERNANCE.md) for how decisions are made.

[한국어](./README.ko.md) · [Website](https://xl3.io) · [Spec](./spec) · [Implementations](./IMPLEMENTATIONS.md) · [Roadmap](./ROADMAP.md) · [Governance](./GOVERNANCE.md)

---

## What is xl3?

xl3 puts Excel transformation logic **inside the Excel file**, not in code.
Non-developers can read and edit the rules directly, because they are written
with the same `IF`, `SUM`, and column references they already use day to day.
Developers ship the engine; the workbook ships the workflow.

The frame is simple:

- Who: operators and analysts who should not need to read code
- What: recurring Excel transformation rules
- How: template workbooks, `source_table`, and familiar Excel formulas

```text
raw.xlsx        (input data)
       +
template.xlsx   (workflow contract)
       ↓
result.xlsx     (finished workbook)
```

Developers own the engine in code. Operators use a file-based flow:
upload raw Excel, choose the approved template, and download the finished
workbook.

Templates are authored **in Excel itself**. Put configuration in `__config__`,
add expressions such as `{{ [Account] }}` or
`{{ IF([Renewal] > 10000, "Priority", "Standard") }}` to cells, save the file,
and run xl3. No macros, no hidden scripts, no vendor cloud.

The template is the handover artifact. It can be reviewed, versioned, archived,
and passed to the next operator without asking them to read the automation
code.

## Quick example

A template can contain ordinary Excel content, `__config__`, and xl3 expressions:

| `__config__` key | Value |
|---|---|
| `source_sheet` | `Raw` |
| `source_table` | `1` |
| `output_file_pattern` | `customer-renewal-report.xlsx` |

| Cell | Template value |
|---|---|
| A5 | `{{ [Account] }}` |
| B5 | `{{ [Region] }}` |
| C5 | `{{ [Renewal] }}` |
| E5 | `{{ IF([Renewal] > 10000, "Priority", "Standard") }}` |

Given this data workbook:

| Account | Region | Renewal | Owner |
|---|---|---:|---|
| Acme Logistics | Seoul | 18400 | Mina |
| Beta Works | Busan | 7200 | Joon |

xl3 renders:

| Account | Region | Renewal | Owner | Tier |
|---|---|---:|---|---|
| Acme Logistics | Seoul | 18400 | Mina | Priority |
| Beta Works | Busan | 7200 | Joon | Standard |

The output is still an `.xlsx` workbook. Template formatting, number formats,
and merged cells are part of the expected result, not incidental details.

See [`spec/`](./spec) for the language draft and [`conformance/`](./conformance) for the implementation-neutral fixture corpus and runner protocol.

## Why xl3 exists

Many reporting workflows already live in spreadsheets: renewal reports,
settlement sheets, invoice exports, internal operation templates. They are often
automated with one-off Python scripts, VBA macros, or service-specific workflow
steps. That works until the rules are scattered across code, accounts, and
tribal knowledge.

xl3 separates the reusable engine from the workbook-specific contract. Keep
deployment, validation, and integration in code; keep the recurring business
workflow in the workbook.

## What xl3 emphasizes

- **A file-based workflow.** Raw `.xlsx` in, approved template in, finished
  workbook out.
- **Rules travel with the workbook.** `__config__`, expressions, layout, and
  output shape are archived in `template.xlsx`.
- **Developer-owned engine.** Use the TypeScript API in a browser page, internal
  portal, CLI, or service endpoint.
- **Excel stays Excel.** Styles, number formats, sheet structure, and merged
  cells remain part of the result.
- **No macros or vendor cloud.** Template behavior is explicit workbook
  content.

## How it compares

| Approach | Best at | Tradeoff |
|---|---|---|
| **xl3** | Building file-based Excel transformation engines where operators upload raw `.xlsx` files and download finished workbooks. Workflow rules stay in `template.xlsx`. | Alpha. The XTL surface is intentionally small and still evolving. |
| Python/VBA scripts | Fast one-off automation close to existing spreadsheets. | Business rules tend to live in code or one maintainer's memory, which makes handoff and review harder. |
| Power Query / Office Scripts / Power Automate | Microsoft 365 workflows, data shaping, and action automation inside the Excel ecosystem. | Strong platform fit, but workflows can become tenant/account/environment-specific rather than portable workbook artifacts. |
| Spreadsheet SDKs such as SheetJS, ExcelJS, Aspose.Cells | Low-level or full-featured programmatic workbook generation. | Developers usually encode report-specific rules directly in application code. |
| Template/report engines such as JXLS or xltpl | Server-side report generation from spreadsheet-like templates. | Useful, but often language/runtime-specific; operator-facing browser flows and workbook-level handoff are not the main product shape. |
| Document-generation SaaS such as Plumsail, Formstack, Conga | Managed document workflows, integrations, approvals, and delivery. | Rules live in a vendor service, not primarily in a portable workbook template you can self-host. |
| LLM-based spreadsheet generation | Ad hoc exploration and drafting. | Not a deterministic transformation contract for recurring operational work. |

## Install

```bash
npm install @jinyoung4478/xl3
```

## Usage

```ts
import { convert } from '@jinyoung4478/xl3';

const templateBuffer = await fetch('./template.xlsx').then((r) => r.arrayBuffer());
const dataBuffer = await fetch('./data.xlsx').then((r) => r.arrayBuffer());

const outputs = await convert(templateBuffer, dataBuffer);
// outputs: OutputFile[] — one or more .xlsx, depending on grouping rules in the template
```

Runs in browsers and Node (≥20.12).

### Browser via `<script>` (no bundler)

For projects that don't use a bundler, a self-contained IIFE bundle
exposes `window.xl3`:

```html
<script src="https://cdn.jsdelivr.net/npm/@jinyoung4478/xl3@0.4.1/dist/xl3.bundle.iife.min.js"></script>
<script>
  const tpl = await fetch('./template.xlsx').then((r) => r.arrayBuffer());
  const data = await fetch('./data.xlsx').then((r) => r.arrayBuffer());
  const outputs = await xl3.convert(tpl, data);
</script>
```

Bundle is ~1 MB minified (~300 KB gzipped). ExcelJS + JSZip are inlined;
no other dependencies are needed.

You can try the browser flow on [xl3.io](https://xl3.io): run the attached
sample files as-is, download the raw/template workbooks, or replace either file
with your own.

### Excel version compatibility

xl3 reads `.xlsx` files via OOXML and is largely version-agnostic by design — it reads cached formula results, normalizes dates in UTC, and ignores OOXML serialization differences at the cell-value layer. See [ADR-0022](./spec/decisions/0022-excel-version-compatibility.md) for the full matrix; the short form is: stick to XTL's `{{ ... }}` syntax for anything dynamic, avoid charts/pivots/native formulas inside data blocks, and pick one date system (1900) per organization.

Templates choose the source table in the hidden `__config__` sheet:

| Key | Example | Meaning |
|---|---|---|
| `source_sheet` | `Raw` | source worksheet name, or prefix pattern ending with `*` |
| `source_table` | `1` | row 1 contains column names; rows below are data |
| `source_table` | `A1:D` | A1-D1 contain column names; rows below are data |
| `source_table` | `A1:D200` | A1-D1 contain column names; A2-D200 are data |

Use `source_table = N` for the common case where row `N` contains the raw
column names. Use a range form when the table starts in a later column or needs
a bounded end row.

### Reserved sheets

Templates use four reserved dunder-wrapped sheets (per ADR-0011):

| Sheet | Purpose |
|---|---|
| `__config__` | author-defined configuration and value dictionary; access via `{{ __config__[name] }}` |
| `__inputs__` | per-run host-supplied values (ADR-0010); declared with `name`/`type`/`default`/`label`/`description`/`options` columns |
| `__sources__` | additional named data sources beyond the default `source_sheet` (ADR-0012); declared with `name`/`sheet`/`table`/`description` columns |
| `__lists__` | membership lists for `@filter [field] in __lists__[name]` |

Author sheets matching `^__[a-z]+__$` are reserved and rejected at parse time.

### Multi-source data

Beyond the default `source_sheet`, templates can declare named sources in
`__sources__` and reference them with the Excel structured-ref form:

```text
{{ Customers[Account] }}
{{ SUM(Renewals[Amount]) }}
{{ XLOOKUP([Account], Customers[Account], Customers[Name]) }}
```

`@source <Name>` scopes a data block so the bare bracket shorthand
(`[Column]`) resolves against `<Name>` instead of the default. `@join`
pairs primary rows with rows from a second source by key (inner-join,
first-match). See [`spec/language.md`](./spec/language.md) for full
directive syntax.

### Runtime inputs

Templates that need per-run values (a target month, a customer
filter, a label) declare them in `__inputs__` and the host passes
them to `convert(...)`:

```ts
await convert(templateBuffer, dataBuffer, {
  inputs: { month: '2026-05', region: 'Seoul' },
});
```

Inputs flow into cells (`{{ __inputs__[month] }}`), filename patterns,
and group keys.

## Examples

Three production-shaped templates live in [`examples/`](./examples):
basic renewal report, sheet-per-region with list-filter, and a
multi-source join with runtime inputs. Run them with
`npm run examples:build && npm run examples:run`.

## Guides

Short, copy-paste recipes for common workflows live in
[`docs/guides/`](./docs/guides). Ten recipes covering getting
started, conditionals, aggregates, file/sheet grouping, runtime
inputs, joins, `XLOOKUP`, sort/top, and styling.

## Spec

The XTL spec is language-neutral and lives in [`spec/`](./spec). This repo provides the TypeScript reference implementation. Other-language ports are welcome — see [IMPLEMENTATIONS.md](./IMPLEMENTATIONS.md).

Run the conformance corpus locally:

```bash
npm run conformance
node dist/bin/conformance.js --fixture-dir=conformance/fixtures --comparison-stage=2
```

A summary of the latest reference-impl run — plus columns for any
external port reports dropped under
[`conformance/reports/`](./conformance/reports/) — lives in
[`conformance/DASHBOARD.md`](./conformance/DASHBOARD.md). Regenerate
with `npm run conformance:dashboard`.

## Project structure

- `spec/` — normative XTL language draft.
- `conformance/` — implementation-neutral fixture corpus and runner protocol.
- `src/` — TypeScript reference implementation.

The spec is the source of truth. Conformance fixtures make spec behavior executable. The reference implementation is useful, but not normative.

## License

- Code (`src/`, `conformance/`): [MIT](./LICENSE)
- XTL spec (`spec/`): [CC-BY-4.0](./spec/LICENSE)

---

Microsoft and Excel are trademarks of Microsoft Corporation. xl3 is not affiliated with Microsoft. The Office Open XML format (`.xlsx`) is published as ISO/IEC 29500.
