"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/lib/store";
import { LogoMark } from "@/components/ui/Logo";
import LanguageSwitcher from "@/components/ui/LanguageSwitcher";
import TraditionSwitcher from "@/components/layout/TraditionSwitcher";
import { useTranslation } from "@/i18n";

export default function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const { user, isAuthenticated, logout } = useAuthStore();
  const { t } = useTranslation();

  // Feature links organized into subtle groups
  const dailyGroup = [
    { href: "/my-day", label: t.nav.myDay },
    { href: "/chat", label: t.nav.consult },
    { href: "/horoscope", label: t.nav.horoscope },
  ];

  const chartsGroup = [
    { href: "/kundli", label: t.nav.kundli },
    { href: "/matching", label: t.nav.matching },
    { href: "/panchang", label: t.nav.panchang },
  ];

  const readingsGroup = [
    { href: "/palmistry", label: t.nav.palmistry },
    { href: "/tarot", label: t.nav.tarot },
    { href: "/numerology", label: t.nav.numerology },
    { href: "/vastu", label: t.nav.vastu },
  ];

  const allLinks = [...dailyGroup, ...chartsGroup, ...readingsGroup];

  useEffect(() => { setMounted(true); }, []);

  const showAuth = mounted && isAuthenticated;

  const featureLinkClass =
    "px-3 py-1.5 text-[13px] text-white/60 hover:text-white rounded-md hover:bg-white/[0.06] transition-colors duration-150 text-center min-w-[96px]";

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-surface-950/80 backdrop-blur-lg border-b divider">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Row 1: Logo + Right-side utility block */}
        <div className="flex h-14 items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 shrink-0">
            <LogoMark className="h-8 w-8" />
            <span className="text-lg font-semibold text-white tracking-tight">
              Jyotron
            </span>
          </Link>

          {/* Desktop Right (single line) */}
          <div className="hidden lg:flex items-center gap-1">
            <TraditionSwitcher />
            <LanguageSwitcher />
            {showAuth ? (
              <>
                {user?.role === "ADMIN" && (
                  <Link href="/admin" className="px-3 py-1.5 text-[13px] text-red-400 hover:text-red-300 transition-colors">
                    {t.common.admin}
                  </Link>
                )}
                <Link href="/reports" className="px-3 py-1.5 text-[13px] text-white/60 hover:text-white transition-colors">
                  {t.common.reports}
                </Link>
                <Link href="/pricing" className="px-3 py-1.5 text-[13px] font-medium text-accent-400 hover:text-accent-300 transition-colors">
                  {t.common.pricing}
                </Link>
                <Link href="/profile" className="px-3 py-1.5 text-[13px] text-white/60 hover:text-white transition-colors max-w-[10ch] truncate" title={user?.name}>
                  {user?.name}
                </Link>
                <button
                  onClick={logout}
                  className="px-3 py-1.5 text-[13px] text-white/40 hover:text-white transition-colors"
                >
                  {t.common.logout}
                </button>
              </>
            ) : (
              <>
                {mounted && (
                  <>
                    <Link href="/auth?mode=login" className="px-3 py-1.5 text-[13px] text-white/60 hover:text-white transition-colors">
                      {t.common.login}
                    </Link>
                    <Link href="/auth?mode=signup" className="px-4 py-1.5 text-[13px] btn-primary rounded-lg">
                      {t.common.signup}
                    </Link>
                  </>
                )}
              </>
            )}
          </div>

          {/* Mobile Hamburger */}
          <div className="flex items-center gap-2 lg:hidden">
            <TraditionSwitcher />
            <LanguageSwitcher />
            <button
              className="p-2 -mr-2 text-white/60 hover:text-white"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle menu"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                {mobileMenuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>

        {/* Row 2: Feature navigation (desktop only) */}
        <div className="hidden lg:flex items-center justify-center h-11 border-t border-white/[0.04]">
          <div className="flex items-center gap-1">
            {dailyGroup.map((link) => (
              <Link key={link.href} href={link.href} className={featureLinkClass}>
                {link.label}
              </Link>
            ))}
          </div>

          <div className="h-3 w-px bg-white/10 mx-3" aria-hidden />

          <div className="flex items-center gap-1">
            {chartsGroup.map((link) => (
              <Link key={link.href} href={link.href} className={featureLinkClass}>
                {link.label}
              </Link>
            ))}
          </div>

          <div className="h-3 w-px bg-white/10 mx-3" aria-hidden />

          <div className="flex items-center gap-1">
            {readingsGroup.map((link) => (
              <Link key={link.href} href={link.href} className={featureLinkClass}>
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      <div className={cn("lg:hidden", mobileMenuOpen ? "block" : "hidden")}>
        <div className="bg-surface-950 border-t divider px-4 py-3 space-y-1">
          {allLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="block px-3 py-2.5 text-sm text-white/60 hover:text-white hover:bg-white/[0.04] rounded-lg active:bg-white/[0.06]"
              onClick={() => setMobileMenuOpen(false)}
            >
              {link.label}
            </Link>
          ))}
          <div className="pt-3 mt-2 border-t divider">
            {showAuth ? (
              <div className="space-y-1">
                {user?.role === "ADMIN" && (
                  <Link href="/admin" className="block px-3 py-2.5 text-sm text-red-400" onClick={() => setMobileMenuOpen(false)}>
                    {t.common.admin}
                  </Link>
                )}
                <Link href="/reports" className="block px-3 py-2.5 text-sm text-white/60 hover:text-white" onClick={() => setMobileMenuOpen(false)}>
                  {t.common.reports}
                </Link>
                <Link href="/pricing" className="block px-3 py-2.5 text-sm font-medium text-accent-400" onClick={() => setMobileMenuOpen(false)}>
                  {t.common.pricing}
                </Link>
                <Link href="/profile" className="block px-3 py-2.5 text-sm text-white/60 hover:text-white" onClick={() => setMobileMenuOpen(false)}>
                  {user?.name}
                </Link>
                <button
                  onClick={() => { logout(); setMobileMenuOpen(false); }}
                  className="w-full text-left px-3 py-2.5 text-sm text-white/40 hover:text-white"
                >
                  {t.common.logout}
                </button>
              </div>
            ) : (
              <div className="flex gap-2 pt-1">
                {mounted && (
                  <>
                    <Link href="/auth?mode=login" className="flex-1 text-center px-4 py-2.5 text-sm btn-secondary rounded-lg" onClick={() => setMobileMenuOpen(false)}>
                      {t.common.login}
                    </Link>
                    <Link href="/auth?mode=signup" className="flex-1 text-center px-4 py-2.5 text-sm btn-primary rounded-lg" onClick={() => setMobileMenuOpen(false)}>
                      {t.common.signup}
                    </Link>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
