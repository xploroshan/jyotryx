"use client";

import Link from "next/link";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/lib/store";

const navLinks = [
  { href: "/chat", label: "AI Astrologer" },
  { href: "/kundli", label: "Kundli" },
  { href: "/horoscope", label: "Horoscope" },
  { href: "/palmistry", label: "Palmistry" },
  { href: "/matching", label: "Matching" },
  { href: "/panchang", label: "Panchang" },
  { href: "/muhurat", label: "Muhurat" },
];

export default function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { user, isAuthenticated, logout } = useAuthStore();

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 glass border-b border-white/10">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary-500 to-mystic-500 flex items-center justify-center text-white font-bold text-sm">
              J
            </div>
            <span className="text-xl font-display font-bold text-gradient">
              Jyotryx
            </span>
          </Link>

          <div className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="px-3 py-2 text-sm text-gray-300 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
              >
                {link.label}
              </Link>
            ))}
          </div>

          <div className="hidden md:flex items-center gap-3">
            {isAuthenticated ? (
              <>
                {user?.role === "ADMIN" && (
                  <Link href="/admin" className="px-3 py-2 text-sm text-red-400 hover:text-red-300 transition-colors">
                    Admin
                  </Link>
                )}
                <Link href="/reports" className="px-3 py-2 text-sm text-gray-300 hover:text-white transition-colors">
                  Reports
                </Link>
                <Link href="/pricing" className="px-3 py-2 text-sm text-accent-400 hover:text-accent-300 transition-colors">
                  {user?.credits} credits
                </Link>
                <Link href="/profile" className="px-3 py-2 text-sm text-gray-300 hover:text-white transition-colors">
                  {user?.name}
                </Link>
                <button
                  onClick={logout}
                  className="px-4 py-2 text-sm text-gray-300 hover:text-white glass rounded-lg transition-colors"
                >
                  Logout
                </button>
              </>
            ) : (
              <>
                <Link href="/auth?mode=login" className="px-4 py-2 text-sm text-gray-300 hover:text-white transition-colors">
                  Login
                </Link>
                <Link href="/auth?mode=signup" className="px-4 py-2 text-sm bg-gradient-to-r from-primary-600 to-mystic-600 text-white rounded-lg hover:from-primary-500 hover:to-mystic-500 transition-all">
                  Get Started
                </Link>
              </>
            )}
          </div>

          <button
            className="md:hidden p-2 text-gray-300 hover:text-white"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              {mobileMenuOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>
      </div>

      <div className={cn("md:hidden", mobileMenuOpen ? "block" : "hidden")}>
        <div className="glass border-t border-white/10 px-4 py-3 space-y-1">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="block px-3 py-2 text-sm text-gray-300 hover:text-white hover:bg-white/10 rounded-lg"
              onClick={() => setMobileMenuOpen(false)}
            >
              {link.label}
            </Link>
          ))}
          <div className="pt-3 border-t border-white/10">
            {isAuthenticated ? (
              <div className="space-y-1">
                {user?.role === "ADMIN" && (
                  <Link href="/admin" className="block px-3 py-2 text-sm text-red-400 hover:text-red-300 hover:bg-white/10 rounded-lg" onClick={() => setMobileMenuOpen(false)}>
                    Admin Panel
                  </Link>
                )}
                <Link href="/reports" className="block px-3 py-2 text-sm text-gray-300 hover:text-white hover:bg-white/10 rounded-lg" onClick={() => setMobileMenuOpen(false)}>
                  Reports
                </Link>
                <Link href="/pricing" className="block px-3 py-2 text-sm text-accent-400 hover:bg-white/10 rounded-lg" onClick={() => setMobileMenuOpen(false)}>
                  {user?.credits} credits
                </Link>
                <Link href="/profile" className="block px-3 py-2 text-sm text-gray-300 hover:text-white hover:bg-white/10 rounded-lg" onClick={() => setMobileMenuOpen(false)}>
                  {user?.name}
                </Link>
                <button
                  onClick={() => { logout(); setMobileMenuOpen(false); }}
                  className="w-full text-left px-3 py-2 text-sm text-gray-400 hover:text-white hover:bg-white/10 rounded-lg"
                >
                  Logout
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <Link href="/auth?mode=login" className="flex-1 text-center px-4 py-2 text-sm text-gray-300 border border-white/20 rounded-lg" onClick={() => setMobileMenuOpen(false)}>
                  Login
                </Link>
                <Link href="/auth?mode=signup" className="flex-1 text-center px-4 py-2 text-sm bg-gradient-to-r from-primary-600 to-mystic-600 text-white rounded-lg" onClick={() => setMobileMenuOpen(false)}>
                  Sign Up
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
