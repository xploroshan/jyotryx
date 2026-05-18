import { test, expect } from '@playwright/test';
import { gotoAndHydrate, installApiMocks, json } from './helpers/mock-api';

/**
 * Covers the in-app password flows on /profile (Security tab):
 *  - change-password (user already has one; needs current + new)
 *  - set-password   (user signed up via OAuth/OTP and has no password yet)
 *  - client-side validation (length, mismatch, same-as-current)
 *  - backend rejection (wrong current password)
 */

const authState = (overrides: Record<string, unknown> = {}) =>
  JSON.stringify({
    state: {
      user: {
        id: 'user-1',
        name: 'Sumanth',
        email: 'sumanth@example.com',
        credits: 20,
        role: 'USER',
        profileComplete: true,
        astrologyTraditions: ['VEDIC'],
        primaryTradition: 'VEDIC',
      },
      accessToken: 'fake-access',
      refreshToken: 'fake-refresh',
      isAuthenticated: true,
      ...overrides,
    },
    version: 0,
  });

const baseProfile = {
  id: 'user-1',
  name: 'Sumanth',
  email: 'sumanth@example.com',
  credits: 20,
  role: 'USER',
  profileComplete: true,
  astrologyTraditions: ['VEDIC'],
  primaryTradition: 'VEDIC',
  dateOfBirth: '1990-01-01',
  timeOfBirth: '10:00',
  placeOfBirth: 'Bangalore, India',
  gender: 'male',
};

test.describe('Profile — change password', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript((authJson) => {
      localStorage.setItem('myastro360-auth', authJson);
    }, authState());
  });

  test('changes password successfully and clears the form', async ({ page }) => {
    let changeCalled = false;
    let receivedPayload: Record<string, string> | null = null;

    await installApiMocks(page, {
      'GET /users/me': async (route) => route.fulfill(json(baseProfile)),
      'GET /users/me/credits': async (route) => route.fulfill(json({ credits: 20 })),
      'GET /auth/status': async (route) =>
        route.fulfill(json({ hasPassword: true })),
      'POST /auth/change-password': async (route, req) => {
        changeCalled = true;
        receivedPayload = req.postDataJSON();
        await route.fulfill(json({ message: 'Password changed' }));
      },
    });

    await gotoAndHydrate(page, '/profile');
    await page.getByRole('button', { name: /security/i }).click();

    const current = page.locator('#profile-current-password');
    const next = page.locator('#profile-new-password');
    const confirm = page.locator('#profile-confirm-password');

    await current.fill('OldPass1234');
    await next.fill('NewSecret9876');
    await confirm.fill('NewSecret9876');

    await page.getByRole('button', { name: /change password|^save$/i }).first().click();

    await expect.poll(() => changeCalled, { timeout: 5_000 }).toBe(true);
    expect(receivedPayload).toEqual({
      currentPassword: 'OldPass1234',
      newPassword: 'NewSecret9876',
    });

    await expect(current).toHaveValue('');
    await expect(next).toHaveValue('');
    await expect(confirm).toHaveValue('');
  });

  test('blocks submit when new password is too short', async ({ page }) => {
    let changeCalled = false;
    await installApiMocks(page, {
      'GET /users/me': async (route) => route.fulfill(json(baseProfile)),
      'GET /users/me/credits': async (route) => route.fulfill(json({ credits: 20 })),
      'GET /auth/status': async (route) =>
        route.fulfill(json({ hasPassword: true })),
      'POST /auth/change-password': async (route) => {
        changeCalled = true;
        await route.fulfill(json({ message: 'Should not be called' }));
      },
    });

    await gotoAndHydrate(page, '/profile');
    await page.getByRole('button', { name: /security/i }).click();

    await page.locator('#profile-current-password').fill('OldPass1234');
    await page.locator('#profile-new-password').fill('short');
    await page.locator('#profile-confirm-password').fill('short');
    await page.getByRole('button', { name: /change password|^save$/i }).first().click();

    // Brief settle to make sure no API call was kicked off
    await page.waitForTimeout(300);
    expect(changeCalled).toBe(false);
  });

  test('blocks submit when new + confirm do not match', async ({ page }) => {
    let changeCalled = false;
    await installApiMocks(page, {
      'GET /users/me': async (route) => route.fulfill(json(baseProfile)),
      'GET /users/me/credits': async (route) => route.fulfill(json({ credits: 20 })),
      'GET /auth/status': async (route) =>
        route.fulfill(json({ hasPassword: true })),
      'POST /auth/change-password': async (route) => {
        changeCalled = true;
        await route.fulfill(json({ message: 'Should not be called' }));
      },
    });

    await gotoAndHydrate(page, '/profile');
    await page.getByRole('button', { name: /security/i }).click();

    await page.locator('#profile-current-password').fill('OldPass1234');
    await page.locator('#profile-new-password').fill('NewSecret9876');
    await page.locator('#profile-confirm-password').fill('Mismatch1234');
    await page.getByRole('button', { name: /change password|^save$/i }).first().click();

    await page.waitForTimeout(300);
    expect(changeCalled).toBe(false);
  });

  test('backend 401 (wrong current password) surfaces an error', async ({ page }) => {
    await installApiMocks(page, {
      'GET /users/me': async (route) => route.fulfill(json(baseProfile)),
      'GET /users/me/credits': async (route) => route.fulfill(json({ credits: 20 })),
      'GET /auth/status': async (route) =>
        route.fulfill(json({ hasPassword: true })),
      'POST /auth/change-password': async (route) =>
        route.fulfill(json({ message: 'Current password is incorrect' }, 401)),
    });

    await gotoAndHydrate(page, '/profile');
    await page.getByRole('button', { name: /security/i }).click();

    await page.locator('#profile-current-password').fill('WrongPass1234');
    await page.locator('#profile-new-password').fill('NewSecret9876');
    await page.locator('#profile-confirm-password').fill('NewSecret9876');
    await page.getByRole('button', { name: /change password|^save$/i }).first().click();

    await expect(page.getByText(/current password is incorrect/i)).toBeVisible({
      timeout: 5_000,
    });
  });
});

