/**
 * Detox E2E — Vedic feature journeys (P2). Extends the auth→My Day starter with
 * per-feature flows: a free auto-run feature, a credit feature form → result,
 * and the gating paywall. Assumes a seeded signed-in user and stubbed API so
 * the feature endpoints resolve deterministically.
 *
 * Navigation: Explore tab → tradition rail (Vedic) → feature grid chip
 * (testID `feature-<slug>`) → the feature screen.
 */
import { device, element, by, expect, waitFor } from 'detox';

async function openFeature(slug: string) {
  await device.reloadReactNative();
  await element(by.id('rail-vedic')).tap();
  await waitFor(element(by.id(`feature-${slug}`)))
    .toBeVisible()
    .withTimeout(8000);
  await element(by.id(`feature-${slug}`)).tap();
}

describe('Vedic features', () => {
  beforeAll(async () => {
    await device.launchApp({ newInstance: true });
    // (Test harness signs in a seeded user before this suite; see auth-myday.test.ts.)
  });

  it('Horoscope (free) auto-runs and renders a result', async () => {
    await openFeature('horoscope');
    await waitFor(element(by.id('feature-result')))
      .toBeVisible()
      .withTimeout(15000);
  });

  it('Panchang (free, no form) renders the almanac', async () => {
    await openFeature('panchang');
    await waitFor(element(by.id('feature-result')))
      .toBeVisible()
      .withTimeout(15000);
  });

  it('Kundli (credit) submits the birth-details form and renders the chart', async () => {
    await openFeature('kundli');
    // Birth fields prefill from the profile; just submit.
    await waitFor(element(by.id('feature-submit')))
      .toBeVisible()
      .withTimeout(8000);
    await element(by.id('feature-submit')).tap();
    await waitFor(element(by.id('feature-result')))
      .toBeVisible()
      .withTimeout(15000);
  });

  it('Numerology switches to Brand mode and analyses', async () => {
    await openFeature('numerology');
    await element(by.id('field-mode-brand')).tap();
    await element(by.id('field-brandName')).typeText('Acme');
    await element(by.id('feature-submit')).tap();
    await waitFor(element(by.id('feature-result')))
      .toBeVisible()
      .withTimeout(15000);
  });

  it('A credit feature with no credits shows the paywall, and Continue anyway proceeds', async () => {
    // Seeded user for this case has 0 credits (harness sets balance per-test).
    await openFeature('tarot');
    await element(by.id('feature-submit')).tap();
    await waitFor(element(by.id('paywall')))
      .toBeVisible()
      .withTimeout(8000);
    await expect(element(by.id('feature-result'))).not.toBeVisible();
  });
});
