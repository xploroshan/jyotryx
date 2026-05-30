import { test, expect } from '@playwright/test';
import { installApiMocks, gotoAndHydrate } from './helpers/mock-api';

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

    // Badge in the hero. It renders with a leading em-dash ("— Vedic Astrology
    // Platform"), so an exact match misses it; a substring match scoped to the
    // first occurrence (the hero badge precedes the footer tagline in the DOM)
    // is the stable assertion.
    await expect(page.getByText('Vedic Astrology Platform').first()).toBeVisible();

    // Hero headline — "Your stars," + "decoded by myastro360". The visible
    // text is split into per-character animation spans (and "myastro360" onto
    // its own line), so it has no space before the brand; assert against the
    // h1's aria-label, which carries the full, clean phrase.
    await expect(page.getByRole('heading', { level: 1 })).toHaveAttribute(
      'aria-label',
      /Your stars.*decoded by myastro360/,
    );

    // Primary CTAs
    await expect(page.getByRole('link', { name: 'Start Consultation' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Try Palm Reading' })).toBeVisible();
  });

  test('home page renders the bento summary logged-out variant', async ({ page }) => {
    await page.goto('/');

    // BentoSummary's logged-out state renders a headline card with
    // "decoded by myastro360" (`t.home.heroHighlight`) plus a "Get Started
    // Free" signup link. Replaces the earlier "14 feature cards" expect
    // — the grid was redesigned to a curated bento summary anchored
    // around My Day. The hero also contains "decoded by myastro360", so
    // scope the h3 lookup (it's a <h3>, not the <h1> hero headline).
    await expect(page.getByText('Favorable Today')).toBeVisible();
    await expect(page.getByRole('heading', { level: 3, name: 'decoded by myastro360' })).toBeVisible();
    await expect(page.getByRole('link', { name: /Get Started Free/i }).first()).toBeVisible();

    // The mantra card at the bottom of the bento grid is always rendered.
    // Text is `ओं नमः शिवाय`
    // ("ओं नमः शिवाय" — U+0913+U+0902, not the combined U+0950 ligature).
    await expect(page.getByText('ओं नमः शिवाय')).toBeVisible();
  });

  test('feature rail above the fold links every Vedic feature', async ({ page }) => {
    // The feature bar (FeatureBarV2, under the navbar) renders only when a
    // tradition is active — it's driven by the route on a tradition page and
    // by the remembered/primary tradition elsewhere, so it is NOT shown on a
    // logged-out `/`. The Vedic tradition page is where its rail appears, so
    // that's what we exercise here. Each feature is a <Link>; labels come from
    // `t.traditionsUi.vedic.features.*`. Some also appear in the footer list,
    // so we use `.first()` to stay scoped to the rail (it renders earlier).
    await page.goto('/vedic');
    const expected = [
      'Chat with Astrologer',
      'Kundli',
      'Kundli Matching',
      'Horoscope',
      'Panchang',
      'Muhurat',
      'Dasha Periods',
      'Dosha Check',
      'Divisional Charts',
      'KP Astrology',
      'Palmistry',
      'Numerology',
      'Tarot',
      'Vastu',
    ];
    for (const label of expected) {
      await expect(page.getByRole('link', { name: label, exact: true }).first()).toBeVisible();
    }
  });

  test('feature chip exposes the correct href to /numerology', async ({ page }) => {
    // We can't reliably click-through to the feature page in dev mode —
    // Next.js 15 + Framer Motion's `motion.li` tap wrapper interact
    // oddly in headless Chromium (the click fires but Next's router
    // treats it as a no-op navigation back to `/`; reproducible across
    // getByRole, href-locator, and forced-click variants). Instead we
    // verify the contract: the rail renders an anchor with the right
    // href. The actual /numerology route rendering is covered by
    // numerology.spec.ts (direct navigation).
    // The feature bar only renders with an active tradition (see the test
    // above), so exercise it on the Vedic tradition page.
    await gotoAndHydrate(page, '/vedic');
    const chip = page.getByRole('link', { name: 'Numerology', exact: true }).first();
    await expect(chip).toHaveAttribute('href', '/numerology');
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
    await expect(card.getByRole('tab', { name: 'Log in', exact: true })).toBeVisible();
    await expect(card.getByRole('tab', { name: 'Sign up', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: /Continue with Google/i })).toBeVisible();
  });
});
