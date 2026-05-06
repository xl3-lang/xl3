# xl3

> Use an Excel workbook as the template. Feed it data from another Excel workbook.
> Get a formatted Excel workbook back.

**Status:** alpha · XTL spec 0.1 (draft) · breaking changes possible until 1.0

[한국어](./README.ko.md) · [Website](https://xl3.io) · [Spec](./spec) · [Implementations](./IMPLEMENTATIONS.md)

---

## What is xl3?

xl3 is an Excel-to-Excel templating engine.

You design a normal `.xlsx` workbook as the template, write expressions such as
`{{ [Customer] }}` or `{{ IF([Amount] > 1000, "VIP", "Standard") }}` inside
cells, and feed xl3 another `.xlsx` workbook as data. xl3 renders a new workbook
while preserving spreadsheet structure, styles, number formats, and merged
cells.

```
data.xlsx       (your source data)
       +
template.xlsx   (your workbook template)
       ↓
result.xlsx     (filled workbook, with formatting preserved)
```

Templates are authored **in Excel itself**. Drop variables into cells, save the
file, run xl3. No macros, no hidden scripts, no vendor cloud.

Excel users design the document. Developers automate the data flow.

## Quick example

A template can contain ordinary Excel content plus xl3 expressions:

| Cell | Template value |
|---|---|
| A1 | `Customer` |
| B1 | `Amount` |
| A2 | `{{ [Customer] }}` |
| B2 | `{{ TEXT([Amount], "#,##0.00") }}` |

Given this data workbook:

| Customer | Amount |
|---|---:|
| Acme | 1200 |
| Beta | 350 |

xl3 renders:

| Customer | Amount |
|---|---:|
| Acme | 1,200.00 |
| Beta | 350.00 |

The output is still an `.xlsx` workbook. Template formatting, number formats,
and merged cells are part of the expected result, not incidental details.

See [`spec/`](./spec) for the language draft and [`conformance/`](./conformance) for the implementation-neutral fixture corpus and runner protocol.

## Why xl3 exists

Many reporting workflows already live in spreadsheets: report forms, invoices,
settlement sheets, exports, and internal operation templates. xl3 keeps that
authoring model intact. The spreadsheet remains the template, while the
transformation rules are explicit, deterministic, and testable.

The goal is not to replace Excel with code. The goal is to keep Excel as the
authoring tool and move repetitive data filling into a small, testable template
language.

## What xl3 emphasizes

- **Excel in, Excel out.** Templates and source data are both `.xlsx` files.
- **Templates are real spreadsheets.** Layout and formatting stay in the workbook.
- **Formatting is part of the contract.** Styles, number formats, and merged cells
  are covered by Stage 2 conformance tests.
- **No macros.** Template behavior is represented by explicit cell expressions.
- **Conformance-tested behavior.** The TypeScript reference implementation
  currently passes the XTL 0.1 fixture corpus, including Stage 2 OOXML comparison.

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
