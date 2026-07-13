import { test, expect } from '@playwright/test';
import { gotoAndHydrate, installApiMocks } from './helpers/mock-api';

/**
 * i18n switcher E2E coverage.
 *
 * The i18n store uses Zustand with `persist`, so a language change on
 * one route must survive a hard reload AND carry over to a different
 * route. This is the full-stack version of the unit test that mocks
 * out persist middleware — it catches regressions like localStorage
 * key renames, SSR/CSR mismatch, or the Navbar failing to rerender
 * after a locale switch.
 *
 * Languages covered: en → hi (Hindi). Hi is the most diverged locale
 * from En and has the most aggressive translation coverage, so if it
 * works, the other 10 locales almost certainly work too.
 */
test.describe('Language switcher', () => {
  test.beforeEach(async ({ page }) => {
    await installApiMocks(page);
  });

  test('switching to Hindi updates home page hero and persists across reload', async ({
    page,
  }) => {
    await gotoAndHydrate(page, '/');

    // Baseline: English hero copy is visible.
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Your stars');

    // Open the navbar language dropdown. The trigger shows the active code,
    // default "EN", and clicking reveals the menu with native names.
    // .first() — the page also renders a <nav> LanguageLinkRow ("other languages").
    const navbar = page.locator('nav').first();
    await navbar.getByRole('button', { name: /^EN/ }).click();

    // Select Hindi. Since SEO PR 1 the option is a LINK when the current page
    // has a localized equivalent — switching NAVIGATES to /hi (localized SSR
    // HTML), with the store write riding along for persistence.
    await navbar.getByRole('link', { name: 'हिन्दी' }).click();
    await expect(page).toHaveURL(/\/hi$/);

    // Hero renders in Hindi — "आपके सितारे," from hi.ts.
    await expect(page.getByRole('heading', { level: 1 })).toContainText('आपके सितारे');

    // Hard reload and confirm the choice persisted.
    await page.reload();
    await expect(page.getByRole('heading', { level: 1 })).toContainText('आपके सितारे');

    // Navigate to a different route — locale still applies.
    await gotoAndHydrate(page, '/numerology');
    // The i18n store rehydrates from localStorage client-side, so wait for
    // the Hindi translation to render before asserting.
    await expect(page.getByText('नाम विश्लेषण')).toBeVisible();
  });

  test('language trigger shows the currently active code', async ({ page }) => {
    await gotoAndHydrate(page, '/');
    // .first() — the page also renders a <nav> LanguageLinkRow ("other languages").
    const navbar = page.locator('nav').first();

    // Starts on EN.
    await expect(navbar.getByRole('button', { name: /^EN/ })).toBeVisible();

    // Switch to Hindi (a link — navigates to /hi), trigger label updates to "हि".
    await navbar.getByRole('button', { name: /^EN/ }).click();
    await navbar.getByRole('link', { name: 'हिन्दी' }).click();
    await expect(navbar.getByRole('button', { name: /^हि/ })).toBeVisible();
  });
});
