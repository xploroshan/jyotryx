/**
 * Honest, stable dates for sitemap lastModified and Article datePublished/
 * dateModified. The previous behaviour stamped request time on every one of
 * ~840 sitemap URLs — Google learns to distrust (and then ignore) lastmod
 * when it changes on every fetch without the content changing.
 *
 * Daily pages (sign horoscopes, panchang cities) genuinely refresh at the
 * IST day boundary; period pages at their period start. IST has no DST, so
 * the fixed +05:30 offset is safe.
 */

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

/** Midnight (00:00) IST of the current day, as a Date. */
export function todayIST(now: Date = new Date()): Date {
  const ist = new Date(now.getTime() + IST_OFFSET_MS);
  const midnightIstAsUtc = Date.UTC(
    ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate(), 0, 0, 0,
  );
  return new Date(midnightIstAsUtc - IST_OFFSET_MS);
}

/** Monday 00:00 IST of the current week. */
export function startOfWeekIST(now: Date = new Date()): Date {
  const today = todayIST(now);
  const ist = new Date(today.getTime() + IST_OFFSET_MS);
  const dow = ist.getUTCDay(); // 0=Sun
  const back = (dow + 6) % 7; // days since Monday
  return new Date(today.getTime() - back * 24 * 60 * 60 * 1000);
}

/** 1st of the month, 00:00 IST. */
export function startOfMonthIST(now: Date = new Date()): Date {
  const ist = new Date(now.getTime() + IST_OFFSET_MS);
  return new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), 1) - IST_OFFSET_MS);
}

/** 1 January, 00:00 IST. */
export function startOfYearIST(now: Date = new Date()): Date {
  const ist = new Date(now.getTime() + IST_OFFSET_MS);
  return new Date(Date.UTC(ist.getUTCFullYear(), 0, 1) - IST_OFFSET_MS);
}

export function periodStartIST(period: "daily" | "weekly" | "monthly" | "yearly", now: Date = new Date()): Date {
  switch (period) {
    case "daily": return todayIST(now);
    case "weekly": return startOfWeekIST(now);
    case "monthly": return startOfMonthIST(now);
    case "yearly": return startOfYearIST(now);
  }
}

/**
 * lastModified for STATIC pages, bumped manually when their copy meaningfully
 * changes (review convention: touching a static page's content = update the
 * relevant const). Grouped so one edit doesn't falsely "freshen" everything.
 */
export const CONTENT_VERSION = {
  /** Feature/marketing pages (kundli, matching, tarot, …). */
  features: new Date("2026-07-07"),
  /** Tradition/technique tool pages (dasha, KP, bazi, …). */
  traditions: new Date("2026-07-07"),
  /** Cities directory hubs. */
  directories: new Date("2026-07-07"),
} as const;
