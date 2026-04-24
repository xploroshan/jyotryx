/**
 * localStorage briefing cache helpers.
 *
 * The daily briefing is cached for the duration of one local calendar
 * day so that a fresh render doesn't wait for a full round-trip every
 * time. The cache is keyed by userId + locale so switching accounts or
 * language busts immediately; the `date` field (YYYY-MM-DD) is how
 * cross-day staleness is detected.
 *
 * Extracted from page.tsx so these small pure functions can be
 * unit-tested with a mocked system clock (see briefing-cache.test.ts).
 */
import type { DailyBriefing } from './types';

export const BRIEFING_CACHE_KEY = 'jyotron-my-day-briefing';

export type BriefingCache = {
  date: string; // YYYY-MM-DD of cached entry; expires daily
  locale: string; // cached locale; bust when user switches language
  userId: string; // bust when user switches accounts
  data: DailyBriefing;
};

/** YYYY-MM-DD in the host's local timezone at the given instant. */
function localDayKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function readBriefingCache(
  userId: string,
  locale: string,
  now: Date = new Date(),
): DailyBriefing | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(BRIEFING_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as BriefingCache;
    const today = localDayKey(now);
    if (parsed.date !== today) return null;
    if (parsed.locale !== locale) return null;
    if (parsed.userId !== userId) return null;
    return parsed.data;
  } catch {
    return null;
  }
}

/**
 * Synchronous cache read used by the useState initializer, so the FIRST
 * client render already has the briefing in hand — no wait for Zustand
 * rehydration or useEffect. We pull userId/locale directly from the
 * persist middleware's localStorage entries instead of routing through
 * the hooks to avoid an extra render cycle on the critical path.
 */
export function readBriefingCacheSync(now: Date = new Date()): DailyBriefing | null {
  if (typeof window === 'undefined') return null;
  try {
    const authRaw = window.localStorage.getItem('jyotron-auth');
    const localeRaw = window.localStorage.getItem('jyotron-locale');
    if (!authRaw) return null;
    const userId = JSON.parse(authRaw)?.state?.user?.id;
    if (!userId) return null;
    const loc = (localeRaw && JSON.parse(localeRaw)?.state?.locale) || 'en';
    return readBriefingCache(userId, loc, now);
  } catch {
    return null;
  }
}

export function writeBriefingCache(
  userId: string,
  locale: string,
  data: DailyBriefing,
  now: Date = new Date(),
): void {
  if (typeof window === 'undefined') return;
  try {
    const payload: BriefingCache = {
      date: localDayKey(now),
      locale,
      userId,
      data,
    };
    window.localStorage.setItem(BRIEFING_CACHE_KEY, JSON.stringify(payload));
  } catch {
    /* quota / private mode */
  }
}
