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
  dataLayer?: unknown[];
  posthog?: PosthogLike;
  /** Pre-load PostHog queue, drained by the posthog-init lazyOnload script. */
  __phq?: [keyof PosthogLike, ...unknown[]][];
  localStorage?: Storage;
}

function analyticsWindow(): AnalyticsWindow | null {
  return typeof window === "undefined" ? null : (window as unknown as AnalyticsWindow);
}

/**
 * Both SDKs load with `strategy="lazyOnload"` (off the critical path), so
 * events fired before the `load` event would be dropped by a bare
 * `win.gtag?.()` / `win.posthog?.capture()`. Instead, queue:
 *
 *  - GA: gtag.js drains window.dataLayer on load, but only entries that are
 *    `Arguments` objects (what the official stub pushes) — plain arrays are
 *    ignored — so this mimics the stub exactly.
 *  - PostHog: buffered in window.__phq; the posthog-init script replays the
 *    queue right after `posthog.init()` (into the loader's own stubs, which
 *    forward to the real library once it arrives).
 */
function queueGtag(win: AnalyticsWindow, ...args: unknown[]): void {
  const dl = (win.dataLayer = win.dataLayer ?? []);
  const stub: (...stubArgs: unknown[]) => void = function () {
    dl.push(arguments);
  };
  stub(...args);
}

/** Fire an event to every analytics sink present. Safe to call anywhere. */
export function track(event: string, props?: EventProps): void {
  const win = analyticsWindow();
  if (!win) return;
  try {
    if (win.gtag) win.gtag("event", event, props ?? {});
    else queueGtag(win, "event", event, props ?? {});
  } catch {
    /* GA not ready — ignore */
  }
  try {
    if (win.posthog) win.posthog.capture(event, props);
    else (win.__phq = win.__phq ?? []).push(["capture", event, props]);
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
    if (win.gtag) win.gtag("set", { user_id: userId });
    else queueGtag(win, "set", { user_id: userId });
  } catch {
    /* ignore */
  }
  try {
    if (win.posthog) win.posthog.identify(userId, traits);
    else (win.__phq = win.__phq ?? []).push(["identify", userId, traits]);
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
