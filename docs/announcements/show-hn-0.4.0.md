# Show HN: xl3 — Excel templates as executable contracts (XTL 0.1)

**Title (≤80 chars):**

> Show HN: xl3 – use Excel files as templates for Excel-to-Excel
> transformations

**URL:** `https://github.com/xl3-lang/xl3`

**Body:**

Hi HN — I built xl3 to put the rules of recurring Excel reports back
inside the Excel file itself, rather than in code that nobody but the
developer can read.

The idea: a template `.xlsx` contains the layout, styling, and a small
expression language (XTL) like `{{ [Account] }}`,
`{{ IF([Renewal] > 10000, "Priority", "Standard") }}`,
`{{ @sort [Amount] desc }}`. A second `.xlsx` is the raw data. xl3
combines them into a finished workbook. No macros, no vendor cloud, no
host code rewriting Excel files row-by-row.

It's aimed at the seam where data engineers and finance/ops people
have to keep handing each other workbooks: the engineer wants the
transformation logic in Git; the operator wants to read and edit the
rules without learning Python. The template is the handoff artifact.

The language is intentionally small — Excel-flavored syntax (IF, SUM,
XLOOKUP, comparison operators), plus a handful of XTL directives
(`@filter`, `@sort`, `@top`, `@source`, `@join`). Documented in a
**language-neutral spec** ([spec/](https://github.com/xl3-lang/xl3/tree/main/spec))
with an executable conformance corpus ([conformance/](https://github.com/xl3-lang/xl3/tree/main/conformance))
— 119 fixtures, all green at Stage 2. The TypeScript implementation
(`@jinyoung4478/xl3` on npm) is the reference impl, not the spec. A
second-language port is in progress; the
[porter's guide](https://github.com/xl3-lang/xl3/blob/main/PORTERS_GUIDE.md)
catalogs the gotchas (NFC/NFD, IEEE 754 2^53, etc.) we've already hit.

Status: alpha. 0.4.0 just shipped after a focused audit pass that
converted every "silent fallthrough" surface to either a coded error or a
normatively pinned behavior. Breaking changes possible until 1.0, but
the public API and error code catalog are pinned with snapshot tests so
you'll see them in CHANGELOG.

I'd love feedback on:

- The XTL surface — is there a common reporting pattern that doesn't
  cleanly express in 119 fixtures' worth of features?
- The spec → ref-impl boundary. Did anything in the porter's guide
  surprise you, or look like it would surprise a Python/Java port?
- Other deployment shapes I haven't thought about (CLI binary,
  workers-deploy, Office add-in, etc.)

Repo: https://github.com/xl3-lang/xl3
Browser demo: https://xl3.io
npm: https://www.npmjs.com/package/@jinyoung4478/xl3
