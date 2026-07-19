# ADR 0075 — `xl3-source-json`: a language-neutral JSON source input format

- **Status:** proposed
- **Date:** 2026-07-19
- **Spec target:** XTL 1.x (additive — a new wire format + new public API; **does not** change `convert()` or the `.xlsx` source path; no existing template changes behavior)
- **Affects:** new public API (`convertJson`, `previewJson`); new normative wire format `xl3-source-json/0.1`; impl (new `json-source.ts` reader → `SourceData`, `index.ts` entry points, `types.ts`, `error-codes.ts`); `spec/evaluation.md` (Source Data Model — a second, equivalent source-ingestion path); `spec/STABILITY.md` (public API surface addition); `PORTERS_GUIDE.md` (the wire format is portable/normative; the reader IR is not); one new error code
- **Issue:** #71

## Context

xl3's official contract is Excel-native end to end:

```text
template.xlsx + data.xlsx  ->  output.xlsx
```

The `.xlsx` **template** is the whole point — operator-authored rules live
in a workbook (README positioning). But the `.xlsx` **source** is only a
data-transport choice, and for non-Excel hosts it is an expensive one.
Python, Java, DB-backed services, queues, and ETL pipelines usually
already hold typed rows in memory. Today they must serialize those rows
into a temporary `data.xlsx` purely so xl3 can read them back — paying a
workbook round-trip and inheriting Excel-specific cell edge cases that
have nothing to do with the host's actual data model.

This also cuts against the standard positioning cemented in the README
and site: **xl3 is an open standard with a reference implementation, not
an Excel-only library.** The *spec* is language-neutral; the *source
input* is not. A neutral source wire format closes that gap — other-language
ports can accept the exact same JSON.

Crucially, the implementation already has the right seam. `.xlsx` source
reading (`readAllSources`, `reader.ts`) normalizes into

```ts
Record<string, SourceData>   // SourceData = { sheetName, headers, rows }
```

and **everything downstream** — column resolution, `@filter`/`@sort`/
`@join`, grouping, and rendering — runs from that model via
`prepareConversionFromSources(parsed, sources)` (`index.ts`). Nothing below
that seam knows or cares whether the sources came from a workbook. So a
JSON format that deserializes **directly into `SourceData`** reuses the
entire pipeline unchanged and, by construction, renders byte-identical
output to the equivalent `data.xlsx`.

## Considered Options

The capability is easy (deserialize into `SourceData`); the decisions are
the **API surface** and the **row shape**.

### API surface

**A. Overload `convert(template, source)`** to sniff JSON vs `.xlsx` from
the buffer (zip magic vs `{`). *Against:* `.xlsx` and JSON fail in
completely different ways, so a single entry point muddies error handling;
buffer-sniffing a `Uint8Array` is fragile; and `convert()`'s signature and
semantics are **frozen at 1.0** (STABILITY.md "Public API surface") —
absorbing a second input contract into it invites a 2.0 break later.
Rejected for v0.1.

**B. New explicit entry points `convertJson` / `previewJson` — ADOPTED.**
Additive, leaves the frozen `convert`/`preview` untouched, and gives JSON
input its own clear error surface. Mirrors the issue's recommendation.

