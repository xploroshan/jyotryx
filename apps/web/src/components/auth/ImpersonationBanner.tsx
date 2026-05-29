"use client";

/**
 * ImpersonationBanner — persistent warning shown while logged in via
 * an admin impersonation token.
 *
 * Renders only when the current access-token JWT carries the
 * `impersonatedBy` claim (set by AdminService.impersonateUser on the
 * server). Displays the admin's email + a countdown-to-expiry and
 * offers a one-click "End session" that clears the auth store and
 * routes back to /auth.
 *
 * Lives in the root layout so it's present on every page the
 * impersonated user visits. The banner itself doesn't care which
 * route the user is on.
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/store";
import { TriangleAlert } from "lucide-react";

function decodeJwtPayload(token: string | null): Record<string, any> | null {
  if (!token) return null;
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
    const json = typeof atob === "function" ? atob(padded) : Buffer.from(padded, "base64").toString("utf8");
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function formatRemaining(ms: number): string {
  if (ms <= 0) return "expired";
  const s = Math.floor(ms / 1000);
  const mins = Math.floor(s / 60);
  const secs = s % 60;
  return `${mins}m ${secs.toString().padStart(2, "0")}s`;
}

export default function ImpersonationBanner() {
  const router = useRouter();
  const accessToken = useAuthStore((s) => s.accessToken);
  const logout = useAuthStore((s) => s.logout);
  const [now, setNow] = useState(() => Date.now());

  // Tick every second so the countdown stays fresh. Only mounts when
  // the token actually carries impersonatedBy (see early-return
  // below), so we don't schedule intervals for normal users.
  const claims = decodeJwtPayload(accessToken);
  const impersonatedBy = claims?.impersonatedBy as string | undefined;
  const expMs = typeof claims?.exp === "number" ? claims.exp * 1000 : null;

  useEffect(() => {
    if (!impersonatedBy) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [impersonatedBy]);

  if (!impersonatedBy) return null;

  const remainingMs = expMs != null ? expMs - now : null;
  const expired = remainingMs != null && remainingMs <= 0;

  const endSession = () => {
    logout();
    router.replace("/auth");
  };

  return (
    <div
      role="alert"
      className="sticky top-0 z-[60] w-full bg-amber-500/95 text-black"
      data-testid="impersonation-banner"
    >
      <div className="mx-auto max-w-7xl px-4 py-2 flex items-center justify-between gap-4 text-sm font-medium">
        <div className="flex items-center gap-3">
          <TriangleAlert aria-hidden size={16} strokeWidth={2} className="shrink-0" />
          <span>
            Impersonating <span className="font-semibold">{claims?.email}</span>
            {" — session started by "}
            <span className="font-semibold">{impersonatedBy}</span>
            {remainingMs != null && (
              <span className="ml-2 tabular-nums text-black/70">
                ({expired ? "expired" : `expires in ${formatRemaining(remainingMs)}`})
              </span>
            )}
          </span>
        </div>
        <button
          onClick={endSession}
          className="px-3 py-1 rounded-md bg-black/10 hover:bg-black/20 text-black text-xs font-semibold"
        >
          End session
        </button>
      </div>
    </div>
  );
}
