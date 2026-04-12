import { test, expect } from '@playwright/test';
import { installApiMocks } from './helpers/mock-api';

test.describe('My Day page', () => {
  test.beforeEach(async ({ page }) => {
    await installApiMocks(page);
  });

  test('renders my-day page heading', async ({ page }) => {
    await page.goto('/my-day');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });

  test('page loads without JS errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));
    await page.goto('/my-day');
    await page.waitForTimeout(1000);
    expect(errors).toHaveLength(0);
  });

  test('displays daily briefing content area', async ({ page }) => {
    await page.goto('/my-day');
    const content = await page.textContent('body');
    expect(content?.length).toBeGreaterThan(0);
  });
});
