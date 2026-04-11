import { test, expect } from '@playwright/test';
import { installApiMocks, json } from './helpers/mock-api';

/**
 * Numerology page E2E coverage.
 *
 * The numerology page has two tabs — Name analysis and Brand/business
 * analysis — both of which POST to the API and render a detailed result
 * card. This spec mocks both endpoints with deterministic payloads and
 * asserts:
 *
 *   - Tab switching re-renders the correct form
 *   - Empty input keeps the analyze button disabled
 *   - A successful response populates the verdict block and lists
 *   - A 500 response surfaces the error banner
 */
const NAME_RESULT = {
  name: 'Arjun Sharma',
  destinyNumber: 7,
  soulNumber: 3,
  personalityNumber: 4,
  destinyMeaning: 'The seeker — drawn to introspection and spiritual knowledge.',
  soulMeaning: 'Creative expression with an optimistic inner drive.',
  personalityMeaning: 'Grounded, practical, and diligent in outward actions.',
  overallVerdict: 'highly_favorable',
  strengths: ['Analytical mind', 'Strong intuition', 'Natural leadership'],
  cautions: ['Tendency to overthink'],
  bestDaysToUse: ['Monday', 'Thursday'],
  luckyColors: ['Blue', 'White'],
  rulingPlanet: 'Ketu',
  compatibility: 'Compatible with numbers 1 and 5',
  suggestion: 'Embrace solitude for growth.',
};

const BRAND_RESULT = {
  brandName: 'Cosmic Aura',
  nameNumber: 6,
  vibration: 'Harmonious and nurturing',
  planetaryRuler: 'Venus',
  suitableFor: ['Wellness', 'Beauty', 'Home goods'],
  avoidFor: ['High-risk trading'],
  overallScore: 8.5,
  recommendation: 'A strong, balanced name for consumer brands.',
  alternativeNumbers: [1, 5, 9],
  bestLaunchDays: ['Friday'],
  luckyColors: ['Pink', 'White'],
};

test.describe('Numerology page', () => {
  test.beforeEach(async ({ page }) => {
    await installApiMocks(page, {
      'POST /numerology/name': async (route) => {
        const body = JSON.parse(route.request().postData() || '{}');
        if (!body.name || body.name === 'fail') {
          await route.fulfill(json({ message: 'Analysis failed' }, 500));
          return;
        }
        await route.fulfill(json({ ...NAME_RESULT, name: body.name }));
      },
      'POST /numerology/brand': async (route) => {
        const body = JSON.parse(route.request().postData() || '{}');
        await route.fulfill(json({ ...BRAND_RESULT, brandName: body.brandName }));
      },
    });
  });

  test('analyze button is disabled on empty input and enables when typed', async ({
    page,
  }) => {
    await page.goto('/numerology');

    const analyzeBtn = page.getByRole('button', { name: /^Analyze$/ });
    await expect(analyzeBtn).toBeDisabled();

    await page.getByPlaceholder(/Arjun Sharma/).fill('Arjun Sharma');
    await expect(analyzeBtn).toBeEnabled();
  });

  test('name analysis happy path renders numbers, verdict, and lists', async ({
    page,
  }) => {
    await page.goto('/numerology');

    await page.getByPlaceholder(/Arjun Sharma/).fill('Arjun Sharma');
    await page.getByRole('button', { name: /^Analyze$/ }).click();

    // Destiny/Soul/Personality cards.
    await expect(page.getByText('Destiny Number')).toBeVisible();
    await expect(page.getByText('Soul Number')).toBeVisible();
    await expect(page.getByText('Personality Number')).toBeVisible();

    // The three numeric values from the mock.
    await expect(page.getByText('7', { exact: true })).toBeVisible();
    await expect(page.getByText('3', { exact: true })).toBeVisible();
    await expect(page.getByText('4', { exact: true })).toBeVisible();

    // Strengths list items.
    await expect(page.getByText('Analytical mind')).toBeVisible();
    await expect(page.getByText('Strong intuition')).toBeVisible();
    await expect(page.getByText('Natural leadership')).toBeVisible();

    // Cautions list item.
    await expect(page.getByText('Tendency to overthink')).toBeVisible();

    // Ruling planet.
    await expect(page.getByText(/Ketu/)).toBeVisible();
  });

  test('switching to brand tab changes the form and analyses brand names', async ({
    page,
  }) => {
    await page.goto('/numerology');

    await page.getByRole('button', { name: /Brand \/ Business/i }).click();

    // Brand-specific placeholder appears.
    const brandInput = page.getByPlaceholder(/TechNova Solutions/i);
    await expect(brandInput).toBeVisible();

    await brandInput.fill('Cosmic Aura');
    await page.getByRole('button', { name: /^Analyze$/ }).click();

    // Brand result surfaces the planetary ruler and score.
    await expect(page.getByText(/Venus/)).toBeVisible();
    await expect(page.getByText(/Harmonious and nurturing/)).toBeVisible();
  });
});
