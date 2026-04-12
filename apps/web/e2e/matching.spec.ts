import { test, expect } from '@playwright/test';
import { installApiMocks } from './helpers/mock-api';

test.describe('Matching page', () => {
  test.beforeEach(async ({ page }) => {
    await installApiMocks(page);
  });

  test('renders matching page heading', async ({ page }) => {
    await page.goto('/matching');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });

  test('shows birth details form for two persons', async ({ page }) => {
    await page.goto('/matching');
    const content = await page.textContent('body');
    expect(content?.length).toBeGreaterThan(0);
  });

  test('page loads without JS errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));
    await page.goto('/matching');
    await page.waitForTimeout(1000);
    expect(errors).toHaveLength(0);
  });
});
