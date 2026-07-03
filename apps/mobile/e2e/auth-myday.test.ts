/**
 * Starter Detox E2E — the auth → My Day vertical slice. Establishes the harness
 * (testID selectors, waitFor synchronisation) that the full §7 matrix extends:
 * one suite per feature, plus payments (sandbox), traditions, and offline.
 *
 * Assumes the API is stubbed/seeded so /auth/login + /daily-briefing resolve.
 */
import { device, element, by, expect, waitFor } from 'detox';

describe('Auth → My Day', () => {
  beforeAll(async () => {
    await device.launchApp({ newInstance: true });
  });

  beforeEach(async () => {
    await device.reloadReactNative();
  });

  it('rejects empty credentials', async () => {
    await waitFor(element(by.id('signin-submit')))
      .toBeVisible()
      .withTimeout(10000);
    await element(by.id('signin-submit')).tap();
    await expect(element(by.id('signin-error'))).toBeVisible();
  });

  it('signs in and lands on My Day', async () => {
    // Assumes a seeded user with a complete profile so we land on the tabs.
    // (A separate onboarding suite covers the profile-incomplete branch.)
    await element(by.id('signin-email')).typeText('e2e@myastro360.com');
    await element(by.id('signin-password')).typeText('correct-horse-battery');
    await element(by.id('signin-submit')).tap();

    await waitFor(element(by.id('myday-card')))
      .toBeVisible()
      .withTimeout(15000);
  });

  it('shows credits and a briefing card on My Day', async () => {
    await waitFor(element(by.id('myday-credits')))
      .toBeVisible()
      .withTimeout(15000);
    await expect(element(by.id('myday-card'))).toBeVisible();
  });
});
