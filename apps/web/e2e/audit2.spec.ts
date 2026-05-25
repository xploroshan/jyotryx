/**
 * Second-pass audit: covers what the first pass missed.
 *   • Submits the Kundli form so we can screenshot the actual chart
 *   • Captures every tradition sub-route
 *   • Re-shoots My Day and Kundli in 4 locales (en, hi, ta, bn)
 *
 * Outputs land in /tmp/jx-audit2:
 *   /tmp/jx-audit2/screenshots/<slug>.png
 *   /tmp/jx-audit2/report.md
 */
import { test, expect } from '@playwright/test';
import { installApiMocks, json } from './helpers/mock-api';
import fs from 'fs';
import path from 'path';

const OUT_DIR = '/tmp/jx-audit2';
const SHOT_DIR = path.join(OUT_DIR, 'screenshots');
fs.mkdirSync(SHOT_DIR, { recursive: true });

const authState = JSON.stringify({
  state: {
    user: {
      id: 'audit-user-1',
      name: 'Audit Tester',
      email: 'audit@example.com',
      phone: '+919999999999',
      credits: 100,
      role: 'USER',
      preferredLanguage: 'en',
      astrologyTraditions: ['VEDIC', 'WESTERN', 'CHINESE'],
      primaryTradition: 'VEDIC',
      profileComplete: true,
      dateOfBirth: '1995-06-15',
      timeOfBirth: '08:30',
      placeOfBirth: 'Bengaluru, India',
      gender: 'MALE',
    },
    accessToken: 'fake-token',
    refreshToken: 'fake-refresh',
    isAuthenticated: true,
  },
  version: 0,
});

// `userSet: true` is critical — without it the i18n store's
// onRehydrateStorage callback overrides the seeded locale with the
// detected system locale (always `en` in the headless browser).
const localeState = (loc: string) =>
  JSON.stringify({ state: { locale: loc, userSet: true }, version: 0 });

const kundliPayload = {
  id: 'k-1',
  ascendant: 'Leo',
  moonSign: 'Cancer',
  sunSign: 'Gemini',
  nakshatra: 'Rohini',
  houses: Array.from({ length: 12 }).map((_, i) => ({
    house: i + 1,
    sign: ['Leo','Virgo','Libra','Scorpio','Sagittarius','Capricorn','Aquarius','Pisces','Aries','Taurus','Gemini','Cancer'][i],
    planets: i === 0 ? ['Sun','Mercury'] : i === 3 ? ['Moon'] : i === 6 ? ['Saturn'] : i === 9 ? ['Jupiter','Venus'] : [],
  })),
  planetaryPositions: [
    { planet: 'Sun', sign: 'Gemini', house: 11, degree: 18, isRetrograde: false, nakshatra: 'Punarvasu' },
    { planet: 'Moon', sign: 'Cancer', house: 12, degree: 8, isRetrograde: false, nakshatra: 'Pushya' },
    { planet: 'Mars', sign: 'Leo', house: 1, degree: 22, isRetrograde: false, nakshatra: 'Magha' },
    { planet: 'Mercury', sign: 'Gemini', house: 11, degree: 14, isRetrograde: true, nakshatra: 'Ardra' },
    { planet: 'Jupiter', sign: 'Taurus', house: 10, degree: 4, isRetrograde: false, nakshatra: 'Krittika' },
    { planet: 'Venus', sign: 'Taurus', house: 10, degree: 27, isRetrograde: false, nakshatra: 'Rohini' },
    { planet: 'Saturn', sign: 'Aquarius', house: 7, degree: 9, isRetrograde: true, nakshatra: 'Shatabhisha' },
  ],
  dashas: [
    {
      planet: 'Jupiter',
      startDate: '2020-01-01',
      endDate: '2036-01-01',
      subPeriods: [
        { planet: 'Saturn', startDate: '2024-06-01', endDate: '2027-01-01' },
        { planet: 'Mercury', startDate: '2027-01-01', endDate: '2029-06-15' },
      ],
    },
  ],
  yogas: [
    { name: 'Gaja Kesari Yoga', description: 'Moon and Jupiter in mutual kendras — wisdom and intelligence.', effect: 'benefic' },
    { name: 'Mangal Dosha', description: 'Mars in 1st house — assertive nature.', effect: 'neutral' },
  ],
};
const doshaPayload = {
  doshas: [
    { name: 'Mangal Dosha', present: true, severity: 'mild', description: 'Mars in 1st house', remedies: ['Hanuman Chalisa', 'Coral'] },
    { name: 'Kaal Sarpa Dosha', present: false, severity: 'none', description: '—', remedies: [] },
  ],
};

