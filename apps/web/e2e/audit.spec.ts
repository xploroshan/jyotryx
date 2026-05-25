/**
 * Manual feature/usability audit. Boots the app, seeds an authenticated +
 * profile-complete user, mocks the daily-briefing + adjacent endpoints,
 * then visits every primary feature route, screenshots it full-page, and
 * records:
 *   • Console / pageerror messages
 *   • Network calls that fell through to the catch-all mock
 *   • Whether the main heading / interactive controls actually rendered
 *
 * Outputs land in /tmp/jx-audit:
 *   /tmp/jx-audit/screenshots/<slug>.png
 *   /tmp/jx-audit/report.json
 *   /tmp/jx-audit/report.md
 */
import { test, expect } from '@playwright/test';
import { installApiMocks, json } from './helpers/mock-api';
import fs from 'fs';
import path from 'path';

const OUT_DIR = '/tmp/jx-audit';
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

// Rich briefing payload that exercises every visual block on My Day.
const briefing = {
  greeting: 'Good Morning, Audit!',
  date: '2026-05-25',
  dayQuality: 'good',
  summary:
    'A favorable day with positive energy supporting your endeavors. Today is Somvaar ruled by Moon. Rohini Nakshatra brings creative and nurturing energy. Creativity peaks today — ideal for UI/UX work, brainstorming features, and pair programming.',
  doList: ['Creative work', 'Client meetings', 'Public-facing tasks', 'Coding', 'Writing'],
  avoidList: ['Major financial decisions', 'Confrontations', 'Long-term commitments'],
  planetaryHours: Array.from({ length: 12 }).map((_, i) => {
    const planets = ['Moon', 'Saturn', 'Jupiter', 'Mars', 'Sun', 'Venus', 'Mercury'];
    const planet = planets[i % planets.length];
    const startH = 6 + i;
    const endH = 7 + i;
    return {
      planet,
      startTime: `${startH > 12 ? startH - 12 : startH}:00 ${startH >= 12 ? 'PM' : 'AM'}`,
      endTime: `${endH > 12 ? endH - 12 : endH}:00 ${endH >= 12 ? 'PM' : 'AM'}`,
      activities: ['Creative work', 'Public meetings', 'Writing'],
      avoid: ['Heavy negotiations'],
      isCurrent: i === 2,
    };
  }),
  currentHora: {
    planet: 'Jupiter',
    startTime: '8:00 AM',
    endTime: '9:00 AM',
    activities: ['Teaching', 'Mentoring', 'Investments'],
    avoid: ['Risky speculation'],
    isCurrent: true,
  },
  luckyColor: 'Pearl White',
  luckyNumber: 7,
  luckyTime: '8:00 AM - 9:00 AM',
  professionInsight:
    'Creativity peaks today — ideal for UI/UX work, brainstorming features, and pair programming.',
  remedy: 'Drink water from a silver glass. Wear white or pearl. Practice Chandra Namaskar.',
  mantra: 'Om Chandraya Namaha',
  panchang: {
    tithi: 'Shukla Pratipada',
    nakshatra: 'Rohini',
    yoga: 'Siddhi',
    vara: 'Somvaar (Monday)',
    rahukaal: '7:30 AM - 9:00 AM',
  },
  transitAlert:
    'Jupiter Return cycle — expansion, growth, and new opportunities. Say yes to big possibilities.',
  astrologyTraditions: ['VEDIC', 'WESTERN', 'CHINESE'],
};

const referralPayload = {
  enabled: true,
  bonusDays: 14,
  code: 'AUDIT100',
  shareUrl: 'https://www.myastro360.com/?ref=AUDIT100',
  totalReferrals: 2,
  activatedReferrals: 1,
  pendingReferrals: 1,
  rejectedReferrals: 0,
  maxPerReferrer: 10,
  remainingSlots: 8,
  recent: [
    { refereeName: 'Priya R', refereeEmail: 'priya@example.com', bonusDays: 14, status: 'ACTIVATED', activatedAt: '2026-05-20T08:00:00Z', createdAt: '2026-05-19T10:00:00Z' },
    { refereeName: 'Arjun S', refereeEmail: 'arjun@example.com', bonusDays: 14, status: 'PENDING', activatedAt: null, createdAt: '2026-05-24T11:00:00Z' },
  ],
};

