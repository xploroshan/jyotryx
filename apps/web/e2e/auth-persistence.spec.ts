import { test, expect } from '@playwright/test';
import { gotoAndHydrate, installApiMocks, json } from './helpers/mock-api';

/**
 * Regression guard for the "logs me out every time" bug.
 *
 * The auth state is persisted to localStorage via Zustand's persist
 * middleware. Before this fix, AuthGuard/ProfileGate and several page
 * components checked `isAuthenticated` synchronously on mount — but the
 * persist middleware rehydrates asynchronously, so during the tiny
 * window before rehydration completes `isAuthenticated` was false and
 * the gate redirected the user to /auth on every hard refresh.
 *
 * The fix introduces an `isHydrated` flag on the store that's flipped
 * to true inside `onRehydrateStorage`. Route gates now wait for it
 * before running the `!isAuthenticated → /auth` redirect.
 */

const authState = JSON.stringify({
  state: {
    user: {
      id: 'persisted-user',
      name: 'Sumanth',
      email: 'sumanth@example.com',
      credits: 20,
      role: 'USER',
      profileComplete: true,
      astrologyTraditions: ['VEDIC'],
      primaryTradition: 'VEDIC',
    },
    accessToken: 'fake-token',
    refreshToken: 'fake-refresh',
    isAuthenticated: true,
  },
  version: 0,
});

test.describe('Auth persists across reload and navigation', () => {
  test.beforeEach(async ({ page }) => {
    await installApiMocks(page, {
      'GET /daily-briefing': async (route) =>
        route.fulfill(
          json({
            greeting: 'Good Morning, Sumanth!',
            date: '2026-04-22',
            dayQuality: 'good',
            summary: 'A favorable day.',
            doList: [],
            avoidList: [],
            planetaryHours: [],
            currentHora: null,
            luckyColor: 'Emerald Green',
            luckyNumber: 8,
            luckyTime: '11:00 AM - 12:00 PM',
            professionInsight: '',
            remedy: '',
            mantra: 'Om Budhaya Namaha',
            panchang: {
              tithi: 'Shukla Shashthi',
              nakshatra: 'Dhanishta',
              yoga: 'Vyaghata',
              vara: 'Budhvaar',
              rahukaal: '12:00 PM - 01:30 PM',
            },
            transitAlert: null,
          }),
        ),
      'GET /users/me': async (route) =>
        route.fulfill(
          json({
            id: 'persisted-user',
            name: 'Sumanth',
            email: 'sumanth@example.com',
            credits: 20,
            profileComplete: true,
            astrologyTraditions: ['VEDIC'],
            primaryTradition: 'VEDIC',
            dateOfBirth: '1990-01-01',
            timeOfBirth: '10:00',
            placeOfBirth: 'Bangalore, India',
            gender: 'male',
          }),
        ),
      'GET /users/me/credits': async (route) =>
        route.fulfill(json({ credits: 20 })),
      'GET /auth/status': async (route) =>
        route.fulfill(json({ hasPassword: true })),
      'GET /reports': async (route) => route.fulfill(json([])),
    });
    await page.addInitScript((authJson) => {
      localStorage.setItem('myastro360-auth', authJson);
    }, authState);
  });

  test('hard refresh on /my-day does not bounce user to /auth', async ({
    page,
  }) => {
    await gotoAndHydrate(page, '/my-day');

    // Greeting fetched from the briefing — proves we stayed on /my-day.
    await expect(page.getByRole('heading', { level: 1 })).toContainText(
      'Sumanth',
      { timeout: 10_000 },
    );
    await expect(page).toHaveURL(/\/my-day$/);

    // Hard reload — previously this bounced to /auth before the fix.
    await page.reload();
    await expect(page).toHaveURL(/\/my-day$/);
    await expect(page.getByRole('heading', { level: 1 })).toContainText(
      'Sumanth',
      { timeout: 10_000 },
    );
  });

  test('navigating between protected pages does not re-auth the user', async ({
    page,
  }) => {
    await gotoAndHydrate(page, '/my-day');
    await expect(page).toHaveURL(/\/my-day$/);

    await gotoAndHydrate(page, '/reports');
    await expect(page).toHaveURL(/\/reports$/);

    await gotoAndHydrate(page, '/profile');
    await expect(page).toHaveURL(/\/profile$/);

    // Landing on /my-day after touring other protected pages — session held.
    await gotoAndHydrate(page, '/my-day');
    await expect(page).toHaveURL(/\/my-day$/);
  });

  test('unauthenticated visitor to /my-day is still redirected to /auth', async ({
    page,
    context,
  }) => {
    // Wipe the injected auth state so the rehydration finishes with a
    // logged-out store. The gate should still redirect — the fix only
    // delays the redirect until rehydration completes, not disable it.
    await context.clearCookies();
    await page.addInitScript(() => {
      localStorage.removeItem('myastro360-auth');
    });
    await page.goto('/my-day');
    await expect(page).toHaveURL(/\/auth/, { timeout: 10_000 });
  });
});
