/**
 * Rendered-English leakage regression test.
 *
 * The i18n-parity test only validates key-shape and untranslated baselines
 * in the locale files. It can't catch hardcoded English strings in
 * page.tsx/component files that render text directly (e.g.
 * `<span>Vedic</span>` in MyDayPage bypasses i18n entirely).
 *
 * This test renders the high-traffic pages in a non-English locale with
 * mocked API responses and asserts that a set of sentinel English words
 * — which should have translations — do not appear in the rendered DOM.
 *
 * When this test fails:
 *   1. Find the hardcoded English string with the search hint from the
 *      failure message.
 *   2. Replace it with a `t.<namespace>.<key>` lookup, adding the key to
 *      en.ts + every locale file if it does not already exist.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';

// next/navigation — no-op router
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/my-day',
  useSearchParams: () => new URLSearchParams(''),
}));

// Locale store — force Kannada ('kn') for every test
vi.mock('@/i18n', async () => {
  const actual = await vi.importActual<typeof import('@/i18n')>('@/i18n');
  const { kn } = await import('@/i18n/kn');
  return {
    ...actual,
    useTranslation: () => ({
      t: kn,
      locale: 'kn' as const,
      setLocale: vi.fn(),
      resetLocale: vi.fn(),
    }),
  };
});

// Authenticated user with all six traditions (so every tradition badge renders)
const mockStoreState = {
  user: {
    id: '1',
    name: 'Test User',
    email: 'test@test.com',
    credits: 10,
    role: 'user',
    dateOfBirth: '1990-01-01',
    timeOfBirth: '10:00',
    placeOfBirth: 'Bangalore, India',
    astrologyTraditions: ['VEDIC', 'WESTERN', 'CHINESE', 'HELLENISTIC', 'HORARY', 'MEDICAL'],
    primaryTradition: 'VEDIC',
  },
  accessToken: 'valid-token',
  refreshToken: 'valid-refresh',
  isAuthenticated: true,
  isHydrated: true,
  setAuth: vi.fn(),
  updateCredits: vi.fn(),
  logout: vi.fn(),
  updatePrimaryTradition: vi.fn(),
  setHydrated: vi.fn(),
};
vi.mock('@/lib/store', () => ({
  useAuthStore: Object.assign(
    vi.fn((selector?: (s: typeof mockStoreState) => unknown) =>
      selector ? selector(mockStoreState) : mockStoreState,
    ),
    { getState: () => mockStoreState },
  ),
}));

// Mocked daily-briefing payload. Fields that go through LLM translation on
// the backend (doList/avoidList/luckyColor/remedy/panchang/summary/greeting/
// professionInsight/transitAlert) are supplied in Kannada as the real
// backend would return them. Fields with exact English → i18n frontend maps
// (activities used by translateActivity, color used by translateColor,
// remedy used by translateRemedy, profession insights used by
// translateProfInsight) are left in English so the frontend translation
// path is exercised.
const mockBriefing = {
  greeting: 'Good Morning, Test!',
  date: '2026-04-22',
  dayQuality: 'good' as const,
  summary: 'A favorable day with positive energy supporting your endeavors.',
  doList: ['Communication', 'Writing', 'Coding'],
  avoidList: ['Long-term commitments', 'Emotional decisions'],
  planetaryHours: [
    { planet: 'Saturn', startTime: '10:00 AM', endTime: '11:00 AM', activities: ['Long-term planning'], avoid: ['New beginnings'], isCurrent: false },
    { planet: 'Jupiter', startTime: '11:00 AM', endTime: '12:00 PM', activities: ['Teaching'], avoid: ['Risky speculation'], isCurrent: true },
  ],
  currentHora: { planet: 'Jupiter', startTime: '11:00 AM', endTime: '12:00 PM', activities: ['Teaching'], avoid: ['Risky speculation'], isCurrent: true },
  luckyColor: 'Ruby Red',
  luckyNumber: 6,
  luckyTime: '11:00 AM - 12:00 PM',
  professionInsight: 'Great for system design, learning new tech, and mentoring juniors. Think big-picture architecture.',
  remedy: 'Visit a temple and offer yellow flowers. Wear yellow sapphire. Read scriptures.',
  mantra: 'Om Budhaya Namaha',
  panchang: {
    tithi: 'ಶುಕ್ಲ ಷಷ್ಠಿ',
    nakshatra: 'ಧನಿಷ್ಠ',
    yoga: 'ವ್ಯಾಘಾತ',
    vara: 'ಬುಧವಾರ',
    rahukaal: '12:00 PM - 1:30 PM',
  },
  transitAlert: null,
};

const mockApiGet = vi.fn();
const mockApiPost = vi.fn();
vi.mock('@/lib/api', () => ({
  api: {
    get: (...args: any[]) => mockApiGet(...args),
    post: (...args: any[]) => mockApiPost(...args),
    put: vi.fn(),
    delete: vi.fn(),
    upload: vi.fn(),
  },
}));

// Import pages AFTER mocks
import MyDayPage from '@/app/my-day/page';
import VedicDashboardPage from '@/app/vedic/page';
import WesternDashboardPage from '@/app/western/page';
import ChineseDashboardPage from '@/app/chinese/page';
import HellenisticDashboardPage from '@/app/hellenistic/page';
import HoraryDashboardPage from '@/app/horary/page';
import MedicalDashboardPage from '@/app/medical/page';

/**
 * Words that should never appear in a Kannada rendering unless they're
 * proper nouns, brand names, or text the user authored themselves.
 *
 * Keep this list narrow — one English word per concept — so the
 * assertion error message points directly at what to translate.
 */
