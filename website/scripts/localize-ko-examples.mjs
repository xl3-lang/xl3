#!/usr/bin/env node
// Replaces English example tokens in Korean guide pages with natural Korean
// business terms. Run from the website/ directory.

import { readFile, writeFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';

const GUIDES_DIR = 'i18n/ko/docusaurus-plugin-content-docs/current/guides';

// Order matters: longer/specific patterns first. The first match wins per pass.
const REPLACEMENTS = [
  // Currency format strings
  [/"\$#,##0\.00"/g, '"₩#,##0"'],
  [/"\$#,##0"/g, '"₩#,##0"'],

  // Compound table[col] refs — must come before bare table names
  [/Renewals\[customer_id\]/g, '갱신현황[거래처코드]'],
  [/Renewals\[amount\]/g, '갱신현황[금액]'],
  [/Renewals\[renewal\]/g, '갱신현황[갱신액]'],
  [/Customers\[id\]/g, '거래처[id]'],
  [/Customers\[name\]/g, '거래처[name]'],
  [/Customers\[tier\]/g, '거래처[등급]'],

  // FK column
  [/\[customer_id\]/g, '[거래처코드]'],
  [/\bcustomer_id\b/g, '거래처코드'],

  // Bracketed business fields
  [/\[Account\]/g, '[계정]'],
  [/\[Region\]/g, '[지역]'],
  [/\[Renewal\]/g, '[갱신액]'],
  [/\[Amount\]/g, '[금액]'],
  [/\[Customer\]/g, '[거래처]'],
  [/\[Status\]/g, '[상태]'],
  [/\[Owner\]/g, '[담당자]'],
  [/\[OrderDate\]/g, '[주문일자]'],
  [/\[Memo\]/g, '[비고]'],
  [/\[Notes\]/g, '[비고]'],
  [/\[Url\]/g, '[URL]'],
  [/\[Date\]/g, '[일자]'],
  [/\[Tier\]/g, '[등급]'],
  [/\[Rate\]/g, '[요율]'],
  [/\[Margin\]/g, '[마진]'],
  [/\[Item\]/g, '[품목]'],
  [/\[Acct\]/g, '[계정]'],
  [/\[Label\]/g, '[표시명]'],
  [/\[Pct\]/g, '[비율]'],

  // Bare table names (after compound refs)
  [/\bRenewals\b/g, '갱신현황'],
  [/\bCustomers\b/g, '거래처'],

  // Bare business field words (column headers, prose mentions in example context)
  [/\bAccount\b/g, '계정'],
  [/\bRegion\b/g, '지역'],
  [/\bRenewal\b/g, '갱신액'],
  [/\bAmount\b/g, '금액'],
  [/\bCustomer\b/g, '거래처'],
  [/\bStatus\b/g, '상태'],
  [/\bOwner\b/g, '담당자'],
  [/\bOrderDate\b/g, '주문일자'],
  [/\bMemo\b/g, '비고'],
  [/\bTier\b/g, '등급'],
  [/\bRate\b/g, '요율'],
  [/\bMargin\b/g, '마진'],
  [/\bItem\b/g, '품목'],

  // Sheet names used in examples
  [/`Raw`/g, '`원본`'],
  [/`Report`/g, '`리포트`'],
  [/source_sheet` \| `Raw`/g, 'source_sheet` | `원본`'],

  // Region literal values (only inside quotes or table cells)
  [/"Seoul"/g, '"서울"'],
  [/"Busan"/g, '"부산"'],
  [/"Daegu"/g, '"대구"'],
  [/"Jeju"/g, '"제주"'],
  // Region in table cells (between pipes)
  [/\| Seoul \|/g, '| 서울 |'],
  [/\| Busan \|/g, '| 부산 |'],
  [/\| Daegu \|/g, '| 대구 |'],
  [/\| Jeju \|/g, '| 제주 |'],

  // Sample company names (Korean B2B feel)
  [/Acme Logistics/g, '한솔물산'],
  [/Beta Works/g, '베타웍스'],
  [/Coreon Foods/g, '코어식품'],

  // Status/label string literals
  [/"Priority"/g, '"우선"'],
  [/"Standard"/g, '"일반"'],
  [/"Unassigned"/g, '"미지정"'],
  [/"Total: "/g, '"합계: "'],
  [/"Total:"/g, '"합계:"'],
  [/"Region total"/g, '"지역 소계"'],
  [/"Grand total"/g, '"전체 합계"'],
  [/"Subtotal"/g, '"소계"'],

  // Config / list keys used as examples
  [/default_region/g, '기본지역'],
  [/ActiveRegions/g, '활성지역'],
  [/active_regions/g, '활성지역'],

  // Bare-word Priority / Standard / Unassigned in table cells (after quoted forms)
  [/\| Priority \|/g, '| 우선 |'],
  [/\| Standard \|/g, '| 일반 |'],
  [/\| Unassigned \|/g, '| 미지정 |'],
  [/`Priority`/g, '`우선`'],
  [/`Standard`/g, '`일반`'],

  // Short company names (after long forms already replaced)
  [/\bAcme\b/g, '한솔'],
  [/\bBeta\b/g, '베타'],
  [/\bCoreon\b/g, '코어'],

  // Demo product names
  [/Widget A/g, '위젯-A'],
  [/Widget B/g, '위젯-B'],
  [/\bWidget\b/g, '위젯'],
  [/\bBolt\b/g, '볼트'],
  [/\bGear\b/g, '기어'],

  // Region literals (bare) — after table-cell + quoted forms
  [/\bSeoul\b/g, '서울'],
  [/\bBusan\b/g, '부산'],
  [/\bDaegu\b/g, '대구'],
  [/\bJeju\b/g, '제주'],

  // Example output filenames using region (after bare Seoul replaced above this still
  // catches anything missed); regex applied after bare-word pass
  [/서울\.xlsx/g, '서울.xlsx'],
  [/부산\.xlsx/g, '부산.xlsx'],
  [/대구\.xlsx/g, '대구.xlsx'],
  [/제주\.xlsx/g, '제주.xlsx'],

  // renewal-report.xlsx → 갱신-리포트.xlsx
  [/renewal-report\.xlsx/g, '갱신-리포트.xlsx'],

  // Footer labels in code/text examples
  [/`Total`/g, '`합계`'],
  [/Total=/g, '합계='],
  [/Total: \$/g, '합계: ₩'],
  [/"Total: \$/g, '"합계: ₩'],
  [/^Total /gm, '합계 '],
  [/^Total:/gm, '합계:'],
  [/(\| A3: )Total(\s+\|)/g, '$1합계$2'],

  // Common select-option literal — markdown table cells escape pipe as \|
  [/`All\\\|/g, '`전체\\|'],
  [/`All`/g, '`전체`'],
  [/= "All"/g, '= "전체"'],
  [/'All'/g, "'전체'"],
  // Target month label
  [/`Target month \(YYYY-MM\)`/g, '`대상 월 (YYYY-MM)`'],
  [/`Title prefix`/g, '`제목 접두어`'],

  // Report label literals in inputs section
  [/"Report for "/g, '"리포트 — "'],
  [/`Report date`/g, '`리포트 일자`'],
  [/`Report label`/g, '`리포트 라벨`'],

  // Misc place names
  [/`서울\/Korea`/g, '`서울/한국`'],
  [/`서울:Korea`/g, '`서울:한국`'],
  [/Seoul_Korea/g, '서울_한국'],
  [/"KR 거래명세서"/g, '"서울 거래명세서"'],
  [/__config__\[region\]/g, '__config__[지역]'],

  // Particle cleanups for sample company names (limited, only obvious cases)
  [/한솔 와 코어/g, '한솔과 코어'],
  [/베타 가 /g, '베타가 '],
];

async function main() {
  const files = (await readdir(GUIDES_DIR)).filter((f) => f.endsWith('.md'));
  let totalChanges = 0;
  for (const file of files) {
    const path = join(GUIDES_DIR, file);
    const original = await readFile(path, 'utf8');
    let updated = original;
    let perFile = 0;
    for (const [pattern, replacement] of REPLACEMENTS) {
      const before = updated;
      updated = updated.replace(pattern, replacement);
      if (before !== updated) {
        const count = (before.match(pattern) ?? []).length;
        perFile += count;
      }
    }
    if (updated !== original) {
      await writeFile(path, updated);
      console.log(`  ${file}: ${perFile} substitutions`);
      totalChanges += perFile;
    } else {
      console.log(`  ${file}: (unchanged)`);
    }
  }
  console.log(`\nTotal substitutions: ${totalChanges}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