const briefing = (loc: string) => ({
  greeting:
    loc === 'hi' ? 'सुप्रभात, ऑडिट!' :
    loc === 'ta' ? 'காலை வணக்கம், ஆடிட்!' :
    loc === 'bn' ? 'শুভ সকাল, অডিট!' :
    'Good Morning, Audit!',
  date: '2026-05-25',
  dayQuality: 'good',
  summary:
    loc === 'hi' ? 'सकारात्मक ऊर्जा का अनुकूल दिन। आज सोमवार है, चंद्रमा शासित।'
    : loc === 'ta' ? 'நேர்மறை ஆற்றலுடன் சாதகமான நாள். இன்று திங்கட்கிழமை.'
    : loc === 'bn' ? 'ইতিবাচক শক্তির সাথে একটি অনুকূল দিন। আজ সোমবার।'
    : 'A favorable day with positive energy supporting your endeavors.',
  doList: ['Creative work', 'Client meetings', 'Public-facing tasks'],
  avoidList: ['Major financial decisions', 'Confrontations'],
  planetaryHours: Array.from({ length: 12 }).map((_, i) => {
    const planets = ['Moon', 'Saturn', 'Jupiter', 'Mars', 'Sun', 'Venus', 'Mercury'];
    const planet = planets[i % planets.length];
    const startH = 6 + i;
    const endH = 7 + i;
    return {
      planet,
      startTime: `${startH > 12 ? startH - 12 : startH}:00 ${startH >= 12 ? 'PM' : 'AM'}`,
      endTime: `${endH > 12 ? endH - 12 : endH}:00 ${endH >= 12 ? 'PM' : 'AM'}`,
      activities: ['Creative work', 'Public meetings'],
      avoid: ['Heavy negotiations'],
      isCurrent: i === 2,
    };
  }),
  currentHora: {
    planet: 'Jupiter', startTime: '8:00 AM', endTime: '9:00 AM',
    activities: ['Teaching', 'Mentoring'], avoid: ['Risky speculation'], isCurrent: true,
  },
  luckyColor: 'Pearl White',
  luckyNumber: 7,
  luckyTime: '8:00 AM - 9:00 AM',
  professionInsight:
    loc === 'hi' ? 'आज रचनात्मकता चरम पर है — UI/UX कार्य के लिए आदर्श।'
    : 'Creativity peaks today — ideal for UI/UX work.',
  remedy: 'Drink water from a silver glass. Wear white or pearl.',
  mantra: 'Om Chandraya Namaha',
  panchang: {
    tithi: 'Shukla Pratipada', nakshatra: 'Rohini', yoga: 'Siddhi',
    vara: 'Somvaar (Monday)', rahukaal: '7:30 AM - 9:00 AM',
  },
  transitAlert: 'Jupiter Return cycle — expansion and growth.',
  astrologyTraditions: ['VEDIC', 'WESTERN', 'CHINESE'],
});

type Note = string;
type RouteReport = {
  slug: string; path: string; locale: string;
  finalUrl: string; heading: string | null;
  pageErrors: string[]; consoleErrors: string[];
  notes: Note[]; screenshot: string;
};
const reports: RouteReport[] = [];

async function mockEverything(page: import('@playwright/test').Page, loc: string) {
  await installApiMocks(page, {
    'GET /daily-briefing': async (r) => r.fulfill(json(briefing(loc))),
    'GET /users/me': async (r) =>
      r.fulfill(
        json({
          id: 'audit-user-1', name: 'Audit Tester', email: 'audit@example.com',
          phone: '+919999999999', gender: 'MALE',
          dateOfBirth: '1995-06-15', timeOfBirth: '08:30', placeOfBirth: 'Bengaluru, India',
          profession: 'SOFTWARE', preferredLanguage: loc,
          credits: 100, role: 'USER', profileComplete: true,
          astrologyTraditions: ['VEDIC', 'WESTERN', 'CHINESE'], primaryTradition: 'VEDIC',
        }),
      ),
    'GET /users/me/credits': async (r) => r.fulfill(json({ credits: 100, history: [] })),
    'GET /auth/status': async (r) => r.fulfill(json({ hasPassword: true })),
    'GET /astrology/panchang': async (r) =>
      r.fulfill(json({
        date: '2026-05-25', tithi: 'Shukla Pratipada', nakshatra: 'Rohini',
        yoga: 'Siddhi', karana: 'Bava', vara: 'Monday',
        sunrise: '5:55 AM', sunset: '6:45 PM', rahukaal: '7:30 AM - 9:00 AM',
      })),
    'POST /astrology/kundli': async (r) => r.fulfill(json(kundliPayload)),
    'GET /astrology/dosha': async (r) => r.fulfill(json(doshaPayload)),
    'GET /briefing/preferences': async (r) =>
      r.fulfill(json({ emailEnabled: false, dailyTime: '07:00', locale: loc })),
    'POST /experiment/paywall/assign': async (r) =>
      r.fulfill(json({ variant: 'control' })),
    'GET /health': async (r) => r.fulfill(json({ status: 'ok' })),
  });
}

