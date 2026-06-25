"use client";

/**
 * Thin, SSR-safe analytics fan-out.
 *
 * Sends a single event to BOTH sinks that may be present on the page:
 *   - GA4 via `window.gtag`   (loaded by components/analytics/GoogleAnalytics.tsx)
 *   - PostHog via `window.posthog` (loaded by components/analytics/PostHogAnalytics.tsx)
 *
 * Both are injected as `next/script` snippets in the root layout, each gated
 * on its own public env key, so in dev / un-keyed environments every call
 * here is a silent no-op. Nothing throws and nothing blocks the UI — a lost
 * analytics event must never break a user-visible success path. GA4 is the
 * marketing/attribution sink; PostHog is the product sink (funnels, retention
 * cohorts). Firing both from one call keeps event names identical across them.
 */

export type EventProps = Record<string, string | number | boolean | null | undefined>;

interface PosthogLike {
  capture: (event: string, props?: EventProps) => void;
  identify: (id: string, props?: EventProps) => void;
}

interface AnalyticsWindow {
  gtag?: (...args: unknown[]) => void;
  posthog?: PosthogLike;
  localStorage?: Storage;
}

function analyticsWindow(): AnalyticsWindow | null {
  return typeof window === "undefined" ? null : (window as unknown as AnalyticsWindow);
}

/** Fire an event to every analytics sink present. Safe to call anywhere. */
export function track(event: string, props?: EventProps): void {
  const win = analyticsWindow();
  if (!win) return;
  try {
    win.gtag?.("event", event, props ?? {});
  } catch {
    /* GA not ready — ignore */
  }
  try {
    win.posthog?.capture(event, props);
  } catch {
    /* PostHog not ready — ignore */
  }
}

/** Associate subsequent events with a user id (called on auth success). */
export function identify(userId: string, traits?: EventProps): void {
  if (!userId) return;
  const win = analyticsWindow();
  if (!win) return;
  try {
    win.gtag?.("set", { user_id: userId });
  } catch {
    /* ignore */
  }
  try {
    win.posthog?.identify(userId, traits);
  } catch {
    /* ignore */
  }
}

const ONCE_PREFIX = "myastro360.evt.once.";

/**
 * Fire an event at most once per browser, keyed by `key`. Used for
 * milestone/activation events (first reading, first signup) so a refresh or
 * a repeated action doesn't double-count them. Returns true if it fired.
 *
 * Falls through to firing if localStorage is unavailable (private mode /
 * quota) — a possible duplicate is preferable to a missed activation signal.
 */
export function trackOnce(key: string, event: string, props?: EventProps): boolean {
  const win = analyticsWindow();
  const storageKey = ONCE_PREFIX + key;
  if (win?.localStorage) {
    try {
      if (win.localStorage.getItem(storageKey)) return false;
      win.localStorage.setItem(storageKey, "1");
    } catch {
      /* fall through and still fire */
    }
  }
  track(event, props);
  return true;
}
