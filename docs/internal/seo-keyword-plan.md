# SEO Keyword Plan

Working backlog from the 2026-06-04 SERP research (16 English queries +
Korean spot checks). Repo-internal — not synced to xl3.io.

## Context

- xl3.io is indexed (GSC ~78 pages) but ranks poorly; external backlinks
  are effectively zero. The constraint is authority + content targeting,
  not technical SEO (sitemap lastmod, robots, IndexNow all fixed
  2026-06-04).
- The site leads with the AI/determinism angle ("deterministic runtime
  for AI-generated Excel reports"); the traditional "excel template
  engine" intent must be carried by titles/meta and dedicated pages.

## SERP findings

1. **JXLS-for-JS is an abandoned market.** `jxls javascript/nodejs`
   resolves to 8–9-year-old repos (node-jxls, node-jxls2, node-java
   dependent). Clear, unserved intent: "JXLS but in JS".
2. **Competitor wedges.** docxtemplater's xlsx support is a *paid
   module*; xlsx-template is *placeholder-only* (no loops/conditions).
   "Alternative" queries convert well.
3. **Korean "엑셀 템플릿 엔진" SERP is polluted** with web/HTML template
   engine articles — the Excel-file-as-template meaning is unclaimed.
4. **Blue ocean:** `deterministic excel generation`, `LLM generate
   excel template` have no library answers yet (only in-cell AI
   add-ins). Matches xl3's actual positioning.

## Keyword table

| # | Query | Comp. | Action | Status |
|---|-------|-------|--------|--------|
| 1 | jxls alternative / jxls javascript / jxls nodejs | weak | New guide: "JXLS for JavaScript: the modern Node.js alternative" with jx:each/jx:if ↔ XTL mapping table | todo |
| 2 | excel template engine (javascript) | mid | Homepage title/meta carries the phrase | **done 2026-06-04** |
| 3 | xlsx-template alternative | weak | New comparison page: placeholder-only vs directives | todo |
| 4 | excel report generator nodejs | strong | New how-to: "Generate Excel reports in Node.js from a template" (flank, don't head-on) | todo |
| 5 | excel template language | weak | /spec title = "XTL — an Excel Template Language" | **done 2026-06-04** |
| 6 | fill excel template programmatically | mid | New guide, interlink with #4 | todo |
| 7 | carbone alternative (open source) | strong | Comparison page: xlsx-native, no LibreOffice. Second wave | todo |
| 8 | docxtemplater xlsx alternative | mid | Comparison page: paid-module wedge | todo |
| 9 | 엑셀 템플릿 엔진 (KR) | weak | /ko definitional guide — claim the term | todo |
| 10 | 엑셀 보고서 자동화 nodejs (KR) | mid | /ko how-to vs low-level ExcelJS | todo |
| 11 | deterministic excel / LLM excel template | none | Thought-leadership post; matches hero positioning | todo |

## Quick-win order

1. JXLS comparison guide (#1) — highest ROI, dead competition
2. docxtemplater-xlsx + xlsx-template comparison pages (#8, #3)
3. Korean 엑셀 템플릿 엔진 guide (#9)

## Backlink backlog (separate constraint, same goal)

- awesome-nodejs / awesome-excel / awesome-typescript PRs
- dev.to: "Migrating from JXLS to a spec-first Excel template engine"
- Reddit r/node, r/javascript show-off post
- ax-exform G15 case study cross-link when public (the 200-거래처 story)
