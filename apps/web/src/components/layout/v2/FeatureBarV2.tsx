"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { WEB_TRADITIONS, resolveTraditionFromPath, type TraditionId, type TraditionFeature } from "@/lib/traditions";
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
 * different one.
 *
 * Layout: traditions with a long feature list (Vedic has 17) are split
 * into two balanced rows on wide desktops (≥xl), each evenly distributed
 * edge-to-edge so nothing is hidden and the spacing reads as intentional
 * rather than a ragged wrap. Below xl — where 9 wide labels can't fit on
 * one line without overflowing — it falls back to a single swipe-scroll
 * row with affordances. Short feature lists (≤9) always render as one
 * left-packed row. Each item is a pill that lights up on hover (selection
 * affordance) and fills with the accent colour on the current page.
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

  // Split into two balanced rows once the list is long enough that a single
  // row would crowd (9 is the comfortable single-row ceiling on desktop).
  // 17 → 9 + 8; a future 10-feature tradition → 5 + 5.
  const feats = cfg.features;
  const twoRows = feats.length > 9;
  const mid = twoRows ? Math.ceil(feats.length / 2) : feats.length;
  const row1 = feats.slice(0, mid);
  const row2 = feats.slice(mid);

  const renderItem = (f: TraditionFeature) => {
    const isActive = pathname === f.href;
    const label = readLabel(f.labelKey, f.slug);
    const base =
      "inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12.5px] whitespace-nowrap transition-colors duration-150";

    if (!f.available) {
      return (
        <li key={f.slug} className="shrink-0">
          <span
            className={`${base} opacity-40 cursor-not-allowed text-[var(--color-fg-muted)]`}
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
          aria-current={isActive ? "page" : undefined}
          className={`${base} ${
            isActive
              ? "bg-[var(--color-accent-subtle)] text-[var(--color-accent)] font-semibold"
              : "text-[var(--color-fg-muted)] hover:bg-[var(--color-bg-subtle)] hover:text-[var(--color-fg)]"
          }`}
        >
          <FeatureGlyph slug={f.slug} size={14} />
          <span>{label}</span>
        </Link>
      </li>
    );
  };

  // Interleave a thin warm hairline (--color-border) between items so each
  // feature is visually separated from its neighbours. The separator is a
  // short, vertically-centred 1px line that sits in the gap; with
  // justify-between it lands centred between the two items it divides.
  const renderRow = (items: TraditionFeature[]) =>
    items.flatMap((f, i) =>
      i === 0
        ? [renderItem(f)]
        : [
            <li
              key={`${f.slug}-sep`}
              aria-hidden
              className="self-center h-4 w-px bg-[var(--color-border)] shrink-0"
            />,
            renderItem(f),
          ],
    );

  return (
    <div
      className="sticky top-14 z-40 border-b border-[var(--color-border)]"
      style={{ background: "rgba(237, 228, 208, 0.88)", backdropFilter: "blur(16px) saturate(140%)" }}
    >
      {/* Wide desktop (≥xl): balanced rows, evenly distributed, nothing hidden. */}
      <nav
        aria-label={readLabel(cfg.labelKey, cfg.slug)}
        className="hidden xl:block mx-auto max-w-7xl px-8"
      >
        <ul
          className={`flex items-center pt-2 ${
            twoRows ? "justify-between gap-x-1 pb-1" : "justify-start gap-x-6 pb-2"
          }`}
        >
          {renderRow(row1)}
        </ul>
        {row2.length > 0 && (
          <ul className="flex items-center justify-between gap-x-1 pt-1 pb-2">
            {renderRow(row2)}
          </ul>
        )}
      </nav>

      {/* Phones, tablets and narrow laptops (<xl): single swipeable row with
          scroll affordances, since 9 wide labels can't fit edge-to-edge. */}
      <div className="xl:hidden">
        <ScrollableRow
          className="mx-auto max-w-7xl"
          innerClassName="px-5 sm:px-8"
          fadeColor="rgb(237, 228, 208)"
        >
          <nav aria-label={readLabel(cfg.labelKey, cfg.slug)}>
            <ul className="flex items-center gap-x-3 sm:gap-x-4 py-2.5">{renderRow(feats)}</ul>
          </nav>
        </ScrollableRow>
      </div>
    </div>
  );
}
