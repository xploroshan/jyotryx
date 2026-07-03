/**
 * Detox E2E — P5 payments. Covers the storefront rendering and the
 * paywall→pricing navigation. The Play purchase itself needs a real device on
 * a Play internal-test track with a license tester — that flow is the manual
 * test documented in docs/PLAY_BILLING_SETUP.md, not automatable in CI.
 *
 * Assumes a seeded signed-in user and a stubbed /payments/pricing with
 * feature.pricing_page_enabled=true.
 */
import { device, element, by, expect, waitFor } from 'detox';

describe('P5 payments', () => {
  beforeAll(async () => {
    await device.launchApp({ newInstance: true });
  });

  it('Profile credits row opens the pricing screen with the packs', async () => {
    await device.reloadReactNative();
    await element(by.id('profile-credits-link')).tap();
    await waitFor(element(by.id('pack-starter')))
      .toBeVisible()
      .withTimeout(10000);
    await expect(element(by.id('pack-popular'))).toBeVisible();
    await expect(element(by.id('pack-pro'))).toBeVisible();
  });

  it('anti-steering: the web link is hidden with default store policy', async () => {
    await device.reloadReactNative();
    await element(by.id('profile-credits-link')).tap();
    await waitFor(element(by.id('pack-starter')))
      .toBeVisible()
      .withTimeout(10000);
    await expect(element(by.id('pricing-web-link'))).not.toBeVisible();
  });

  it('a credit paywall routes to pricing via Get credits', async () => {
    // Seeded user with 0 credits: submit a credit feature → paywall → pricing.
    await device.reloadReactNative();
    await element(by.id('rail-vedic')).tap();
    await element(by.id('feature-tarot')).tap();
    await element(by.id('feature-submit')).tap();
    await waitFor(element(by.id('paywall')))
      .toBeVisible()
      .withTimeout(8000);
    await element(by.id('paywall-get-credits')).tap();
    await waitFor(element(by.id('pack-starter')))
      .toBeVisible()
      .withTimeout(10000);
  });

  it('restore purchases reports an outcome', async () => {
    await device.reloadReactNative();
    await element(by.id('profile-credits-link')).tap();
    await waitFor(element(by.id('pricing-restore')))
      .toBeVisible()
      .withTimeout(10000);
    await element(by.id('pricing-restore')).tap();
    await waitFor(element(by.id('pricing-notice')))
      .toBeVisible()
      .withTimeout(10000);
  });
});
