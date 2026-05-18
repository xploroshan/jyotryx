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

  // On the cream canvas the navbar is always ink-on-cream. We swap the
  // surface from transparent (sitting flush against the dawn wash) to a
  // frosted cream pill once the user scrolls — keeps the chrome legible
  // over white BentoSummary cards without painting a black bar across
  // the editorial layout.
  const linkBase =
    "px-3.5 py-2 text-[13px] rounded-lg transition-colors duration-200 focus-ring";

  return (
    <nav
      className={cn(
        "fixed top-0 left-0 right-0 z-50 transition-all duration-300",
        scrolled
          ? "glass-strong shadow-warm-sm"
          : "bg-transparent"
      )}
    >
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <div className="flex h-16 items-center justify-between">
          <Link
            href="/"
            className="flex items-center gap-2.5 shrink-0 group transition-transform duration-200 hover:scale-[1.02] focus-ring rounded-lg"
          >
            <LogoMark className="h-7 w-7 transition-transform duration-500 group-hover:rotate-[20deg]" />
            <span className="font-display text-[19px] font-semibold text-surface-950 tracking-tight">
              myastro360
            </span>
          </Link>

          <div className="hidden lg:flex items-center gap-1">
            <LanguageSwitcher />
            {showAuth ? (
              <>
                {user?.role === "ADMIN" && (
                  <Link
                    href="/admin"
                    className={cn(linkBase, "text-primary-600 hover:text-primary-500 hover:bg-primary-500/10")}
                  >
                    {t.common.admin}
                  </Link>
                )}
                <Link
                  href="/reports"
                  className={cn(linkBase, "text-ink-700 hover:text-surface-950 hover:bg-black/[0.04]")}
                  style={{ color: "var(--color-ink-700)" }}
                >
                  {t.common.reports}
                </Link>
                <Link
                  href="/pricing"
                  className={cn(linkBase, "font-semibold text-primary-600 hover:text-primary-500 hover:bg-primary-500/10")}
                >
                  {t.common.pricing}
                </Link>
                <Link
                  href="/referral"
                  className={cn(linkBase, "hover:bg-black/[0.04]")}
                  style={{ color: "var(--color-ink-700)" }}
                >
                  Invite
                </Link>
                <Link
                  href="/profile"
                  className={cn(linkBase, "hover:bg-black/[0.04] max-w-[10ch] truncate")}
                  style={{ color: "var(--color-ink-700)" }}
                  title={user?.name}
                >
                  {user?.name}
                </Link>
                <button
                  onClick={logout}
                  className={cn(linkBase, "hover:bg-black/[0.04]")}
                  style={{ color: "var(--color-ink-500)" }}
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
                      className={cn(linkBase, "hover:bg-black/[0.04]")}
                      style={{ color: "var(--color-ink-700)" }}
                    >
                      {t.common.login}
                    </Link>
                    <Link
                      href="/auth?mode=signup"
                      className="ml-1 px-4 py-2 text-[13px] btn-primary rounded-full focus-ring"
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
              className="p-2 -mr-2 text-surface-950 hover:bg-black/[0.04] rounded-lg transition-colors focus-ring"
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
          mobileMenuOpen ? "max-h-96 opacity-100" : "max-h-0 opacity-0"
        )}
      >
        <div className="glass-strong border-t hairline px-5 py-4">
          {showAuth ? (
            <div className="space-y-1">
              {user?.role === "ADMIN" && (
                <Link
                  href="/admin"
                  className="block px-3 py-2.5 text-sm text-primary-600 font-semibold rounded-lg"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {t.common.admin}
                </Link>
              )}
              <Link
                href="/reports"
                className="block px-3 py-2.5 text-sm hover:bg-black/[0.04] rounded-lg"
                style={{ color: "var(--color-ink-700)" }}
                onClick={() => setMobileMenuOpen(false)}
              >
                {t.common.reports}
              </Link>
              <Link
                href="/pricing"
                className="block px-3 py-2.5 text-sm font-semibold text-primary-600 rounded-lg"
                onClick={() => setMobileMenuOpen(false)}
              >
                {t.common.pricing}
              </Link>
              <Link
                href="/referral"
                className="block px-3 py-2.5 text-sm hover:bg-black/[0.04] rounded-lg"
                style={{ color: "var(--color-ink-700)" }}
                onClick={() => setMobileMenuOpen(false)}
              >
                Invite
              </Link>
              <Link
                href="/profile"
                className="block px-3 py-2.5 text-sm hover:bg-black/[0.04] rounded-lg"
                style={{ color: "var(--color-ink-700)" }}
                onClick={() => setMobileMenuOpen(false)}
              >
                {user?.name}
              </Link>
              <button
                onClick={() => {
                  logout();
                  setMobileMenuOpen(false);
                }}
                className="w-full text-left px-3 py-2.5 text-sm hover:bg-black/[0.04] rounded-lg"
                style={{ color: "var(--color-ink-500)" }}
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
                    className="flex-1 text-center px-4 py-2.5 text-sm btn-ghost rounded-full"
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
