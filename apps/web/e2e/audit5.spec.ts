/**
 * Fifth-pass audit: shoots the editorial tradition landings in their
 * "fully populated" state for all six traditions, plus three
 * additional Vedic states (with/without chart, no birth details).
 */
import { test, expect } from '@playwright/test';
import { installApiMocks, json } from './helpers/mock-api';
import fs from 'fs';
import path from 'path';

const OUT_DIR = '/tmp/jx-audit5';
const SHOT_DIR = path.join(OUT_DIR, 'screenshots');
fs.mkdirSync(SHOT_DIR, { recursive: true });

const userBase = {
  id: 'audit-user-1', name: 'Sumanth Rosh', email: 'sumanth@example.com',
  phone: '+919999999999', credits: 100, role: 'USER', preferredLanguage: 'en',
  astrologyTraditions: ['VEDIC', 'WESTERN', 'CHINESE', 'HELLENISTIC', 'HORARY', 'MEDICAL'],
  primaryTradition: 'VEDIC', profileComplete: true,
  dateOfBirth: '1995-06-15', timeOfBirth: '08:30',
  placeOfBirth: 'Bengaluru, India', gender: 'MALE',
};

const authState = (user: any) => JSON.stringify({
  state: {
    user, accessToken: 'fake-token', refreshToken: 'fake-refresh',
    isAuthenticated: true,
  },
  version: 0,
});

const briefingPayload = {
  greeting: 'Good Morning, Sumanth!',
  date: '2026-05-25',
  dayQuality: 'good',
  summary: 'A favorable day with positive energy.',
  doList: ['Creative work', 'Client meetings'],
  avoidList: ['Major decisions'],
  planetaryHours: [],
  currentHora: { planet: 'Jupiter', startTime: '8:00 AM', endTime: '9:00 AM', activities: [], avoid: [], isCurrent: true },
  luckyColor: 'Pearl White', luckyNumber: 7, luckyTime: '8:00 AM - 9:00 AM',
  professionInsight: 'Creativity peaks today.',
  remedy: 'Drink water from a silver glass.',
  mantra: 'Om Chandraya Namaha',
  panchang: {
    tithi: 'Shukla Pratipada', nakshatra: 'Rohini', yoga: 'Siddhi',
    vara: 'Somvaar (Monday)', rahukaal: '7:30 AM - 9:00 AM',
  },
  transitAlert: 'Jupiter Return cycle — expansion, growth, and new opportunities.',
};

const kundliPayload = {
  id: 'k-1',
  ascendant: 'Leo',
  moonSign: 'Cancer',
  sunSign: 'Gemini',
  nakshatra: 'Pushya',
  houses: [],
  planetaryPositions: [],
  dashas: [
    {
      planet: 'Jupiter',
      startDate: '2020-01-01',
      endDate: '2036-01-01',
      subPeriods: [
        { planet: 'Saturn', startDate: '2024-06-01', endDate: '2027-01-01' },
      ],
    },
  ],
  yogas: [],
};

const mocks = {
  'GET /daily-briefing': async (r: any) => r.fulfill(json(briefingPayload)),
  'POST /astrology/kundli': async (r: any) => r.fulfill(json(kundliPayload)),
  'GET /astrology/dosha': async (r: any) => r.fulfill(json({ doshas: [] })),
  'GET /health': async (r: any) => r.fulfill(json({ status: 'ok' })),
};

test.describe.serial('audit5 (editorial tradition dashboards)', () => {

const traditions = ['vedic', 'western', 'chinese', 'hellenistic', 'horary', 'medical'] as const;

for (const slug of traditions) {
  test(`${slug} landing — fully populated`, async ({ page }) => {
    await installApiMocks(page, mocks);
    await page.addInitScript((a) => {
      localStorage.setItem('myastro360-auth', a);
    }, authState(userBase));
    await page.goto(`/${slug}`, { waitUntil: 'domcontentloaded' });
    // Vedic awaits a kundli fetch — give it longer.
    await page.waitForTimeout(slug === 'vedic' ? 2500 : 1500);
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.screenshot({ path: path.join(SHOT_DIR, `${slug}-full.png`), fullPage: true });
    expect(true).toBe(true);
  });
}

test('vedic landing — no birth details', async ({ page }) => {
  await installApiMocks(page, {
    'GET /daily-briefing': async (r) => r.fulfill(json(briefingPayload)),
    'GET /health': async (r) => r.fulfill(json({ status: 'ok' })),
  });
  const userNoBirth = { ...userBase, dateOfBirth: null, timeOfBirth: null, placeOfBirth: null };
  await page.addInitScript((a) => {
    localStorage.setItem('myastro360-auth', a);
  }, authState(userNoBirth));
  await page.goto('/vedic', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.screenshot({ path: path.join(SHOT_DIR, 'vedic-no-birth.png'), fullPage: true });
  expect(true).toBe(true);
});

test('western landing — no birth details', async ({ page }) => {
  await installApiMocks(page, {
    'GET /daily-briefing': async (r) => r.fulfill(json(briefingPayload)),
    'GET /health': async (r) => r.fulfill(json({ status: 'ok' })),
  });
  const userNoBirth = { ...userBase, dateOfBirth: null, timeOfBirth: null, placeOfBirth: null };
  await page.addInitScript((a) => {
    localStorage.setItem('myastro360-auth', a);
  }, authState(userNoBirth));
  await page.goto('/western', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.screenshot({ path: path.join(SHOT_DIR, 'western-no-birth.png'), fullPage: true });
  expect(true).toBe(true);
});

});
