"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/lib/store";
import { LogoMark } from "@/components/ui/Logo";

const navLinks = [
  { href: "/my-day", label: "My Day" },
  { href: "/chat", label: "Consult" },
  { href: "/kundli", label: "Kundli" },
  { href: "/horoscope", label: "Horoscope" },
  { href: "/palmistry", label: "Palmistry" },
  { href: "/numerology", label: "Numerology" },
  { href: "/matching", label: "Matching" },
  { href: "/panchang", label: "Panchang" },
  { href: "/muhurat", label: "Muhurat" },
];

export default function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const { user, isAuthenticated, logout } = useAuthStore();

  // Only show auth-dependent UI after client-side hydration
  useEffect(() => { setMounted(true); }, []);
  const showAuth = mounted && isAuthenticated;

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-surface-950/80 backdrop-blur-lg border-b divider">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-14 items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5">
            <LogoMark className="h-8 w-8" />
            <span className="text-lg font-semibold text-white tracking-tight">
              Jyotron
            </span>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden lg:flex items-center gap-0.5">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="px-3 py-1.5 text-[13px] text-white/60 hover:text-white rounded-md hover:bg-white/[0.06] transition-colors duration-150"
              >
                {link.label}
              </Link>
            ))}
          </div>

          {/* Desktop Right */}
          <div className="hidden lg:flex items-center gap-2">
            {showAuth ? (
              <>
                {user?.role === "ADMIN" && (
                  <Link href="/admin" className="px-3 py-1.5 text-[13px] text-red-400 hover:text-red-300 transition-colors">
                    Admin
                  </Link>
                )}
                <Link href="/reports" className="px-3 py-1.5 text-[13px] text-white/60 hover:text-white transition-colors">
                  Reports
                </Link>
                <Link href="/pricing" className="px-3 py-1.5 text-[13px] font-medium text-accent-400 hover:text-accent-300 transition-colors">
                  Pricing
                </Link>
                <Link href="/profile" className="px-3 py-1.5 text-[13px] text-white/60 hover:text-white transition-colors">
                  {user?.name}
                </Link>
                <button
                  onClick={logout}
                  className="px-3 py-1.5 text-[13px] text-white/40 hover:text-white transition-colors"
                >
                  Log out
                </button>
              </>
            ) : (
              <>
                {mounted && (
                  <>
                    <Link href="/auth?mode=login" className="px-3 py-1.5 text-[13px] text-white/60 hover:text-white transition-colors">
                      Log in
                    </Link>
                    <Link href="/auth?mode=signup" className="px-4 py-1.5 text-[13px] btn-primary rounded-lg">
                      Get Started
                    </Link>
                  </>
                )}
              </>
            )}
          </div>

          {/* Mobile Hamburger */}
          <button
            className="lg:hidden p-2 -mr-2 text-white/60 hover:text-white"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
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

      {/* Mobile Menu */}
      <div className={cn("lg:hidden", mobileMenuOpen ? "block" : "hidden")}>
        <div className="bg-surface-950 border-t divider px-4 py-3 space-y-1">
          {navLinks.map((link) => (
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
                    Admin Panel
                  </Link>
                )}
                <Link href="/reports" className="block px-3 py-2.5 text-sm text-white/60 hover:text-white" onClick={() => setMobileMenuOpen(false)}>
                  Reports
                </Link>
                <Link href="/pricing" className="block px-3 py-2.5 text-sm font-medium text-accent-400" onClick={() => setMobileMenuOpen(false)}>
                  Pricing
                </Link>
                <Link href="/profile" className="block px-3 py-2.5 text-sm text-white/60 hover:text-white" onClick={() => setMobileMenuOpen(false)}>
                  {user?.name}
                </Link>
                <button
                  onClick={() => { logout(); setMobileMenuOpen(false); }}
                  className="w-full text-left px-3 py-2.5 text-sm text-white/40 hover:text-white"
                >
                  Log out
                </button>
              </div>
            ) : (
              <div className="flex gap-2 pt-1">
                {mounted && (
                  <>
                    <Link href="/auth?mode=login" className="flex-1 text-center px-4 py-2.5 text-sm btn-secondary rounded-lg" onClick={() => setMobileMenuOpen(false)}>
                      Log in
                    </Link>
                    <Link href="/auth?mode=signup" className="flex-1 text-center px-4 py-2.5 text-sm btn-primary rounded-lg" onClick={() => setMobileMenuOpen(false)}>
                      Get Started
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
