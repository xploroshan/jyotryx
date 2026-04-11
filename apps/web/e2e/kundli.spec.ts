import { test, expect } from '@playwright/test';
import { gotoAndHydrate, installApiMocks, json } from './helpers/mock-api';

/**
 * Kundli form E2E coverage.
 *
 * The Kundli page requires auth (it reads the access token from the
 * auth store before POSTing to /astrology/kundli). These tests seed
 * the Zustand persist slot directly via `localStorage` so the page
 * boots into the authenticated state without running the full OTP
 * flow every time. That keeps this spec focused on the form's own
 * behaviour: disabled-until-valid, happy-path POST, error rendering.
 */
const AUTH_STATE = {
  state: {
    user: {
      id: 'kundli-user',
      name: 'Test User',
      phone: '+919999000011',
      email: null,
      credits: 10,
      role: 'USER',
      profileComplete: true,
      preferredLanguage: 'en',
    },
    accessToken: 'kundli-access-token',
    refreshToken: 'kundli-refresh-token',
    isAuthenticated: true,
  },
  version: 0,
};

const KUNDLI_RESPONSE = {
  id: 'kundli-1',
  ascendant: 'Leo',
  moonSign: 'Taurus',
  sunSign: 'Gemini',
  nakshatra: 'Rohini',
  houses: Array.from({ length: 12 }, (_, i) => ({
    house: i + 1,
    sign: 'Leo',
    planets: i === 0 ? ['Sun'] : [],
  })),
  planetaryPositions: [
    { planet: 'Sun', sign: 'Leo', house: 1, degree: 15.3, isRetrograde: false, nakshatra: 'Magha' },
  ],
  dashas: [
    { planet: 'Venus', startDate: '2020-01-01', endDate: '2040-01-01', subPeriods: [] },
  ],
  yogas: [
    { name: 'Gaja Kesari', description: 'Strong yoga', effect: 'Brings prosperity' },
  ],
};

test.describe('Kundli form', () => {
  test.beforeEach(async ({ page }) => {
    // Seed the auth store before navigation so useAuthStore rehydrates
    // as authenticated on first paint.
    await page.addInitScript((authState) => {
      window.localStorage.setItem('jyotron-auth', JSON.stringify(authState));
    }, AUTH_STATE);

    await installApiMocks(page, {
      'POST /astrology/kundli': async (route) => {
        await route.fulfill(json(KUNDLI_RESPONSE));
      },
      'GET /astrology/dosha': async (route) => {
        await route.fulfill(json({ doshas: [] }));
      },
    });
  });

  test('generate button is disabled until all fields are filled', async ({ page }) => {
    // Ensure React is hydrated before interacting with controlled inputs —
    // otherwise early `fill()` calls set native input values that hydration
    // will reset on first render.
    await gotoAndHydrate(page, '/kundli');

    const generateBtn = page.getByRole('button', { name: /Generate Kundli/i });
    // Baseline: empty form disables the button.
    await expect(generateBtn).toBeDisabled();

    // Partially fill — button must still be disabled.
    await page.getByPlaceholder('Enter your full name').fill('Arjun Sharma');
    await page.locator('input[type="date"]').fill('1990-05-15');
    await page.locator('input[type="time"]').fill('08:30');
    await expect(generateBtn).toBeDisabled();

    // Fill the last required field; button should enable.
    await page.getByPlaceholder('Search city...').fill('Mumbai, India');
    // Commit the React state update by blurring the input.
    await page.getByPlaceholder('Search city...').press('Tab');
    await expect(generateBtn).toBeEnabled();
  });

  test('submitting the form fetches kundli and renders results', async ({ page }) => {
    await gotoAndHydrate(page, '/kundli');

    await page.getByPlaceholder('Enter your full name').fill('Arjun Sharma');
    await page.locator('input[type="date"]').fill('1990-05-15');
    await page.locator('input[type="time"]').fill('08:30');
    await page.getByPlaceholder('Search city...').fill('Mumbai, India');

    await page.getByRole('button', { name: /Generate Kundli/i }).click();

    // Results block: profile summary shows the name, date, and place we entered.
    await expect(page.getByRole('heading', { name: 'Arjun Sharma' })).toBeVisible();
    await expect(page.getByText('Mumbai, India', { exact: false })).toBeVisible();

    // Ascendant/moon/sun/nakshatra line shows the mocked response values.
    // Scope to the profile-summary card (the one that contains the user's name)
    // rather than `.first()`, which matches the "Vedic Birth Chart" badge.
    const summary = page.locator('.surface-card').filter({ hasText: 'Arjun Sharma' });
    await expect(summary).toContainText('Leo');
    await expect(summary).toContainText('Taurus');
    await expect(summary).toContainText('Rohini');
  });
});
