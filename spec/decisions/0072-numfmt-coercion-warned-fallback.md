# ADR 0072 — numFmt coercion failure degrades to a warned text fallback (amends ADR-0003)

- **Status:** accepted (implementation prepared for the post-1.0 release)
- **Date:** 2026-06-28
- **Spec target:** **POST-1.0**, per ROADMAP #56. Amends ADR-0003: relaxes a fatal error to a warned text fallback. Removing `xl3/cell/numfmt-coercion` is a breaking catalog change. This implementation must be released on a version line that permits that removal; merging it into the current 1.0 RC line resets the G3/G24 stability gates. Preparing the change locally does not change the published release or its calendar.
- **Affects:** evaluation.md ("Cell Evaluation / Single-Expression Cells"); language.md (numFmt coercion paragraph, L253); ADR-0003 (failure-mode clause); impl (`renderer.ts` `renderCellValue` / `coerceDateValue` / `coerceNumberValue`); `types.ts` (`XtlWarningCode`); error-codes catalog; conformance fixtures 021/022
- **Amends:** ADR-0003
- **Issue:** #56

## Context

ADR-0003 promoted single-expression-cell numFmt coercion from `MAY` to
`MUST` and added the clause **"Failing to coerce is an error,"** with the
explicit rationale that **"silent string-pass-through is no longer
conformant."** The reference impl honors this in `renderer.ts`:
`coerceDateValue` / `coerceNumberValue` `throw xl3/cell/numfmt-coercion`
when a string value will not parse under a date/number format.

That `throw` aborts the **entire conversion**, not just the offending
cell. Real operator data routinely mixes a typed value with placeholder
text in the same column — `-`, `N/A`, blank-as-dash — because the source
sheet inherited a date/number `numFmt` on a column that is only
*sometimes* a date. A single `-` in a `취소일` (cancel-date) column under
an `mm-dd-yy` format kills the whole file:

```
Error: Value cannot be coerced to a date for cell format "mm-dd-yy": -
  code: 'xl3/cell/numfmt-coercion'
```

Three problems:

1. **Stricter than Excel.** Excel shows non-conforming text in a
   date/number cell as text and moves on. xl3 makes it fatal.
2. **Whole-file abort.** One bad cell out of thousands fails the entire
   output. Common with placeholder-mixed real data.
3. **Inconsistent with the sibling failure path.** In the same
   `renderCellValue`, a *formula* error (`__xl3_error__`) is recorded
   **per cell** (`{ error }`, render continues), while *coercion*
   failure alone aborts globally.
4. **Poor diagnostics.** The message carries only the format and value
   (`-`) — no sheet / cell address / column — so locating the offending
   column is slow.

The author currently works around this by clearing the block cell's
`numFmt` to `General` at template-build time for every mixed column — a
non-obvious trap repeated per template. That is exactly the toil xl3
exists to remove.

ADR-0003's reproducibility argument, however, is real and must be
preserved: if coercion failure silently passed through as text, two
conformant impls could diverge (one errors, one passes through) with no
observable signal. The fix must keep that signal.

## Considered Options

**A. Silent text fallback.** On failure, write the value as text and
continue. Fixes the abort and matches Excel. **Rejected** — this is
precisely the "silent string-pass-through" ADR-0003 outlawed: no
observable signal, so a non-parsing impl and a parsing impl diverge
invisibly. Breaks reproducibility.

**B. Warned text fallback (recommended).** On failure, emit a
conformance warning `xl3w/cell/numfmt-coercion` **and** write the value
via the text path; conversion continues. The warning is part of the
conformance contract (`expected_warnings`), so every conformant impl
emits the same warning and the same text output — the divergence
ADR-0003 feared cannot occur silently.

**C. Per-cell hard error.** Record the failure as a cell-level
`{ error }` (mirroring the formula-error path) instead of aborting.
Fixes the abort and is internally consistent, but writes an Excel error
cell (`#…`) where Excel itself would show plain text — surprising for
placeholder data, and loses the original value. **Structurally available
but not free:** the `{ error }` cell-writing path already exists
(`renderer.ts` formula-error branch), yet `XtlErrorCell.__xl3_error__` is
currently hardcoded to the single token `'#DIV/0!'` (`functions.ts`), so
C would need a new token (`#VALUE!`) added to that type — itself a
catalog-class change. B reuses the existing `preserveValue` path with
zero new machinery. C is **not foreclosed**: because both output shapes
already exist in the engine, a future ADR can add C as a config-selected
mode without revisiting this decision.

**D. Location in the diagnostic (parallel, not exclusive).** Whatever
the failure mode, include `sheet "X" cell A5` (and column name when
available) in the message/`location`. Addresses problem 4 and composes
with any of A–C.

**E. Keep the throw.** Status quo. Rejected — the abort is the reported
defect.

## Decision

**Adopt B + D.** Coercion failure on a single-expression date/number
cell:

1. **does not throw** — conversion of the file continues;
2. **emits** a warning `xl3w/cell/numfmt-coercion` whose `code` and
   English `message` are normative (corpus-matched), with `location` =
   `sheet "<name>" cell <address>` using final output coordinates, plus
   ` column "<column>"` for a direct data-block column reference;
