# xl3

> Excel-to-Excel templates where the spreadsheet itself is the template.

**Status:** alpha · XTL spec 0.1 (draft) · breaking changes possible until 1.0

[Website](https://xl3.io) · [Spec](./spec) · [Implementations](./IMPLEMENTATIONS.md)

---

## What is xl3?

xl3 takes a source workbook and a template workbook, then produces one or more result workbooks:

```
data.xlsx       (your raw data)
       +
template.xlsx   (your form, with {{ }} placeholders inside cells)
       ↓
result.xlsx     (filled, repeated, grouped — possibly many files)
```

Templates are authored **in Excel itself**. Drop variables into cells, save, run. No code, no DSL learned outside the spreadsheet, no vendor cloud.

## Quick example

A template cell containing `{{ [Item] }} - {{ [Quantity] }}` followed by a row of source data with `Item="Widget"`, `Quantity=12` produces a cell with the value `Widget - 12`. Repeat blocks, group keys (sheet/file split), filters, Excel-style functions such as `IF()`, `SUM()`, `COUNT()`, `ROW()`, and `TODAY()`, and template cell number/date formats extend this to real-world reporting workflows.

See [`spec/`](./spec) for the language draft and [`conformance/`](./conformance) for the implementation-neutral fixture corpus and runner protocol.

## Why xl3 exists

Many reporting workflows already live in spreadsheets: forms, totals, filters, grouping, and layout. xl3 keeps that authoring model intact. The spreadsheet remains the template, while the transformation rules are explicit, deterministic, and testable.

The goal is not to replace Excel with code. The goal is to make spreadsheet-authored transformations reproducible across implementations.

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

## Spec

The XTL spec is language-neutral and lives in [`spec/`](./spec). This repo provides the TypeScript reference implementation. Other-language ports are welcome — see [IMPLEMENTATIONS.md](./IMPLEMENTATIONS.md).

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