async function seed(page: import('@playwright/test').Page, loc: string, auth: boolean) {
  await page.addInitScript(({ a, l, doAuth }) => {
    if (doAuth) localStorage.setItem('myastro360-auth', a);
    localStorage.setItem('myastro360-locale', l);
  }, { a: authState, l: localeState(loc), doAuth: auth });
}

test.describe.serial('audit2 (chart, locales, sub-routes)', () => {

// ─── 1. Submit-and-screenshot the Kundli chart ─────────────────────────
test('kundli-chart submits form and renders chart (en)', async ({ page }) => {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error' && !m.text().startsWith('[mock-api]') && !m.text().includes('Sentry')) {
      consoleErrors.push(m.text());
    }
  });
  page.on('pageerror', (e) => pageErrors.push(e.message));

  await mockEverything(page, 'en');
  await seed(page, 'en', true);
  await page.goto('/kundli', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);

  // Form should be prefilled from user profile (name, dob, time, place).
  // Click Generate.
  await page.getByRole('button', { name: /generate kundli/i }).click();
  await page.waitForTimeout(2500);

  const shot = path.join(SHOT_DIR, 'kundli-chart-en.png');
  await page.screenshot({ path: shot, fullPage: true });

  reports.push({
    slug: 'kundli-chart-en', path: '/kundli', locale: 'en',
    finalUrl: page.url(),
    heading: (await page.locator('h3').first().textContent().catch(() => null)) ?? null,
    pageErrors, consoleErrors, notes: [], screenshot: shot,
  });

  // Switch to "Planets" tab and screenshot
  await page.getByRole('tab', { name: /planetary details/i }).click().catch(() => null);
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(SHOT_DIR, 'kundli-planets-en.png'), fullPage: true });

  // Switch to "Dasha" tab
  await page.getByRole('tab', { name: /dasha periods/i }).click().catch(() => null);
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(SHOT_DIR, 'kundli-dasha-en.png'), fullPage: true });

  // Houses
  await page.getByRole('tab', { name: /house analysis/i }).click().catch(() => null);
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(SHOT_DIR, 'kundli-houses-en.png'), fullPage: true });

  // Doshas
  await page.getByRole('tab', { name: /doshas/i }).click().catch(() => null);
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(SHOT_DIR, 'kundli-doshas-en.png'), fullPage: true });

  expect(true).toBe(true);
});

// ─── 2. Multi-locale My Day ────────────────────────────────────────────
for (const loc of ['hi', 'ta', 'bn']) {
  test(`my-day in ${loc}`, async ({ page }) => {
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];
    page.on('console', (m) => {
      if (m.type() === 'error' && !m.text().startsWith('[mock-api]') && !m.text().includes('Sentry')) {
        consoleErrors.push(m.text());
      }
    });
    page.on('pageerror', (e) => pageErrors.push(e.message));
    await mockEverything(page, loc);
    await seed(page, loc, true);
    await page.goto('/my-day', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2500);
    const shot = path.join(SHOT_DIR, `my-day-${loc}.png`);
    await page.screenshot({ path: shot, fullPage: true });
    reports.push({
      slug: `my-day-${loc}`, path: '/my-day', locale: loc,
      finalUrl: page.url(),
      heading: (await page.locator('h1').first().textContent().catch(() => null)) ?? null,
      pageErrors, consoleErrors, notes: [], screenshot: shot,
    });
    expect(true).toBe(true);
  });
}

