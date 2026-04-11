import { test, expect } from '@playwright/test';
import { installApiMocks } from './helpers/mock-api';

/**
 * Navigation smoke tests — the "is the web app still wired up correctly"
 * safety net. Exercises the home page hero, the feature grid links, and
 * the primary routes linked from the navbar. Catches regressions like:
 *
 *   - A new Next.js upgrade breaking `next/link` client navigation
 *   - A refactor removing a nav feature link without removing its page
 *   - An i18n key being renamed without updating the default locale map
 *
 * No backend required — the pages under test don't fetch anything until
 * the user interacts, and the interaction-triggered fetches are handled
 * in the feature-specific spec files.
 */
test.describe('Navigation smoke', () => {
  test.beforeEach(async ({ page }) => {
    await installApiMocks(page);
  });

  test('home page renders hero, badge, and CTA buttons', async ({ page }) => {
    await page.goto('/');

    // Badge in the hero. `Vedic astrology platform` also appears (lowercase)
    // in the footer tagline/subtitle, so scope the match to the hero badge
    // via its exact casing + surrounding dot element.
    await expect(page.getByText('Vedic Astrology Platform', { exact: true })).toBeVisible();

    // Hero headline — "Your stars," + "decoded by Jyotron"
    const hero = page.getByRole('heading', { level: 1 });
    await expect(hero).toContainText('Your stars');
    await expect(hero).toContainText('decoded by Jyotron');

    // Primary CTAs
    await expect(page.getByRole('link', { name: 'Start Consultation' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Try Palm Reading' })).toBeVisible();
  });

  test('home page shows feature grid with 14 feature cards', async ({ page }) => {
    await page.goto('/');

    // Features section headline
    await expect(page.getByRole('heading', { name: /Everything you need for/i })).toBeVisible();

    // Each feature title is unique in the grid.
    const expectedFeatures = [
      'Astrologer Chat',
      'Palmistry Reading',
      'Kundli Generator',
      'Daily Horoscope',
      'Kundli Matching',
      'Muhurat Finder',
      'Daily Panchang',
      'Dosha Analysis',
      'My Day',
      'Numerology',
      'Tarot Reading',
      'Vastu Shastra',
      'KP Astrology',
      'Divisional Charts',
    ];
    for (const label of expectedFeatures) {
      await expect(page.getByRole('heading', { level: 3, name: label })).toBeVisible();
    }
  });

  test('clicking a feature card navigates to the feature route', async ({ page }) => {
    await page.goto('/');

    // Click Numerology — one of the fully static, no-auth pages.
    await page.getByRole('heading', { level: 3, name: 'Numerology' }).click();
    await expect(page).toHaveURL(/\/numerology$/);
    await expect(page.getByRole('heading', { name: /Numerology/ })).toBeVisible();
  });

  test('kundli page mounts with the birth-details form', async ({ page }) => {
    await page.goto('/kundli');
    await expect(page.getByRole('heading', { name: /Enter Birth Details/i })).toBeVisible();
    await expect(page.getByPlaceholder('Enter your full name')).toBeVisible();
  });

  test('auth page mounts with login/signup tabs and Google button', async ({ page }) => {
    await page.goto('/auth');
    // Tabs live inside the card; scope to the form container to avoid matching
    // the navbar "Log in" link that appears on every page.
    const card = page.locator('.surface-card').first();
    await expect(card.getByRole('button', { name: 'Log in', exact: true })).toBeVisible();
    await expect(card.getByRole('button', { name: 'Sign up', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: /Continue with Google/i })).toBeVisible();
  });
});
