import { test, expect } from '@playwright/test';
import { gotoAndHydrate, installApiMocks, json, waitForReactHandlers } from './helpers/mock-api';

/**
 * Auth page E2E coverage.
 *
 * Firebase phone auth is explicitly disabled by the webServer env
 * (NEXT_PUBLIC_FIREBASE_API_KEY=''), so the page uses the backend OTP
 * endpoints `/auth/otp/send` and `/auth/otp/verify`. Both are mocked
 * here with deterministic responses, exercising the real React state
 * machine end-to-end: enter phone → send → enter OTP → verify → redirect.
 *
 * The OTP-send response returns `devOtp` (the server sends this only in
 * dev/test mode, per the auth config's `exposeOtpInResponse`). The UI
 * doesn't consume devOtp — it just submits whatever the user types — so
 * we manually type "123456" and the mocked verify handler accepts that.
 */
test.describe('Auth page', () => {
  test.beforeEach(async ({ page }) => {
    await installApiMocks(page, {
      // Wake-up ping fires on auth-page mount; return a quick 200 so the
      // "Waking up the server..." indicator clears.
      'GET /health': async (route) => {
        await route.fulfill(json({ status: 'ok' }));
      },
      'POST /auth/otp/send': async (route) => {
        const body = JSON.parse(route.request().postData() || '{}');
        await route.fulfill(
          json({
            message: 'OTP sent successfully',
            expiresIn: 300,
            devOtp: '123456',
            phone: body.phone,
          }),
        );
      },
      'POST /auth/otp/verify': async (route) => {
        const body = JSON.parse(route.request().postData() || '{}');
        if (body.otp !== '123456') {
          await route.fulfill(json({ message: 'Invalid OTP' }, 400));
          return;
        }
        await route.fulfill(
          json({
            user: {
              id: 'test-user-1',
              name: 'Test User',
              phone: body.phone,
              email: null,
              credits: 10,
              role: 'USER',
              profileComplete: false,
              preferredLanguage: 'en',
            },
            tokens: {
              accessToken: 'test-access-token',
              refreshToken: 'test-refresh-token',
            },
          }),
        );
      },
    });
  });

  test('phone OTP flow: send → enter OTP → verify → redirect', async ({ page }) => {
    // `gotoAndHydrate` waits for React to finish attaching its event
    // listeners. On first compile of /auth in dev mode, `goto` returns
    // before hydration completes and clicks are silently dropped.
    await gotoAndHydrate(page, '/auth?mode=login');

    // Phone method is the default. Enter the 10-digit number.
    const phoneInput = page.getByPlaceholder('Phone number');
    await expect(phoneInput).toBeVisible();
    await phoneInput.fill('9999000011');

    // Click Send OTP
    await page.getByRole('button', { name: /Send OTP/i }).click();

    // OTP input appears
    const otpInput = page.getByPlaceholder('6-digit OTP');
    // Placeholder matches t.auth.enterOtpPlaceholder exactly.
    await expect(otpInput).toBeVisible({ timeout: 10_000 });

    // Type the OTP and verify
    await otpInput.fill('123456');
    await page.getByRole('button', { name: /Verify & Continue/i }).click();

    // Profile incomplete → redirected to /profile.
    await expect(page).toHaveURL(/\/profile$/, { timeout: 10_000 });
  });

  test('invalid OTP shows error and keeps user on auth page', async ({ page }) => {
    await page.goto('/auth?mode=login');

    await page.getByPlaceholder('Phone number').fill('9999000011');
    await page.getByRole('button', { name: /Send OTP/i }).click();

    const otpInput = page.getByPlaceholder('6-digit OTP');
    // Placeholder matches t.auth.enterOtpPlaceholder exactly.
    await expect(otpInput).toBeVisible();

    await otpInput.fill('000000');
    await page.getByRole('button', { name: /Verify & Continue/i }).click();

    // Error banner appears; URL unchanged.
    await expect(page.getByText('Invalid OTP')).toBeVisible();
    await expect(page).toHaveURL(/\/auth/);
  });

  test('switches between phone and email methods', async ({ page }) => {
    // `gotoAndHydrate` waits for React to finish attaching handlers —
    // clicks dispatched before hydration are silently dropped on first
    // compile of /auth in dev mode. But "any element hydrated" doesn't
    // guarantee the specific method-toggle button is hydrated in Next
    // 15 dev mode, so we also wait for the Email button to have its
    // React props bound before clicking. Verified race: against the
    // prod build (`next start`) this test passes without the extra
    // wait; against `next dev` it fails ~50% of runs without it.
    await gotoAndHydrate(page, '/auth');

    // Default is phone.
    await expect(page.getByPlaceholder('Phone number')).toBeVisible();

    // Switch to email.
    await waitForReactHandlers(page, { role: 'button', name: 'Email' });
    await page.getByRole('tab', { name: 'Email', exact: true }).click();
    await expect(page.getByPlaceholder('you@example.com')).toBeVisible();
    await expect(page.getByPlaceholder(/Min 8 characters/i)).toBeVisible();

    // Switch back to phone.
    await page.getByRole('tab', { name: /Phone \(OTP\)/i }).click();
    await expect(page.getByPlaceholder('Phone number')).toBeVisible();
  });

  test('signup tab shows name field when email method is selected', async ({ page }) => {
    await page.goto('/auth?mode=signup');

    const card = page.locator('.surface-card').first();
    await card.getByRole('tab', { name: 'Sign up', exact: true }).click();
    await page.getByRole('tab', { name: 'Email', exact: true }).click();

    await expect(page.getByPlaceholder('Enter your name')).toBeVisible();
  });

  test('signup tab shows name field for phone OTP method too', async ({ page }) => {
    // Previously the name field was email-only — phone-OTP signups fell back
    // to a hard-coded "User" default on the backend. Regression guard.
    await page.goto('/auth?mode=signup');

    const card = page.locator('.surface-card').first();
    await card.getByRole('tab', { name: 'Sign up', exact: true }).click();
    // Phone is the default method.
    await expect(page.getByPlaceholder('Phone number')).toBeVisible();
    await expect(page.getByPlaceholder('Enter your name')).toBeVisible();
  });
});