**C. A pluggable "source adapter" interface** (hosts register a
`Source -> SourceData` provider). *Against:* over-engineered for v0.1 — the
wire format *is* the contract, and an adapter layer is a speculative
feature (ADR-0042 #5 bar). Can be added later without breaking B. Rejected.

### Row shape

**Column-oriented `headers` + array `rows` — ADOPTED**, over object-shaped
rows (`{ "Customer": "Acme", ... }`). Array rows preserve header order
(the `SourceData.headers` order is load-bearing — ADR-0012's column model
and duplicate-header guard), map 1:1 onto `SourceData`, cut payload size,
and avoid JSON objects' duplicate-key ambiguity. Object rows are a
non-goal (below).

## Decision

Adopt **B** plus a versioned wire format **`xl3-source-json/0.1`**.

### Wire format

```json
{
  "version": "xl3-source-json/0.1",
  "sources": {
    "default": {
      "headers": ["Customer", "Amount", "OrderDate"],
      "rows": [
        ["Acme", 18400, { "type": "date", "value": "2026-05-01" }],
        ["Beta", 7200,  { "type": "date", "value": "2026-05-02" }]
      ]
    }
  }
}
```

- `version` MUST be exactly `xl3-source-json/0.1` in v0.1. Any other value
  ⇒ error (forward compatibility is opt-in per version).
- `sources` is an object keyed by source name; `sources.default` is
  **required** (the implicit default source, ADR-0012/0065).
- Each source is `{ headers: string[], rows: Xl3SourceJsonValue[][] }`.

### Value model

Each cell deserializes to the **same internal `SourceData` row value** the
`.xlsx` reader produces (`parseCellValue`, ADR-0017), so downstream
rendering is identical:

| JSON value | internal row value | equivalent `.xlsx` cell |
|---|---|---|
| `null` | `""` (empty string) | blank cell (ADR-0062) |
| string | string | text cell |
| number (finite) | number | number cell |
| boolean | boolean | boolean cell |
| `{ "type": "date", "value": … }` | JS `Date` (UTC) | date cell (ADR-0017) |
| `{ "type": "error", "value": … }` | `""` (empty string) | error cell → empty (ADR-0017) |

```ts
type Xl3SourceJsonValue =
  | null
  | string
  | number
  | boolean
  | { type: "date"; value: string }    // "YYYY-MM-DD" | "YYYY-MM-DDTHH:mm:ss"
  | { type: "error"; value: string };  // "#N/A" | "#VALUE!" | "#DIV/0!" | "#REF!" | "#NAME?" | "#NUM!" | "#NULL!"
```

Rules:

- **`null` ⇒ empty**, which internally is `""` (ADR-0062), matching a blank
  `.xlsx` cell — not JSON `undefined` (absent) and not the string `"null"`.
- **Dates use UTC** (ADR-0017 UTC-normative): `"YYYY-MM-DD"` ⇒ UTC
  midnight; `"YYYY-MM-DDTHH:mm:ss"` ⇒ that UTC instant. No timezone
  suffixes or offsets in v0.1 (non-goal).
- **`error` ⇒ empty**, matching Excel source error-cell semantics
  (ADR-0017): a source error is data-absent, not a hard failure.
- **Numbers** must be finite IEEE-754 doubles. `NaN`/`Infinity` (which JSON
  cannot represent anyway) and out-of-range values ⇒ error. Large
  identifiers that must survive round-trip exactly SHOULD be sent as
  strings.
- **Rows are arrays**; every row's length MUST equal `headers.length`.
- **All-empty rows are skipped**, matching `.xlsx` source behavior
  (`reader.ts` `allEmpty`).
- **Unknown tagged objects** (a `{ "type": … }` that is neither `date` nor
  `error`) ⇒ error — reserved for future value types, not silently
  coerced.

### Source-declaration semantics (honoring ADR-0012)

JSON sources still obey the template's **declared-source** model:

- `sources.default` is required.
- Every source declared in the template's `__sources__` MUST be present in
  `sources`.
- **Extra sources** (present in JSON, neither `default` nor declared) are
  **rejected** in v0.1. Otherwise an undeclared source could leak into
  `SUM(Extra[Amount])` and weaken ADR-0012's declared-source guarantee.
- JSON mode **ignores** `__config__.source_sheet` / `source_table` for data
  selection (the JSON already carries `headers` + `rows`); a template MAY
  keep those keys for `.xlsx` compatibility.

### API

```ts
type Xl3SourceJsonInput = string | ArrayBuffer | Uint8Array | object;

function convertJson(
  templateBuffer: ArrayBuffer,
  sourceJson: Xl3SourceJsonInput,
  options?: ConvertOptions,
): Promise<OutputFile[]>;

function previewJson(
  templateBuffer: ArrayBuffer,
  sourceJson: Xl3SourceJsonInput,
  options?: ConvertOptions,
): Promise<PreviewResult>;
```

- `sourceJson` accepts a JSON **string**, raw **bytes** (`ArrayBuffer` /
  `Uint8Array`, UTF-8 decoded), or an **already-parsed object**.
- Implementation: `parseTemplate` → **`readJsonSources`** (the new seam,
  replacing `readAllSources`) → `prepareConversionFromSources` → the
  **existing** `renderPreparedConversion` / `buildPreviewFromPrepared`. The
  JSON path diverges from `.xlsx` at exactly one function.
- `options.inputs` works unchanged (`resolveInputs`).
- `options.engine`: the JSON path is **JS-only** in v0.1 (the wasm bridge
  consumes `.xlsx` source buffers). `engine: 'wasm'` ⇒ a clear
  "not supported for JSON source in v0.1" error; `'auto'`/`'js'`/unset run
  the JS pipeline.
- `previewJson` returns the standard `PreviewResult`. For JSON sources the
  `.xlsx`-only `PreviewSource` fields carry sentinels: `sheet` = the source
  name, `table` = `"(json-source)"`; `rowCount`/`headers` are real.

### Errors

- **New code `xl3/source-json/invalid`** — the umbrella for every
  wire-format / schema failure: unparseable JSON, missing/unknown
  `version`, missing `default`, non-object `sources`, non-array `rows`,
  row-length ≠ header count, non-finite number, malformed date tag, unknown
  tagged object, empty/duplicate/reserved header, or an extra undeclared
  source. Messages name the offending source/row/column. (One umbrella
  code for v0.1 mirrors how the `.xlsx` reader groups `xl3/source/*`; it
  can be split into sub-codes in a later version without a break.)
- **Reserved headers** reuse the existing reserved set (`reader.ts`):
  `Rows`, `__rownum`, `__activeSource__`, `__joinedRow__`, and anything
  matching `/^__[a-z]+__$/`.
- **Downstream** semantic errors (missing column referenced by a cell,
  `@join` key problems, filename collisions — ADR-0031) surface through the
  **existing** `xl3/*` codes, because they occur in the shared pipeline
  after the JSON has become `SourceData`.

Adding an error code is a **catalog addition**, not a removal — it does not
reset the G24 1.0 clock (contrast ADR-0072, where *removing* a code is the
breaking change).

## Scope

- **In scope (v0.1):** `convertJson` / `previewJson`; the
  `xl3-source-json/0.1` wire format (column-oriented, tagged date/error
  values); strict declared-source matching; the value model above; the
  `xl3/source-json/invalid` error code.
- **Out of scope / non-goals (v0.1):** YAML/XML source formats;
  streaming / NDJSON; object-shaped rows; `Decimal`/`BigDecimal` typed
  values; arbitrary-timezone date parsing; overloading `convert()` to sniff
  input; a pluggable source-adapter interface; making JSON source part of
  the Stage 2 OOXML canonical comparison.

## Consequences

- Non-Excel hosts feed typed rows directly — no temporary `data.xlsx`, no
  Excel cell edge cases in the source path.
- **Reinforces the standard**: `xl3-source-json/0.1` is a portable,
  normative wire format that any conforming implementation can accept. Per
  PORTERS_GUIDE, the *format* is normative; the TS reader's internal IR
  (`SourceData`) is not.
- **Output-identical by construction**: because `readJsonSources` yields
  the same `SourceData` as the `.xlsx` reader, `convertJson(t, json)`
  renders the same workbook as `convert(t, equivalentXlsx)` — this is the
  primary acceptance test.
- Additive only: `convert()` / `preview()` / the `.xlsx` path are
  untouched and stay 1.0-frozen; the new entry points are new surface; the
  new error code is a catalog addition.
- **Conformance**: the fixture corpus is `template.xlsx` + `data.xlsx`
  driven, so JSON source cannot ride the existing runner directly. Coverage
  lands as **focused tests** that assert `convertJson(t, json)` equals
  `convert(t, data.xlsx)` for representative shapes (multi-source `@source`,
  `SUM(Source[Col])`, `XLOOKUP`, `@join`, and the full value model), plus
  negative tests for each `xl3/source-json/invalid` trigger. ADR-0075 is
  listed in `INFORMATIONAL_ADRS` (`spec-coverage.test.ts`) only until those
  tests land with the implementation.

## Open questions (for review before implementation)

1. **Error granularity** — one umbrella `xl3/source-json/invalid` (proposed)
   vs. distinct sub-codes (`.../version`, `.../shape`, `.../value`). Umbrella
   keeps the catalog small for v0.1 and can be refined later.
2. **`engine: 'wasm'` + JSON** — throw an explicit "unsupported" error
   (proposed) vs. silently run the JS path.
3. **`previewJson` sentinels** — `sheet` = source name, `table` =
   `"(json-source)"` (proposed) vs. making those fields optional on
   `PreviewSource` (a type change).
4. **Accepting a pre-parsed `object`** in addition to string/bytes
   (proposed: accept all four) — convenient for JS hosts, but the object
   then bypasses the "is it valid JSON" check (still fully schema-validated).
5. **Reserved-header errors** — reuse `xl3/source/reserved-column-name`
   (shared with `.xlsx`) vs. fold under `xl3/source-json/invalid` (proposed,
   for a single JSON error namespace).

## References

- ADR-0012 — Multi-source data model (the declared-source model this
  honors; `Source[Column]`)
- ADR-0017 — Source value model (UTC dates; error cell → empty; the value
  mapping this mirrors)
- ADR-0062 — Empty-string semantics (`null` / blank ⇒ `""`)
- ADR-0031 — Output filename collision (still enforced downstream)
- ADR-0065 — `@source` default explicit form (the `default` source)
- ADR-0050 — Template inputs as XTL expressions (`options.inputs` path,
  unchanged)
- `spec/STABILITY.md` — Public API surface (why `convert()` stays frozen and
  this is additive)
- `PORTERS_GUIDE.md` — normative wire format vs. non-normative reader IR
- README — the open-standard positioning this closes the input-side gap for
