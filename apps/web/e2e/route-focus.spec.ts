/**
 * Route-focus-reset e2e.
 *
 * Next.js client-side navigation leaves focus on whatever link the
 * user clicked, which paints a stuck ring on nav pills and silently
 * skips screen-reader announcements of the new page. RouteFocusReset
 * moves focus to <main> on every pathname change; this test guards
 * that contract at the browser level, where jsdom can't reproduce the
 * bug.
 */
import { test, expect } from '@playwright/test';
import { installApiMocks } from './helpers/mock-api';

test('focus lands on <main> after clicking an in-app link', async ({ page }) => {
  await installApiMocks(page);
  await page.goto('/');
  await page.waitForLoadState('networkidle');

  // Pricing is a public link present in the top nav on every page.
  // Reaching it via keyboard click guarantees the browser treats it as
  // a genuine activation — the same flow a keyboard user would take.
  const pricingLink = page.locator('nav a[href="/pricing"]').first();
  await pricingLink.focus();
  await pricingLink.click();
  await page.waitForURL('**/pricing');

  // Give the RouteFocusReset effect a tick to run.
  await page.waitForFunction(() => {
    const main = document.querySelector('main');
    return main != null && document.activeElement === main;
  }, undefined, { timeout: 2000 });

  const activeTag = await page.evaluate(() => document.activeElement?.tagName);
  expect(activeTag).toBe('MAIN');
});

test('no tradition pill is aria-selected on the homepage', async ({ page }) => {
  await installApiMocks(page);
  await page.goto('/');
  await page.waitForLoadState('networkidle');

  const selected = await page
    .locator('[role="tab"][aria-selected="true"]')
    .count();
  expect(selected).toBe(0);
});
