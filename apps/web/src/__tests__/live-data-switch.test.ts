/**
 * DISABLE_LIVE_DATA — the cost switch for the live panchang/horoscope blocks.
 *
 * The whole point is that the web tier can serve every indexed page with the
 * backend scaled to zero. These tests pin the two halves of that contract:
 *   1. when ON, the fan-out calls (panchang/horoscope) are skipped BEFORE
 *      fetch() — not merely failed — so a render costs nothing;
 *   2. when ON, the money-critical calls (pricing) are STILL made, so the
 *      switch can never make the app display a price it won't charge.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  liveDataDisabled,
  fetchPanchang,
  fetchHoroscope,
  fetchPricing,
} from '@/lib/seo/server-api';

const ORIGINAL = process.env.DISABLE_LIVE_DATA;

function mockFetch() {
  const spy = vi.fn(async () => ({
    ok: true,
    json: async () => ({ sign: 'aries', period: 'daily', prediction: 'x' }),
  }));
  vi.stubGlobal('fetch', spy);
  return spy;
}

beforeEach(() => {
  delete process.env.DISABLE_LIVE_DATA;
});

afterEach(() => {
  vi.unstubAllGlobals();
  if (ORIGINAL === undefined) delete process.env.DISABLE_LIVE_DATA;
  else process.env.DISABLE_LIVE_DATA = ORIGINAL;
});

describe('liveDataDisabled()', () => {
  it('defaults to ENABLED when unset (existing deploys are unaffected)', () => {
    expect(liveDataDisabled()).toBe(false);
  });

  it('is only disabled by an explicit "true" (case-insensitive)', () => {
    for (const v of ['true', 'TRUE', 'True']) {
      process.env.DISABLE_LIVE_DATA = v;
      expect(liveDataDisabled(), v).toBe(true);
    }
    for (const v of ['false', '', '1', 'yes', 'off']) {
      process.env.DISABLE_LIVE_DATA = v;
      expect(liveDataDisabled(), v).toBe(false);
    }
  });

  it('is read at CALL time, so flipping the env var needs no module reload', () => {
    expect(liveDataDisabled()).toBe(false);
    process.env.DISABLE_LIVE_DATA = 'true';
    expect(liveDataDisabled()).toBe(true);
  });
});

describe('when DISABLE_LIVE_DATA=true', () => {
  beforeEach(() => {
    process.env.DISABLE_LIVE_DATA = 'true';
  });

  it('fetchPanchang short-circuits WITHOUT touching the network', async () => {
    const spy = mockFetch();
    await expect(fetchPanchang(19.07, 72.87)).resolves.toBeNull();
    expect(spy).not.toHaveBeenCalled();
  });

  it('fetchHoroscope short-circuits WITHOUT touching the network', async () => {
    const spy = mockFetch();
    await expect(fetchHoroscope('aries', 'daily')).resolves.toBeNull();
    expect(spy).not.toHaveBeenCalled();
  });

  it('MONEY SAFETY: pricing is NOT gated — it still calls the API', async () => {
    // Gating pricing would let the page show fallback prices while checkout
    // charges the real ones. The switch must never cause that.
    const spy = mockFetch();
    await fetchPricing();
    expect(spy).toHaveBeenCalled();
  });
});

describe('when the switch is off (default)', () => {
  it('fetchPanchang and fetchHoroscope call the API as before', async () => {
    const spy = mockFetch();
    await fetchPanchang(19.07, 72.87);
    await fetchHoroscope('aries', 'daily');
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it('still fails SAFE (null, never throws) when the API is unreachable', async () => {
    // The pre-existing guarantee the switch builds on: with the backend down
    // but the flag unset, pages must still render rather than 500.
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new Error('ECONNREFUSED');
    }));
    await expect(fetchPanchang(19.07, 72.87)).resolves.toBeNull();
    await expect(fetchHoroscope('aries', 'daily')).resolves.toBeNull();
  });
});
