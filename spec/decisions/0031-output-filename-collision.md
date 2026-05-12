# ADR 0031 - Output filename collision is an error

- **Status:** accepted
- **Date:** 2026-05-09
- **Spec target:** XTL 0.1
- **Affects:** ADR-0002 (filename sanitization), ADR-0021 (sheet-name collision is impl-defined), evaluation.md "Output Filenames"

## Context

The output_file_pattern is rendered against each file group's key
values, then sanitized per ADR-0002. Distinct group keys that
sanitize to the same filename produce two `OutputFile` entries
sharing one filename:

```
output_file_pattern: "{{ Region }}.xlsx"

Region values in source:
  "Seoul/Korea"   → sanitized → "Seoul_Korea.xlsx"
  "Seoul:Korea"   → sanitized → "Seoul_Korea.xlsx"
  "Busan"         → sanitized → "Busan.xlsx"

→ Engine returns 3 OutputFile entries:
   "Seoul_Korea.xlsx" (Acme's row)
   "Seoul_Korea.xlsx" (Beta's row)       ← collision
   "Busan.xlsx"
```

Host code that writes the array to disk or zips it overwrites the
first file with the second. Authors don't know they lost data
until they manually compare row counts. xl3-py issue #1's
cardinal-bug pattern in another shape: silent data loss.

The sister case for sheet-name collision is already covered by
ADR-0021, which leaves the resolution **implementation-defined**.
Sheet collisions are usually less dangerous because they happen
within one workbook (the operator sees one sheet), while file
collisions split data across hosts and bypass visibility.

## Considered Options

**A. Throw `xl3/filename/collision`.** Fail-loud at convert time.
Author must disambiguate the source data or pick a more specific
output_file_pattern.

**B. Auto-suffix collisions** (`Seoul_Korea (1).xlsx`,
`Seoul_Korea (2).xlsx`). OS-Finder style. Pro: convert succeeds,
data preserved. Con: author may not notice that two business-
distinct groups merged into adjacent files; meaning is lost.

**C. Leave impl-defined** (same as ADR-0021 sheet collision).
Pro: parity with sheet case. Con: silent data loss is the worst
outcome; sheet collisions are visible (operator sees one tab),
file collisions are not (host writes 2 files, same name, second
overwrites).

## Decision

Adopt **A** (throw). Output filename collision raises
`xl3/filename/collision` at convert time before any file is
rendered. The detection runs against all file groups by computing
`previewFilename(fg)` for each and checking for duplicates.

### Rationale for diverging from ADR-0021's sheet-name-collision
stance

Sheet collisions and file collisions look symmetric but their
user-visible consequences differ:

| | Sheet collision | File collision |
|---|---|---|
| Visibility | Operator sees missing tab | Two files written, second overwrites first; no warning at OS level |
| Data preservation | Skip-second (ADR-0021) keeps first group's rows in the kept sheet | Skip-second loses second group's rows entirely from the host's filesystem |
| Recovery | Author renames sheet template; partial output already lets them inspect | Host overwritten; second group's data is gone |

For files, "no convert" is safer than "silent half-overwrite." For
sheets, "partial render" remains a useful operator-feedback
artifact, and the impl-defined stance lets ports pick whichever
makes sense for their host UI.

A future ADR may revisit ADR-0021 to also throw on sheet
collisions; the symmetry argument applies, but the user-visibility
asymmetry above makes the file case more urgent.

### Detection point

In `renderPreparedConversion` (the public `convert()` entry), the
engine computes `previewFilename(fg)` for every file group BEFORE
calling `renderFile`. Detection happens after all filenames are
known and before any workbook serialization runs — so detection
cost is bounded even for templates that produce many files.

### What does NOT trigger the error

- Group keys whose values are identical (same canonical-string
  form) already merge into one group identity at extract time per
  the existing grouping algorithm. No collision arises.
- The `(blank)` placeholder (ADR-0026) is normative for empty
  group keys; multiple empty-key rows merge into one `(blank)`
  group, so there's only ever one `(blank).xlsx`.

The error fires only when **distinct group identities** produce
the **same sanitized filename**. The most common cause is
forbidden characters (`/`, `:`, `\`, etc.) being replaced with `_`
in two different ways that happen to coincide.

## Consequences

- Templates whose source data hits this corner now error loudly.
  Author-fix is either a more specific `output_file_pattern`
  (include more group keys: `{{ Region }}-{{ Quarter }}.xlsx`) or
  pre-process the source to disambiguate the group key values.
- One new error code `xl3/filename/collision` in the ADR-0015
  catalog and snapshot.
- One new conformance fixture (119) pins the collision case.
- No change to ADR-0021's sheet-collision stance for now.

## References

- ADR-0002 — Output filename sanitization (the rule that produces
  the collision)
- ADR-0015 — Stable error codes
- ADR-0021 — Implementation-defined boundaries (sheet collision)
- ADR-0026 — Empty value lifecycle (the `(blank)` placeholder,
  unrelated to this case but adjacent)
- evaluation.md "Output Filenames"
