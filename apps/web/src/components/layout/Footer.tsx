"use client";

import Link from "next/link";
import { LogoMark } from "@/components/ui/Logo";
import { useTranslation } from "@/i18n";

export default function Footer() {
  const { t } = useTranslation();

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
        { label: t.common.pricing, href: "/pricing" },
        { label: t.common.reports, href: "/reports" },
        { label: t.common.signup, href: "/auth?mode=signup" },
      ],
    },
    {
      title: t.footer.groupCompany,
      links: [
        { label: t.profile.title, href: "/profile" },
        { label: t.common.login, href: "/auth?mode=login" },
        { label: t.common.pricing, href: "/pricing" },
      ],
    },
  ];

  return (
    <footer className="border-t border-surface-900/[0.04] bg-surface-50">
      <div className="mx-auto max-w-7xl px-5 sm:px-8 py-16">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-10">
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2.5 mb-5">
              <LogoMark className="h-7 w-7" />
              <span className="text-[15px] font-semibold text-surface-900 tracking-tight">Jyotron</span>
            </div>
            <p className="text-sm text-surface-900/65 leading-relaxed mb-5">
              {t.footer.tagline}
            </p>
            <p className="text-xs text-surface-900/45 leading-relaxed">
              {t.footer.disclaimer}
            </p>
          </div>

          {footerGroups.map((group) => (
            <div key={group.title}>
              <h3 className="text-[11px] font-medium text-surface-900/55 uppercase tracking-widest mb-4">
                {group.title}
              </h3>
              <ul className="space-y-3">
                {group.links.map((link) => (
                  <li key={link.href + link.label}>
                    <Link
                      href={link.href}
                      className="text-sm text-surface-900/65 hover:text-surface-900 transition-colors duration-200"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-16 pt-8 border-t border-surface-900/[0.04] flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-xs text-surface-900/45">
            &copy; {new Date().getFullYear()} Jyotron. {t.footer.copyright}
          </p>
          <div className="flex gap-8">
            <a href="#" className="text-surface-900/55 hover:text-surface-900 transition-colors text-xs">Twitter</a>
            <a href="#" className="text-surface-900/55 hover:text-surface-900 transition-colors text-xs">Instagram</a>
            <a href="#" className="text-surface-900/55 hover:text-surface-900 transition-colors text-xs">YouTube</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
