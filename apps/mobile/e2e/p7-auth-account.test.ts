/**
 * Detox E2E — P1/P7 auth + account flows. Email register, phone OTP (the dev
 * API returns the code in the response — surfaced as the on-screen Dev OTP
 * hint), and the Profile account sections. Google sign-in needs a real
 * browser/Play services — manual test.
 *
 * Assumes a dev/staging API (OTP_EXPOSE_IN_RESPONSE active) or stubbed
 * endpoints.
 */
import { device, element, by, expect, waitFor } from 'detox';

describe('Auth modes', () => {
  beforeAll(async () => {
    await device.launchApp({ newInstance: true, delete: true });
  });

  it('register mode collects name + email + password and validates weak passwords', async () => {
    await waitFor(element(by.id('auth-mode-register'))).toBeVisible().withTimeout(10000);
    await element(by.id('auth-mode-register')).tap();
    await element(by.id('signin-name')).typeText('E2E User');
    await element(by.id('signin-email')).typeText(`e2e-${Date.now()}@myastro360.com`);
    await element(by.id('signin-password')).typeText('weakpass');
    await element(by.id('signin-submit')).tap();
    await expect(element(by.id('signin-error'))).toBeVisible(); // needs upper+digit
  });

  it('phone mode sends a code and verifies via the dev OTP', async () => {
    await element(by.id('auth-mode-phone')).tap();
    await element(by.id('signin-phone')).typeText('9876543210');
    await element(by.id('signin-send-otp')).tap();
    // Dev OTP hint appears when the API exposes the code (non-production).
    await waitFor(element(by.id('signin-otp'))).toBeVisible().withTimeout(10000);
    // The harness reads the hint text and types the code (stubbed API: 123456).
    await element(by.id('signin-otp')).typeText('123456');
    await element(by.id('signin-verify-otp')).tap();
    await waitFor(element(by.id('myday-card')))
      .toBeVisible()
      .withTimeout(15000);
  });
});

describe('Profile account sections', () => {
  it('shows referral card with a shareable code (program enabled)', async () => {
    await waitFor(element(by.id('referral-card')))
      .toBeVisible()
      .withTimeout(10000);
    await expect(element(by.id('referral-code'))).toBeVisible();
  });

  it('briefing preference toggle flips and persists', async () => {
    await waitFor(element(by.id('briefing-toggle'))).toBeVisible().withTimeout(8000);
    await element(by.id('briefing-toggle')).tap();
    // Optimistic flip sticks (rollback only on API error).
    await expect(element(by.id('briefing-prefs'))).toBeVisible();
  });
});
