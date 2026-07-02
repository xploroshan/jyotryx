/**
 * Detox E2E — P3 traditions. Verifies the tradition rail switches the feature
 * grid, features across Western/Chinese/Hellenistic/Medical run, and horary's
 * client-side history persists on-device after an ask. Assumes a seeded signed-
 * in user with birth details and a stubbed API.
 */
import { device, element, by, expect, waitFor } from 'detox';

async function openIn(traditionSlug: string, featureSlug: string) {
  await device.reloadReactNative();
  await element(by.id(`rail-${traditionSlug}`)).tap();
  await waitFor(element(by.id(`feature-${featureSlug}`)))
    .toBeVisible()
    .withTimeout(8000);
  await element(by.id(`feature-${featureSlug}`)).tap();
}

describe('P3 traditions', () => {
  beforeAll(async () => {
    await device.launchApp({ newInstance: true });
  });

  it('Western → Natal submits and renders', async () => {
    await openIn('western', 'natal');
    await element(by.id('feature-submit')).tap();
    await waitFor(element(by.id('feature-result')))
      .toBeVisible()
      .withTimeout(15000);
  });

  it('Chinese → Flying Stars (free) auto-runs the annual grid', async () => {
    await openIn('chinese', 'flying-stars');
    await waitFor(element(by.id('feature-result')))
      .toBeVisible()
      .withTimeout(15000);
  });

  it('Hellenistic → Profections calculates from a date', async () => {
    await openIn('hellenistic', 'profections');
    await element(by.id('feature-submit')).tap();
    await waitFor(element(by.id('feature-result')))
      .toBeVisible()
      .withTimeout(15000);
  });

  it('Medical → Body & Zodiac (free) auto-runs the melothesia map', async () => {
    await openIn('medical', 'body-zodiac');
    await waitFor(element(by.id('feature-result')))
      .toBeVisible()
      .withTimeout(15000);
  });

  it('Horary ask persists to on-device history', async () => {
    await openIn('horary', 'ask');
    await element(by.id('field-question')).typeText('Will the deal close?');
    await element(by.id('feature-submit')).tap();
    await waitFor(element(by.id('feature-result')))
      .toBeVisible()
      .withTimeout(15000);

    // History is client-side (MMKV) — the ask should now appear there.
    await openIn('horary', 'history');
    await waitFor(element(by.id('horary-record')).atIndex(0))
      .toBeVisible()
      .withTimeout(8000);
  });
});
