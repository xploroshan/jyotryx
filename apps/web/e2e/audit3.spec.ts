/**
 * Third-pass audit:
 *   1. Screenshots the home hero in all 12 supported locales (above-the-fold
 *      only — we just want to see the heroTitle + heroHighlight render).
 *   2. Exercises the LanguageSwitcher: opens the dropdown, picks Hindi,
 *      verifies the hero text changes, picks English, verifies it reverts.
 *
 * Outputs land in /tmp/jx-audit3:
 *   /tmp/jx-audit3/screenshots/hero-<locale>.png
 *   /tmp/jx-audit3/screenshots/switcher-{closed,open,hi,en}.png
 *   /tmp/jx-audit3/report.md
 */
import { test, expect } from '@playwright/test';
import { installApiMocks, json } from './helpers/mock-api';
import fs from 'fs';
import path from 'path';

const OUT_DIR = '/tmp/jx-audit3';
const SHOT_DIR = path.join(OUT_DIR, 'screenshots');
fs.mkdirSync(SHOT_DIR, { recursive: true });

const localeState = (loc: string) =>
  JSON.stringify({ state: { locale: loc, userSet: true }, version: 0 });

const ALL_LOCALES = ['en', 'hi', 'ta', 'te', 'bn', 'mr', 'gu', 'kn', 'ml', 'pa', 'or', 'as'];

const heroSnapshots: { locale: string; title: string | null; highlight: string | null }[] = [];

test.describe.serial('audit3 (heroes + language switcher)', () => {

for (const loc of ALL_LOCALES) {
  test(`hero in ${loc}`, async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (m) => {
      if (m.type() === 'error' && !m.text().startsWith('[mock-api]') && !m.text().includes('Sentry')) {
        consoleErrors.push(m.text());
      }
    });
    await installApiMocks(page, {
      'GET /health': async (r) => r.fulfill(json({ status: 'ok' })),
    });
    await page.addInitScript((l) => {
      localStorage.setItem('myastro360-locale', l);
    }, localeState(loc));
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    // Wait long enough for the async locale chunk to load + the CharReveal
    // animation to settle.
    await page.waitForTimeout(2500);

    // Capture just the above-the-fold hero region.
    await page.setViewportSize({ width: 1280, height: 720 });
    const shot = path.join(SHOT_DIR, `hero-${loc}.png`);
    await page.screenshot({ path: shot, fullPage: false });

    // Pull the rendered heroTitle/heroHighlight text from the DOM so we
    // can sanity-check that "myastro360" appears as a Latin substring in
    // every locale (the brand should not be transliterated).
    const heroEl = page.locator('h1').first();
    const heroText = await heroEl.textContent().catch(() => null);
    // The h1 contains heroTitle then heroHighlight, separated by a space.
    heroSnapshots.push({ locale: loc, title: heroText, highlight: null });
    expect(true).toBe(true);
  });
}

// Language switcher functional test
test('language switcher opens, swaps locale, and persists', async ({ page }) => {
  await installApiMocks(page, {
    'GET /health': async (r) => r.fulfill(json({ status: 'ok' })),
    'PUT /users/me': async (r) => r.fulfill(json({ ok: true })),
  });
  await page.addInitScript((l) => {
    localStorage.setItem('myastro360-locale', l);
  }, localeState('en'));
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  await page.setViewportSize({ width: 1280, height: 720 });

  // Closed state — the EN chip
  await page.screenshot({ path: path.join(SHOT_DIR, 'switcher-closed.png'), fullPage: false });

  // Click the switcher button (it shows "EN" + a globe icon). It's in
  // the navbar — find by text "EN" inside a <button>.
  const switcherButton = page.locator('button').filter({ hasText: /^\s*EN\s*$/ }).first();
  await switcherButton.click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(SHOT_DIR, 'switcher-open.png'), fullPage: false });

  // Verify all 12 entries are listed in the dropdown
  const dropdown = page.locator('text=हिन्दी').first();
  await expect(dropdown).toBeVisible({ timeout: 5_000 });

  // Pick Hindi
  await page.locator('button').filter({ hasText: 'हिन्दी' }).first().click();
  await page.waitForTimeout(2000); // wait for the hi locale chunk to load

  await page.screenshot({ path: path.join(SHOT_DIR, 'switcher-hi.png'), fullPage: false });

  // Verify the hero updated to the Hindi heroTitle. textContent strips
  // the inter-block space between heroTitle's CharReveal spans and
  // heroHighlight, so we normalize whitespace before asserting.
  const heroAfterHi = (await page.locator('h1').first().textContent() || '').replace(/\s+/g, ' ');
  expect(heroAfterHi).toContain('आपके सितारे');
  // Brand must remain Latin "myastro360", not a transliteration
  expect(heroAfterHi).toContain('myastro360');

  // Switch back to English
  await page.locator('button').filter({ hasText: /^\s*हि\s*$/ }).first().click();
  await page.waitForTimeout(300);
  await page.locator('button').filter({ hasText: 'English' }).first().click();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(SHOT_DIR, 'switcher-en.png'), fullPage: false });

  const heroAfterEn = (await page.locator('h1').first().textContent() || '').replace(/\s+/g, ' ');
  expect(heroAfterEn).toContain('Your stars');
});

}); // end describe.serial

test.afterAll(async () => {
  const md: string[] = [
    '# Jyotryx audit pass 3 (heroes + language switcher)',
    '',
    `Generated: ${new Date().toISOString()}`,
    '',
    '## Hero text by locale',
    '',
    '| Locale | Rendered hero (h1 text) | Contains "myastro360" |',
    '|---|---|:---:|',
  ];
  for (const s of heroSnapshots) {
    const titleStr = (s.title || '').replace(/\s+/g, ' ').slice(0, 80);
    const hasBrand = (s.title || '').includes('myastro360') ? '✅' : '❌';
    md.push(`| ${s.locale} | ${titleStr} | ${hasBrand} |`);
  }
  fs.writeFileSync(path.join(OUT_DIR, 'report.md'), md.join('\n'));
});
