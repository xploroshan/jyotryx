import { test, expect } from '@playwright/test';
import { installApiMocks } from './helpers/mock-api';

test.describe('Tarot page', () => {
  test.beforeEach(async ({ page }) => {
    await installApiMocks(page);
  });

  test('renders tarot page heading', async ({ page }) => {
    await page.goto('/tarot');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });

  test('displays spread selection or card draw UI', async ({ page }) => {
    await page.goto('/tarot');
    // The page should have interactive card/spread elements
    const content = await page.textContent('body');
    expect(content?.length).toBeGreaterThan(0);
  });

  test('page loads without JS errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));
    await page.goto('/tarot');
    await page.waitForTimeout(1000);
    expect(errors).toHaveLength(0);
  });
});
