# Porter's Guide

This guide is for engineers writing a second-language implementation of XTL.
It distinguishes **what is normatively part of XTL** (and your port must
match) from **what is incidental to the TypeScript reference implementation**
(and your port should not copy).

If you have not already read [`spec/STABILITY.md`](./spec/STABILITY.md) and
[`conformance/runner-protocol.md`](./conformance/runner-protocol.md), start
there. This document complements them; it does not replace them.

## Where the contract lives

In strict precedence order:

1. **The conformance corpus** ([`conformance/fixtures/`](./conformance/fixtures/))
   is the executable contract. If your impl produces the same output for
   every fixture under Stage 1, you are conformant for everything those
   fixtures cover. Spec prose is non-binding when it disagrees with a
   passing fixture.
2. **The spec prose** ([`spec/language.md`](./spec/language.md),
   [`spec/evaluation.md`](./spec/evaluation.md)) defines the language.
   Where prose is silent or ambiguous, the corpus disambiguates.
3. **The ADRs** ([`spec/decisions/`](./spec/decisions/)) record why the
   prose is what it is. Read them when you hit a "but why is it like
   this?" — the rationale is usually there.

The TypeScript reference impl is a fourth-place tiebreaker, NOT a
specification. Mimicking its internals will make you copy bugs and
miss simplifications.

## What you MUST match

These are non-negotiable for any port that wants to claim XTL conformance.

### Error codes (ADR-0015)

Stable `error.code` strings of the form `xl3/<category>/<id>`. Hosts
dispatch on these codes for localization and programmatic handling.
The full catalog is in [`src/error-codes.ts`](./src/error-codes.ts);
the snapshot test in
[`src/__tests__/error-codes.test.ts`](./src/__tests__/error-codes.test.ts)
pins it.

Your port emits the **same code** at the **same logical site**. The
English `Error.message` is also part of the conformance contract —
fixtures use `expected_error` substring matching against it. Localize
in a layer above the engine, not by changing the engine's English text.

#### Message style guide

Stick to a consistent voice so substring matching across ports stays
predictable. The reference impl follows these rules:

- **Capitalize the first word** of the message.
- **Subject + verb** form. Subject is the offending entity:
  `Source "X"`, `Column "X"`, `Input "X"`, `Cell A5`, `Output filename "..."`,
  `XLOOKUP`, `@join key columns`, etc.
- **Quote identifiers** with `"..."` so they survive substring matches:
  `Source "Renewals"` not `Source Renewals`.
- **Reference reserved sheets by name** (`__sources__`, `__inputs__`)
  with no quotes — they are syntactic, not user-supplied.
- **Detail follows a `:`** for parse failures:
  `Input "month" cannot be parsed as a date: empty value`.
- **No "you must"**. Use `"X must be a Y"`, not `"you must provide a Y"`.
- **No log-style prefixes** like `XLOOKUP: ...` or `[error] ...`.
- **No trailing period** unless the message is a full sentence with
  multiple clauses; one-clause messages omit it for terseness.

When you discover a message in the reference impl that violates these
rules, that is a defect — file an issue against xl3 with the proposed
rewording.

### Date semantics (ADR-0017)

