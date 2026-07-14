import { test, expect, type Page } from '@playwright/test';
import { LEARN_ARTICLES, listArticleSlugs } from '../src/lib/learn/articles';

/**
 * E2E guards for the /learn definitional cluster + structured-data expansion
 * (AEO playbook §3/§7) and the localized landing FAQs (§4).
 *
 * Asserts the CRAWLER-VISIBLE surface of the running app:
 *  - every /learn article renders its question-led H1 and emits the full
 *    JSON-LD set (Article, BreadcrumbList, FAQPage, DefinedTerm, and HowTo
 *    where the article defines one);
 *  - sitemap.xml and llms.txt agree with the article registry (single
 *    source of truth — expectations derive from LEARN_ARTICLES itself);
 *  - tool pages carry Service JSON-LD tied to the Organization entity;
 *  - localized horoscope/panchang pages render genuinely localized FAQs
 *    whose FAQPage JSON-LD matches the visible copy (no English leakage).
 *
 * Like the rest of this suite it runs hermetically: server-side data
 * fetches fail (no backend) and pages must still render their SEO surface.
 */

/** Parse every JSON-LD script on the page into plain objects. */
async function jsonLdBlocks(page: Page): Promise<Record<string, unknown>[]> {
  const raw = await page
    .locator('script[type="application/ld+json"]')
    .evaluateAll((els) => els.map((e) => e.textContent ?? ''));
  return raw.map((t) => JSON.parse(t) as Record<string, unknown>);
}

function byType(blocks: Record<string, unknown>[], type: string) {
  return blocks.filter((b) => b['@type'] === type);
}

test.describe('/learn hub', () => {
  test('lists every registered article and emits an ItemList of them', async ({ page }) => {
    await page.goto('/learn');
    for (const article of LEARN_ARTICLES) {
      await expect(
        page.locator(`a[href="/learn/${article.slug}"]`).first(),
      ).toBeVisible();
    }
    const blocks = await jsonLdBlocks(page);
    const [itemList] = byType(blocks, 'ItemList');
    expect(itemList, 'hub must emit ItemList JSON-LD').toBeTruthy();
    const items = itemList.itemListElement as { url?: string; item?: string }[];
    expect(items).toHaveLength(LEARN_ARTICLES.length);
  });
});

