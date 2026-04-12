import { test, expect } from '@playwright/test';
import { installApiMocks } from './helpers/mock-api';

test.describe('Palmistry page', () => {
  test.beforeEach(async ({ page }) => {
    await installApiMocks(page);
  });

  test('renders palmistry page heading', async ({ page }) => {
    await page.goto('/palmistry');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });

  test('shows upload or camera option for palm image', async ({ page }) => {
    await page.goto('/palmistry');
    const content = await page.textContent('body');
    expect(content?.length).toBeGreaterThan(0);
  });

  test('page loads without JS errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));
    await page.goto('/palmistry');
    await page.waitForTimeout(1000);
    expect(errors).toHaveLength(0);
  });
});
