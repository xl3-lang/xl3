# xl3

> **The deterministic runtime for AI-generated Excel reports.**
> An LLM writes the template, xl3 renders the workbook — same template,
> same data, same bytes, every time.

**Status:** alpha · XTL spec 0.1 (draft) · breaking changes possible until 1.0

xl3 is a small TypeScript engine that turns a pair of `.xlsx` files —
a **template** (the workflow contract) and **raw data** — into a
finished, formatted workbook. The template is itself an `.xlsx`, authored
in Excel with familiar formulas plus a tiny embedded expression
language (XTL) for the things that must be known *before* the workbook
is written: filters, groups, aggregates, filename patterns.

It's a good fit when the template is generated, edited, or reviewed by
an LLM (Claude, GPT, Gemini, Cursor, Codex, …) and you need the
**execution** layer to stay deterministic, inspectable, and verifiable —
not "AI guessing at the output cells."

**English** · [한국어](./README.ko.md) · [日本語](./README.ja.md) · [简体中文](./README.zh-CN.md) · [繁體中文](./README.zh-TW.md) · [Español](./README.es.md) · [Website](https://xl3.io) · [Spec](./spec) · [LLM authoring guide](./docs/llm-template-authoring.md) · [Implementations](./IMPLEMENTATIONS.md) · [Roadmap](./ROADMAP.md) · [Governance](./GOVERNANCE.md)

---

## The split: model writes, runtime renders

```text
  ┌──────────────────────────┐         ┌──────────────────────────┐
  │   LLM (Claude / GPT /    │         │         xl3              │
  │   Gemini / Cursor / …)   │         │  (deterministic runtime) │
  │                          │         │                          │
  │   natural language       │         │   template.xlsx          │
  │   + sample report   ───► │  emits  │   + raw.xlsx             │
  │                          │         │   → result.xlsx          │
  │   "monthly settlement    │         │                          │
  │    by region, with       │         │   same inputs            │
  │    per-region subtotals" │         │   → same bytes, always   │
  └──────────────────────────┘         └──────────────────────────┘
       creative, stochastic                 boring, reproducible
```

LLMs are good at *drafting* a report shape from a prompt and a sample.
They are bad at producing the same `.xlsx` twice, preserving cell styles,
or honoring "this column must always be SUM-aggregated." xl3 fills that
gap: the model emits an `.xlsx` template once; every subsequent render
is a pure function of `(template, data, inputs)`.

This split is what [`docs/llm-template-authoring.md`](./docs/llm-template-authoring.md),
the 154-fixture conformance corpus, and the intentionally small XTL
surface are designed for.

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

…with the template's number formats, fills, borders, merged headers, and
footer rows preserved verbatim. The output is an `.xlsx` you can open in
Excel, Numbers, or Google Sheets without conversion.

See [`spec/`](./spec) for the language draft and [`conformance/`](./conformance) for the implementation-neutral fixture corpus and runner protocol.

## Why the runtime needs to be boring

The pitch in one paragraph: **anything an LLM emits as Excel is one bad
token away from a broken report.** Cell formulas drift, a merge moves
by one row, a currency symbol becomes a literal `$` instead of a number
format. xl3's job is to make the *execution* of that template predictable
so the model only has to be right *once*.

Concretely:

- **A small, auditable XTL surface (ADR-0043).** A function lives in
  XTL only when its value must be known *before* the workbook is
  written. Everything else is a normal Excel cell formula and Excel
  evaluates it at open time. The smaller the language, the smaller
  the surface an LLM has to learn — and the smaller the surface to
  verify. See [Cookbook 16](./docs/guides/16-xtl-vs-excel-formula.md)
  for the side-by-side guide.
- **Conformance corpus.** 154 fixtures, all green, across 70 ADRs.
  This is the test bed an LLM's template can be checked against
  *before* it ever touches user data.
- **One implementation, one spec.** The [`spec/`](./spec) directory
  defines XTL independently of this TypeScript reference. Ports to
  other runtimes are welcome; the corpus is the contract.
- **No macros, no vendor cloud.** A template is an ordinary `.xlsx`.
  You can diff it, review it in a pull request, and hand it to a
  human reviewer who has never heard of xl3.

The same properties make xl3 useful even **without an LLM in the loop** —
operators and analysts can read and edit templates directly, because
expressions are written with the same `IF`, `SUM`, and column references
they already use day to day. The AI angle is the wedge; the
human-readability is the long tail.

## What's new

**0.8.0 → 0.9.0-rc.1** (May 2026): opt-in **Rust + WebAssembly
acceleration**. Install [`xl3-wasm`](https://www.npmjs.com/package/xl3-wasm)
alongside `@jinyoung4478/xl3@rc` and `convert` / `preview` route their
heavy work — XLSX parsing, XTL evaluation, output serialization, deflate —
through [`xl3-core`](https://crates.io/crates/xl3-core) (calamine +
rust_xlsxwriter). The JS path stays the canonical reference; the wasm
path falls back to it automatically on any unsupported template
construct or missing dependency.

```bash
npm install @jinyoung4478/xl3@rc xl3-wasm
```

```ts
await convert(templateBuffer, dataBuffer, { engine: 'wasm' });
// or 'auto' (default) / 'js'
```

Measured speedups (Node 22, Apple Silicon, May 2026): 36k-row multi-axis
report **2.5 s → ~0.3 s**, 70 MB / 6 M cells round-trip **67 s → ~5.8 s**
warm. Conformance under `--engine=wasm`: **119 / 148** Stage 1 fixtures
pass — see [IMPLEMENTATIONS.md](./IMPLEMENTATIONS.md) for the Rust
impl's row. `latest` stays on 0.8.0 until the 7-day rc soak completes
(earliest 2026-06-02).

**0.7.0 → 0.8.0** (May 2026): data blocks are now **column-scoped**
(ADR-0066). Side summary tables, header columns, and notes off to the
right keep their original row positions when the block expands. Closes
two long-standing bugs (#46 duplicate shared-formula owners, #47 stale
formula references in displaced side cells). Adds the explicit
**`@block`** directive (ADR-0067) in three forms — bare, column-range,
and rectangular — plus strict multi-block detection (ADR-0068) on
sheets that opt in. **Backward compatibility:** templates without
`@block` and without outside-column content render exactly the same as
0.7.x; `@block` is opt-in.

**0.6.0 → 0.7.0**: a 15-ADR pass (ADR-0051..0065) closed every remaining
syntactic-conflict surface — places where a template shape could be
parsed two ways or silently fall through. The most user-visible change
is **aggregate argument shape** (ADR-0059): `SUM`, `AVERAGE`, `MIN`,
`MAX`, and 1-arg `COUNT` now require a single column reference and
reject per-row arithmetic at parse time. Use a helper column upstream
or a native `=SUMPRODUCT(...)` in the footer cell (see
[Cookbook 03](./docs/guides/03-aggregates.md)).

**0.5.x → 0.6.0**: native merged-cell headers (ADR-0033) — common in
Korean vendor templates (거래명세서, 정산서, 발주서); merged data rows
broadcast to slaves (ADR-0035); a normative feature-preservation matrix
covering images, conditional formatting, named ranges, freeze pane,
sheet protection, data validation, and cell comments (ADR-0036); and
**`@group` / `@subtotal`** for interleaved per-customer / per-month
subtotal rows in a single data block (ADR-0038).

[Full changelog →](./CHANGELOG.md)

## How it compares

| Approach | Best at | Tradeoff for AI-driven Excel |
|---|---|---|
| **xl3** | The execution half of an LLM-authored Excel pipeline. The model writes the template once; xl3 renders deterministically every run. | Alpha; one maintainer; the XTL surface is intentionally small and still evolving until 1.0. |
| Direct LLM → xlsx (function-call to a spreadsheet SDK) | Quick exploratory drafting, one-off charts. | Each render is non-deterministic; styles, number formats, and totals drift between runs even with temperature 0. |
| SheetJS / ExcelJS / openpyxl | Low-level workbook generation. | The model has to learn the entire SDK surface and re-emit it every render; the "template" is application code, not a portable file. |
| Power Query / Office Scripts / Power Automate | Microsoft 365 workflows, data shaping, and action automation inside the Excel ecosystem. | Tenant-bound; the workflow rules don't travel with the workbook. |
| JXLS / xltpl / jsreport xlsx recipe | Server-side report generation from spreadsheet-like templates. | Useful, but predate the LLM-as-author model; their template DSLs are larger and not designed to be model-emittable. |
| Document-generation SaaS (Plumsail, Conga, Formstack) | Managed document workflows, integrations, approvals, and delivery. | Rules live in a vendor service, not a portable workbook you can hand an LLM to edit. |

## Status, honestly

- **Alpha.** XTL is at spec 0.1 (draft). Behavior is stabilizing fast
  but the language surface can still change before 1.0.
- **One maintainer.** No production reference cases yet. If you ship
  xl3 in something that matters, the most valuable contribution right
  now is *telling me about it* — open an issue or a discussion thread,
  even a thumbs-up that "this worked for us." That feedback is the
  difference between a 1.0 that fits real workflows and one that fits
  my imagination of them.
- **70 ADRs, 154 conformance fixtures, all green.** The language surface
  is stable enough for early adopters.
- **MIT, TypeScript, Node ≥ 20.12, runs in browsers.**

See [ROADMAP.md](./ROADMAP.md) for what's blocking 1.0 and
[GOVERNANCE.md](./GOVERNANCE.md) for how decisions are made.

> **Authoring an xl3 template with an LLM?** Read
> [`docs/llm-template-authoring.md`](./docs/llm-template-authoring.md)
> first — it covers the one mistake LLMs reliably make (leftover styled
> rows polluting every output) and how to avoid it.

## Install

```bash
npm install @jinyoung4478/xl3
```

Optional acceleration (rc):

```bash
npm install @jinyoung4478/xl3@rc xl3-wasm
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

### Acceleration (opt-in)

`convert` and `preview` accept an `engine` option that selects the
rendering backend:

```ts
await convert(templateBuffer, dataBuffer, { engine: 'auto' });
//   'auto' (default): try xl3-wasm if installed, fall back to JS silently
//   'wasm'          : require xl3-wasm; throw if missing or unsupported feature
//   'js'            : force the ExcelJS path
```

Install [`xl3-wasm`](https://www.npmjs.com/package/xl3-wasm) alongside
xl3 to activate the auto path; the JS engine remains the canonical
reference, and the wasm engine falls back to it for any template it
can't yet handle. Available in 0.9.0-rc.1 onwards.

### Browser via `<script>` (no bundler)

For projects that don't use a bundler, a self-contained IIFE bundle
exposes `window.xl3`:

```html
<script src="https://cdn.jsdelivr.net/npm/@jinyoung4478/xl3@0.8.0/dist/xl3.bundle.iife.min.js"></script>
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

Four production-shaped templates live in [`examples/`](./examples):
basic renewal report, sheet-per-region with list-filter, a
multi-source join with runtime inputs, and a cafe weekly report
showcasing `@group` + `@subtotal` per-category subtotals. Run them
with `npm run examples:build && npm run examples:run`.

## Guides

Short, copy-paste recipes for common workflows live in
[`docs/guides/`](./docs/guides). Eighteen recipes covering getting
started, conditionals, aggregates, file/sheet grouping, runtime
inputs, joins, `XLOOKUP`, sort/top, styling, multi-line text, empty
values, error handling, `__config__` values, directive composition,
XTL vs Excel-formula, template-authoring display, and `@group` /
`@subtotal`.

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