// ─── Email login flow ───────────────────────────────────────────────────────
// Exercises /auth/login via the email/password method tab. Covers the happy
// path, a 401 from the backend, and a network error that should render the
// generic "can't reach server" banner with a Retry button.
test.describe('Auth page — email login', () => {
  test('happy path: valid credentials → redirect', async ({ page }) => {
    await installApiMocks(page, {
      'GET /health': async (route) => {
        await route.fulfill(json({ status: 'ok' }));
      },
      'POST /auth/login': async (route) => {
        await route.fulfill(
          json({
            user: {
              id: 'email-user-1',
              name: 'Email User',
              email: 'user@example.com',
              phone: null,
              credits: 10,
              role: 'USER',
              profileComplete: true,
              preferredLanguage: 'en',
            },
            tokens: {
              accessToken: 'test-access',
              refreshToken: 'test-refresh',
            },
          }),
        );
      },
    });

    await gotoAndHydrate(page, '/auth?mode=login');

    // Switch from the default phone method to email. Guard the click
    // with an explicit react-props wait — see helpers/mock-api.ts for
    // the dev-mode-only hydration-race explanation.
    await waitForReactHandlers(page, { role: 'button', name: 'Email' });
    await page.getByRole('tab', { name: 'Email', exact: true }).click();

    await page.getByPlaceholder('you@example.com').fill('user@example.com');
    await page.getByPlaceholder(/Min 8 characters/i).fill('CorrectPass123');

    // Two "Log in" buttons exist: the tab switcher at the top and the
    // form submit below. `.last()` selects the submit button.
    await page.getByRole('button', { name: /^Log in$/ }).last().click();

    // profileComplete=true → /my-day
    await expect(page).toHaveURL(/\/my-day$/, { timeout: 10_000 });
  });

  test('wrong password: backend 401 renders an error and keeps user on /auth', async ({ page }) => {
    // Abort any Firebase Identity Toolkit call — the auth page attempts a
    // Firebase email/password fallback on backend 401, and without this the
    // test would wait 10s for Firebase's internal timeout.
    await page.route('**/identitytoolkit.googleapis.com/**', (route) =>
      route.abort('failed'),
    );
    await installApiMocks(page, {
      'GET /health': async (route) => {
        await route.fulfill(json({ status: 'ok' }));
      },
      'POST /auth/login': async (route) => {
        await route.fulfill(json({ message: 'Invalid email or password' }, 401));
      },
    });

    await gotoAndHydrate(page, '/auth?mode=login');
    await waitForReactHandlers(page, { role: 'button', name: 'Email' });
    await page.getByRole('tab', { name: 'Email', exact: true }).click();
    await page.getByPlaceholder('you@example.com').fill('user@example.com');
    await page.getByPlaceholder(/Min 8 characters/i).fill('WrongPass123');
    // Two "Log in" buttons exist: the tab switcher at the top and the
    // form submit below. `.last()` selects the submit button.
    await page.getByRole('button', { name: /^Log in$/ }).last().click();

    // Firebase fallback fails immediately → control falls back to the
    // original 401 message which is surfaced inline.
    await expect(page.getByText(/Invalid email or password/i)).toBeVisible({
      timeout: 15_000,
    });
    await expect(page).toHaveURL(/\/auth/);
  });

  test('network error: shows generic banner with Retry button', async ({ page }) => {
    // No mock registered for /auth/login → the mock-api route handler aborts
    // the request, which the client sees as `ApiError.isNetwork`.
    await installApiMocks(page, {
      'GET /health': async (route) => {
        await route.fulfill(json({ status: 'ok' }));
      },
      'POST /auth/login': async (route) => {
        await route.abort('failed');
      },
    });

    await gotoAndHydrate(page, '/auth?mode=login');
    await waitForReactHandlers(page, { role: 'button', name: 'Email' });
    await page.getByRole('tab', { name: 'Email', exact: true }).click();
    await page.getByPlaceholder('you@example.com').fill('user@example.com');
    await page.getByPlaceholder(/Min 8 characters/i).fill('SomePass123');
    // Two "Log in" buttons exist: the tab switcher at the top and the
    // form submit below. `.last()` selects the submit button.
    await page.getByRole('button', { name: /^Log in$/ }).last().click();

    // Banner with the network string and a Retry affordance.
    await expect(
      page.getByText(/Can't reach the server\. Check your connection and try again\./i),
    ).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('button', { name: /^Retry$/ })).toBeVisible();
    await expect(page).toHaveURL(/\/auth/);
  });
});
