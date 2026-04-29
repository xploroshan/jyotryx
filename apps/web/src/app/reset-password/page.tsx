"use client";

/**
 * Branded password-reset landing page.
 *
 * Firebase's password reset email links to `{actionUrl}?mode=resetPassword&oobCode=...`.
 * When the Firebase console's action URL is pointed at `/reset-password`, the
 * user lands here. We verify the oobCode with `verifyPasswordResetCode`
 * (which also tells us the account email), then call `confirmPasswordReset`
 * to actually change the password.
 *
 * Works entirely against Firebase — no backend roundtrip needed, so a sleeping
 * API on Render won't block a user from completing a password reset.
 */
import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { auth, verifyPasswordResetCode, confirmPasswordReset } from "@/lib/firebase";
import { useTranslation } from "@/i18n";
import { LogoMark } from "@/components/ui/Logo";

function ResetPasswordContent() {
  const { t } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();

  const oobCode = searchParams.get("oobCode") || "";
  const mode = searchParams.get("mode") || "";

  const [verifying, setVerifying] = useState(true);
  const [email, setEmail] = useState<string | null>(null);
  const [invalidLink, setInvalidLink] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  // Verify the reset link as soon as we have an oobCode. This resolves quickly
  // — Firebase returns the owning email so we can show "Reset password for
  // foo@bar.com" in the UI.
  useEffect(() => {
    if (!oobCode || mode !== "resetPassword") {
      setInvalidLink(true);
      setVerifying(false);
      return;
    }
    (async () => {
      try {
        const e = await verifyPasswordResetCode(auth, oobCode);
        setEmail(e);
      } catch {
        setInvalidLink(true);
      } finally {
        setVerifying(false);
      }
    })();
  }, [oobCode, mode]);

  const passwordStrength = (pw: string) => {
    let score = 0;
    if (pw.length >= 8) score++;
    if (/[a-z]/.test(pw)) score++;
    if (/[A-Z]/.test(pw)) score++;
    if (/\d/.test(pw)) score++;
    if (/[^a-zA-Z0-9]/.test(pw)) score++;
    return score;
  };
  const strength = passwordStrength(newPassword);
  const strengthLabel = ["", t.auth.strengthWeak, t.auth.strengthFair, t.auth.strengthGood, t.auth.strengthStrong, t.auth.strengthVeryStrong][strength] || "";
  const strengthColor = ["", "bg-red-500", "bg-orange-500", "bg-amber-500", "bg-emerald-500", "bg-emerald-400"][strength] || "";

  const handleSubmit = async () => {
    setError("");
    if (!newPassword || newPassword.length < 8) {
      setError(t.auth.errPasswordShort);
      return;
    }
    if (newPassword !== confirmPassword) {
      setError(t.auth.errPasswordsMismatch);
      return;
    }
    setSaving(true);
    try {
      await confirmPasswordReset(auth, oobCode, newPassword);
      setDone(true);
      setTimeout(() => router.push("/auth?mode=login"), 2500);
    } catch (err: any) {
      if (err?.code === "auth/expired-action-code" || err?.code === "auth/invalid-action-code") {
        setInvalidLink(true);
      } else {
        setError(err?.message || t.auth.errResetFailed);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page-dark flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm fade-in-up">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 mb-4">
            <LogoMark className="h-8 w-8" />
            <span className="text-lg font-semibold text-surface-50">{t.auth.brandName}</span>
          </Link>
          <p className="text-sm text-surface-50/40">{t.auth.subtitle}</p>
        </div>

        <div className="surface-card p-6">
          {verifying && (
            <div className="flex flex-col items-center justify-center py-8 gap-3">
              <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-primary-500" />
              <p className="text-xs text-surface-50/40">{t.auth.resetPasswordVerifying}</p>
            </div>
          )}

          {!verifying && invalidLink && (
            <>
              <h2 className="text-base font-semibold text-surface-50 mb-2">{t.auth.resetPasswordTitle}</h2>
              <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
                {t.auth.resetPasswordInvalidLink}
              </div>
              <Link href="/auth?mode=login" className="block w-full py-2.5 rounded-lg btn-primary text-sm text-center">
                {t.auth.backToLogin}
              </Link>
            </>
          )}

          {!verifying && !invalidLink && done && (
            <div className="mb-4 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs">
              {t.auth.resetPasswordSuccess}
            </div>
          )}

          {!verifying && !invalidLink && !done && (
            <>
              <h2 className="text-base font-semibold text-surface-50 mb-1">{t.auth.resetPasswordTitle}</h2>
              <p className="text-xs text-surface-50/40 mb-5">
                {email ? `${t.auth.resetPasswordDesc} (${email})` : t.auth.resetPasswordDesc}
              </p>

              {error && (
                <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
                  {error}
                </div>
              )}

              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-surface-50/40 mb-1.5">{t.auth.newPasswordLabel}</label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder={t.auth.passwordPlaceholder}
                      className="w-full px-3 py-2.5 pr-14 rounded-lg surface-input text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-50/25 hover:text-surface-50/50 text-xs"
                    >
                      {showPassword ? t.auth.hide : t.auth.show}
                    </button>
                  </div>
                  {newPassword.length > 0 && (
                    <div className="mt-2">
                      <div className="flex gap-0.5 mb-1">
                        {[1, 2, 3, 4, 5].map((i) => (
                          <div key={i} className={`h-0.5 flex-1 rounded-full ${i <= strength ? strengthColor : "bg-white/[0.06]"}`} />
                        ))}
                      </div>
                      <p className={`text-[11px] ${strength >= 4 ? "text-emerald-400" : strength >= 3 ? "text-amber-400" : "text-red-400"}`}>
                        {strengthLabel}
                      </p>
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-xs text-surface-50/40 mb-1.5">{t.auth.confirmPasswordLabel}</label>
                  <input
                    type={showPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder={t.auth.confirmPasswordPlaceholder}
                    className="w-full px-3 py-2.5 rounded-lg surface-input text-sm"
                    onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                  />
                </div>
                <button
                  onClick={handleSubmit}
                  disabled={saving}
                  className="w-full py-2.5 rounded-lg btn-primary text-sm disabled:opacity-50"
                >
                  {saving ? t.auth.sending : t.auth.updatePassword}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[85vh] flex items-center justify-center">
          <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-primary-500" />
        </div>
      }
    >
      <ResetPasswordContent />
    </Suspense>
  );
}
