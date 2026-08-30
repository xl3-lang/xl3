# ADR 0078 - Source compatibility validation API

- **Status:** accepted (implemented in xl3-js unit tests)
- **Date:** 2026-08-30
- **Spec target:** XTL 1.x (additive - new read-only public API; does not change `convert()`, `preview()`, `convertJson()`, or `previewJson()` behavior)
- **Affects:** new public API (`validateSource`, `validateSourceJson`); `spec/evaluation.md` (Source compatibility validation); `spec/STABILITY.md` (public API surface addition); impl (`validator.ts`, `reader.ts`, `types.ts`, `index.ts`); focused unit tests
- **Issue:** #109

## Context

Hosts need to answer "can this source be used with this template?" before
running a conversion. Today the only portable way to learn that is to call
`convert()` or `preview()` and handle the first error. That is a poor fit for
operator-facing workflows: one round trip reports one problem, large sources
pay parse/render setup before a misspelled header is found, and hosts that want
to build mapping or preprocessing UIs must reconstruct the engine's source
contract from exceptions.

The compatibility vocabulary already exists: the `xl3/source/*` error family.
What is missing is a non-throwing report shape that collects all source
compatibility findings for a given template/source pair.

## Considered Options

**A. Keep using `convert()` / `preview()` as validation.** Rejected. Those
entry points are execution APIs: they throw on the first fatal problem and
either render output workbooks or build a conversion preview. They cannot
return a complete diagnostic set without changing their contract.

**B. Expose a read-only validator that returns an input contract plus
diagnostics.** Accepted. This preserves existing conversion behavior while
giving hosts a cheap compatibility gate and a stable source of truth for what
the template requires.

**C. Expose only `analyzeModel()` and let hosts compare schemas.** Rejected.
`analyzeModel()` answers "what is in this template," not "what source columns
are required under block/source/join scoping." Requiring hosts to derive that
contract would recreate the drift this API is meant to prevent.

## Decision

Add two read-only entry points:

```ts
validateSource(
  templateBuffer: ArrayBuffer,
  sourceBuffer: ArrayBuffer,
  options?: ValidateOptions,
): Promise<ValidationReport>;

validateSourceJson(
  templateBuffer: ArrayBuffer,
  sourceJson: Xl3SourceJsonInput,
  options?: ValidateOptions,
): Promise<ValidationReport>;
```

`ValidateOptions.depth` defaults to `"schema"`. Schema validation resolves
the template, source declarations, source sheet/table headers, and static
column requirements without scanning source data rows. `"full"` is accepted as
a forward-compatible spelling, but this ADR does not define any additional
row-level checks; the reference implementation currently treats it as schema
validation.

The report shape is:

```ts
interface ValidationReport {
  ok: boolean;
  contract: InputContract;
  diagnostics: ValidationDiagnostic[];
}
```

`ok` is true only when no diagnostic has severity `"error"`.

`InputContract` describes the source schemas the template requires:

```ts
interface InputContract {
  sources: Array<{
    name: string;          // "default" or a __sources__ name
    sheet: string;
    headerRow: number;
    requiredColumns: string[];
    optionalColumns: string[];
  }>;
}
```

`optionalColumns` is reserved for future features and is empty for this ADR.

For `.xlsx` validation, `sheet` and `headerRow` describe the configured source
selector. For JSON validation, workbook selectors do not apply: `sheet` is the
source name and `headerRow` is `1`, matching the explicit `headers` array.

Diagnostics reuse existing `XtlErrorCode` values. No new error vocabulary is
introduced by validation.

```ts
interface ValidationDiagnostic {
  code: XtlErrorCode;
  severity: "error" | "warning";
  source?: string;
  sheet?: string;
  column?: string;
  location?: string;
  detail: string;
  candidates?: string[];
}
```

`source`, `sheet`, `column`, and `location` are structured context fields for
hosts. `detail` is human-readable English diagnostic text. `candidates` is a
non-normative convenience field for possible fuzzy matches; engines MAY omit
it, and conformance MUST NOT assert its contents.

### Required column collection

Validation MUST collect required columns with source context, not by reading
`variables[].columns` alone. The following references are source requirements:

- `output_file_pattern` group keys and sheet-name group keys: `default`.
- `@filter`, `@sort`, and `@group` fields: the active source of the data block.
- `@join` keys: the primary key from the primary source and the joined key from
  the joined source.
- Bare `[Column]` cell references: the active source of the enclosing block,
  or the static expression context used by the renderer.
- `Source[Column]` references in row-set contexts such as aggregates and
  `XLOOKUP`: the named source.
- `Source[Column]` row-level references: valid only when the named source is
  the active source or the joined source of the enclosing block; otherwise the
  diagnostic is `xl3/source/row-cross-block`.

Missing required columns are validation errors with code
`xl3/source/unknown-column`.

### Strict bare-column rule

Validation is stricter than `preview()` warnings for missing bare columns.
When a template reads `{{ [Amount] }}` and the source has no `Amount` header,
`validateSource*()` MUST report `xl3/source/unknown-column` with severity
`"error"`. This is intentional: `ok: true` means every column the template
reads is present.

`preview()` keeps its existing `xl3w/parser/missing-column` warning behavior
for backwards compatibility. Hosts that need a compatibility gate call
`validateSource*()`; hosts that need planned filenames/sheets/row counts call
`preview*()`.

### JSON source validation

`validateSourceJson()` uses the `xl3-source-json/0.1` envelope from ADR-0075.
It validates the version, `sources` object, declared-source presence, extra
undeclared sources, source `headers`, and that each source has a `rows` array.
Malformed envelope and source-shape findings are returned as
`xl3/source-json/invalid` diagnostics; they do not short-circuit the report when
the remaining source objects can still be inspected.
At schema depth it does not scan row values, row lengths, or per-cell tagged
values. Those remain `convertJson()` / `previewJson()` responsibilities.

## Consequences

The API gives hosts a complete diagnostic set without producing output
workbooks or mutating the source. It also gives host UIs a single engine-owned
input contract for mapping and preprocessing workflows.

The diagnostic shape is intentionally marked experimental in xl3-js until it
has real host feedback. In particular, `location`, `candidates`, warning
diagnostics, and future `"full"` row-level checks may evolve before being
frozen.

The conformance corpus remains output-oriented (`template.xlsx + data.xlsx ->
output.xlsx`), so this ADR is covered by focused reference-implementation unit
tests rather than `.xlsx` fixtures.

## References

- ADR-0012 - Multi-source data model
- ADR-0015 - Structured error reporting
- ADR-0075 - `xl3-source-json`
- Issue #109
