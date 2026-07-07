"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogoMark, Wordmark } from "@/components/ui/Logo";
import { useTranslation } from "@/i18n";
import { LANDING_LOCALES, type Locale } from "@/i18n/locales";
import { LOCALIZED_PATHS } from "@/lib/seo/feature-pages";
import { ZODIAC_SIGNS } from "@/lib/seo/zodiac";
import { usePricingConfig } from "@/lib/usePricingConfig";

/**
 * Site footer. Doubles as the site-wide internal-linking backbone: it links
 * every Tier-A feature page, both cities hubs, and all 12 horoscope sign
 * pages (the pattern competitors use to keep those clusters crawlable from
 * every URL). This component is server-rendered into initial HTML by the
 * root layout, so these are real links for crawlers.
 *
 * Locale-aware: on /<locale>/… pages, links whose localized variant exists
 * point at the /<locale> equivalent, keeping the localized tree internally
 * connected instead of dumping users (and crawlers) back to English.
 */
export default function Footer() {
  const { t, locale } = useTranslation();
  const { pricingEnabled } = usePricingConfig();
  const pathname = usePathname() ?? "/";

  // The locale whose URL tree we're currently inside (from the URL, not the
  // store — URL is the source of truth for where links should point).
  const urlLocale = pathname.split("/")[1];
  const inLocaleTree = LANDING_LOCALES.includes(urlLocale as Locale) && urlLocale !== "en";

  /** /kundli → /hi/kundli when browsing the /hi tree and the variant exists. */
  const localized = (href: string): string =>
    inLocaleTree && LOCALIZED_PATHS.includes(href) ? `/${urlLocale}${href}` : href;

  /** Sign landing pages exist for LANDING_LOCALES only. */
  const signHref = (slug: string): string =>
    inLocaleTree ? `/${urlLocale}/horoscope/${slug}` : `/horoscope/${slug}`;

  const footerGroups = [
    {
      title: t.footer.groupFeatures,
      links: [
        { label: t.nav.consult, href: "/chat" },
        { label: t.nav.kundli, href: localized("/kundli") },
        { label: t.nav.matching, href: localized("/matching") },
        { label: t.nav.horoscope, href: "/horoscope" },
        { label: t.nav.panchang, href: "/panchang" },
        { label: t.nav.palmistry, href: localized("/palmistry") },
        { label: t.nav.numerology, href: localized("/numerology") },
        { label: t.nav.tarot, href: localized("/tarot") },
        { label: t.nav.vastu, href: localized("/vastu") },
        { label: t.muhurat.title, href: localized("/muhurat") },
      ],
    },
    {
      // 12-sign cluster: keeps the 336 sign/period landing pages one hop
      // from every page on the site.
      title: t.nav.horoscope,
      links: ZODIAC_SIGNS.map((s) => ({
        label: (t.horoscope as unknown as Record<string, string>)[s.slug] ?? s.name,
        href: signHref(s.slug),
      })),
    },
    {
      title: t.footer.groupResources,
      links: [
        // Pricing link only when the operator has enabled the pricing page.
        ...(pricingEnabled ? [{ label: t.common.pricing, href: "/pricing" }] : []),
        { label: "Learn", href: "/learn" },
        { label: `${t.nav.panchang} — ${t.footer.byCity}`, href: "/panchang/cities" },
        { label: `${t.nav.kundli} — ${t.footer.byCity}`, href: "/kundli/cities" },
        { label: t.common.reports, href: "/reports" },
        { label: t.common.signup, href: "/auth?mode=signup" },
      ],
    },
    {
      title: t.footer.groupCompany,
      links: [
        { label: t.profile.title, href: "/profile" },
        { label: t.common.login, href: "/auth?mode=login" },
        ...(pricingEnabled ? [{ label: t.common.pricing, href: "/pricing" }] : []),
      ],
    },
  ];

  return (
    <footer className="relative bg-surface-950 text-surface-50 overflow-hidden">
      {/* Soft sunrise edge along the top — visually ties the dark anchor
          back to the brand-orange palette without painting a hard line. */}
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-px"
        style={{
          background:
            "linear-gradient(90deg, rgba(255,77,0,0) 0%, rgba(255,77,0,0.55) 50%, rgba(255,77,0,0) 100%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 left-1/2 -translate-x-1/2 w-[80%] h-64 opacity-50 blur-3xl"
        style={{
          background:
            "radial-gradient(ellipse at center, rgba(255,182,39,0.18) 0%, rgba(255,77,0,0.10) 50%, transparent 80%)",
        }}
      />

      <div className="relative mx-auto max-w-7xl px-5 sm:px-8 py-20">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-12">
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2.5 mb-5">
              <LogoMark className="h-7 w-7" />
              <Wordmark className="font-display text-[19px] font-semibold text-surface-50 tracking-tight" />
            </div>
            <p className="text-sm text-surface-50/70 leading-relaxed mb-5 max-w-xs">
              {t.footer.tagline}
            </p>
            <p className="text-xs text-surface-50/45 leading-relaxed max-w-xs">
              {t.footer.disclaimer}
            </p>
          </div>

          {footerGroups.map((group, gi) => (
            <div key={`${group.title}-${gi}`}>
              <h3 className="text-[11px] font-medium text-surface-50/55 uppercase tracking-[0.22em] mb-4">
                {group.title}
              </h3>
              <ul className="space-y-3">
                {group.links.map((link) => (
                  <li key={link.href + link.label}>
                    <Link
                      href={link.href}
                      className="text-sm text-surface-50/70 hover:text-primary-300 transition-colors duration-200"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-16 pt-8 border-t border-white/[0.06] flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-xs text-surface-50/45">
            &copy; {new Date().getFullYear()} MyAstro360. {t.footer.copyright}
          </p>
        </div>
      </div>
    </footer>
  );
}
