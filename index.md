---
layout: home

hero:
  name: xl3
  text: Excel conversion, inside Excel.
  tagline: Keep recurring Excel transformation rules inside workbook templates. No macros, no vendor cloud, no host code rewriting Excel files row-by-row.
  actions:
    - theme: brand
      text: Read the cookbook
      link: /docs/cookbook/
    - theme: alt
      text: Read the spec
      link: /spec/
    - theme: alt
      text: GitHub
      link: https://github.com/jinyoung4478/xl3

features:
  - title: Rules travel with the workbook
    details: '`__config__`, expressions, and layout are archived in `template.xlsx`. Operators read and edit; developers do not become a bottleneck.'
  - title: Language-neutral spec
    details: 32 ADRs, 119 conformance fixtures, all green at Stage 2. The TypeScript implementation is the reference impl, not the spec.
  - title: Audit-pass complete
    details: Every silent-fallthrough surface either errors with a stable `xl3/<category>/<id>` code or is normatively pinned. CHANGELOG tracks each ADR's scope.
  - title: Designed to be ported
    details: PORTERS_GUIDE catalogs the gotchas — NFC/NFD, IEEE 754, timezone handling. The conformance corpus is the executable contract.
---

## Quick install

```bash
npm install @jinyoung4478/xl3
```

```ts
import { convert } from '@jinyoung4478/xl3';

const outputs = await convert(templateBuffer, dataBuffer, {
  inputs: { month: '2026-05' },
});
```

Runs in browsers and Node ≥ 20.12.

## Where to start

- **New here?** [Cookbook 01 — Getting started in 5 minutes](/docs/cookbook/01-getting-started).
- **Want to read the language?** [`spec/language.md`](/spec/language).
- **Porting to another language?** [`PORTERS_GUIDE.md`](/PORTERS_GUIDE).
- **Curious about conformance?** [Dashboard](/conformance/DASHBOARD), [coverage matrix](/conformance/coverage).