const ROUTES: { slug: string; path: string; needsAuth?: boolean; postLoad?: 'short' | 'long' }[] = [
  { slug: '00-home', path: '/' },
  { slug: '01-auth-login', path: '/auth?mode=login' },
  { slug: '02-auth-signup', path: '/auth?mode=signup' },
  { slug: '03-my-day', path: '/my-day', needsAuth: true, postLoad: 'long' },
  { slug: '04-horoscope', path: '/horoscope', needsAuth: true },
  { slug: '05-kundli', path: '/kundli', needsAuth: true },
  { slug: '06-matching', path: '/matching', needsAuth: true },
  { slug: '07-panchang', path: '/panchang', needsAuth: true },
  { slug: '08-muhurat', path: '/muhurat', needsAuth: true },
  { slug: '09-divisional', path: '/divisional', needsAuth: true },
  { slug: '10-kp-astrology', path: '/kp-astrology', needsAuth: true },
  { slug: '11-palmistry', path: '/palmistry', needsAuth: true },
  { slug: '12-numerology', path: '/numerology', needsAuth: true },
  { slug: '13-tarot', path: '/tarot', needsAuth: true },
  { slug: '14-vastu', path: '/vastu', needsAuth: true },
  { slug: '15-western', path: '/western', needsAuth: true },
  { slug: '16-chinese', path: '/chinese', needsAuth: true },
  { slug: '17-hellenistic', path: '/hellenistic', needsAuth: true },
  { slug: '18-horary', path: '/horary', needsAuth: true },
  { slug: '19-medical', path: '/medical', needsAuth: true },
  { slug: '20-chat', path: '/chat', needsAuth: true },
  { slug: '21-reports', path: '/reports', needsAuth: true },
  { slug: '22-profile', path: '/profile', needsAuth: true },
  { slug: '23-pricing', path: '/pricing' },
  { slug: '24-referral', path: '/referral', needsAuth: true },
  { slug: '25-vedic', path: '/vedic', needsAuth: true },
];

type RouteReport = {
  slug: string;
  path: string;
  ok: boolean;
  finalUrl: string;
  consoleErrors: string[];
  pageErrors: string[];
  unhandledMocks: string[];
  http404s: string[];
  screenshot: string;
  headingText: string | null;
  notes: string[];
};

const reports: RouteReport[] = [];

test.describe.configure({ mode: 'serial' });

