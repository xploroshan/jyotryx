"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { WEB_TRADITIONS, resolveTraditionFromPath, type TraditionId } from "@/lib/traditions";
import { useAuthStore, useAuthHydrated } from "@/lib/store";
import { useTranslation } from "@/i18n";
import { FeatureGlyph } from "@/components/icons";
import { ScrollableRow } from "@/components/ui/ScrollableRow";

/**
 * v2 feature bar. Slim secondary nav that renders the sub-features of the
 * user's current tradition. On a tradition page (/vedic, /western, …) the
 * tradition comes from the URL; on cross-cutting pages (My Day, home, …)
 * it falls back to the user's persisted `primaryTradition`, so the
 * selected tradition and its sub-features stay put until the user picks a
 * different one. Replaces the FeatureChips sticky strip. ~36px tall vs the
 * previous ~44px, with a clean underline indicator instead of an animated
 * gradient.
 */
export default function FeatureBarV2() {
  const pathname = usePathname() ?? "/";
  const { t } = useTranslation();
  const { user, activeTradition } = useAuthStore();
  const hydrated = useAuthHydrated();

  // Resolve the tradition from the URL — this covers tradition dashboards
  // (/vedic) AND feature pages (/horoscope, /kundli, /western/natal), so
  // the bar never vanishes when you open a sub-feature.
  const urlTrad = resolveTraditionFromPath(pathname);
  // On tradition-agnostic pages (My Day, home, …) fall back to the last
  // tradition the user was in (then their saved primary). Gated on
  // hydration so SSR and the first client render agree (no bar) and the
  // remembered bar slots in only after the auth store rehydrates.
  const remembered = hydrated
    ? ((activeTradition as TraditionId | null) ?? (user?.primaryTradition as TraditionId | null) ?? null)
    : null;
  const activeId: TraditionId | null =
    urlTrad ?? (remembered && WEB_TRADITIONS[remembered] ? remembered : null);
  if (!activeId) return null;
  const cfg = WEB_TRADITIONS[activeId];

  const readLabel = (path: string, fallback: string): string => {
    const parts = path.split(".");
    let node: unknown = t;
    for (const part of parts) {
      if (node && typeof node === "object" && part in (node as Record<string, unknown>)) {
        node = (node as Record<string, unknown>)[part];
      } else {
        return fallback;
      }
    }
    return typeof node === "string" ? node : fallback;
  };

  return (
    <div
      className="sticky top-14 z-40 border-b border-[var(--color-border)]"
      style={{ background: "rgba(237, 228, 208, 0.88)", backdropFilter: "blur(16px) saturate(140%)" }}
    >
      <ScrollableRow className="mx-auto max-w-7xl" innerClassName="px-5 sm:px-8" fadeColor="rgb(237, 228, 208)">
        {/* On phones/tablets (touch) the row stays a single swipeable line with
            scroll affordances. On desktop (≥lg, where horizontal scrolling is
            unnatural) it wraps to as many rows as needed so no sub-feature is
            ever hidden off-screen — important for traditions with ~17 features. */}
        <ul className="flex flex-nowrap lg:flex-wrap gap-x-5 sm:gap-x-7 gap-y-3 py-2.5" role="tablist">
          {cfg.features.map((f) => {
            const isActive = pathname === f.href;
            const label = readLabel(f.labelKey, f.slug);

            if (!f.available) {
              return (
                <li key={f.slug} className="shrink-0">
                  <span
                    className="inline-flex items-center gap-1.5 py-1 text-[12.5px] opacity-40 cursor-not-allowed text-[var(--color-fg-muted)]"
                    aria-disabled="true"
                  >
                    <FeatureGlyph slug={f.slug} size={14} />
                    <span>{label}</span>
                  </span>
                </li>
              );
            }
            return (
              <li key={f.slug} className="shrink-0">
                <Link
                  href={f.href}
                  className={`relative inline-flex items-center gap-1.5 py-1 text-[12.5px] transition-colors duration-150 ${
                    isActive
                      ? "text-[var(--color-fg)] font-semibold"
                      : "text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
                  }`}
                  aria-current={isActive ? "page" : undefined}
                >
                  <FeatureGlyph slug={f.slug} size={14} />
                  <span>{label}</span>
                  {isActive && (
                    <span
                      aria-hidden
                      className="absolute left-0 right-0 -bottom-[11px] h-[2px] bg-[var(--color-accent)] rounded-full"
                    />
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </ScrollableRow>
    </div>
  );
}
