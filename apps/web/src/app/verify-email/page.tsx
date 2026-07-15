"use client";

/**
 * Email-verification landing page.
 *
 * The verification email (sent by the backend via Resend) links here with a
 * one-time `?token=...`. We POST it to `/auth/verify-email`, which flips the
 * account to verified and returns real auth tokens — so a successful verify
 * also logs the user in and drops them into the app.
 */
import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/store";
import { useTranslation } from "@/i18n";
import { LogoMark, Wordmark } from "@/components/ui/Logo";

function VerifyEmailContent() {
  const { t } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();
  const setAuth = useAuthStore((s) => s.setAuth);

  const token = searchParams.get("token") || "";
  const [status, setStatus] = useState<"verifying" | "success" | "error">("verifying");
  // React 18 StrictMode double-invokes effects in dev; the token is single-use,
  // so guard against firing the POST twice.
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    if (!token) {
      setStatus("error");
      return;
    }
    (async () => {
      try {
        const res = await api.post<any>("/auth/verify-email", { token }, { timeoutMs: 20_000 });
        setAuth(res.user, res.tokens.accessToken, res.tokens.refreshToken);
        setStatus("success");
        setTimeout(() => {
          router.push(res.user?.profileComplete ? "/my-day" : "/profile?complete=1");
        }, 1200);
      } catch {
        setStatus("error");
      }
    })();
  }, [token, setAuth, router]);

  return (
    <div className="relative min-h-[85vh] flex items-center justify-center px-4 py-16">
      <div className="relative w-full max-w-sm text-center">
        <Link href="/" className="inline-flex items-center gap-2 mb-6">
          <LogoMark className="h-8 w-8" />
          <Wordmark className="text-lg font-semibold text-surface-950" />
        </Link>

        <div className="surface-card p-6">
          {status === "verifying" && (
            <>
              <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-primary-500/30 border-t-primary-600" />
              <p className="text-sm text-secondary">{t.auth.verifyChecking}</p>
            </>
          )}

          {status === "success" && (
            <>
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10">
                <svg className="h-6 w-6 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h1 className="text-base font-semibold text-surface-950 mb-1">{t.auth.verifySuccessTitle}</h1>
              <p className="text-xs text-[rgba(12,8,5,0.66)]">{t.auth.verifySuccessDesc}</p>
            </>
          )}

          {status === "error" && (
            <>
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10">
                <svg className="h-6 w-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <h1 className="text-base font-semibold text-surface-950 mb-1">{t.auth.verifyFailedTitle}</h1>
              <p className="text-xs text-[rgba(12,8,5,0.66)] mb-5">{t.auth.verifyFailedDesc}</p>
              <Link href="/auth?mode=login" className="btn-primary inline-block px-5 py-2.5 text-sm">
                {t.auth.backToLogin}
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<div className="min-h-[85vh]" aria-hidden />}>
      <VerifyEmailContent />
    </Suspense>
  );
}
