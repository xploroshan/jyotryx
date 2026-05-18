/**
 * Briefing-cache tests.
 *
 * The My Day briefing is cached in localStorage for one local calendar
 * day. Before these tests existed, nothing in CI verified that a cache
 * written yesterday (or under a different user/locale) gets invalidated
 * on the next read. That's exactly the class of bug that produced
 * "Saturn is NOW" at 3:25 PM — the stale briefing carried an
 * `isCurrent` flag frozen from hours earlier.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  BRIEFING_CACHE_KEY,
  readBriefingCache,
  writeBriefingCache,
  readBriefingCacheSync,
} from '../app/my-day/lib/briefingCache';
import type { DailyBriefing } from '../app/my-day/lib/types';

const fixtureBriefing: DailyBriefing = {
  greeting: 'Hi',
  date: '2026-04-24',
  dayQuality: 'good',
  summary: 'x',
  doList: [],
  avoidList: [],
  planetaryHours: [],
  currentHora: null,
  luckyColor: 'blue',
  luckyNumber: 7,
  luckyTime: '9am',
  professionInsight: '',
  remedy: '',
  mantra: '',
  panchang: { tithi: '', nakshatra: '', yoga: '', vara: '', rahukaal: '' },
  transitAlert: null,
};

describe('briefing cache — cross-day invalidation', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    window.localStorage.clear();
  });

  it('returns the cached briefing on the same local day', () => {
    vi.setSystemTime(new Date(2026, 3, 24, 9, 0));
    writeBriefingCache('user-1', 'en', fixtureBriefing);

    vi.setSystemTime(new Date(2026, 3, 24, 15, 25));
    expect(readBriefingCache('user-1', 'en')).toEqual(fixtureBriefing);
  });

  it('rejects a briefing cached yesterday (the real stale-NOW scenario)', () => {
    // Write at 11pm on day N.
    vi.setSystemTime(new Date(2026, 3, 23, 23, 0));
    writeBriefingCache('user-1', 'en', fixtureBriefing);

    // Read at 1am on day N+1.
    vi.setSystemTime(new Date(2026, 3, 24, 1, 0));
    expect(readBriefingCache('user-1', 'en')).toBeNull();
  });

  it('busts when locale changes', () => {
    vi.setSystemTime(new Date(2026, 3, 24, 9, 0));
    writeBriefingCache('user-1', 'en', fixtureBriefing);
    expect(readBriefingCache('user-1', 'hi')).toBeNull();
  });

  it('busts when userId changes (account switch)', () => {
    vi.setSystemTime(new Date(2026, 3, 24, 9, 0));
    writeBriefingCache('user-1', 'en', fixtureBriefing);
    expect(readBriefingCache('user-2', 'en')).toBeNull();
  });

  it('returns null when nothing is cached', () => {
    expect(readBriefingCache('user-1', 'en')).toBeNull();
  });

  it('survives corrupted JSON in storage', () => {
    window.localStorage.setItem(BRIEFING_CACHE_KEY, '{not valid json');
    expect(readBriefingCache('user-1', 'en')).toBeNull();
  });
});

describe('readBriefingCacheSync — pulls userId/locale from persist middleware', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 3, 24, 9, 0));
  });
  afterEach(() => {
    vi.useRealTimers();
    window.localStorage.clear();
  });

  it('reads the cache using userId+locale from the persist keys', () => {
    window.localStorage.setItem(
      'myastro360-auth',
      JSON.stringify({ state: { user: { id: 'user-7' } } }),
    );
    window.localStorage.setItem(
      'myastro360-locale',
      JSON.stringify({ state: { locale: 'hi' } }),
    );
    writeBriefingCache('user-7', 'hi', fixtureBriefing);
    expect(readBriefingCacheSync()).toEqual(fixtureBriefing);
  });

  it('returns null when auth is missing (user logged out)', () => {
    expect(readBriefingCacheSync()).toBeNull();
  });

  it('falls back to locale=en when locale key is absent', () => {
    window.localStorage.setItem(
      'myastro360-auth',
      JSON.stringify({ state: { user: { id: 'user-7' } } }),
    );
    writeBriefingCache('user-7', 'en', fixtureBriefing);
    expect(readBriefingCacheSync()).toEqual(fixtureBriefing);
  });
});
