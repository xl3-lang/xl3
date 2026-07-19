# @xl3-lang/xl3

The JavaScript/TypeScript **reference implementation** of [xl3](https://xl3.io) —
an open standard for declarative Excel transformation.

xl3 lets you use an Excel workbook as a *template*: you write rules in
cells with a small embedded expression language (**XTL**), and the engine
renders formatted `.xlsx` output from your Excel data. The rules live in
the spreadsheet, authored by the person who owns the report format; the
engine is owned by developers.

- **Standard & spec:** https://xl3.io — the language is spec-first and
  language-neutral. This package is one conforming implementation.
- **Repository:** https://github.com/xl3-lang/xl3 (this package lives in
  [`impl/js/`](https://github.com/xl3-lang/xl3/tree/main/impl/js))
- **Spec:** [`spec/`](https://github.com/xl3-lang/xl3/tree/main/spec)
- **Conformance corpus:** [`conformance/`](https://github.com/xl3-lang/xl3/tree/main/conformance)

## Install

```bash
npm install @xl3-lang/xl3
```

Requires Node.js >= 20.12. Also runs in the browser via the prebuilt
IIFE bundle (`@xl3-lang/xl3/bundle`, exposes `window.xl3`).

## Usage

```ts
import { convert } from '@xl3-lang/xl3';
import { readFileSync } from 'node:fs';

const toArrayBuffer = (b: Buffer): ArrayBuffer =>
  b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;

const template = toArrayBuffer(readFileSync('template.xlsx'));
const data = toArrayBuffer(readFileSync('data.xlsx'));

// Returns Array<{ filename: string; data: Uint8Array }> — one entry per
// output workbook (a template can fan out to multiple files by group key).
const outputs = await convert(template, data);

for (const { filename, data } of outputs) {
  writeFileSync(filename, data);
}
```

## Conformance

This implementation is validated against the standard's language-neutral
conformance corpus. From the repository root:

```bash
npm run conformance          # Stage 1
npm run conformance:stage2   # Stage 1 + OOXML canonicalization
```

## License

[MIT](./LICENSE) © xl3 contributors