3. **writes the original value as text** via the existing text/General
   path (`preserveValue`) — the cell shows the literal value (`-`),
   exactly as Excel would.

ADR-0003's MUST is **narrowed, not revoked**: coercion is still
mandatory and a *successful* coercion still MUST produce the typed
value. Only the **failure mode** changes from `error` to
`warning + text fallback`. The clause "silent string-pass-through is no
longer conformant" is upheld — the fallback is **warned**, never silent.

### Scope (unchanged paths)

- Only **single-expression** cells with a **date or number** numFmt take
  this path (the cells that previously threw). Mixed-text cells and `@`
  text-format cells already stringify via `canonicalString` and never
  threw — untouched.
- Empty / null values and successful coercions of already-typed values
  behave as before, without a warning. A boolean under a date format,
  which previously failed, now warns and is preserved by `preserveValue`.
- The change is **per cell**: N non-coercible cells emit N warnings, in
  deterministic sheet render order, then row/column order within each
  sheet, after filename warnings. Addresses account for block expansion
  and deletion. `expected_warnings` lists are stable and ordered.
- Warning messages retain the previous diagnostic text:
  `Value cannot be coerced to a number for cell format "<numFmt>": <value>`
  (or `a date`), where `<value>` is the trimmed string form. Fallback
  strings retain their original whitespace and cell format. Preview
  does not render cells, so it does not emit these warnings.

## Consequences

- The implementation here covers the JavaScript reference backend. The
  optional `xl3-wasm` backend is a separate implementation and needs its
  own ADR-0072 conformance work. Hosts requiring these diagnostics should
  select `engine: 'js'` or use `convertJson` until parity is verified.

- **Impl** (`renderer.ts`): `coerceDateValue` / `coerceNumberValue` no
  longer `throw`; on parse failure they push an `XtlWarning` to a
  per-file sink and return `preserveValue(v)`. `renderCellValue` and its
  call sites thread the sink + a `location` (sheet/address already in
  scope at every call site via `evalCellAt(sheet.name, cell.address, …)`).
  The collected warnings merge into `OutputFile.warnings` alongside the
  existing filename warnings.
- **New warning code** `xl3w/cell/numfmt-coercion` added to
  `XtlWarningCode` (`types.ts`) and the error/warning catalog. `@stable`
  warning list is **additive** (G3 non-reset preserved).
- **Existing error code** `xl3/cell/numfmt-coercion` is **removed** from
  the `XtlErrorCode` catalog — once the failure path warns instead of
  throwing, the code is no longer emitted anywhere and carrying dead
  surface into 1.0 is undesirable.
  - **Timing gate (G24):** removal is a breaking error-code change. The
    catalog is **append-only** pre-1.0 (`error-codes.test.ts` fails CI on
    removal *by design*) and the G24 quarter clock restarts on any
    breaking spec/API/error-code change (ROADMAP: 1.0 earliest
    ≈ 2026-09-21 absent such a change). This matches ROADMAP already
    classifying #54/#56/#57 as **POST-1.0 additive** — so the removal
    (and this ADR's whole implementation) lands **after the 1.0 freeze**,
    not during the G24 window. The original `proposed` ADR was doc-only;
    accepting and implementing it does not waive this release constraint.
- **Conformance fixtures** `021-numfmt-number-coercion-error` and
  `022-numfmt-date-coercion-error` convert from `expected_error_code`
  to `expected_warnings` + a rendered output pinning the text fallback.
  ADR-0015's error-code coverage list drops 021/022 (they no longer
  assert an error); a new warning-path fixture is added under ADR-0072.
- **Spec text**: evaluation.md "Single-Expression Cells" failure
  sentence changes from "Failing to coerce is an error" to "Failing to
  coerce emits `xl3w/cell/numfmt-coercion` and falls back to the cell's
  text rendering"; language.md L253 mirrors it. ADR-0003 gains an
  "Amended by ADR-0072" note on its failure-mode clause.
- **Reproducibility** is preserved: the warning is normative, so a
  parsing impl and a non-parsing impl still diverge *observably* (one
  emits the warning, one does not) — never silently. This is strictly
  stronger than the pre-ADR-0003 `MAY` and consistent with ADR-0003's
  stated reason for existing.
- **Migration**: templates that previously aborted now produce output
  plus warnings. Hosts that treated any non-empty `warnings` as failure
  should review their policy. No public API shape change
  (`OutputFile.warnings` already exists).

## References

- Amends: [ADR-0003](./0003-numfmt-coercion-must.md) — numFmt coercion MUST
- [ADR-0015](./0015-structured-error-reporting.md) — structured error/warning reporting (warning shape, corpus matching)
- Sibling per-cell failure path: ADR-0025 (error-cell marker) in `renderer.ts` `renderCellValue`
- `spec/evaluation.md` "Cell Evaluation / Single-Expression Cells"; `spec/language.md` numFmt coercion paragraph
- Issue: #56
