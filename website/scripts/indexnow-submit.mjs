#!/usr/bin/env node
// Submit every sitemap URL to IndexNow after a Pages deploy, so Bing
// (and Naver/Seznam/Yandex via the IndexNow federation) re-crawl
// changed pages immediately instead of waiting for the next sitemap
// poll. IndexNow has no penalty for re-submitting unchanged URLs, so
// we submit the full set on every deploy rather than diffing.
//
// Runs in CI after `cp -R website/build/. site/` — reads the built
// sitemaps from site/. The key is intentionally public: IndexNow
// verifies ownership by fetching https://xl3.io/<key>.txt, which we
// commit in site/.

import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';

const HERE = dirname(fileURLToPath(import.meta.url));
const SITE = join(HERE, '..', '..', 'site');

const HOST = 'xl3.io';
const KEY = 'eb18dd671c2eeb397a5669c064c8b090';
const LOCALES = ['', 'ko', 'ja', 'es', 'zh-CN', 'zh-TW'];

async function main() {
  const urls = new Set();
  for (const locale of LOCALES) {
    const file = join(SITE, locale, 'sitemap.xml');
    if (!existsSync(file)) {
      console.warn(`skip missing sitemap: ${locale || 'root'}`);
      continue;
    }
    const xml = await readFile(file, 'utf8');
    for (const [, loc] of xml.matchAll(/<loc>([^<]+)<\/loc>/g)) {
      urls.add(loc);
    }
  }
  if (urls.size === 0) {
    throw new Error('no sitemap URLs found under site/');
  }

  const res = await fetch('https://api.indexnow.org/indexnow', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({
      host: HOST,
      key: KEY,
      keyLocation: `https://${HOST}/${KEY}.txt`,
      urlList: [...urls],
    }),
  });
  // 200 = processed, 202 = accepted (key validation pending) — both fine.
  if (res.status !== 200 && res.status !== 202) {
    const body = await res.text();
    // Right after the key file first goes live, IndexNow's async site
    // verification may not have finished yet (403). The ping is
    // best-effort — don't fail an otherwise successful deploy for it;
    // the next deploy re-submits everything anyway.
    if (res.status === 403 && body.includes('SiteVerificationNotCompleted')) {
      console.warn(`IndexNow: site verification still pending, skipping (HTTP 403)`);
      return;
    }
    throw new Error(`IndexNow rejected the batch: HTTP ${res.status} ${body}`);
  }
  console.log(`IndexNow: submitted ${urls.size} URLs (HTTP ${res.status})`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
