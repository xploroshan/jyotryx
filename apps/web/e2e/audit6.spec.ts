/**
 * Visual audit for the Remember-me checkbox and the Nickname field
 * on /profile. Used by the human to eyeball the new UI.
 */
import { test, expect } from '@playwright/test';
import { installApiMocks, json } from './helpers/mock-api';
import fs from 'fs';
import path from 'path';

const OUT_DIR = '/tmp/jx-audit6';
const SHOT_DIR = path.join(OUT_DIR, 'screenshots');
fs.mkdirSync(SHOT_DIR, { recursive: true });

const user = {
  id: 'u-1', name: 'Sumanth Rosh', nickname: 'Sums',
  email: 'sumanth@example.com', phone: '+919999999999',
  credits: 100, role: 'USER', preferredLanguage: 'en',
  astrologyTraditions: ['VEDIC'], primaryTradition: 'VEDIC',
  profileComplete: true, dateOfBirth: '1995-06-15',
  timeOfBirth: '08:30', placeOfBirth: 'Bengaluru, India', gender: 'MALE',
};

const authState = JSON.stringify({
  state: { user, accessToken: 'fake', refreshToken: 'fake-r', isAuthenticated: true },
  version: 0,
});

test('auth — email tab with Remember me checkbox', async ({ page }) => {
  await installApiMocks(page, {
    'GET /health': async (r) => r.fulfill(json({ status: 'ok' })),
  });
  await page.goto('/auth?mode=login', { waitUntil: 'domcontentloaded' });
  await page.getByRole('tab', { name: /^email$/i }).click();
  await page.waitForTimeout(800);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.screenshot({ path: path.join(SHOT_DIR, 'auth-email-rememberme.png'), fullPage: true });
  expect(true).toBe(true);
});

test('profile — nickname field present', async ({ page }) => {
  await installApiMocks(page, {
    'GET /users/me': async (r) => r.fulfill(json(user)),
    'GET /users/me/credits': async (r) => r.fulfill(json({ available: 100, used: 0, total: 100, role: 'USER', resetsAt: '2026-07-01' })),
    'GET /auth/status': async (r) => r.fulfill(json({ hasPassword: true })),
    'GET /health': async (r) => r.fulfill(json({ status: 'ok' })),
  });
  await page.addInitScript((a) => { localStorage.setItem('myastro360-auth', a); }, authState);
  await page.goto('/profile', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.screenshot({ path: path.join(SHOT_DIR, 'profile-nickname.png'), fullPage: true });
  expect(true).toBe(true);
});

test('vedic landing — uses nickname as the greeting', async ({ page }) => {
  await installApiMocks(page, {
    'GET /daily-briefing': async (r) => r.fulfill(json({
      greeting: 'Good Morning, Sums!', date: '2026-05-27',
      dayQuality: 'good', summary: 'A favorable day.',
      doList: [], avoidList: [], planetaryHours: [],
      currentHora: { planet: 'Jupiter', startTime: '8AM', endTime: '9AM', activities: [], avoid: [], isCurrent: true },
      luckyColor: 'White', luckyNumber: 7, luckyTime: '8-9AM',
      professionInsight: '', remedy: '', mantra: '',
      panchang: { tithi: 'Pratipada', nakshatra: 'Rohini', yoga: 'Siddhi', vara: 'Monday', rahukaal: '7:30-9AM' },
      transitAlert: '',
    })),
    'POST /astrology/kundli': async (r) => r.fulfill(json({
      id: 'k', ascendant: 'Leo', moonSign: 'Cancer', sunSign: 'Gemini', nakshatra: 'Pushya',
      houses: [], planetaryPositions: [],
      dashas: [{ planet: 'Jupiter', startDate: '2020-01-01', endDate: '2036-01-01', subPeriods: [] }],
      yogas: [],
    })),
    'GET /health': async (r) => r.fulfill(json({ status: 'ok' })),
  });
  await page.addInitScript((a) => { localStorage.setItem('myastro360-auth', a); }, authState);
  await page.goto('/vedic', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.screenshot({ path: path.join(SHOT_DIR, 'vedic-nickname.png'), fullPage: true });
  expect(true).toBe(true);
});