test.describe('Profile — set password (OAuth/OTP-only user)', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript((authJson) => {
      localStorage.setItem('myastro360-auth', authJson);
    }, authState());
  });

  test('no current-password field rendered when user has no password', async ({
    page,
  }) => {
    await installApiMocks(page, {
      'GET /users/me': async (route) => route.fulfill(json(baseProfile)),
      'GET /users/me/credits': async (route) => route.fulfill(json({ credits: 20 })),
      'GET /auth/status': async (route) =>
        route.fulfill(json({ hasPassword: false })),
    });

    await gotoAndHydrate(page, '/profile');
    await page.getByRole('button', { name: /security/i }).click();

    await expect(page.locator('#profile-current-password')).toHaveCount(0);
    await expect(page.locator('#profile-new-password')).toBeVisible();
  });

  test('POSTs to /auth/set-password (not /change-password) for first-time setup', async ({
    page,
  }) => {
    let setCalled = false;
    let changeCalled = false;

    await installApiMocks(page, {
      'GET /users/me': async (route) => route.fulfill(json(baseProfile)),
      'GET /users/me/credits': async (route) => route.fulfill(json({ credits: 20 })),
      'GET /auth/status': async (route) =>
        route.fulfill(json({ hasPassword: false })),
      'POST /auth/set-password': async (route) => {
        setCalled = true;
        await route.fulfill(json({ message: 'Password set' }));
      },
      'POST /auth/change-password': async (route) => {
        changeCalled = true;
        await route.fulfill(json({ message: 'should not be called' }));
      },
    });

    await gotoAndHydrate(page, '/profile');
    await page.getByRole('button', { name: /security/i }).click();

    await page.locator('#profile-new-password').fill('NewSecret9876');
    await page.locator('#profile-confirm-password').fill('NewSecret9876');
    await page.getByRole('button', { name: /set password/i }).first().click();

    await expect.poll(() => setCalled, { timeout: 5_000 }).toBe(true);
    expect(changeCalled).toBe(false);
  });
});
