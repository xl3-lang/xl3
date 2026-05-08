# ADR 0016 - Ordering and stability

- **Status:** accepted
- **Date:** 2026-05-08
- **Spec target:** XTL 0.1 draft
- **Affects:** language.md, evaluation.md

## Context

Three ordering questions have lurked under the spec without a
normative answer. Each one is a portability hazard if two conformant
implementations make different choices:

1. **`@sort` stability.** `evaluation.md` defines the directive
   pipeline (`filter → sort → top`) but never says whether `@sort`
   preserves the relative order of rows that have equal sort keys.
   Two implementations could sort identically by key and still
   differ on tie order.
2. **File group output order.** When `output_file_pattern` produces
   multiple files (one per `Customer`, etc.), the spec doesn't say
   in what order those files appear in the result list / zip. The
   reference impl uses *first-seen* order today; that is observable
   behavior nobody pinned.
3. **Sheet group order within a file.** When a sheet template has a
   group key (`Region` etc.) and produces multiple sheets per file,
   the order is currently `order.sort()` — lexicographic on the
   canonical-string-form group key. That is inconsistent with the
   file-group rule and depends on the JS default sort, which
   produces a different relative ordering than file groups for the
   same data.

Pre-1.0 is the right window to lock these.

## Considered Options

### `@sort` stability

**A. Stable (chosen).** Equal sort keys keep their input order. JS
`Array.sort` is stable since ES2019. Easy to implement; matches
author intuition.

**B. Unstable, implementation-defined.** Cost: silently breaks data
flows that rely on a stable secondary order (e.g. sort by region,
then expect customers to appear in source order within each region).

**C. Lexicographic tie-breaker on first column.** Cost: surprises
authors; requires them to know the rule.

### File group order

**D. First-seen (chosen).** When the engine walks source rows in
order, the first row whose group key produces filename X writes that
group "first." Reproducible from the source data without further
sort.

**E. Sorted by canonical-string-form filename.** Cost: every run
sorts files lexicographically — predictable but doesn't match the
source's own order; authors expect "first row's group goes first."

### Sheet group order within a file

**F. First-seen, matching file groups (chosen).** Reuses the same
rule; once authors learn it for files they know it for sheets.

**G. Lexicographic by joined key (status quo).** Inconsistent with
file groups, locale-undefined.

## Decision

### `@sort` is stable

Implementations MUST preserve the relative order of rows whose
`@sort` key compares equal. With multiple `@sort` directives, the
**first** directive is the primary sort key; subsequent directives
are tiebreakers in the order they appear. Source order is the final
tiebreaker. This matches the convention of Excel "Sort by … then by
…" and SQL `ORDER BY a, b` (the first column is primary).

### File and sheet groups use first-seen order

When `output_file_pattern` evaluates to multiple distinct filenames,
the file groups are emitted in the order in which the engine first
encounters each filename while walking source rows.

When a sheet template's group keys produce multiple sheets within a
file, those sheets are emitted in first-seen order over the file
group's row list.

The single-source iteration order is the source's natural row order
(`source_table` reading top-to-bottom). With multi-source data
(ADR-0012) this rule applies to the *primary* source's rows.

### Spec text additions

- `language.md` "Sort" gains: "`@sort` is stable. Equal sort keys
  preserve source order. Multiple `@sort` directives apply in order
  with later sorts stable relative to earlier ones."
- `evaluation.md` "Render Phases" gains a new "Ordering" subsection:
  - File groups: first-seen.
  - Sheet groups within a file: first-seen.
- The implementation's sheet-group lexicographic sort (`order.sort()`
  in `grouper.ts:groupByKeysOrdered`) is replaced with insertion
  order.

## Consequences

- Single-source templates that sort by a column are unaffected (JS
  default `Array.sort` is already stable).
- Templates that relied on the implementation's lexicographic sheet-
  group ordering will see a behavior change: sheets now appear in
  the order their first matching source row appeared. This is a
  deliberate, signalled break for the 0.x window.
- Multi-source templates (ADR-0012) inherit the same rule: the
  primary source's iteration order drives output order; named
  sources contribute to aggregates and joins but do not affect
  file / sheet output order.
- The spec gains predictability for ZIP packaging, audit, and
  diffing across runs.
- This ADR does not introduce author control over output order.
  Authors who need a specific order can sort their source data
  beforehand or use a sortable group-key column.

## References

- ADR-0007: empty value definition (empty group keys still produce
  one group per distinct empty representation; ordering by first-
  seen).
- ADR-0009: comparison and string coercion (canonical-string-form
  drives group-key identity; ordering does not depend on Unicode
  collation).
- ADR-0012: multi-source data model (primary source drives ordering).
- `spec/evaluation.md` "Render Phases", "Group Keys".
- `spec/language.md` "Sort".
