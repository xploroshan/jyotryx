"use client";

import { useEffect, useState } from "react";
import { api } from "./api";
import { useAuthStore } from "./store";

export type PaywallVariant = "control" | "first_free";

export interface PaywallAssignment {
  variant: PaywallVariant;
  /** What the backend recorded as the userKey for this assignment;
   *  used as the conversion-event key. */
  userKey: string;
}

const ANON_COOKIE_KEY = "myastro360.exp.anon";
const ANON_COOKIE_TTL_DAYS = 365;

/**
 * Mint or retrieve a stable anonymous cookie. URL-safe so it can flow
 * through query params without escaping; entropy is 192 bits which is
 * plenty for a non-cryptographic bucket key.
 */
function getOrMintAnonymousKey(): string {
  if (typeof document === "undefined") return "";
  const existing = readCookie(ANON_COOKIE_KEY);
  if (existing && /^[A-Za-z0-9_-]{16,128}$/.test(existing)) return existing;

  const fresh = crypto
    .getRandomValues(new Uint8Array(24))
    .reduce((s, b) => s + b.toString(16).padStart(2, "0"), "");
  writeCookie(ANON_COOKIE_KEY, fresh, ANON_COOKIE_TTL_DAYS);
  return fresh;
}

function readCookie(name: string): string | null {
  // Cookie names in this codebase only use [A-Za-z0-9.] so a literal
  // string match is sufficient — no regex-escape gymnastics. We split
  // by ';' once and look for the prefix on each piece.
  const target = `${name}=`;
  const parts = document.cookie.split(';');
  for (const raw of parts) {
    const piece = raw.trim();
    if (piece.startsWith(target)) {
      return decodeURIComponent(piece.slice(target.length));
    }
  }
  return null;
}

function writeCookie(name: string, value: string, days: number): void {
  const date = new Date();
  date.setTime(date.getTime() + days * 24 * 60 * 60 * 1000);
  // SameSite=Lax + Secure when on https, max age in seconds.
  const secure = typeof window !== "undefined" && window.location.protocol === "https:";
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${date.toUTCString()}; path=/; SameSite=Lax${secure ? "; Secure" : ""}`;
}

/**
 * React hook that fetches (or creates) the paywall variant for the
 * current visitor on first paint. Consumers render variant-conditional
 * UI, e.g.:
 *
 *   const { variant } = usePaywallVariant();
 *   if (variant === "first_free") return <FreeKundliCTA />;
 *
 * SSR-safe: returns `loading: true` until hydrated, so server-rendered
 * pages never flash the wrong variant.
 */
export function usePaywallVariant(): {
  loading: boolean;
  variant: PaywallVariant;
  userKey: string;
} {
  const accessToken = useAuthStore((s) => s.accessToken);
  const [state, setState] = useState<{
    loading: boolean;
    variant: PaywallVariant;
    userKey: string;
  }>({ loading: true, variant: "control", userKey: "" });

  useEffect(() => {
    let cancelled = false;
    const anonymousKey = getOrMintAnonymousKey();

    // Defensive: in jest/vitest harnesses the api mock may return a
    // non-thenable value, which would crash `.then()` in the chain
    // below. Wrapping in Promise.resolve() turns any sync return —
    // including undefined — into a rejected promise we can swallow.
    void (async () => {
      try {
        const res = await Promise.resolve(
          api.post<PaywallAssignment>(
            "/experiment/paywall/assign",
            { anonymousKey },
            { token: accessToken ?? undefined },
          ),
        );
        if (cancelled || !res) return;
        setState({
          loading: false,
          variant: (res.variant as PaywallVariant) ?? "control",
          userKey: res.userKey ?? "",
        });
      } catch {
        if (cancelled) return;
        // Fall through to control. The admin tab surfaces the empty
        // assignment count if something is genuinely wrong.
        setState({ loading: false, variant: "control", userKey: "" });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [accessToken]);

  return state;
}

/**
 * Fire-and-forget conversion event. Called from the success surfaces
 * (signup completion, first paid kundli, subscription purchase). Errors
 * are swallowed — we'd rather lose a conversion record than block the
 * user-visible success animation.
 */
export async function recordPaywallConversion(
  type: "signup" | "first_paid_kundli" | "subscription",
): Promise<void> {
  try {
    const anonymousKey = getOrMintAnonymousKey();
    await Promise.resolve(
      api.post(
        "/experiment/paywall/convert",
        { anonymousKey, conversionType: type },
        { token: useAuthStore.getState().accessToken ?? undefined },
      ),
    );
  } catch {
    // Swallow.
  }
}

/**
 * Called from the auth success path so the cookie-bucketed visitor's
 * assignment row gets the new user id stamped on it. Without this the
 * funnel splits the same human into two rows (anonymous + authed).
 */
export async function linkAnonymousAssignment(): Promise<void> {
  try {
    const anonymousKey = getOrMintAnonymousKey();
    if (!anonymousKey) return;
    await Promise.resolve(
      api.post(
        "/experiment/paywall/link",
        { anonymousKey },
        { token: useAuthStore.getState().accessToken ?? undefined },
      ),
    );
  } catch {
    // Swallow.
  }
}
