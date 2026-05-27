/**
 * Regression tests for the "Remember me" checkbox on /auth.
 *
 *  - When ticked + login succeeds, the email is persisted to
 *    localStorage and pre-filled on the next visit.
 *  - When un-ticked + login succeeds, any stored email is cleared.
 *  - First-time visitor (no stored email) sees the box unchecked.
 *
 * The password is intentionally not stored — the browser's
 * password manager handles it via the input's autoComplete
 * attribute. Nothing to test client-side beyond that.
 */
import { test, expect } from '@playwright/test';
import { installApiMocks, json } from './helpers/mock-api';

const authedResponse = (overrides: Record<string, unknown> = {}) => ({
  user: {
    id: 'remember-user',
    name: 'Sumanth Rosh',
    email: 'sumanth@example.com',
    credits: 10,
    role: 'USER',
    profileComplete: true,
    astrologyTraditions: ['VEDIC'],
    primaryTradition: 'VEDIC',
    ...overrides,
  },
  tokens: {
    accessToken: 'fake-access',
    refreshToken: 'fake-refresh',
    expiresIn: '15m',
  },
});

const STORE_KEY = 'myastro360.rememberedEmail';

test.describe('Auth — Remember me', () => {
  test('checked: persists email and pre-fills next visit', async ({ page }) => {
    await installApiMocks(page, {
      'POST /auth/login': async (route) => route.fulfill(json(authedResponse())),
      'GET /users/me': async (route) => route.fulfill(json({})),
      'GET /users/me/credits': async (route) => route.fulfill(json({ credits: 10 })),
      'GET /health': async (route) => route.fulfill(json({ status: 'ok' })),
    });

    await page.goto('/auth?mode=login', { waitUntil: 'domcontentloaded' });
    await page.getByRole('tab', { name: /^email$/i }).click();

    // First visit — no stored email; checkbox should be unchecked.
    const checkbox = page.locator('input[type="checkbox"]', { hasText: /remember/i }).first().or(
      page.getByLabel(/remember me/i),
    );
    await expect(checkbox).not.toBeChecked();

    await page.locator('#auth-email').fill('sumanth@example.com');
    await page.locator('#auth-password').fill('CorrectHorse9!');
    await checkbox.check();
    await page.getByRole('button', { name: /^log in$/i }).click();

    // Wait for navigation away from /auth (login succeeds).
    await page.waitForURL(/(my-day|profile|\/$)/, { timeout: 10_000 });

    const stored = await page.evaluate((k) => localStorage.getItem(k), STORE_KEY);
    expect(stored).toBe('sumanth@example.com');

    // Revisit /auth — email should pre-fill, box pre-checked.
    await page.evaluate(() => localStorage.removeItem('myastro360-auth'));
    await page.goto('/auth?mode=login', { waitUntil: 'domcontentloaded' });
    await page.getByRole('tab', { name: /^email$/i }).click();
    await expect(page.locator('#auth-email')).toHaveValue('sumanth@example.com');
    await expect(page.getByLabel(/remember me/i)).toBeChecked();
  });

  test('unchecked: clears stored email on next successful login', async ({ page }) => {
    await page.addInitScript((k) => {
      localStorage.setItem(k, 'old@example.com');
    }, STORE_KEY);
    await installApiMocks(page, {
      'POST /auth/login': async (route) => route.fulfill(json(authedResponse())),
      'GET /users/me': async (route) => route.fulfill(json({})),
      'GET /users/me/credits': async (route) => route.fulfill(json({ credits: 10 })),
      'GET /health': async (route) => route.fulfill(json({ status: 'ok' })),
    });

    await page.goto('/auth?mode=login', { waitUntil: 'domcontentloaded' });
    await page.getByRole('tab', { name: /^email$/i }).click();

    // Stored email pre-fills the field and pre-checks the box.
    await expect(page.locator('#auth-email')).toHaveValue('old@example.com');
    await expect(page.getByLabel(/remember me/i)).toBeChecked();

    // Untick + log in with a different account.
    await page.locator('#auth-email').fill('sumanth@example.com');
    await page.locator('#auth-password').fill('CorrectHorse9!');
    await page.getByLabel(/remember me/i).uncheck();
    await page.getByRole('button', { name: /^log in$/i }).click();

    await page.waitForURL(/(my-day|profile|\/$)/, { timeout: 10_000 });

    const stored = await page.evaluate((k) => localStorage.getItem(k), STORE_KEY);
    expect(stored).toBeNull();
  });
});