test.describe('/learn articles — structured data', () => {
  // One new article (full DefinedTerm + HowTo), one seed article
  // (DefinedTerm added retroactively), and the comparison-format page.
  const SAMPLES = ['kundli', 'nakshatras-overview', 'vedic-vs-western-astrology'];

  for (const slug of SAMPLES) {
    test(`/learn/${slug} renders the question H1 and full JSON-LD set`, async ({ page }) => {
      const article = LEARN_ARTICLES.find((a) => a.slug === slug)!;
      await page.goto(`/learn/${slug}`);

      await expect(page.locator('h1')).toContainText(article.hero.headline);
      // The snippet-optimal first answer paragraph is server-rendered.
      await expect(
        page.locator('article, main').first(),
      ).toContainText(article.sections[0].paragraphs[0].slice(0, 60));

      const blocks = await jsonLdBlocks(page);
      expect(byType(blocks, 'Article')).toHaveLength(1);
      expect(byType(blocks, 'BreadcrumbList')).toHaveLength(1);
      expect(byType(blocks, 'FAQPage')).toHaveLength(1);

      const [definedTerm] = byType(blocks, 'DefinedTerm');
      expect(definedTerm, 'every article must emit DefinedTerm').toBeTruthy();
      expect(definedTerm.name).toBe(article.definedTerm!.term);
      const termSet = definedTerm.inDefinedTermSet as Record<string, unknown>;
      expect(String(termSet['@id'])).toMatch(/\/learn#glossary$/);

      if (article.howTo) {
        const [howTo] = byType(blocks, 'HowTo');
        expect(howTo, `${slug} defines howTo so HowTo JSON-LD must render`).toBeTruthy();
        const steps = howTo.step as { position: number; text: string }[];
        expect(steps.map((s) => s.position)).toEqual(
          article.howTo.steps.map((_, i) => i + 1),
        );

        // C13/C19: the HowTo steps must render VISIBLY, not just in JSON-LD.
        // The steps are the only decimal-ordered list on the page (breadcrumb
        // is a flex <ol>, related/bullets are <ul>). Exactly one <li> per step,
        // each visible — a truncating component would fail this.
        const stepItems = page.locator('ol.list-decimal > li');
        await expect(stepItems).toHaveCount(article.howTo.steps.length);
        for (let i = 0; i < article.howTo.steps.length; i++) {
          await expect(stepItems.nth(i)).toBeVisible();
        }
      }

      // FAQPage mirrors the visible FAQ copy (single-source rule).
      const [faq] = byType(blocks, 'FAQPage');
      const questions = (faq.mainEntity as { name: string }[]).map((q) => q.name);
      expect(questions).toEqual(article.faqs.map((f) => f.q));
      // JSON-LD ↔ visible-copy parity: EVERY question must render visibly, not
      // just the first couple — a component that truncated the list would fail.
      for (const q of questions) {
        await expect(page.getByText(q, { exact: true }).first()).toBeVisible();
      }
      // And the visible FAQ item count must equal the registry length (the FAQ
      // <dl> is the only `divide-y` list; the DefinedTerm <dl> is not).
      await expect(page.locator('dl.divide-y > div')).toHaveCount(article.faqs.length);
    });
  }

  test('articles cross-link their tool pages and siblings', async ({ page }) => {
    await page.goto('/learn/rahu-kaal');
    await expect(page.locator('a[href="/panchang"]').first()).toBeVisible();
    await expect(
      page.locator('a[href="/learn/panchang-explained"], a[href="/learn/choosing-muhurat"]').first(),
    ).toBeVisible();
  });
});

test.describe('discovery surfaces agree with the registry', () => {
  test('sitemap.xml contains every /learn article URL', async ({ page }) => {
    const res = await page.request.get('/sitemap.xml');
    expect(res.ok()).toBe(true);
    const xml = await res.text();
    for (const slug of listArticleSlugs()) {
      expect(xml).toContain(`/learn/${slug}</loc>`);
    }
  });

  test('llms.txt cites every /learn article', async ({ page }) => {
    const res = await page.request.get('/llms.txt');
    expect(res.ok()).toBe(true);
    const txt = await res.text();
    for (const slug of listArticleSlugs()) {
      expect(txt).toContain(`https://www.myastro360.com/learn/${slug}`);
    }
  });
});

test.describe('Service JSON-LD on tool pages', () => {
  const TOOL_PAGES = [
    '/kundli',
    '/matching',
    '/panchang',
    '/muhurat',
    '/numerology',
    '/tarot',
    '/palmistry',
    '/vastu',
    '/horoscope',
  ];

  for (const path of TOOL_PAGES) {
    test(`${path} emits a Service tied to the Organization`, async ({ page }) => {
      await page.goto(path);
      const blocks = await jsonLdBlocks(page);
      const [service] = byType(blocks, 'Service');
      expect(service, `${path} must emit Service JSON-LD`).toBeTruthy();
      expect(service.serviceType).toBeTruthy();
      expect(String(service.url)).toContain(path);
      const provider = service.provider as Record<string, unknown>;
      expect(String(provider['@id'])).toMatch(/#organization$/);
      expect(service.areaServed).toContain('India');
    });
  }
});

test.describe('localized landing FAQs (no English leakage)', () => {
  test('English /horoscope/aries FAQ is unchanged and single-sourced', async ({ page }) => {
    await page.goto('/horoscope/aries');
    const blocks = await jsonLdBlocks(page);
    const [faq] = byType(blocks, 'FAQPage');
    const questions = (faq.mainEntity as { name: string }[]).map((q) => q.name);
    expect(questions.some((q) => q.includes('Aries'))).toBe(true);
    await expect(page.getByText(questions[0], { exact: true }).first()).toBeVisible();
  });

  test('/hi/horoscope/aries renders Devanagari FAQs with matching JSON-LD', async ({ page }) => {
    await page.goto('/hi/horoscope/aries');
    const blocks = await jsonLdBlocks(page);
    const [faq] = byType(blocks, 'FAQPage');
    expect(faq, 'localized sign page must emit FAQPage').toBeTruthy();
    const questions = (faq.mainEntity as { name: string }[]).map((q) => q.name);
    expect(questions.length).toBeGreaterThanOrEqual(4);
    // Genuinely localized: Devanagari codepoints present, and the copy is
    // not the raw template (no unsubstituted {tokens}).
    expect(questions.join(' ')).toMatch(/[ऀ-ॿ]/);
    expect(questions.join(' ')).not.toMatch(/\{[a-zA-Z]+\}/);
    await expect(page.getByText(questions[0], { exact: true }).first()).toBeVisible();
  });

  test('/ta/panchang/chennai renders localized page but no self-orphaning FAQPage', async ({ page }) => {
    // Panchang FAQ gating: a locale OUTSIDE PANCHANG_SITEMAP_LOCALES (only
    // en + long-form-template locales qualify; ta has neither) must render the
    // data-table-only path. Emitting a standalone FAQ block + FAQPage there
    // would be a self-orphaning thin page — indexable content with no sitemap
    // entry and hreflang that omits it — so no FAQPage is expected.
    await page.goto('/ta/panchang/chennai');
    const blocks = await jsonLdBlocks(page);
    // Still a real, indexable page: Article JSON-LD is always emitted.
    expect(byType(blocks, 'Article'), 'city page must still emit Article JSON-LD').toHaveLength(1);
    // But no FAQPage for a non-sitemap locale.
    expect(byType(blocks, 'FAQPage'), 'non-sitemap locale must not emit FAQPage').toHaveLength(0);
    // And the page is genuinely localized (Tamil H1), not English-leaking.
    const h1 = page.locator('h1');
    await expect(h1).toBeVisible();
    expect(await h1.innerText()).toMatch(/[஀-௿]/); // Tamil block
  });

  test('/hi/panchang/mumbai keeps the richer per-city content path (no double FAQ)', async ({ page }) => {
    await page.goto('/hi/panchang/mumbai');
    const blocks = await jsonLdBlocks(page);
    expect(byType(blocks, 'FAQPage'), 'exactly one FAQPage block').toHaveLength(1);
  });
});