// ─── 3. Home in 3 locales ──────────────────────────────────────────────
for (const loc of ['hi', 'ta', 'gu']) {
  test(`home in ${loc}`, async ({ page }) => {
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];
    page.on('console', (m) => {
      if (m.type() === 'error' && !m.text().startsWith('[mock-api]') && !m.text().includes('Sentry')) {
        consoleErrors.push(m.text());
      }
    });
    page.on('pageerror', (e) => pageErrors.push(e.message));
    await mockEverything(page, loc);
    await seed(page, loc, false);
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    const shot = path.join(SHOT_DIR, `home-${loc}.png`);
    await page.screenshot({ path: shot, fullPage: true });
    reports.push({
      slug: `home-${loc}`, path: '/', locale: loc,
      finalUrl: page.url(),
      heading: (await page.locator('h1').first().textContent().catch(() => null)) ?? null,
      pageErrors, consoleErrors, notes: [], screenshot: shot,
    });
    expect(true).toBe(true);
  });
}

// ─── 4. Tradition sub-routes ───────────────────────────────────────────
const SUB_ROUTES = [
  '/vedic/dasha', '/vedic/dosha',
  '/western/natal', '/western/transits', '/western/synastry',
  '/chinese/bazi', '/chinese/zodiac', '/chinese/flying-stars',
  '/hellenistic/natal', '/hellenistic/profections', '/hellenistic/zodiacal-releasing',
  '/horary/ask', '/horary/history',
  '/medical/decumbiture', '/medical/body-zodiac',
];

for (const p of SUB_ROUTES) {
  const slug = `sub-${p.replace(/^\//, '').replace(/\//g, '-')}`;
  test(`sub-route ${p}`, async ({ page }) => {
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];
    page.on('console', (m) => {
      if (m.type() === 'error' && !m.text().startsWith('[mock-api]') && !m.text().includes('Sentry')) {
        consoleErrors.push(m.text());
      }
    });
    page.on('pageerror', (e) => pageErrors.push(e.message));
    await mockEverything(page, 'en');
    await seed(page, 'en', true);
    let finalUrl = '';
    const notes: string[] = [];
    try {
      const resp = await page.goto(p, { waitUntil: 'domcontentloaded', timeout: 20_000 });
      if (resp && resp.status() === 404) notes.push('404 Not Found');
      await page.waitForTimeout(1500);
      finalUrl = page.url();
    } catch (e: any) {
      notes.push(`Navigation error: ${e?.message ?? e}`);
    }
    const shot = path.join(SHOT_DIR, `${slug}.png`);
    await page.screenshot({ path: shot, fullPage: true }).catch(() => {});
    reports.push({
      slug, path: p, locale: 'en', finalUrl,
      heading: (await page.locator('h1,h2').first().textContent().catch(() => null)) ?? null,
      pageErrors, consoleErrors, notes, screenshot: shot,
    });
    expect(true).toBe(true);
  });
}

}); // end describe.serial

test.afterAll(async () => {
  const md: string[] = [
    '# Jyotryx audit pass 2 (chart, locales, sub-routes)',
    '',
    `Generated: ${new Date().toISOString()}`,
    '',
    '| Slug | Path | Locale | Heading | PageErr | ConsoleErr | Notes |',
    '|---|---|---|---|---:|---:|---|',
  ];
  for (const r of reports) {
    md.push(
      `| ${r.slug} | ${r.path} | ${r.locale} | ${r.heading ? r.heading.replace(/\s+/g, ' ').slice(0, 50) : '—'} | ${r.pageErrors.length} | ${r.consoleErrors.length} | ${r.notes.join('; ')} |`,
    );
  }
  md.push('', '## Details', '');
  for (const r of reports) {
    md.push(`### ${r.slug} — ${r.path} (${r.locale})`);
    md.push(`- final: \`${r.finalUrl}\``);
    md.push(`- heading: ${r.heading ?? '(none)'}`);
    if (r.notes.length) md.push(`- notes: ${r.notes.join(' | ')}`);
    if (r.pageErrors.length) md.push('- pageErrors:\n' + r.pageErrors.map((e) => `  - ${e}`).join('\n'));
    if (r.consoleErrors.length) md.push('- consoleErrors:\n' + r.consoleErrors.map((e) => `  - ${e}`).join('\n'));
    md.push('');
  }
  fs.writeFileSync(path.join(OUT_DIR, 'report.md'), md.join('\n'));
  fs.writeFileSync(path.join(OUT_DIR, 'report.json'), JSON.stringify(reports, null, 2));
});
