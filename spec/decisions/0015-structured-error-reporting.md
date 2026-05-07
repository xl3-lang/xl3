# ADR 0015 - Structured error reporting + i18n direction

- **Status:** accepted
- **Date:** 2026-05-07
- **Spec target:** XTL 0.1 draft
- **Affects:** evaluation.md (errors list), runner-protocol.md

## Context

Every spec-defined error today is identified by a stable English
substring carried in `Error.message`. The conformance corpus relies on
that substring (`expected_error: "Source \"X\" is not declared in
__sources__"`). Hosts that want to localize the error or programmatically
distinguish error categories must scrape the message text.

Two follow-up needs surface this:

1. **Localization.** A Korean operator running a converter sees
   English error text. Hosts (browser converter, internal portals)
   want to translate, but only by *meaning* — they need a stable
   identifier they can map to a translation table.
2. **Programmatic dispatch.** A SaaS that wraps xl3 may want to
   classify failures: parse error vs runtime error, retry-able vs
   not, user-facing vs internal. Today every error is a flat
   `Error.message`.

Both needs map onto a single design: assign each spec-defined error a
stable code (`xl3/<category>/<short-id>`), keep the English message
verbatim for the conformance corpus, and expose the code on the thrown
`Error` so hosts can read it programmatically.

## Considered Options

**A. Status quo — substring matching.** Cost: localization is
fragile; programmatic dispatch is regex-based. Doesn't scale as the
error catalog grows.

**B. Replace messages with codes.** Codes-only, no English text. Cost:
breaks the conformance corpus; readability drops; the operator
running raw xl3 sees `xl3/source/undeclared` instead of "Source
\"X\" is not declared in __sources__".

**C. Codes alongside messages (chosen).** Each thrown `Error` carries
a `.code` property; the message stays English and stays the
conformance contract. Hosts wanting i18n key off `.code`.

**D. Custom error class with structured fields.** Beyond `code` —
`category`, `severity`, `cause`. Cost: spec surface grows; most hosts
just need `code`. A future ADR can extend.

## Decision

Adopt option C. Every spec-defined error throw site SHOULD attach a
stable code to the thrown `Error`:

```ts
const err = new Error(`Source "${name}" is not declared in __sources__`);
(err as any).code = 'xl3/source/undeclared';
throw err;
```

(The reference impl exposes a small helper `xtlError(code, message)`.)

### Code namespace

Codes follow `xl3/<category>/<id>`:

| Category | Examples |
|---|---|
| `xl3/config` | invalid `source_table`, removed config key |
| `xl3/inputs` | missing required input, type mismatch, select option |
| `xl3/source` | undeclared source, source sheet missing |
| `xl3/join` | undeclared join source, bad on-clause |
| `xl3/lists` | missing list, duplicate entry |
| `xl3/cell` | numFmt coercion failure, ROW outside repeat |
| `xl3/xlookup` | no match, source mismatch, bad arg shape |
| `xl3/filename` | empty after sanitization, length overflow |

The catalog is opened by this ADR and grows as new spec rules add
errors. The reference impl maintains the canonical list in
`src/error-codes.ts` and exports it for hosts.

### Conformance corpus

- `expected_error` continues to match the English substring.
- A new optional `expected_error_code` field in `meta.yaml` matches
  the `.code` property exactly when present. Both fields MUST agree
  when both are declared.

### Host i18n

Hosts MAY map `error.code` to localized text. Hosts MUST NOT depend
on the English message for programmatic logic — `code` is the stable
contract. The English message remains the readable fallback for
unsuited contexts.

## Consequences

- The reference impl gains a small helper and starts attaching codes
  at every throw site under spec coverage. Existing thrown errors
  without codes still work for hosts; uncoded errors are
  implementation-internal (e.g. unexpected ExcelJS shapes).
- The conformance protocol gains an opt-in `expected_error_code`
  field. Existing fixtures keep working unchanged.
- Hosts (browser, CLI, SaaS) get a stable contract for
  localization + classification. The xl3.io browser site can ship a
  Korean error map without touching the engine.
- This ADR does not localize messages. Localization is host-side; the
  spec stays English-canonical.
- Future ADR can extend `Error` with `category`, `severity`, or
  `cause` if real demand emerges.

## References

- ADR-0010: missing-input error already has a clear shape; first
  candidate to receive a code.
- ADR-0012/0013/0014: every new spec-defined error gets a code.
- runner-protocol.md: gains `expected_error_code` field.
