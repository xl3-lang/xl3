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

### Function table is bounded (ADR-0043)

The XTL function set is *intentionally smaller* than Excel's catalog,
gated by the Excel-native preference principle (ADR-0043): a function
is in XTL only when its evaluation must happen *before* the workbook
is written. Anything Excel can compute at workbook-open time stays in
output-cell formulas, which xl3 preserves verbatim (ADR-0046).

For your port this means: implement only the functions in
[`spec/language.md`](./spec/language.md) "Functions" — don't add
locally-popular Excel functions like `SQRT`, `ISNUMBER`, `SUMIF`,
`NETWORKDAYS`, etc. as XTL functions, even if they are easy. Those
are intentionally Excel-formula territory (see ADR-0045). Adding them
would diverge your port from xl3 and produce templates that don't
round-trip between implementations.

If you have a real render-time use case that XTL doesn't currently
support, open an issue using the **Function re-proposal** template
so the maintainer can ADR-track the gap.

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

Reserved sheets MUST NOT appear in output workbooks. Even though
`__inputs__`, `__sources__`, `__lists__`, and `__config__` exist
in the input template and are read during evaluation, the rendered
output workbook MUST omit them. This is required by
[`spec/evaluation.md`](./spec/evaluation.md) ("List Sheets") and
pinned by fixture 040. How you achieve this is incidental — strip
them at the end (see "removeAuxiliarySheets timing" under "What
you MUST NOT copy") or never carry them forward in the first
place. The contract is the absence in output, not the mechanism.

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

### Language-specific gotchas (informational)

These are real differences porters have hit. Documented from xl3-py
issue #1 — share the lessons rather than make every port rediscover.

**Number-to-string formatting.** The canonical string form follows
ECMA-262 §6.1.6.1.13 exactly. **Do NOT trust your host language's
default float formatter** — Python's `repr(1e-7)` is `"1e-07"` (two-
digit exponent) where ECMA says `"1e-7"`; Python's `repr(-0.0)` is
`"-0.0"` where ECMA says `"0"`. Re-implement the algorithm directly
or pin the exact ECMA behavior with fixtures (012, 016, 064, 096).

**Date timezone handling.** ADR-0017 mandates UTC. ExcelJS exposes
Excel's timezone-naive serial dates as `Date` objects anchored at
UTC midnight; the TS impl uses `getUTCFullYear` etc. **openpyxl
returns `datetime.datetime` with `tzinfo=None`** — calling
`.year`/`.month`/`.date()` is correct only if the value never gets
localized first. Easy to introduce a subtle drift. The Stage 1 TZ
matrix (`TZ=UTC` / `TZ=America/New_York` / `TZ=Asia/Seoul`) catches
this.

**Whitespace and zero-width.** ADR-0007 says zero-width characters
(U+200B, U+FEFF) are NOT whitespace. The native `str.strip()` /
`String.prototype.trim()` in many languages strips U+FEFF — your
isEmpty MUST pre-replace zero-width chars with a non-whitespace
sentinel before trimming, or use a hand-rolled whitespace test.
Fixture 095 pins this behavior.

**Unicode normalization (NFC/NFD).** ADR-0030 says string
comparison uses **raw code points** with NO normalization applied.
NFC `한` (1 code point, U+D55C) and NFD `한` (3 code points,
U+1112 U+1161 U+11AB) render identically but compare as different
strings. macOS filesystems and clipboards often produce NFD; web
input and Windows produce NFC. Do NOT add a normalization step in
your port's compareValues — the spec deliberately matches Excel
behavior (no normalization). Fixture 118 pins NFC ≠ NFD.

**Integer precision beyond 2^53.** ADR-0032 #4 pins the value
model as IEEE 754 doubles. Source cell `9007199254740993` (2^53+1)
reads as `9007199254740992` because no double can represent it.
Languages with native bigint (Python, Ruby, Java BigInteger,
JS BigInt) MUST NOT widen automatically — that diverges from the
TS reference. If a host needs exact integers beyond 2^53 (financial
IDs, very large counts), they store the value as a string in the
source and call `TEXT()` for formatting. xl3 does NOT detect or
warn about precision loss.

**IF condition normalizer: `=` AND `==`.** XTL accepts both `=`
(Excel) and `==` (C-family) as equality operators in `IF`
conditions. Early port code that normalizes only one of them
silently treats the other as assignment / fails. Fixture 058 has
`=`; a normalizer that strips `==` to `=` but not vice-versa, or
vice-versa, will produce wrong output for hand-written templates.
Both forms reach the same comparison algorithm.

**Function name case-insensitivity.** ADR-0029 §"Function name
case-insensitivity (normative)" makes function name matching
case-insensitive: `if`, `If`,
`IF`, `iF` are all the same function. Excel itself is
case-insensitive on function names. Authors who write `if(...)`
or `sum(...)` in their templates must get the same behavior as
the canonical uppercase form. Hash function names lower-case before
dispatch. Fixture 116 pins this.

**Hidden source rows are still iterated.** ADR-0029 normatively
includes hidden rows in `source_sheet` iteration. xl3 reads OOXML
rows regardless of Excel's row-hidden flag, because reading
visibility-aware would silently drop data the author may not even
know is hidden. Authors who want visibility-aware behavior use
`@filter` explicitly. If your port's Excel reader auto-filters
hidden rows, override it. Fixture 117 pins this.

