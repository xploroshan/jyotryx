import { test, expect } from '@playwright/test';
import { gotoAndHydrate, installApiMocks } from './helpers/mock-api';

/**
 * Covers /reset-password — the branded Firebase password-reset landing page.
 *
 * Firebase emails link to `/reset-password?mode=resetPassword&oobCode=...`.
 * The page calls `verifyPasswordResetCode` (to surface the owning email)
 * then `confirmPasswordReset` to commit the new password.
 *
 * The webServer in playwright.config.ts launches the app with
 * NEXT_PUBLIC_FIREBASE_API_KEY='' so real Firebase is intentionally
 * disabled (the rest of the suite exercises the backend OTP fallback).
 * That means the page's Firebase verify call always fails in this rig,
 * collapsing into the "invalid link" branch — which is what these
 * regression tests assert. The "valid link → set new password → success"
 * happy path is exercised end-to-end against real Firebase by the
 * pre-prod smoke run; see docs/E2E_TEST_PLAN.md.
 */

test.describe('/reset-password — invalid-link branches', () => {
  test.beforeEach(async ({ page }) => {
    await installApiMocks(page, {});
  });

  test('no oobCode → renders invalid-link UI', async ({ page }) => {
    await gotoAndHydrate(page, '/reset-password');
    await expect(
      page.getByRole('link', { name: /back to login|login/i }),
    ).toBeVisible({ timeout: 10_000 });
  });

  test('wrong mode parameter → renders invalid-link UI', async ({ page }) => {
    await gotoAndHydrate(
      page,
      '/reset-password?oobCode=abc123&mode=verifyEmail',
    );
    await expect(
      page.getByRole('link', { name: /back to login|login/i }),
    ).toBeVisible({ timeout: 10_000 });
  });

  test('oobCode present but Firebase rejects → invalid-link UI', async ({
    page,
  }) => {
    // With NEXT_PUBLIC_FIREBASE_API_KEY='', any Firebase auth call throws
    // synchronously inside the page's useEffect. The catch block flips
    // invalidLink=true. We assert the rendered outcome regardless of which
    // failure mode tripped it.
    await gotoAndHydrate(
      page,
      '/reset-password?oobCode=anything&mode=resetPassword',
    );
    await expect(
      page.getByRole('link', { name: /back to login|login/i }),
    ).toBeVisible({ timeout: 10_000 });
  });

  test('back-to-login link navigates to /auth', async ({ page }) => {
    await gotoAndHydrate(page, '/reset-password');
    await page.getByRole('link', { name: /back to login|login/i }).click();
    await expect(page).toHaveURL(/\/auth/, { timeout: 10_000 });
  });
});
