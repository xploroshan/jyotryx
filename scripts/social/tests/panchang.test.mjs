/**
 * Tests for the live-panchang fetch + token substitution
 * (scripts/social/lib/panchang.mjs) against a local node:http mock server.
 * Run: npm run social:test
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';

import { fetchPanchang, substituteTokens } from '../lib/panchang.mjs';

async function startMock(t, handler) {
  const requests = [];
  const server = createServer((req, res) => {
    const url = new URL(req.url, 'http://mock');
    requests.push({ path: url.pathname, query: Object.fromEntries(url.searchParams) });
    handler(req, res, url);
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  return { apiBase: `http://127.0.0.1:${server.address().port}/api`, requests };
}

const PAYLOAD = {
  date: '2026-07-13',
  tithi: 'Shukla Ashtami',
  nakshatra: 'Rohini',
  vara: 'Somvar',
  sunrise: '06:07',
  sunset: '19:18',
  rahukaal: '07:45–09:23',
};

test('fetchPanchang: happy path returns the parsed payload and passes lat/lng', async (t) => {
  const { apiBase, requests } = await startMock(t, (req, res) => {
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify(PAYLOAD));
  });

  const result = await fetchPanchang({ lat: 19.076, lng: 72.8777, apiBase });
  assert.deepEqual(result, PAYLOAD);

  assert.equal(requests.length, 1);
  assert.equal(requests[0].path, '/api/astrology/panchang');
  assert.deepEqual(requests[0].query, { lat: '19.076', lng: '72.8777' });
});

test('fetchPanchang: trailing slashes on apiBase are tolerated', async (t) => {
  const { apiBase, requests } = await startMock(t, (req, res) => {
    res.end(JSON.stringify(PAYLOAD));
  });
  const result = await fetchPanchang({ lat: 1, lng: 2, apiBase: `${apiBase}///` });
  assert.deepEqual(result, PAYLOAD);
  assert.equal(requests[0].path, '/api/astrology/panchang');
});

test('fetchPanchang: HTTP 500 returns null (never throws)', async (t) => {
  const { apiBase } = await startMock(t, (req, res) => {
    res.statusCode = 500;
    res.end('internal error');
  });
  assert.equal(await fetchPanchang({ lat: 19.076, lng: 72.8777, apiBase }), null);
});

test('fetchPanchang: malformed JSON body returns null', async (t) => {
  const { apiBase } = await startMock(t, (req, res) => {
    res.setHeader('content-type', 'application/json');
    res.end('{not json');
  });
  assert.equal(await fetchPanchang({ lat: 1, lng: 2, apiBase }), null);
});

test('fetchPanchang: connection failure returns null', async () => {
  // Port 1 is never listening; fetch rejects and the module must swallow it.
  assert.equal(
    await fetchPanchang({ lat: 1, lng: 2, apiBase: 'http://127.0.0.1:1/api' }),
    null,
  );
});

test('fetchPanchang: unset apiBase returns null without any request', async () => {
  assert.equal(await fetchPanchang({ lat: 1, lng: 2, apiBase: undefined }), null);
  assert.equal(await fetchPanchang({ lat: 1, lng: 2, apiBase: '' }), null);
});

// The module's 15s request timeout is a private constant with no override
// parameter, so a real timeout test would have to stall a socket for >15s.
// Skipped by design; the connection-failure and 500 paths cover the same
// "never throws, returns null" contract.
test('fetchPanchang: timeout returns null', { skip: 'TIMEOUT_MS (15s) is not overridable' }, () => {});

test('substituteTokens: replaces known {tokens} and leaves unknown text alone', () => {
  const out = substituteTokens(
    'Rahu Kaal in {city}: {rahu_kaal}. Unknown {mystery} stays. Plain braces {not a token} stay.',
    { city: 'Mumbai', rahu_kaal: '07:45–09:23' },
  );
  assert.equal(
    out,
    'Rahu Kaal in Mumbai: 07:45–09:23. Unknown {mystery} stays. Plain braces {not a token} stay.',
  );
});

test('substituteTokens: null map values leave the token visible', () => {
  assert.equal(substituteTokens('{tithi}', { tithi: null }), '{tithi}');
});

test('substituteTokens: numeric values are stringified', () => {
  assert.equal(substituteTokens('{n} of {total}', { n: 2, total: 5 }), '2 of 5');
});

test('substituteTokens: non-string input is returned as-is', () => {
  assert.equal(substituteTokens(null, { a: 1 }), null);
  assert.equal(substituteTokens(42, { a: 1 }), 42);
  assert.equal(substituteTokens(undefined), undefined);
});