const ENGLISH_SENTINELS = [
  // Tradition names (from TRADITION_LABELS / nav)
  'Vedic',
  'Western',
  'Chinese',
  'Hellenistic',
  'Horary',
  'Medical',
  // Common UI labels
  'Switch tradition',
  'Focus mode',
  'Focus',
  'All traditions',
  'Primary tradition',
  'Explore features',
  // Tradition feature labels
  'Natal Chart',
  'Transits',
  'Synastry',
  'Chinese Zodiac',
  'Flying Stars',
  'Profections',
  'Zodiacal Releasing',
  'Question History',
  'Decumbiture',
  'Body Zodiac',
  'Dosha Check',
  'Dasha Periods',
  'Divisional Charts',
];

/**
 * User-authored / proper-noun text from the mock that is *allowed* to
 * appear verbatim in the rendered page. If a sentinel substring is a
 * substring of one of these, it is not considered leakage.
 */
const ALLOWED_CONTEXTS = [
  'Test User',
  'test@test.com',
  'Bangalore, India',
  'Om Budhaya Namaha', // Sanskrit mantra — intentionally untranslated
  'Jyotron',
  'Jyotryx',
];

function assertNoEnglishLeakage(sentinels: string[]) {
  const body = document.body.textContent ?? '';
  const leakedWords: string[] = [];
  for (const word of sentinels) {
    if (!body.includes(word)) continue;
    // Skip if the match is inside an allowed context (proper noun, user name, etc.)
    const insideAllowed = ALLOWED_CONTEXTS.some((c) => c.includes(word));
    if (insideAllowed) continue;
    leakedWords.push(word);
  }
  if (leakedWords.length) {
    throw new Error(
      `Rendered page (locale=kn) contains hardcoded English:\n` +
        leakedWords.map((w) => `  • "${w}"`).join('\n') +
        `\n\nFix: search the codebase for the exact string and replace it ` +
        `with a t.<namespace>.<key> lookup. Add the key to en.ts and every ` +
        `locale file if it does not already exist.`,
    );
  }
}

describe('i18n rendered-leakage (locale=kn)', () => {
  beforeEach(() => {
    mockApiGet.mockReset();
    mockApiPost.mockReset();
    mockApiGet.mockResolvedValue(mockBriefing);
    mockApiPost.mockResolvedValue(mockBriefing);
    mockStoreState.isAuthenticated = true;
  });

  it('MyDayPage hero does not leak English tradition labels', async () => {
    render(<MyDayPage />);
    // Wait for the async API fetch to populate briefing; once the greeting
    // or quality label shows up, the tradition badges have been rendered.
    await waitFor(() => {
      expect(document.body.textContent).toContain('Test');
    });
    assertNoEnglishLeakage(ENGLISH_SENTINELS);
  });

  const traditionDashboards: Array<[string, React.ComponentType]> = [
    ['Vedic dashboard', VedicDashboardPage],
    ['Western dashboard', WesternDashboardPage],
    ['Chinese dashboard', ChineseDashboardPage],
    ['Hellenistic dashboard', HellenisticDashboardPage],
    ['Horary dashboard', HoraryDashboardPage],
    ['Medical dashboard', MedicalDashboardPage],
  ];

  for (const [name, Page] of traditionDashboards) {
    it(`${name} does not leak English tradition labels in hero/feature tiles`, () => {
      render(<Page />);
      assertNoEnglishLeakage(ENGLISH_SENTINELS);
    });
  }
});
