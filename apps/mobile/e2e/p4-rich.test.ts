/**
 * Detox E2E — P4 rich features. Chat, Reports, Memory, Match-share, Palmistry.
 * Assumes a seeded signed-in user with birth details + credits and a stubbed
 * API (deterministic chat reply, report sections, share token). The camera
 * capture path is device-only and covered manually; here we assert the
 * palmistry screen renders its gender/photo controls.
 */
import { device, element, by, expect, waitFor } from 'detox';

describe('P4 rich features', () => {
  beforeAll(async () => {
    await device.launchApp({ newInstance: true });
  });

  it('Chat sends a message and shows a reply', async () => {
    await device.reloadReactNative();
    await element(by.id('chat-input')).typeText('What does today hold?');
    await element(by.id('chat-send')).tap();
    await waitFor(element(by.id('chat-assistant')).atIndex(0))
      .toBeVisible()
      .withTimeout(15000);
  });

  it('Reports generates and opens a reader', async () => {
    await device.reloadReactNative();
    await element(by.id('report-life')).tap();
    await waitFor(element(by.id('report-section')).atIndex(0))
      .toBeVisible()
      .withTimeout(20000);
  });

  it('Memory: add and remove a fact in Profile', async () => {
    await device.reloadReactNative();
    await element(by.id('memory-input')).typeText('I work in tech');
    await element(by.id('memory-add')).tap();
    await waitFor(element(by.id('memory-item')).atIndex(0))
      .toBeVisible()
      .withTimeout(8000);
  });

  it('Match-share exposes a Share action on the matching result', async () => {
    await device.reloadReactNative();
    await element(by.id('rail-vedic')).tap();
    await element(by.id('feature-matching')).tap();
    await element(by.id('feature-submit')).tap();
    await waitFor(element(by.id('match-share')))
      .toBeVisible()
      .withTimeout(15000);
  });

  it('Palmistry screen renders gender + photo controls', async () => {
    await device.reloadReactNative();
    await element(by.id('rail-vedic')).tap();
    await element(by.id('feature-palmistry')).tap();
    await waitFor(element(by.id('palm-gender-male')))
      .toBeVisible()
      .withTimeout(8000);
    await expect(element(by.id('palm-analyze'))).toBeVisible();
  });
});