for (const route of ROUTES) {
  test(`audit ${route.slug} (${route.path})`, async ({ page }) => {
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];
    const unhandledMocks: string[] = [];
    const http404s: string[] = [];
    const notes: string[] = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        const text = msg.text();
        if (
          // Filter out the Next.js dev-mode noise and font CDN warnings we can't fix here.
          text.includes('Failed to load resource') ||
          text.includes('Download the React DevTools') ||
          text.includes('Sentry') ||
          text.includes('hydration')
        ) {
          return;
        }
        if (text.startsWith('[mock-api] Unhandled')) {
          unhandledMocks.push(text.replace('[mock-api] Unhandled ', ''));
          return;
        }
        consoleErrors.push(text);
      }
    });
    page.on('pageerror', (err) => pageErrors.push(err.message));
    page.on('response', (resp) => {
      if (resp.status() === 404 && !resp.url().includes('_next')) {
        http404s.push(`${resp.status()} ${resp.url()}`);
      }
    });

    await installApiMocks(page, {
      'GET /daily-briefing': async (r) => r.fulfill(json(briefing)),
      'GET /users/me': async (r) =>
        r.fulfill(
          json({
            id: 'audit-user-1',
            name: 'Audit Tester',
            email: 'audit@example.com',
            phone: '+919999999999',
            gender: 'MALE',
            dateOfBirth: '1995-06-15',
            timeOfBirth: '08:30',
            placeOfBirth: 'Bengaluru, India',
            profession: 'SOFTWARE',
            preferredLanguage: 'en',
            credits: 100,
            role: 'USER',
            profileComplete: true,
            astrologyTraditions: ['VEDIC', 'WESTERN', 'CHINESE'],
            primaryTradition: 'VEDIC',
          }),
        ),
      'GET /users/me/credits': async (r) =>
        r.fulfill(json({ credits: 100, history: [] })),
      'GET /auth/status': async (r) => r.fulfill(json({ hasPassword: true })),
      'GET /horoscope/daily': async (r) =>
        r.fulfill(
          json({
            sign: 'Gemini',
            date: '2026-05-25',
            summary: 'A bright day for communication.',
            love: 'Stable',
            career: 'Productive',
            health: 'Energetic',
            lucky: { color: 'Green', number: 5 },
          }),
        ),
      'GET /panchang': async (r) =>
        r.fulfill(
          json({
            date: '2026-05-25',
            tithi: 'Shukla Pratipada',
            nakshatra: 'Rohini',
            yoga: 'Siddhi',
            karana: 'Bava',
            vara: 'Monday',
            sunrise: '5:55 AM',
            sunset: '6:45 PM',
            rahukaal: '7:30 AM - 9:00 AM',
          }),
        ),
      'GET /astrology/panchang': async (r) =>
        r.fulfill(
          json({
            date: '2026-05-25',
            tithi: 'Shukla Pratipada',
            nakshatra: 'Rohini',
            yoga: 'Siddhi',
            karana: 'Bava',
            vara: 'Monday',
            sunrise: '5:55 AM',
            sunset: '6:45 PM',
            rahukaal: '7:30 AM - 9:00 AM',
          }),
        ),
      'GET /referral': async (r) =>
        r.fulfill(json(referralPayload)),
      'GET /referral/me': async (r) =>
        r.fulfill(json(referralPayload)),
      'GET /briefing/preferences': async (r) =>
        r.fulfill(json({ emailEnabled: false, dailyTime: '07:00', locale: 'en' })),
      'GET /astrology/horoscope/aries': async (r) =>
        r.fulfill(json({
          sign: 'Aries', date: '2026-05-25',
          summary: 'A productive day for new starts.',
          love: 'Steady', career: 'Promising', health: 'Energetic',
          lucky: { color: 'Red', number: 9 },
        })),
      'POST /experiment/paywall/assign': async (r) =>
        r.fulfill(json({ variant: 'control' })),
      'GET /health': async (r) => r.fulfill(json({ status: 'ok' })),
      'GET /payments/pricing': async (r) =>
        r.fulfill(json({ plans: [] })),
      'GET /reports': async (r) => r.fulfill(json({ reports: [] })),
      'GET /reports/me': async (r) => r.fulfill(json({ reports: [] })),
      'GET /chat/history': async (r) => r.fulfill(json({ conversations: [] })),
      'GET /pricing/plans': async (r) =>
        r.fulfill(
          json({
            plans: [
              { id: 'free', name: 'Free', priceInr: 0, features: ['1 free chart'] },
              { id: 'pro', name: 'Pro', priceInr: 499, features: ['Unlimited charts'] },
            ],
          }),
        ),
    });

    if (route.needsAuth) {
      await page.addInitScript((s) => {
        localStorage.setItem('myastro360-auth', s);
      }, authState);
    }

    let finalUrl = '';
    try {
      const resp = await page.goto(route.path, { waitUntil: 'domcontentloaded', timeout: 25_000 });
      if (resp && resp.status() >= 400) {
        notes.push(`HTTP ${resp.status()} on initial navigation`);
      }
      // Allow client effects (auth hydration, API fetch, ProfileGate) to settle.
      await page.waitForTimeout(route.postLoad === 'long' ? 2500 : 1200);
      finalUrl = page.url();
      if (route.needsAuth && finalUrl.includes('/auth')) {
        notes.push('Bounced to /auth despite seeded auth state');
      }
      if (route.needsAuth && finalUrl.includes('/profile?complete=1') && route.path !== '/profile') {
        notes.push('ProfileGate redirected to /profile?complete=1');
      }
    } catch (e: any) {
      notes.push(`Navigation threw: ${e?.message ?? e}`);
    }

    const heading =
      (await page.locator('h1').first().textContent().catch(() => null)) ??
      (await page.locator('h2').first().textContent().catch(() => null));

    const screenshotPath = path.join(SHOT_DIR, `${route.slug}.png`);
    try {
      await page.screenshot({ path: screenshotPath, fullPage: true, timeout: 15_000 });
    } catch (e: any) {
      notes.push(`Screenshot failed: ${e?.message ?? e}`);
    }

    reports.push({
      slug: route.slug,
      path: route.path,
      ok: pageErrors.length === 0 && consoleErrors.length === 0,
      finalUrl,
      consoleErrors,
      pageErrors,
      unhandledMocks: Array.from(new Set(unhandledMocks)),
      http404s: Array.from(new Set(http404s)),
      screenshot: screenshotPath,
      headingText: heading?.trim() ?? null,
      notes,
    });

    // Always pass — this spec is a survey, not a gate.
    expect(true).toBe(true);
  });
}

