"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/lib/store";
import { LogoMark } from "@/components/ui/Logo";
import LanguageSwitcher from "@/components/ui/LanguageSwitcher";
import { useTranslation } from "@/i18n";

export default function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { user, isAuthenticated, logout } = useAuthStore();
  const { t } = useTranslation();

  useEffect(() => {
    setMounted(true);
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const showAuth = mounted && isAuthenticated;

  return (
    <nav
      className={cn(
        "fixed top-0 left-0 right-0 z-50 transition-all duration-300",
        scrolled
          ? "bg-surface-950/80 backdrop-blur-2xl border-b border-white/[0.06]"
          : "bg-transparent"
      )}
    >
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <div className="flex h-16 items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 shrink-0">
            <LogoMark className="h-7 w-7" />
            <span className="text-[15px] font-semibold text-white tracking-tight">
              Jyotron
            </span>
          </Link>

          <div className="hidden lg:flex items-center gap-1">
            <LanguageSwitcher />
            {showAuth ? (
              <>
                {user?.role === "ADMIN" && (
                  <Link
                    href="/admin"
                    className="px-3.5 py-2 text-[13px] text-red-400 hover:text-red-300 transition-colors rounded-lg hover:bg-white/[0.04]"
                  >
                    {t.common.admin}
                  </Link>
                )}
                <Link
                  href="/reports"
                  className="px-3.5 py-2 text-[13px] text-white/50 hover:text-white transition-colors rounded-lg hover:bg-white/[0.04]"
                >
                  {t.common.reports}
                </Link>
                <Link
                  href="/pricing"
                  className="px-3.5 py-2 text-[13px] font-medium text-primary-400 hover:text-primary-300 transition-colors rounded-lg hover:bg-white/[0.04]"
                >
                  {t.common.pricing}
                </Link>
                <Link
                  href="/profile"
                  className="px-3.5 py-2 text-[13px] text-white/50 hover:text-white transition-colors rounded-lg hover:bg-white/[0.04] max-w-[10ch] truncate"
                  title={user?.name}
                >
                  {user?.name}
                </Link>
                <button
                  onClick={logout}
                  className="px-3.5 py-2 text-[13px] text-white/35 hover:text-white transition-colors rounded-lg hover:bg-white/[0.04]"
                >
                  {t.common.logout}
                </button>
              </>
            ) : (
              <>
                {mounted && (
                  <>
                    <Link
                      href="/auth?mode=login"
                      className="px-3.5 py-2 text-[13px] text-white/50 hover:text-white transition-colors rounded-lg hover:bg-white/[0.04]"
                    >
                      {t.common.login}
                    </Link>
                    <Link
                      href="/auth?mode=signup"
                      className="px-4 py-2 text-[13px] btn-primary rounded-full"
                    >
                      {t.common.signup}
                    </Link>
                  </>
                )}
              </>
            )}
          </div>

          <div className="flex items-center gap-2 lg:hidden">
            <LanguageSwitcher />
            <button
              className="p-2 -mr-2 text-white/50 hover:text-white transition-colors"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle menu"
            >
              <svg
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                {mobileMenuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>
      </div>

      <div
        className={cn(
          "lg:hidden transition-all duration-300 overflow-hidden",
          mobileMenuOpen ? "max-h-80 opacity-100" : "max-h-0 opacity-0"
        )}
      >
        <div className="bg-surface-950/95 backdrop-blur-2xl border-t border-white/[0.06] px-5 py-4">
          {showAuth ? (
            <div className="space-y-1">
              {user?.role === "ADMIN" && (
                <Link
                  href="/admin"
                  className="block px-3 py-2.5 text-sm text-red-400 rounded-lg"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {t.common.admin}
                </Link>
              )}
              <Link
                href="/reports"
                className="block px-3 py-2.5 text-sm text-white/50 hover:text-white rounded-lg"
                onClick={() => setMobileMenuOpen(false)}
              >
                {t.common.reports}
              </Link>
              <Link
                href="/pricing"
                className="block px-3 py-2.5 text-sm font-medium text-primary-400 rounded-lg"
                onClick={() => setMobileMenuOpen(false)}
              >
                {t.common.pricing}
              </Link>
              <Link
                href="/profile"
                className="block px-3 py-2.5 text-sm text-white/50 hover:text-white rounded-lg"
                onClick={() => setMobileMenuOpen(false)}
              >
                {user?.name}
              </Link>
              <button
                onClick={() => {
                  logout();
                  setMobileMenuOpen(false);
                }}
                className="w-full text-left px-3 py-2.5 text-sm text-white/35 hover:text-white rounded-lg"
              >
                {t.common.logout}
              </button>
            </div>
          ) : (
            <div className="flex gap-3 pt-1">
              {mounted && (
                <>
                  <Link
                    href="/auth?mode=login"
                    className="flex-1 text-center px-4 py-2.5 text-sm btn-secondary rounded-full"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    {t.common.login}
                  </Link>
                  <Link
                    href="/auth?mode=signup"
                    className="flex-1 text-center px-4 py-2.5 text-sm btn-primary rounded-full"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    {t.common.signup}
                  </Link>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
