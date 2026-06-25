"use client";

/**
 * ImpersonateHandler — client-side landing pad for admin impersonation.
 *
 * When an admin clicks "Log in as user" in /admin, the backend mints a
 * 1-hour access token with an `impersonatedBy` claim. We open a new
 * tab at `/?__imp=<token>`; this component:
 *
 *  1. Reads the `__imp` query param once on mount.
 *  2. Decodes the JWT client-side (no signature verify — the backend
 *     revalidates every request anyway) to populate the auth store
 *     with the minimum user shape the app needs.
 *  3. Strips `__imp` from the URL so the token never ends up in
 *     history, shared links, or analytics.
 *  4. Routes the tab to /my-day, where the rest of the app runs as
 *     that user until the token expires.
 *
 * The refresh-token slot is deliberately left empty: impersonation
 * must die at the 1-hour mark without silent renewal.
 */

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useAuthStore } from "@/lib/store";

function decodeJwtPayload(token: string): Record<string, any> | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    // JWT uses base64url; normalize to base64 before decoding.
    const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
    const json = typeof atob === "function" ? atob(padded) : Buffer.from(padded, "base64").toString("utf8");
    return JSON.parse(json);
  } catch {
    return null;
  }
}

export default function ImpersonateHandler() {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const setImpersonation = useAuthStore((s) => s.setImpersonation);

  useEffect(() => {
    const token = search?.get("__imp");
    if (!token) return;

    const claims = decodeJwtPayload(token);
    if (!claims?.sub || !claims?.email) {
      // Malformed token — bail silently; the user just lands on home.
      return;
    }

    // Replace the current session with the impersonation session. We treat the
    // target as a non-admin USER in the client store (the backend enforces the
    // real role anyway). setImpersonation keeps this session in-memory only —
    // the 1-hour token is never written to localStorage and dies on reload.
    setImpersonation(
      {
        id: claims.sub,
        name: claims.name ?? claims.email,
        email: claims.email,
        credits: 0,
        role: "USER",
        astrologyTraditions: [],
        primaryTradition: null,
        profileComplete: true,
      } as any,
      token,
    );

    // Strip the sensitive param from the URL before the user (or any
    // observer) sees it in history/analytics.
    const nextUrl = pathname || "/my-day";
    router.replace(nextUrl);
  }, [pathname, router, search, setImpersonation]);

  return null;
}
