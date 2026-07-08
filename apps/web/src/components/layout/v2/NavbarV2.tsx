"use client";

import Link from "next/link";
import { useState, useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuthStore, useAuthHydrated } from "@/lib/store";
import { greetingName } from "@/lib/displayName";
import { LogoMark, Wordmark } from "@/components/ui/Logo";
import LanguageSwitcher from "@/components/ui/LanguageSwitcher";
import { useTranslation } from "@/i18n";
import {
  TRADITION_LIST,
  WEB_TRADITIONS,
  resolveTraditionFromPath,
  type TraditionId,
} from "@/lib/traditions";
import { TraditionGlyph } from "@/components/icons";
import { api } from "@/lib/api";
import { usePricingConfig } from "@/lib/usePricingConfig";

/**
 * v2 navbar. Single 56px fixed bar that replaces the previous trio of
 * Navbar + TraditionRail + FeatureChips. Traditions live in an inline
 * dropdown so we recover ~64px of vertical space across every page.
 * Feature tabs (when relevant) move to FeatureBarV2 below this bar.
 */
export default function NavbarV2() {
  const pathname = usePathname() ?? "/";
  const router = useRouter();
  const { user, isAuthenticated, logout, updatePrimaryTradition, activeTradition, setActiveTradition } = useAuthStore();
  const { t } = useTranslation();
  const { pricingEnabled } = usePricingConfig();
  const [mounted, setMounted] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [tradOpen, setTradOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const tradRef = useRef<HTMLDivElement>(null);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!tradOpen) return;
    const onClick = (e: MouseEvent) => {
      if (tradRef.current && !tradRef.current.contains(e.target as Node)) {
        setTradOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setTradOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [tradOpen]);

  // Close menus on route change.
  useEffect(() => {
    setMobileOpen(false);
    setTradOpen(false);
  }, [pathname]);

  // `activeTrad` = the tradition of the *current page*, resolved from both
  // tradition dashboards (/vedic) and feature pages (/horoscope → Vedic).
  // Drives the active-page highlight on the switcher button.
  const activeTrad = resolveTraditionFromPath(pathname);
  const hydrated = useAuthHydrated();
  // `selectedTrad` = what the switcher shows. On tradition-agnostic pages
  // (My Day, home, …) it falls back to the last tradition browsed, then
  // the saved `primaryTradition`, so the selection persists. Gated on
  // hydration to avoid an SSR/client mismatch.
  const remembered = hydrated
    ? ((activeTradition as TraditionId | null) ?? (user?.primaryTradition as TraditionId | null) ?? null)
    : null;
  const selectedTrad: TraditionId | null =
    activeTrad ?? (remembered && WEB_TRADITIONS[remembered] ? remembered : null);
  const isMyDay = pathname.startsWith("/my-day");

  // Remember the tradition context as the user navigates tradition/feature
  // pages, so neutral pages (My Day, home) can recall it. Kept separate
  // from the saved `primaryTradition` preference, which only the switcher
  // dropdown and the profile editor change.
  useEffect(() => {
    if (activeTrad && activeTrad !== activeTradition) setActiveTradition(activeTrad);
  }, [activeTrad, activeTradition, setActiveTradition]);

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

  const showAuth = mounted && isAuthenticated;

  const handleTraditionSelect = (id: TraditionId, slug: string) => {
    updatePrimaryTradition(id);
    setTradOpen(false);
    setMobileOpen(false);
    router.push(`/${slug}`);
    if (isAuthenticated) {
      api.put("/users/me", { primaryTradition: id }).catch(() => {});
    }
  };

  const navLink =
    "px-3 h-9 inline-flex items-center text-[13px] font-medium rounded-md transition-colors duration-150";
  const navLinkInactive =
    "text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] hover:bg-[var(--color-bg-subtle)]";
  const navLinkActive = "text-[var(--color-fg)] bg-[var(--color-bg-subtle)]";

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-colors duration-200 ${
        scrolled ? "v2-nav-scrolled" : "v2-nav-top"
      }`}
    >
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <div className="flex h-14 items-center justify-between gap-4">
          {/* Logo */}
          <Link
            href="/"
            className="flex items-center gap-2 shrink-0 group focus-ring rounded-md"
          >
            <LogoMark className="h-6 w-6 transition-transform duration-300 group-hover:rotate-[12deg]" />
            <Wordmark className="font-semibold text-[16px] tracking-tight text-[var(--color-fg)]" />
          </Link>

          {/* Desktop primary nav */}
          <div className="hidden lg:flex items-center gap-1 flex-1 justify-center">
            <Link
              href="/my-day"
              className={`${navLink} ${isMyDay ? navLinkActive : navLinkInactive}`}
            >
              {t.nav.myDay}
            </Link>

            {/* Tradition switcher */}
            <div className="relative" ref={tradRef}>
              <button
                type="button"
                onClick={() => setTradOpen((o) => !o)}
                className={`${navLink} gap-1.5 ${activeTrad ? navLinkActive : navLinkInactive}`}
                aria-expanded={tradOpen}
                aria-haspopup="true"
              >
                {selectedTrad
                  ? readLabel(
                      WEB_TRADITIONS[selectedTrad].labelKey,
                      WEB_TRADITIONS[selectedTrad].slug,
                    )
                  : "Traditions"}
                <svg
                  className={`w-3 h-3 transition-transform ${tradOpen ? "rotate-180" : ""}`}
                  viewBox="0 0 12 12"
                  fill="none"
                >
                  <path
                    d="M3 4.5L6 7.5L9 4.5"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
              {tradOpen && (
                <div
                  className="absolute top-full mt-1 left-0 w-[260px] v2-surface p-1.5 z-50"
                  style={{
                    boxShadow:
                      "0 6px 24px -8px rgba(26, 20, 16, 0.18), 0 2px 6px -2px rgba(26, 20, 16, 0.08)",
                  }}
                  role="menu"
                >
                  {TRADITION_LIST.map((cfg) => {
                    const isActive = cfg.id === selectedTrad;
                    const label = readLabel(cfg.labelKey, cfg.slug);
                    return (
                      <button
                        key={cfg.id}
                        type="button"
                        onClick={() => handleTraditionSelect(cfg.id, cfg.slug)}
                        className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-[6px] text-left transition-colors ${
                          isActive
                            ? "bg-[var(--color-accent-subtle)] text-[var(--color-accent)]"
                            : "hover:bg-[var(--color-bg-subtle)] text-[var(--color-fg)]"
                        }`}
                        role="menuitem"
                      >
                        <TraditionGlyph id={cfg.id} size={16} />
                        <span className="text-[13px] font-medium flex-1">{label}</span>
                        {isActive && (
                          <span className="text-[10px] uppercase tracking-wider font-medium text-[var(--color-accent)]">
                            active
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Always visible: the /learn content hub is a primary
                discovery + SEO surface, so every visitor gets a nav path to
                it (it was previously reachable only from the footer). */}
            <Link
              href="/learn"
              className={`${navLink} ${pathname.startsWith("/learn") ? navLinkActive : navLinkInactive}`}
            >
              Learn
            </Link>

            {showAuth && (
              <Link
                href="/reports"
                className={`${navLink} ${pathname.startsWith("/reports") ? navLinkActive : navLinkInactive}`}
              >
                {t.common.reports}
              </Link>
            )}

            {pricingEnabled && (
              <Link
                href="/pricing"
                className={`${navLink} ${pathname.startsWith("/pricing") ? navLinkActive : navLinkInactive}`}
              >
                {t.common.pricing}
              </Link>
            )}

            {showAuth && user?.role === "ADMIN" && (
              <Link
                href="/admin"
                className={`${navLink} ${pathname.startsWith("/admin") ? navLinkActive : navLinkInactive}`}
              >
                {t.common.admin}
              </Link>
            )}
          </div>

          {/* Desktop right side */}
          <div className="hidden lg:flex items-center gap-2 shrink-0">
            <LanguageSwitcher />
            {showAuth ? (
              <>
                <Link
                  href="/profile"
                  className={`${navLink} ${navLinkInactive} max-w-[12ch] truncate`}
                  title={user?.name ?? undefined}
                >
                  {greetingName(user)}
                </Link>
                <button onClick={logout} className={`${navLink} ${navLinkInactive}`}>
                  {t.common.logout}
                </button>
              </>
            ) : mounted ? (
              <>
                <Link href="/auth?mode=login" className={`${navLink} ${navLinkInactive}`}>
                  {t.common.login}
                </Link>
                <Link
                  href="/auth?mode=signup"
                  className="v2-btn v2-btn-primary h-9 px-4 text-[13px]"
                >
                  {t.common.signup}
                </Link>
              </>
            ) : null}
          </div>

          {/* Mobile hamburger */}
          <div className="flex items-center gap-2 lg:hidden">
            <LanguageSwitcher />
            <button
              type="button"
              onClick={() => setMobileOpen((o) => !o)}
              className="p-2 -mr-1 text-[var(--color-fg)] hover:bg-[var(--color-bg-subtle)] rounded-md transition-colors"
              aria-label="Toggle menu"
              aria-expanded={mobileOpen}
            >
              <svg
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.6}
              >
                {mobileOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      <div
        className={`lg:hidden overflow-hidden transition-[max-height] duration-200 border-t border-[var(--color-border)] ${
          mobileOpen ? "max-h-[640px]" : "max-h-0"
        }`}
        style={{ background: "var(--color-bg)" }}
      >
        <div className="px-5 py-4 space-y-1">
          <Link
            href="/my-day"
            onClick={() => setMobileOpen(false)}
            className={`flex items-center px-3 h-10 rounded-md text-[14px] font-medium ${
              isMyDay
                ? "bg-[var(--color-bg-subtle)] text-[var(--color-fg)]"
                : "text-[var(--color-fg-muted)] hover:bg-[var(--color-bg-subtle)] hover:text-[var(--color-fg)]"
            }`}
          >
            {t.nav.myDay}
          </Link>

          {/* Always visible — the /learn hub is a primary discovery surface. */}
          <Link
            href="/learn"
            onClick={() => setMobileOpen(false)}
            className={`flex items-center px-3 h-10 rounded-md text-[14px] font-medium ${
              pathname.startsWith("/learn")
                ? "bg-[var(--color-bg-subtle)] text-[var(--color-fg)]"
                : "text-[var(--color-fg-muted)] hover:bg-[var(--color-bg-subtle)] hover:text-[var(--color-fg)]"
            }`}
          >
            Learn
          </Link>

          <p className="px-3 pt-3 pb-1 text-[11px] uppercase tracking-wider font-medium text-[var(--color-fg-subtle)]">
            Traditions
          </p>
          {TRADITION_LIST.map((cfg) => {
            const isActive = cfg.id === selectedTrad;
            const label = readLabel(cfg.labelKey, cfg.slug);
            return (
              <button
                key={cfg.id}
                type="button"
                onClick={() => handleTraditionSelect(cfg.id, cfg.slug)}
                className={`w-full text-left flex items-center gap-2 px-3 h-10 rounded-md text-[14px] ${
                  isActive
                    ? "bg-[var(--color-accent-subtle)] text-[var(--color-accent)]"
                    : "text-[var(--color-fg)] hover:bg-[var(--color-bg-subtle)]"
                }`}
              >
                <TraditionGlyph id={cfg.id} size={18} />
                {label}
              </button>
            );
          })}

          <div className="pt-3 mt-2 border-t border-[var(--color-border)] space-y-1">
            {showAuth ? (
              <>
                {user?.role === "ADMIN" && (
                  <Link
                    href="/admin"
                    onClick={() => setMobileOpen(false)}
                    className="flex items-center px-3 h-10 rounded-md text-[14px] text-[var(--color-fg-muted)] hover:bg-[var(--color-bg-subtle)] hover:text-[var(--color-fg)]"
                  >
                    {t.common.admin}
                  </Link>
                )}
                <Link
                  href="/reports"
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center px-3 h-10 rounded-md text-[14px] text-[var(--color-fg-muted)] hover:bg-[var(--color-bg-subtle)] hover:text-[var(--color-fg)]"
                >
                  {t.common.reports}
                </Link>
                {pricingEnabled && (
                  <Link
                    href="/pricing"
                    onClick={() => setMobileOpen(false)}
                    className="flex items-center px-3 h-10 rounded-md text-[14px] text-[var(--color-fg-muted)] hover:bg-[var(--color-bg-subtle)] hover:text-[var(--color-fg)]"
                  >
                    {t.common.pricing}
                  </Link>
                )}
                <Link
                  href="/profile"
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center px-3 h-10 rounded-md text-[14px] text-[var(--color-fg-muted)] hover:bg-[var(--color-bg-subtle)] hover:text-[var(--color-fg)]"
                  title={user?.name ?? undefined}
                >
                  {greetingName(user)}
                </Link>
                <button
                  onClick={() => {
                    logout();
                    setMobileOpen(false);
                  }}
                  className="w-full text-left flex items-center px-3 h-10 rounded-md text-[14px] text-[var(--color-fg-muted)] hover:bg-[var(--color-bg-subtle)] hover:text-[var(--color-fg)]"
                >
                  {t.common.logout}
                </button>
              </>
            ) : mounted ? (
              <div className="flex gap-2 pt-1">
                <Link
                  href="/auth?mode=login"
                  onClick={() => setMobileOpen(false)}
                  className="flex-1 v2-btn v2-btn-secondary h-10"
                >
                  {t.common.login}
                </Link>
                <Link
                  href="/auth?mode=signup"
                  onClick={() => setMobileOpen(false)}
                  className="flex-1 v2-btn v2-btn-primary h-10"
                >
                  {t.common.signup}
                </Link>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </nav>
  );
}
