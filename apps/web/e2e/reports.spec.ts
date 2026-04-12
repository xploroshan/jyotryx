import { test, expect } from '@playwright/test';
import { installApiMocks } from './helpers/mock-api';

test.describe('Reports page', () => {
  test.beforeEach(async ({ page }) => {
    await installApiMocks(page);
  });

  test('renders reports page', async ({ page }) => {
    await page.goto('/reports');
    const content = await page.textContent('body');
    expect(content?.length).toBeGreaterThan(0);
  });

  test('page loads without JS errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));
    await page.goto('/reports');
    await page.waitForTimeout(1000);
    expect(errors).toHaveLength(0);
  });
});
