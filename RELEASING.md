# Releasing xl3

The reference impl publishes to npm; the spec lives in this repo.
This file documents the cut procedure for both.

## Versioning model

The npm package version (`package.json`) and the XTL spec version
(`spec/STABILITY.md`) move on **independent timelines** but follow
related rules:

| Bump | Trigger |
|---|---|
| `xl3` patch (`1.0.x`) | impl bug fix; no API change; no spec change |
| `xl3` minor (`1.x.0`) | new export; spec opt-in addition (e.g., new function added in XTL 1.x) |
| `xl3` major (`2.0.0`) | spec breaking change OR impl API breaking change |
| XTL minor (e.g., 1.0 → 1.1) | additive spec change (new function, new directive option) |
| XTL major (e.g., 1.0 → 2.0) | breaking spec change (changes existing semantics) |

A spec minor bump usually drives an `xl3` minor bump but not always;
a pure impl refactor can ship as `xl3` patch with no spec change.

## Pre-release sequence (for any 1.x.0)

1. Land all targeted PRs on `main`.
2. Verify locally:

   ```bash
   npm run typecheck
   npm test -- --run
   npm run build
   npm run conformance
   npm run conformance:tz
   npm run examples:build
   npm run examples:run
   npm run bench
   ```

   All MUST be green. The bench numbers go in
   `scripts/BENCH.md` if they shifted significantly.

3. Confirm `CHANGELOG.md` `[Unreleased]` is comprehensive.
4. Bump `package.json` version to the rc form
   (e.g., `1.0.0-rc.1`). Do NOT publish a `1.0.0` directly without
   an rc cycle for any major / new-spec-minor release.
5. Move `[Unreleased]` to `[1.0.0-rc.1] - YYYY-MM-DD` and re-create
   an empty `[Unreleased]` section.
6. Tag and push:

   ```bash
   git tag -a v1.0.0-rc.1 -m "xl3 1.0.0-rc.1"
   git push origin main --tags
   ```

7. Publish:

   ```bash
   npm publish --tag rc
   ```

   The `rc` dist-tag means hosts opting in
   (`npm install @jinyoung4478/xl3@rc`) get the candidate; default
   `npm install @jinyoung4478/xl3` keeps the prior stable.

8. Open a GitHub release for the tag with the section from
   CHANGELOG.

## Final 1.0.0 cut

After a minimum 7-day rc soak with no critical issues:

1. Bump version to `1.0.0`.
2. Move `[1.0.0-rc.1]` → `[1.0.0] - YYYY-MM-DD` in CHANGELOG (with
   any rc-only fixes folded in).
3. Tag, push, publish:

   ```bash
   git tag -a v1.0.0 -m "xl3 1.0.0 — XTL 0.1 final"
   git push origin main --tags
   npm publish
   ```

   No `--tag rc` this time; this becomes the new `latest`.

4. Update IMPLEMENTATIONS.md row for the TS reference impl to show
   `1.0.0`.
5. Open a GitHub release with the migration notes from CHANGELOG.

## XTL spec version cut

A spec version cut is independent of the npm release. When the XTL
spec moves from 0.1 → 1.0:

1. Update `spec/STABILITY.md` "Current state" to read 1.0.
2. Tag the conformance corpus snapshot:

   ```bash
   git tag -a xtl-1.0 -m "XTL 1.0 conformance corpus baseline"
   git push origin --tags
   ```

   This tag pins the corpus state that any 1.0-claiming
   implementation must pass.

3. Update fixture `meta.yaml` `spec_version` fields if any moved
   from 0.1 to 1.0 (a future operation; no fixtures move at the
   actual 0.1 → 1.0 cut since 1.0 IS the 0.1 surface frozen).

The XTL 1.0 cut and the `xl3` 1.0.0 cut SHOULD happen in the same
commit so external porters see a clear baseline.

## Things that MUST NOT happen

- A breaking API change in a patch or minor.
- Publishing to npm with a dirty working tree.
- Skipping the rc cycle for a major release.
- Removing a stable export without a 2.0 bump.
- Changing an `xl3/...` error code's logical meaning. Adding a new
  code is fine; renaming or repurposing is breaking.
- Changing an English `Error.message` in a way that breaks an
  existing `expected_error` substring assertion. Update the fixture
  and the message together, or don't touch the message.

## Rollback

If a release ships a critical bug:

1. Publish the fix as the next patch (`1.0.0` → `1.0.1`).
2. If the fix can't ship within an hour:

   ```bash
   npm dist-tag rm @jinyoung4478/xl3 latest      # un-recommend the bad version
   npm dist-tag add @jinyoung4478/xl3@<previous> latest
   ```

   Hosts that pinned to `@jinyoung4478/xl3` keep the old version
   until they bump.

3. Never `npm unpublish` — npm policy disallows unpublishing
   versions used as dependencies after a brief grace window.