test.afterAll(async () => {
  fs.writeFileSync(path.join(OUT_DIR, 'report.json'), JSON.stringify(reports, null, 2));
  const md: string[] = ['# Jyotryx feature audit', ''];
  md.push(`Generated: ${new Date().toISOString()}`, '');
  md.push('| Slug | Path | Final URL | Heading | PageErr | ConsoleErr | Notes |');
  md.push('|---|---|---|---|---:|---:|---|');
  for (const r of reports) {
    const notes = [
      ...r.notes,
      ...(r.unhandledMocks.length ? [`unhandled: ${r.unhandledMocks.join(', ')}`] : []),
      ...(r.http404s.length ? [`404: ${r.http404s.length}`] : []),
    ].join('; ');
    md.push(
      `| ${r.slug} | ${r.path} | ${r.finalUrl.replace('http://127.0.0.1:3100', '')} | ${
        r.headingText ? r.headingText.replace(/\s+/g, ' ').slice(0, 50) : '—'
      } | ${r.pageErrors.length} | ${r.consoleErrors.length} | ${notes || ''} |`,
    );
  }
  md.push('', '## Details', '');
  for (const r of reports) {
    md.push(`### ${r.slug} — ${r.path}`);
    md.push(`- finalUrl: \`${r.finalUrl}\``);
    md.push(`- heading: ${r.headingText ?? '(none)'}`);
    if (r.notes.length) md.push(`- notes: ${r.notes.join(' | ')}`);
    if (r.pageErrors.length) md.push(`- pageErrors:\n` + r.pageErrors.map((e) => `  - ${e}`).join('\n'));
    if (r.consoleErrors.length) md.push(`- consoleErrors:\n` + r.consoleErrors.map((e) => `  - ${e}`).join('\n'));
    if (r.unhandledMocks.length) md.push(`- unhandled mocks:\n` + r.unhandledMocks.map((e) => `  - ${e}`).join('\n'));
    if (r.http404s.length) md.push(`- 404 responses:\n` + r.http404s.map((e) => `  - ${e}`).join('\n'));
    md.push('');
  }
  fs.writeFileSync(path.join(OUT_DIR, 'report.md'), md.join('\n'));
});
