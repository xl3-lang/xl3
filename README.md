# xl3

> Build Excel transformation engines from workbook templates.
> Operators upload raw Excel files and download finished workbooks.

**Status:** alpha · XTL spec 0.1 (draft) · breaking changes possible until 1.0

[한국어](./README.ko.md) · [Website](https://xl3.io) · [Spec](./spec) · [Implementations](./IMPLEMENTATIONS.md)

---

## What is xl3?

xl3 is a TypeScript library for turning recurring Excel transformation work into
template workbooks.

Developers define the reusable engine in code. The workbook-specific rules,
source header mapping, layout, and output shape live inside `template.xlsx`.
Non-developers can then use a simple file flow: upload raw Excel, choose the
approved template, download the finished workbook.

```text
raw.xlsx        (operator data)
       +
template.xlsx   (workflow rules + workbook layout)
       ↓
result.xlsx     (finished workbook)
```

Templates are authored **in Excel itself**. Put configuration in `_config`, add
expressions such as `{{ [Account] }}` or
`{{ IF([Renewal] > 10000, "Priority", "Standard") }}` to cells, save the file,
and run xl3. No macros, no hidden scripts, no vendor cloud.

The template becomes the handover artifact. It can be reviewed, versioned,
archived, and passed to the next operator without asking them to read the
automation code.

## Quick example

A template can contain ordinary Excel content, `_config`, and xl3 expressions:

| `_config` key | Value |
|---|---|
| `source_sheet` | `Raw` |
| `source_header_range` | `A1:D1` |
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

- **Operator-friendly flow.** Raw `.xlsx` in, approved template in, finished
  workbook out.
- **Rules travel with the workbook.** `_config`, expressions, layout, and output
  shape are archived in `template.xlsx`.
- **Developer-owned engine.** Use the TypeScript API in a browser page, internal
  portal, CLI, or service endpoint.
- **Excel stays Excel.** Styles, number formats, sheet structure, and merged
  cells remain part of the result.
- **No macros or vendor cloud.** Template behavior is explicit workbook content.

## How it compares

|  | xl3 | xltpl (Python) | JXLS (Java) | Plumsail | VBA macros | LLMs |
|---|---|---|---|---|---|---|
| Excel-as-template | ✅ | ✅ | ✅ (XML in cells) | ✅ | n/a | ❌ |
| Browser-native | ✅ | ❌ | ❌ | ❌ | ❌ | partial |
| Open spec | ✅ (XTL, CC-BY-4.0) | ❌ | ❌ | ❌ closed | n/a | ❌ |
| Deterministic, reproducible | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| Non-developer authoring | ✅ | ❌ | ❌ | ✅ | ⚠️ | ✅ |
| Self-hostable / no vendor lock | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ |

## Install

```bash
npm install xl3
```

## Usage

```ts
import { convert } from 'xl3';

const templateBuffer = await fetch('./template.xlsx').then((r) => r.arrayBuffer());
const dataBuffer = await fetch('./data.xlsx').then((r) => r.arrayBuffer());

const outputs = await convert(templateBuffer, dataBuffer);
// outputs: OutputFile[] — one or more .xlsx, depending on grouping rules in the template
```

Runs in browsers and Node (≥18).

You can try the browser flow on [xl3.io](https://xl3.io): run the attached
sample files as-is, download the raw/template workbooks, or replace either file
with your own.

Templates can choose the source header cells in the hidden `_config` sheet:

| Key | Example | Meaning |
|---|---|---|
| `source_sheet` | `Raw` | source worksheet name, or prefix pattern ending with `*` |
| `source_header_range` | `A1:D1` | header cells; rows below are read as data |
| `source_range` | `A1:D200` | bounded source range; first row is headers |

Use `source_header_range` when the header span is known but the data row count is
open-ended. Do not set it together with `source_range`.

## Spec

The XTL spec is language-neutral and lives in [`spec/`](./spec). This repo provides the TypeScript reference implementation. Other-language ports are welcome — see [IMPLEMENTATIONS.md](./IMPLEMENTATIONS.md).

Run the conformance corpus locally:

```bash
npm run conformance
node dist/bin/conformance.js --fixture-dir=conformance/fixtures --comparison-stage=2
```

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
