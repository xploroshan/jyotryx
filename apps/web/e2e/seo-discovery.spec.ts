import { test, expect } from '@playwright/test';
import { featureContentLocales } from '../src/lib/seo/feature-content';

// Single source of truth the app itself uses — when a locale's content lands
// these expectations expand with it instead of breaking.
const CONTENT_LOCALES = featureContentLocales();

/**
 * E2E guards for SEO phase 2 (crawl-budget alignment + city-page enrichment).
 *
 * These assert the CRAWLER-VISIBLE surface of the running app:
 *  - hreflang alternates advertise only content-backed locales (en + hi
 *    today), never the thin locale trees Google was declining to index;
 *  - the visible "Also available in" language row matches that same set;
 *  - the kundli city pages carry their per-city substance (dynamic contrast
 *    cities — the Mumbai-vs-Mumbai template bug — and nearby-city links)
 *    and degrade gracefully when the panchang API is unreachable (this
 *    suite runs with no backend, which IS the failure case);
 *  - sitemap.xml agrees with the links/hreflang about what exists.
 */

test.describe('hreflang / language-row alignment (feature pages)', () => {
  test('/kundli head advertises exactly the content-backed locales + x-default', async ({ page }) => {
    await page.goto('/kundli');
    const alternates = page.locator('link[rel="alternate"][hreflang]');
    const hreflangs = await alternates.evaluateAll((els) =>
      els.map((e) => e.getAttribute('hreflang')).sort(),
    );
    expect(hreflangs).toEqual([...CONTENT_LOCALES, 'x-default'].sort());
    // The thin locales must NOT be advertised until their content lands.
    expect(hreflangs).not.toContain('gu');
    expect(hreflangs).not.toContain('as');
  });

  test('/kundli language row links only the content-backed locales', async ({ page }) => {
    await page.goto('/kundli');
    const row = page.getByRole('navigation', { name: /other languages/i });
    await expect(row).toBeVisible();
    const links = row.locator('a');
    // The English page links every OTHER content-backed locale (today: just hi).
    await expect(links).toHaveCount(CONTENT_LOCALES.length - 1);
    await expect(row.locator('a[href="/hi/kundli"]')).toHaveText('हिन्दी');
  });

  test('sign pages keep their wider (content-backed) landing-locale row', async ({ page }) => {
    await page.goto('/horoscope/aries');
    const row = page.getByRole('navigation', { name: /other languages/i });
    await expect(row).toBeVisible();
    // LANDING_LOCALES = en + 6 translated locales → 6 links on the English page.
    await expect(row.locator('a')).toHaveCount(6);
  });
});

test.describe('kundli city pages (enrichment + graceful degradation)', () => {
  test('Mumbai page never compares Mumbai to itself (dynamic contrast cities)', async ({ page }) => {
    await page.goto('/kundli/mumbai');
    const article = page.locator('article');
    await expect(article).toContainText(/different from the same moment in\s+Kolkata or Delhi/);
    await expect(article).not.toContainText('in Mumbai or Kolkata');
  });

  test('non-metro page contrasts with the metro pair', async ({ page }) => {
    await page.goto('/kundli/varanasi');
    await expect(page.locator('article')).toContainText(
      /different from the same moment in\s+Mumbai or Kolkata/,
    );
  });

  test('nearby-city links are present and never self-referential', async ({ page }) => {
    await page.goto('/kundli/mumbai');
    const nearby = page.getByText('Kundli for nearby cities:');
    await expect(nearby).toBeVisible();
    const links = nearby.locator('a');
    await expect(links).toHaveCount(4);
    for (const href of await links.evaluateAll((els) => els.map((e) => e.getAttribute('href')))) {
      expect(href).toMatch(/^\/kundli\/[a-z-]+$/);
      expect(href).not.toBe('/kundli/mumbai');
    }
  });

  test('page renders fully when the panchang API is unreachable (no backend here)', async ({ page }) => {
    // This suite runs without an API server — fetchPanchang returns null, so
    // the "Today in {city}" section must be OMITTED (not broken/empty) and
    // everything else must render.
    await page.goto('/kundli/chennai');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Free Kundli for Chennai');
    await expect(page.getByRole('link', { name: /Generate my kundli for Chennai/ })).toBeVisible();
    // FAQ content present (the page's static substance is intact).
    await expect(page.getByText('Is the kundli for Chennai free on MyAstro360?')).toBeVisible();
  });
});

test.describe('sitemap agrees with advertised discovery', () => {
  test('sitemap.xml lists content-backed URLs and excludes thin locales', async ({ request }) => {
    const res = await request.get('/sitemap.xml');
    expect(res.status()).toBe(200);
    const xml = await res.text();
    const locs = xml.match(/<loc>/g)?.length ?? 0;
    // ~534 entries today; assert a sane band rather than an exact count so
    // content additions don't break the test.
    expect(locs).toBeGreaterThan(450);
    expect(locs).toBeLessThan(700);
    expect(xml).toContain('/kundli/mumbai');
    expect(xml).toContain('/hi/kundli');
    expect(xml).toContain('/learn');
    // Thin locales stay out until translated content lands.
    expect(xml).not.toContain('/gu/kundli');
    expect(xml).not.toContain('/as/kundli');
    expect(xml).not.toContain('/ta/panchang/mumbai');
  });
});
