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
    <footer className="border-t divider bg-surface-950">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2.5 mb-4">
              <LogoMark className="h-8 w-8" />
              <span className="text-lg font-semibold text-white tracking-tight">Jyotron</span>
            </div>
            <p className="text-sm text-white/40 leading-relaxed mb-4">
              {t.footer.tagline}
            </p>
            <p className="text-xs text-white/25">
              {t.footer.disclaimer}
            </p>
          </div>

          {/* Links */}
          {footerGroups.map((group) => (
            <div key={group.title}>
              <h3 className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-3">{group.title}</h3>
              <ul className="space-y-2">
                {group.links.map((link) => (
                  <li key={link.href + link.label}>
                    <Link href={link.href} className="text-sm text-white/40 hover:text-white transition-colors duration-150">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 pt-6 border-t divider flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-xs text-white/25">
            &copy; {new Date().getFullYear()} Jyotron. {t.footer.copyright}
          </p>
          <div className="flex gap-6">
            <a href="#" className="text-white/25 hover:text-white/50 transition-colors text-xs">Twitter</a>
            <a href="#" className="text-white/25 hover:text-white/50 transition-colors text-xs">Instagram</a>
            <a href="#" className="text-white/25 hover:text-white/50 transition-colors text-xs">YouTube</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
