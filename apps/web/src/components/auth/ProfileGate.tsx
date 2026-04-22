"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuthStore, useAuthHydrated } from "@/lib/store";

/**
 * Paths that do NOT require a completed profile. Users who are authenticated
 * but haven't filled in their birth details can still visit these pages.
 * Everything else redirects to /profile with ?complete=1.
 */
const OPEN_PATHS = new Set<string>([
  "/",
  "/auth",
  "/profile",
  "/pricing",
  "/reports",
]);

function isOpenPath(pathname: string): boolean {
  if (OPEN_PATHS.has(pathname)) return true;
  // Allow Next.js internals and admin area through the gate
  if (pathname.startsWith("/admin")) return true;
  if (pathname.startsWith("/_next")) return true;
  return false;
}

/**
 * Blocks authenticated users from reaching feature pages until they've
 * completed their profile (birth date, time, place, gender). Unauthenticated
 * visitors pass through — individual pages handle their own auth check.
 */
export default function ProfileGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isHydrated = useAuthHydrated();

  const needsProfile = isAuthenticated && user ? !user.profileComplete : false;
  // Only redirect once the persisted auth state has been loaded; otherwise a
  // fresh reload would race the rehydration and bounce the user through the
  // profile flow before we know whether they're logged in at all.
  const shouldRedirect = isHydrated && needsProfile && !isOpenPath(pathname);

  useEffect(() => {
    if (shouldRedirect) {
      router.replace("/profile?complete=1");
    }
  }, [shouldRedirect, router]);

  if (shouldRedirect) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <svg className="w-6 h-6 animate-spin text-primary-500" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    );
  }

  return <>{children}</>;
}