**Headers in merged cells now read as one logical column** (per
ADR-0033, which superseded ADR-0032 §#2 on 2026-05-17). A
horizontally-merged header cell forms one source column at the
merge master's column index; slave cells in the same row are
transparent (they contribute no column and do not trigger
`xl3/source/duplicate-name`). Vertical-direction merges in the
header row read the master's text at the slave's column unchanged
— this is how multi-row header bands work. A 2D merge (band) is
handled by the same rules without new clauses; the recommended
authoring pattern is to pick the band's *last* row as the header
row so data starts immediately below the band. See ADR-0033's
"Amendment (2026-05-17)" section for the porter-library
independence rule (column-skip is identified from merge-region
metadata, not from cell-value presence — ExcelJS, openpyxl, and
other libraries differ on what they put in slave cells, but all
ports MUST produce the same column list). Fixtures 121
(simple horizontal merge) and 124 (2D merge band) pin this.

**Output filename collision is an error.** ADR-0031 requires
detecting two distinct file group keys that sanitize (per ADR-0002)
to the same filename. Example: `Seoul/Korea` and `Seoul:Korea` both
sanitize to `Seoul_Korea.xlsx`. Detect this **before rendering any
file** — the TS impl precomputes filenames for all file groups
into a `Set` and raises `xl3/filename/collision` on the first
duplicate. A port that just appends to a `dict` and lets the second
overwrite the first will silently produce wrong output. Fixture
119 pins this.

**Reserved source column names.** ADR-0027 rejects source columns
named `Rows`, `__rownum`, `__activeSource__`, `__joinedRow__`, or
matching `^__[a-z]+__$` at parse with
`xl3/source/reserved-column-name`. These collide with the renderer's
internal context keys. A port that uses different internal key
names might think it can accept these column names — DON'T. The
constraint is part of the spec, not an internal detail. Authors
rename the column upstream.

**Empty-value placeholder is `(blank)`, not error or empty.**
ADR-0026 specifies that an empty group-key value (file- or
sheet-level) substitutes the literal token `(blank)` per Excel
pivot table convention. Earlier impl behavior diverged: file-level
halted with an error, sheet-level fell back to the literal `Sheet`.
Authors with sloppy data want `(blank).xlsx` and a `(blank)` sheet,
not a halted conversion. Fixtures 107, 108 pin this.

**Unary operators on non-literal expressions are an error, not a
no-op.** ADR-0028 specifies that `+5`, `--5`, `-[col]`, `-(expr)`
raise `xl3/eval/unsupported-syntax`. Number literals with a leading
`-` (`-5`, `-3.14`) remain valid — that is a signed literal, not a
unary operator. Workaround for column negation: `(0 - [col])` or
`[col] * -1`. The previous silent fallthrough rendered the literal
expression text (e.g., `"-{{ [col] }}"`), which looked like working
output to authors. Fixture 113 pins this.

**Workbook + sheet properties pass-through.** ADR-0032 #3 requires
preserving `tabColor`, `defaultRowHeight`, `defaultColWidth`,
`pageSetup`, `views`, themes, defined names, and print areas from
template to output. If your port builds output workbooks fresh
instead of cloning the template, copy these properties explicitly.
The TS impl uses `cloneWorksheet` to clone the worksheet wholesale,
then overwrites cell values. Fixture 120 pins `tabColor`
preservation as the most user-visible example.

**String length > 32,767 chars.** ADR-0032 #1 says strings longer
than Excel's per-cell limit are written to OOXML as-is.
Implementation-defined; xl3 does NOT pre-validate. The resulting
workbook may fail to open in Excel. Hosts that need Excel
compatibility validate upstream. Do NOT add silent truncation in
your port — pass the value through unchanged.

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
7. **Audit-pass fixtures (094-120)** — these were added after the
   initial corpus and cover edge cases the original 001-093 set
   didn't pin. Group by theme:
   - **Reserved + error cases**: 094 (reserved sheet error), 099
     (empty template block), 109 (reserved source column),
     110-111 (empty `@filter` / `@source`), 114 (duplicate
     `@source`), 115 (self-join), 119 (filename collision).
   - **Arithmetic + arity**: 100 (string-to-number coerce), 101
     (non-numeric string error), 102-103 (function arity), 104
     (multiple `@filter` = AND), 105 (template-block whitespace),
     106 (division-by-zero error cell).
   - **Empty / placeholder**: 107-108 (`(blank)` group-key file
     and sheet placeholders).
   - **Literals + unary**: 112 (signed literal), 113 (unary on
     non-literal is an error).
   - **Unicode + visibility**: 095 (zero-width ≠ whitespace), 116
     (function name case-insensitive), 117 (hidden rows
     included), 118 (NFC ≠ NFD).
   - **Workbook properties**: 120 (`tabColor` + sheet/workbook
     property pass-through).
8. **Stage 2** (024, 025, 026, 027, 093, 120) — only if your
   language has a solid OOXML canonicalizer story. Skip if Stage 1
   isn't 90%+ yet.

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
