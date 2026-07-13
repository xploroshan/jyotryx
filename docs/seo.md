# SEO & Search Indexing Runbook

The codebase ships a clean technical-SEO surface (server-rendered content,
self-canonical + hreflang on every page, a dynamic `sitemap.xml`, `robots.txt`,
JSON-LD structured data, `llms.txt` for answer engines). Being *searchable* is
then an **operations** task — discovery, verification, and authority. This doc
is that checklist.

## 0. Verify the site is actually crawlable

In a browser, confirm these return real content (not a 404, a login wall, or
Vercel Deployment Protection):

- `https://www.myastro360.com/robots.txt` — allow rules + `Sitemap:` line
- `https://www.myastro360.com/sitemap.xml` — hundreds of `<loc>` URLs
- `https://www.myastro360.com/` — view-source shows the hero text (SSR), not an
  empty `<div id="root">`

Then check indexing status by Googling:

- `site:myastro360.com` — every URL Google has indexed (zero = not indexed yet)
- `myastro360` — your brand term should return you once indexed

> A brand-new domain takes days–weeks for Google to discover and index even
> with a perfect sitemap. Don't judge by competitive terms ("kundli") — a new
> site won't rank for those for months regardless of markup.

## 1. Google Search Console (required for fast indexing)

1. <https://search.google.com/search-console> → **Add property → Domain**
   (`myastro360.com` — covers www + apex + http/https).
2. **Verify** ownership via either:
   - **DNS TXT** record at the registrar (recommended for a Domain property), or
   - the **HTML meta tag** — set `NEXT_PUBLIC_GSC_VERIFICATION` in Vercel to the
     token GSC shows; `app/layout.tsx` emits the `google-site-verification` tag
     when that env var is present. Redeploy, then click Verify.
3. **Sitemaps** → submit `sitemap.xml`.
4. **URL Inspection** → paste the top ~10 URLs (home, `/kundli`, `/panchang`,
   `/horoscope`, `/numerology`, `/matching`, `/tarot`, `/vastu`, `/muhurat`,
   `/palmistry`) → **Request Indexing** for each.
5. Track progress under **Pages** (indexing) and **Performance** (impressions).

Also set up **Bing Webmaster Tools** (<https://www.bing.com/webmasters>) — you
can import the property from GSC. Bing feeds ChatGPT/Copilot search.

## 2. IndexNow (instant notify for Bing-family engines)

IndexNow tells Bing/Yandex/Seznam/Naver about new or changed URLs immediately.
(Google does **not** use IndexNow — for Google use §1.)

- Key file is hosted at `https://www.myastro360.com/<key>.txt`
  (`apps/web/public/054ce2c31a61abf369ff442e273cb04b.txt`).
- After a deploy that adds/changes pages, submit the whole sitemap:

  ```bash
  npm run indexnow --workspace=apps/web
  # or: node apps/web/scripts/indexnow-submit.mjs
  ```

  Override `SITE_ORIGIN` / `INDEXNOW_KEY` via env if they change. To automate,
  run this from a post-deploy hook or a daily cron.

## 3. Canonical host

`myastro360.com` (apex) 301-redirects to `www.myastro360.com` via
`next.config.ts` `redirects()`, matching `metadataBase`, the sitemap and every
canonical. This prevents Google from splitting signals across two hosts. If
Vercel's domain settings already redirect apex → www, this is a harmless no-op.

## 4. Traction (ranking ≠ indexing)

Once indexed, ranking is driven by **authority and content**, not markup:

- **Backlinks** — directories (Google Business Profile, Product Hunt, astrology
  directories), social profiles (Instagram, YouTube, Pinterest, Quora, Reddit)
  all linking the domain, guest posts / partnerships with astrology blogs.
  **Full playbook with targets, templates and cadence: `docs/seo-backlinks.md`.**
- **Content depth** — make the localized panchang/horoscope city × language
  pages genuinely useful (explanations, FAQs), not thin templates.
- **Long-tail first** — you'll rank for "panchang for Coimbatore in Tamil"
  before "kundli". Lean into the specific localized queries the pages target.
- **Freshness** — the daily-revalidating horoscope/panchang ISR signals an
  active site; keep it running.
