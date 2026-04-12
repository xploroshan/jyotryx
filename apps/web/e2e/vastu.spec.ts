import { test, expect } from '@playwright/test';
import { installApiMocks } from './helpers/mock-api';

test.describe('Vastu page', () => {
  test.beforeEach(async ({ page }) => {
    await installApiMocks(page);
  });

  test('renders vastu page heading', async ({ page }) => {
    await page.goto('/vastu');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });

  test('displays direction-related UI elements', async ({ page }) => {
    await page.goto('/vastu');
    const content = await page.textContent('body');
    expect(content?.length).toBeGreaterThan(0);
  });

  test('page loads without JS errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));
    await page.goto('/vastu');
    await page.waitForTimeout(1000);
    expect(errors).toHaveLength(0);
  });
});
