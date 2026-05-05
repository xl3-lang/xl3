# ADR 0005 - Dynamic conformance assertions

- **Status:** accepted
- **Date:** 2026-05-05
- **Spec target:** XTL 0.1 draft
- **Affects:** conformance/runner-protocol.md, conformance fixtures

## Context

Most XTL conformance fixtures can commit a static `expected.xlsx`. `TODAY()` is
different: ADR-0001 makes it deterministic across timezones by defining it as
the UTC date at render time, but the exact expected date changes every day.

Using a committed workbook would either become stale or require an artificial
clock-freezing mechanism that is not part of the XTL language. Leaving
`TODAY()` outside the corpus also leaves one normative function covered only by
reference-implementation unit tests.

## Considered Options

**A. Do not add `TODAY()` fixtures.** This avoids runner complexity. Cost:
portable behavior for a normative function remains untested by the corpus.

**B. Add a fake clock input to the runner.** This makes expected workbooks
static. Cost: every implementation must expose a non-user-facing clock injection
hook just to satisfy the runner.

**C. Add dynamic assertions to `meta.yaml`.** The fixture stays small and the
runner computes the expected value from its own runner-start timestamp. Cost:
runner protocol grows a second expected-result mode beyond static workbooks and
expected errors.

## Decision

Adopt option C.

Dynamic fixtures omit `expected.xlsx` and `expected/`, declare
`expected_dynamic` in `meta.yaml`, and list the cells to compare. Runners MUST
capture one runner-start timestamp before executing fixtures and use that single
timestamp for every dynamic assertion in the run.

XTL 0.1 defines one dynamic assertion kind:

```yaml
expected_dynamic: utc_today
dynamic_cells:
  - sheet: Report
    cell: A2
    format: YYYY-MM-DD
```

For `utc_today`, each listed cell's expected value is the UTC calendar date from
the runner-start timestamp formatted with the listed XTL `TEXT()` date format.
The implementation output MUST contain that string value at the listed
sheet/cell coordinate.

`expected_dynamic` and `expected_error` are mutually exclusive.

## Consequences

- A `TODAY()` conformance fixture can be added without committing a stale
  `expected.xlsx`.
- Runners that do not support a declared dynamic assertion kind must report the
  fixture as skipped, not passed.
- This ADR does not introduce a general expression assertion language. XTL 0.1
  only defines `utc_today`.
- This ADR does not require implementations to expose a fake clock or change
  user-facing render APIs.

## References

- ADR-0001: `TODAY()` returns UTC date
- `conformance/runner-protocol.md`
