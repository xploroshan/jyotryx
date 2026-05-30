#!/usr/bin/env node
/**
 * IndexNow submitter.
 *
 * Notifies IndexNow-participating engines (Bing, Yandex, Seznam, Naver — and
 * by extension surfaces like ChatGPT/Copilot search that lean on Bing's index)
 * that our URLs exist or changed, so they crawl in minutes instead of waiting
 * for organic discovery. Google does NOT use IndexNow — for Google, submit the
 * sitemap in Search Console and use "Request indexing" (see docs/seo.md).
 *
 * It reads the live sitemap, extracts every <loc>, and POSTs the batch to
 * IndexNow with our hosted key. Run it after a deploy that adds/changes pages:
 *
 *   node apps/web/scripts/indexnow-submit.mjs
 *
 * Env:
 *   SITE_ORIGIN      default https://www.myastro360.com
 *   INDEXNOW_KEY     default 054ce2c31a61abf369ff442e273cb04b
 *                    (must match the file at /<key>.txt in public/)
 */

const SITE_ORIGIN = (process.env.SITE_ORIGIN || 'https://www.myastro360.com').replace(/\/$/, '');
const KEY = process.env.INDEXNOW_KEY || '054ce2c31a61abf369ff442e273cb04b';
const HOST = new URL(SITE_ORIGIN).host;
const KEY_LOCATION = `${SITE_ORIGIN}/${KEY}.txt`;
const INDEXNOW_ENDPOINT = 'https://api.indexnow.org/indexnow';
const MAX_PER_REQUEST = 10000; // IndexNow hard limit per submission

async function fetchSitemapUrls() {
  const res = await fetch(`${SITE_ORIGIN}/sitemap.xml`);
  if (!res.ok) throw new Error(`sitemap fetch failed: HTTP ${res.status}`);
  const xml = await res.text();
  const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim());
  // Only submit URLs on our own host (IndexNow rejects cross-host batches).
  return [...new Set(urls)].filter((u) => {
    try { return new URL(u).host === HOST; } catch { return false; }
  });
}

async function submit(urlList) {
  const res = await fetch(INDEXNOW_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ host: HOST, key: KEY, keyLocation: KEY_LOCATION, urlList }),
  });
  // 200 = accepted, 202 = accepted pending validation. Both are success.
  return res.status;
}

async function main() {
  const urls = await fetchSitemapUrls();
  if (urls.length === 0) {
    console.error('No URLs found in sitemap — nothing to submit.');
    process.exit(1);
  }
  console.log(`Submitting ${urls.length} URL(s) to IndexNow as ${HOST} …`);
  for (let i = 0; i < urls.length; i += MAX_PER_REQUEST) {
    const batch = urls.slice(i, i + MAX_PER_REQUEST);
    const status = await submit(batch);
    const ok = status === 200 || status === 202;
    console.log(`  batch ${i / MAX_PER_REQUEST + 1}: ${batch.length} URLs → HTTP ${status} ${ok ? '✓' : '✗'}`);
    if (!ok) process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error('IndexNow submission failed:', err.message);
  process.exit(1);
});
