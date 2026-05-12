# Conformance reports

Drop JSON conformance reports from external ports here, named
`<impl>-<version>.json` (e.g., `xl3-py-0.2.0.json`). The report
format is documented in
[`conformance/runner-protocol.md`](../runner-protocol.md) "JSON
report format".

After dropping a report, regenerate the dashboard:

```bash
node conformance/scripts/dashboard.mjs
```

The generated [`conformance/DASHBOARD.md`](../DASHBOARD.md) will
include a per-fixture column for every report it finds here.