- Date components MUST be read in **UTC**. `getUTCFullYear` /
  `getUTCMonth` / `getUTCDate` (or your language's equivalent), never
  the host-local variants.
- `YYYY-MM-DD` for midnight, `YYYY-MM-DDTHH:mm:ss` otherwise.
- `TODAY()` returns "today in UTC". Hosts that need locale-specific
  dates compute them outside the engine and pass via `__inputs__`.
- String-to-Date coercion (numFmt path) builds at UTC midnight.

CI runs the conformance suite under three timezones (UTC,
America/New_York, Asia/Seoul). Your port should do the same.

### Comparison + truthiness (ADR-0007/0008/0009)

- Empty: missing/null/undefined OR a string of only Unicode whitespace.
  Numbers (including 0), Booleans (including false), and Dates are
  never empty.
- Truthy: not empty AND not Boolean false AND not numeric 0. The
  strings `"0"` and `"false"` are truthy.
- Comparison falls through: number-or-numeric-string → IEEE 754;
  Boolean → false < true; Date → underlying timestamp; otherwise
  canonical string form, Unicode code-point order. **No locale
  collation.**
- Numeric comparison uses IEEE 754 equality (`0.1 + 0.2 != 0.3`).
  Tolerance requires explicit `ROUND()`.

### Reserved sheet names (ADR-0011)

Author-created sheets matching `^__[a-z]+__$` are rejected at parse
time with `xl3/sheet/reserved-name`. The four reserved sheets:

- `__config__` — configuration + author-defined value dictionary
- `__inputs__` — runtime input declarations
- `__sources__` — additional named data sources
- `__lists__` — membership lists for `@filter ... in __lists__[name]`

Your port enforces this even if it never uses some of them — the
constraint protects future evolution.

### Aggregate semantics (ADR-0012)

`SUM(Source[Column])`, `AVERAGE(...)`, `MIN(...)`, `MAX(...)`,
`COUNT(...)` over a `Source[Column]` reference operate on the
**source's full row set**, NOT the filtered/joined block. Bare
`SUM([Column])` operates on the active block's filtered rows.

### Sort + ordering (ADR-0016)

- `@sort` is **stable**. Equal keys preserve source order.
- Multiple `@sort` directives: first is primary key, later are
  tiebreakers (Excel/SQL convention).
- File groups and sheet groups emit in **first-seen** order.

### Single-implementation impl details that ARE normative

These look like JS-flavored choices but are spec:

- "Shortest round-trippable number" representation (matches IEEE 754
  to-string algorithms across languages, but verify with fixtures
  012, 016, 064).
- ECMAScript-equivalent Unicode whitespace for trim (verify with
  fixture 050; in Python use `re.match(r'\s*$', s)` semantics).

## What you MUST NOT copy from the TS impl

These are incidental to the reference implementation. Copying them
makes your port worse, not more conformant.

### Async-everywhere

The TS impl uses `Promise<...>` because ExcelJS is async. If your
language's Excel library is sync (openpyxl, Apache POI, ClosedXML),
your `convert()` should be sync. Document the choice; do not invent
fake async to mimic.

### WeakMap-cached XLOOKUP index

`functions.ts:getOrBuildLookupIndex` uses a WeakMap because JS
needs it to release memory after the source array is GC'd. If your
language has different lifetime semantics, use whatever idiom is
right (Python: regular `dict` keyed by `id(rows)`; Rust: `HashMap`
inside the impl struct; etc.). The contract is "first XLOOKUP over
a `(rows, column)` is O(N), subsequent are O(1)" — not "use a
WeakMap."

### "removeAuxiliarySheets" timing

The TS impl strips reserved sheets from the output workbook at the
end of rendering. The contract is "reserved sheets do not appear in
the output." If your renderer never adds them in the first place,
that is equally valid; you do not need a separate strip pass.

### ExcelJS-specific workarounds

- Stage 2 canonicalization rules 5 (page-setup defaults) exist
  because ExcelJS adds attributes that Excel did not. If your
  language's library does not add them, you do not need to strip
  them — but you DO need to canonicalize anything your library adds
  that is not in the input.
- The `removeAuxiliarySheets` regex `^__[a-z]+__$` exists because
  the TS impl forwards input sheets to output. A renderer that
  builds output sheets fresh does not need this match — but it
  does need to never emit a reserved-named sheet.

### TypeScript-only ergonomics

- `XtlErrorCode` as a discriminated union: nice in TS, irrelevant
  in dynamically-typed languages. The string codes are what matter.
- `interface SheetTemplate` shape: an internal data model. Your
  internal model can look completely different.

## Recommended development order

Implementing all of XTL 0.1 in one pass is overwhelming. The corpus
gives you a natural curriculum:

1. **Build a runner first**, not a parser. Read
   `conformance/runner-protocol.md` and write something that loads
   `template.xlsx` + `data.xlsx`, calls a stub `convert()`, and
   compares to `expected.xlsx` or `expected_error`. Make it fail
   loudly. Now you have a target.
2. **Fixtures 001-010** — substitution, IF, list filter, ROUND,
   filename sanitization, numFmt. Forces you to build reader →
   parser → normalizer → renderer skeleton.
3. **Fixtures 050-064** — empty, truthy, comparison, canonical
   string form. The value model is here.
4. **Fixtures 065-068** — runtime inputs (ADR-0010).
5. **Fixtures 069-091** — multi-source, XLOOKUP, `@join`, error
   surfaces.
6. **Fixtures 092 (composition) and 087-090 (date model)** — last,
   because they exercise multiple layers.
7. **Stage 2** (024-027, 092-093) — only if your language has a
   solid OOXML canonicalizer story. Skip if Stage 1 isn't 90%+ yet.

**Resist the urge to architect for fixtures you have not read.**
The corpus is finite; each fixture you add support for tells you
exactly what abstraction the next one needs.

## Reporting findings back

When you discover a place where the spec is genuinely ambiguous (not
"I don't understand it" — actually under-specified), file an issue
against [xl3](https://github.com/jinyoung4478/xl3/issues) with:

- The fixture number / spec section.
- Your port's interpretation.
- The TS port's interpretation (if they diverge).
- An alternative reasonable interpretation that produces a different
  output.
- A proposed ADR amendment if you have one.

Batch findings — open one issue with five ambiguities rather than
five issues with one each. The spec evolves through these reports;
each one is value, not a complaint.

## API surface (recommended shape)

Mirror the TS public API for porting ergonomics:

```
convert(template, source, options?) -> list[OutputFile]
preview(template, source, options?) -> PreviewResult
read_template_inputs(template) -> list[InputSpec]
xtl_error(code, message) -> XtlError
is_xtl_error(value) -> bool
```

Where `OutputFile`, `PreviewResult`, `InputSpec`, `XtlError` are
your language's natural shape — interface in TS, NamedTuple /
dataclass in Python, struct in Rust, record in Java/Kotlin. The
field names should match TS where the field has a spec meaning
(`filename`, `data`, `inputs`, `code`, `message`).

## What "claiming conformance" means

A port that passes:
- 80%+ Stage 1 fixtures → "partial" in IMPLEMENTATIONS.md.
- 100% Stage 1 → "full" for Stage 1.
- 100% Stage 1 + 100% Stage 2 → "full" outright.

In all cases, run conformance under at least UTC and one
non-UTC timezone before claiming. The reference repo's CI runs the
3-TZ matrix.

A port that does not run the conformance corpus should not list
itself in IMPLEMENTATIONS.md, even if it "looks like XTL."
