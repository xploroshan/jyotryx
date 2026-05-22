"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { WEB_TRADITIONS, SLUG_TO_TRADITION, type TraditionId } from "@/lib/traditions";
import { useTranslation } from "@/i18n";
import { FeatureGlyph } from "@/components/icons";

/**
 * v2 feature bar. Slim secondary nav that renders only on tradition
 * pages (/vedic, /western, /chinese, etc). Replaces the FeatureChips
 * sticky strip. ~36px tall vs the previous ~44px, with a clean
 * underline indicator instead of an animated gradient.
 */
export default function FeatureBarV2() {
  const pathname = usePathname() ?? "/";
  const { t } = useTranslation();

  const firstSegment = pathname.split("/").filter(Boolean)[0] ?? "";
  const activeId: TraditionId | null = SLUG_TO_TRADITION[firstSegment] ?? null;
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
      <div className="mx-auto max-w-7xl px-5 sm:px-8 overflow-x-auto no-scrollbar">
        <ul className="flex gap-5 sm:gap-7 py-2.5" role="tablist">
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
      </div>
    </div>
  );
}
