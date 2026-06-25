"use client";

import Link from "next/link";
import { LogoMark, Wordmark } from "@/components/ui/Logo";
import { useTranslation } from "@/i18n";
import { usePricingConfig } from "@/lib/usePricingConfig";

export default function Footer() {
  const { t } = useTranslation();
  const { pricingEnabled } = usePricingConfig();

  const footerGroups = [
    {
      title: t.footer.groupFeatures,
      links: [
        { label: t.nav.consult, href: "/chat" },
        { label: t.nav.palmistry, href: "/palmistry" },
        { label: t.nav.kundli, href: "/kundli" },
        { label: t.nav.matching, href: "/matching" },
        { label: t.nav.horoscope, href: "/horoscope" },
        { label: t.nav.panchang, href: "/panchang" },
      ],
    },
    {
      title: t.footer.groupResources,
      links: [
        // Pricing link only when the operator has enabled the pricing page.
        ...(pricingEnabled ? [{ label: t.common.pricing, href: "/pricing" }] : []),
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
        <div className="grid grid-cols-2 md:grid-cols-4 gap-12">
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

          {footerGroups.map((group) => (
            <div key={group.title}>
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
          <div className="flex gap-8">
            <a href="#" className="text-surface-50/55 hover:text-primary-300 transition-colors text-xs">Twitter</a>
            <a href="#" className="text-surface-50/55 hover:text-primary-300 transition-colors text-xs">Instagram</a>
            <a href="#" className="text-surface-50/55 hover:text-primary-300 transition-colors text-xs">YouTube</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
