import { test, expect } from '@playwright/test';
import { installApiMocks, json } from './helpers/mock-api';

/**
 * E2E coverage for language switching on briefing surfaces (home +
 * my-day + panchang). These are the pages the user called out where
 * English leaked into the Hindi UI — color names, planet names,
 * nakshatra/tithi/yoga/vara panchang values, and hora time ranges.
 *
 * The backend returns canonical English strings for these fields (the
 * offline engine does too). The frontend is responsible for rendering
 * them in the current locale via the panchang-terms translator tables.
 */

const authState = JSON.stringify({
  state: {
    user: {
      id: 'test-user-1',
      name: 'Sumanth',
      email: 'sumanth@example.com',
      credits: 20,
      role: 'USER',
      profileComplete: true,
      astrologyTraditions: ['VEDIC'],
      primaryTradition: 'VEDIC',
    },
    accessToken: 'fake-token',
    refreshToken: 'fake-refresh',
    isAuthenticated: true,
  },
  version: 0,
});

const hiLocale = JSON.stringify({
  state: { locale: 'hi', userSet: true },
  version: 0,
});

const briefing = {
  greeting: 'Good Morning, Sumanth!',
  date: '2026-04-22',
  dayQuality: 'good',
  summary:
    'A favorable day with positive energy supporting your endeavors. Today is Budhvaar (Wednesday) ruled by Mercury. Dhanishta Nakshatra brings prosperous and rhythmic energy. Strong day for architecture decisions and code reviews. Your technical leadership shines — present that proposal.',
  doList: ['Coding', 'Communication'],
  avoidList: ['Major purchases'],
  planetaryHours: [
    {
      planet: 'Sun',
      startTime: '11:00 AM',
      endTime: '12:00 PM',
      activities: ['Leadership decisions'],
      avoid: ['Starting partnerships'],
      isCurrent: true,
    },
  ],
  currentHora: {
    planet: 'Sun',
    startTime: '11:00 AM',
    endTime: '12:00 PM',
    activities: ['Leadership decisions'],
    avoid: ['Starting partnerships'],
    isCurrent: true,
  },
  luckyColor: 'Emerald Green',
  luckyNumber: 8,
  luckyTime: '11:00 AM - 12:00 PM',
  professionInsight:
    'Strong day for architecture decisions and code reviews. Your technical leadership shines — present that proposal.',
  remedy:
    'Chant Vishnu Sahasranama. Wear emerald green. Feed green vegetables to cows.',
  mantra: 'Om Budhaya Namaha',
  panchang: {
    tithi: 'Shukla Shashthi',
    nakshatra: 'Dhanishta',
    yoga: 'Vyaghata',
    vara: 'Budhvaar (Wednesday)',
    rahukaal: '12:00 PM - 01:30 PM',
  },
  transitAlert: null,
};

test.describe('Briefing surfaces translate when locale is Hindi', () => {
  test.beforeEach(async ({ page }) => {
    await installApiMocks(page, {
      'GET /daily-briefing': async (route) => route.fulfill(json(briefing)),
    });
    await page.addInitScript(
      ({ auth, locale }: { auth: string; locale: string }) => {
        localStorage.setItem('myastro360-auth', auth);
        localStorage.setItem('myastro360-locale', locale);
      },
      { auth: authState, locale: hiLocale },
    );
  });

  test('my-day panchang, hora, lucky color are Hindi not English', async ({
    page,
  }) => {
    await page.goto('/my-day');

    // Panchang cells: the English inputs should be replaced with Devanagari.
    // Backend returns "Dhanishta" / "Vyaghata" / "Shukla Shashthi" / "Budhvaar (Wednesday)";
    // Hindi UI must show the Devanagari forms.
    await expect(page.getByText('धनिष्ठा').first()).toBeVisible();
    await expect(page.getByText('व्याघात').first()).toBeVisible();
    await expect(page.getByText('शुक्ल षष्ठी').first()).toBeVisible();
    await expect(page.getByText('बुधवार').first()).toBeVisible();

    // The English transliterated form and the English weekday must NOT
    // appear in the panchang grid.
    await expect(page.locator('body')).not.toContainText('Budhvaar');
    await expect(page.locator('body')).not.toContainText('Dhanishta');
    await expect(page.locator('body')).not.toContainText('Vyaghata');

    // Lucky color: English "Emerald Green" → Hindi "पन्ना हरा".
    await expect(page.getByText('पन्ना हरा').first()).toBeVisible();

    // Hora AM/PM: Hindi renders "पूर्वाह्न" / "अपराह्न" instead of AM/PM.
    await expect(page.getByText(/पूर्वाह्न|अपराह्न/).first()).toBeVisible();
  });

  test('my-day summary no longer mixes Budhvaar/Dhanishta in a Hindi sentence', async ({
    page,
  }) => {
    await page.goto('/my-day');
    // Wait for async briefing to render (greeting is a fast signal).
    await expect(page.getByRole('heading', { level: 1 })).toContainText(
      'Sumanth',
    );
    const body = await page.locator('body').innerText();
    // Sanity: the Hindi summary prefix translates.
    expect(body).toContain('सकारात्मक ऊर्जा');
    // Regressions we fixed: the summary must not leak these English chunks.
    expect(body).not.toContain('Budhvaar');
    expect(body).not.toContain('Dhanishta');
    expect(body).not.toContain('Nakshatra brings');
    expect(body).not.toContain('ruled by');
  });
});
