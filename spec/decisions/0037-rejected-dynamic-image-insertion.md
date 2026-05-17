# ADR 0037 - Rejected: dynamic image insertion

- **Status:** rejected
- **Date:** 2026-05-17
- **Spec target:** XTL 0.1 (rejection; no spec change)
- **Affects:** ADR-0034 (Corollary 2 / 3 application)

## Context

JXLS ships a `jx:image` command that lets a template author embed
an image whose binary source is supplied at render time:

```xml
<!-- JXLS-style, conceptual -->
jx:image(href="${item.logoPath}", x="1", y="1")
```

The same shape appears in `xltpl` and several JXLS forks. The
typical use case is per-customer logos, signature images, or QR
codes that vary row-to-row.

The natural XTL spelling would be something like:

```text
{{ IMAGE([LogoPath]) }}
{{ @image [QRBase64] }}
```

This ADR records the decision **not** to ship that feature in
XTL 0.1 (or 1.0). The rejection is deliberate, not an oversight,
so that future proposers see the rationale before reopening the
question.

Per ADR-0034 Corollary 3, this is the first feature-level
rejection ADR following that informational principle.

## Considered Options

**A. Ship dynamic image insertion in 0.1.** Adds a new directive
or function with binary-data semantics.

**B. Ship a static image-anchor preservation only (ADR-0036
item 1) and reject runtime image insertion.** Templates ship
images already in the file; the engine preserves them; no
runtime binary pipeline.

**C. Defer (no decision yet).** Leaves the question open and
recurring.

## Decision

Adopt **B**. Dynamic image insertion is **out of scope** for XTL
0.1 and **not on the roadmap** to 1.0.

### Why rejected

Five distinct objections, each sufficient on its own:

#### 1. The use case is narrow in practice

Audit of real Korean vendor templates (거래명세서, 정산서, 발주서,
인보이스) over the conversation that produced ADR-0033 surfaced:
**every observed image was a static company logo or stamp,
authored once into the template**, not a per-row dynamic asset.
The "per-customer logo" scenario JXLS targets is real but
vanishingly rare in the operations workflows XTL is designed
for. Authoring effort for a feature with thin demand is wasted
authoring effort that delays features with broad demand.

#### 2. Binary-data pipeline breaks the browser story

XTL's browser flow (`xl3.io`) operates on two `.xlsx` files: a
template and a source data workbook. Both are self-contained.
A dynamic image feature requires *additional* binary inputs at
render time — file paths the browser cannot resolve, base64
blobs that bloat the source workbook, or external URLs the
engine would need to fetch. Each shape breaks one of XTL's
design axes:

- File paths → host-specific I/O leak; browser cannot resolve.
- Base64 in cells → source-workbook size explosion; not how
  operators author data.
- Fetched URLs → introduces a network surface; security
  implications; cannot run offline.

The static-image preservation in ADR-0036 sidesteps all three:
images live in the template (where author already put them),
not in the source data.

#### 3. Cross-impl portability cost is high

Image placement in OOXML uses `xdr:twoCellAnchor` / `oneCellAnchor`
with EMU coordinates and per-image relationship parts. Each port
(xl3-py, future Rust/Go) would need to:

- Parse the row/column the directive targets
- Compute EMU offsets for one-cell or two-cell anchoring
- Generate the `xl/media/imageN.{png,jpg}` parts
- Wire the worksheet's `_rels/sheet*.xml.rels` correctly
- Handle MIME type detection / re-encoding for the input source

This is ~500 lines per port for a feature few authors will use.
ADR-0034 Corollary 1 says absorb experience cheaply; this
feature is the inverse — expensive for thin payoff.

#### 4. Excel-native function alternative exists for the common case

Excel has `IMAGE()` (Microsoft 365 / 2024+), `HYPERLINK()` for
clickable logos, and conditional formatting "Icon Sets" for
status indicators. Authors who really need data-driven visuals
have author-side options that don't require an XTL directive.

A future ADR could add `IMAGE()` to the XTL function table as a
pass-through to Excel's native `IMAGE()` evaluation, but that
is a much smaller surface than `jx:image` and is **not part of
this ADR's rejection** — it would be a separate proposal if
demand surfaces.

#### 5. Encourages templates to grow non-portable behavior

The moment a template depends on per-render binary assets, the
template stops being a self-contained artifact. README §41-52
states the thesis: "**The template is the handover artifact.**
It can be reviewed, versioned, archived, and passed to the next
operator without asking them to read the automation code." A
template that says `{{ @image [LogoPath] }}` is only meaningful
in the context of *some host system* that knows where logo paths
resolve. The template is no longer the contract.

### What is *not* rejected

- Static image preservation (the template's own embedded images
  survive to output). **Preserved** per ADR-0036 item 1.
- Excel's native `=IMAGE("url")` formula evaluating inside the
  workbook. **Out of scope** of this ADR — orthogonal question.
- Future reconsideration if production users report dynamic
  image insertion as a blocker. ADRs are revisable per
  `GOVERNANCE.md` § "Disagreements". A reopening would need to
  address all five objections above with concrete evidence.

## Consequences

- Future proposers of dynamic image features can cite this ADR
  to know the bar (overcome all five objections) before
  drafting.
- No new directive, no new function in 0.1.
- No conformance fixture is added — rejected ADRs do not need
  fixtures; the rejection IS the contract.
- `docs/internal/jxls-absorption-plan.md` Category C item C6
  links to this ADR.
- Listed in `INFORMATIONAL_ADRS` of `src/__tests__/spec-coverage.test.ts`
  so the ADR↔fixture coverage check passes.

## References

- ADR-0034 — Relationship to prior-art template engines
  (Corollary 3: some prior-art choices are explicitly out of
  scope)
- ADR-0036 — Template feature preservation matrix (item 1:
  static image preservation, the kept side of this rejection)
- README § "Why xl3 exists" / § "What xl3 emphasizes" (the
  thesis the rejection protects)
- `GOVERNANCE.md` § "Disagreements" (revisability)
