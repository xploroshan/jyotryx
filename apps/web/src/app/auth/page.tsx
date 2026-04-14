"use client";

import { useState, useEffect, useCallback, useRef, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { api, wakeUpBackend, ApiError } from "@/lib/api";
import { useAuthStore } from "@/lib/store";
import { useTranslation, SUPPORTED_LOCALES, type Locale } from "@/i18n";
import { LogoMark } from "@/components/ui/Logo";
import LanguageSwitcher from "@/components/ui/LanguageSwitcher";
import {
  auth,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  GoogleAuthProvider,
  signInWithPopup,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
} from "@/lib/firebase";
import type { ConfirmationResult } from "firebase/auth";

function AuthPageContent() {
  const { t, setLocale } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();
  const setAuth = useAuthStore((s) => s.setAuth);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const existingUser = useAuthStore((s) => s.user);
  const [tab, setTab] = useState<"login" | "signup">("login");

  useEffect(() => {
    if (isAuthenticated) {
      router.replace(existingUser?.profileComplete ? "/my-day" : "/profile");
      return;
    }
    const mode = searchParams.get("mode");
    if (mode === "signup") setTab("signup");
    else if (mode === "login") setTab("login");
  }, [searchParams, isAuthenticated, existingUser, router]);

  const [authMethod, setAuthMethod] = useState<"phone" | "email">("phone");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  // When true, the error banner shows a Retry button that re-runs the last
  // failed action. Set for network/timeout failures only.
  const [lastAction, setLastAction] = useState<null | (() => void)>(null);
  // Shows a subtle "Waking up the server…" hint while the initial cold-start
  // ping is still in flight.
  const [serverWaking, setServerWaking] = useState(false);

  const confirmationResultRef = useRef<ConfirmationResult | null>(null);
  const recaptchaVerifierRef = useRef<RecaptchaVerifier | null>(null);
  const recaptchaContainerRef = useRef<HTMLDivElement>(null);
  // Tracks whether the current OTP session used Firebase (client-side
  // confirmation) or the backend /auth/otp/* fallback, so `handleVerifyOtp`
  // knows which verify flow to run.
  const otpChannelRef = useRef<"firebase" | "backend">("firebase");
  // Phone (in E.164) the backend fallback sent the OTP to, needed by verify.
  const backendOtpPhoneRef = useRef<string>("");

  // If the NEXT_PUBLIC_FIREBASE_API_KEY env var isn't set at build time,
  // Firebase phone auth cannot work. Detect this once and use the backend
  // OTP endpoints instead.
  const firebasePhoneAvailable = Boolean(process.env.NEXT_PUBLIC_FIREBASE_API_KEY);

  // Cleanup reCAPTCHA on unmount
  useEffect(() => {
    return () => {
      if (recaptchaVerifierRef.current) {
        try { recaptchaVerifierRef.current.clear(); } catch {}
        recaptchaVerifierRef.current = null;
      }
    };
  }, []);

  // Free-tier hosting (Render, Fly, etc.) spins the API container down after
  // idle. The auth page is the first thing most users load, so we fire a
  // best-effort /health ping here to warm the server while the user is still
  // picking their tab. No error handling needed — the real auth call below
  // surfaces any actual failures.
  useEffect(() => {
    let cancelled = false;
    setServerWaking(true);
    wakeUpBackend(25_000).finally(() => {
      if (!cancelled) setServerWaking(false);
    });
    return () => { cancelled = true; };
  }, []);

  /**
   * Translate an ApiError/FirebaseError/Error into a user-facing string and
   * decide whether the failure is "retryable" (network/timeout). When it is,
   * the banner grows a Retry button that re-runs `retryFn`.
   */
  const mapAuthError = useCallback((err: any, fallback: string): { message: string; retryable: boolean } => {
    if (err instanceof ApiError) {
      if (err.isTimeout) return { message: t.auth.errTimeout, retryable: true };
      if (err.isNetwork) return { message: t.auth.errNetwork, retryable: true };
      if (err.status && err.status >= 500) {
        return { message: t.auth.errNetwork, retryable: true };
      }
    }
    return { message: err?.message || fallback, retryable: false };
  }, [t]);

  const applyUserLanguage = useCallback((userLang?: string | null) => {
    if (userLang && (SUPPORTED_LOCALES as string[]).includes(userLang)) {
      setLocale(userLang as Locale, { userSet: true });
    }
  }, [setLocale]);

  const authenticateWithBackend = useCallback(async (firebaseIdToken: string) => {
    // Cold-start tolerant: 30s the first time, the ApiError is re-thrown so
    // the caller can run its own retry UX.
    const res = await api.post<any>("/auth/firebase", { idToken: firebaseIdToken }, { timeoutMs: 30_000 });
    setAuth(res.user, res.tokens.accessToken, res.tokens.refreshToken);
    applyUserLanguage(res.user?.preferredLanguage);
    router.push(res.user?.profileComplete ? "/my-day" : "/profile");
  }, [setAuth, router, applyUserLanguage]);

  const setupRecaptcha = useCallback(() => {
    // Clear previous verifier to avoid stale instances
    if (recaptchaVerifierRef.current) {
      try { recaptchaVerifierRef.current.clear(); } catch {}
      recaptchaVerifierRef.current = null;
    }
    if (!recaptchaContainerRef.current) return;

    recaptchaVerifierRef.current = new RecaptchaVerifier(auth, recaptchaContainerRef.current, {
      size: "invisible",
    });
  }, []);

  // Fallback path: call the backend /auth/otp/send directly. Used when
  // Firebase phone auth isn't configured or returns a configuration-class
  // error (operation-not-allowed, invalid-app-credential, etc.).
  const sendOtpViaBackend = async (phoneNumber: string) => {
    const res = await api.post<{ message: string; expiresIn: number; devOtp?: string }>(
      "/auth/otp/send",
      { phone: phoneNumber },
      { timeoutMs: 15_000 },
    );
    otpChannelRef.current = "backend";
    backendOtpPhoneRef.current = phoneNumber;
    confirmationResultRef.current = null;
    setOtpSent(true);
    // In non-prod, the backend returns the OTP so users can self-test.
    setSuccess(
      res.devOtp
        ? `${t.auth.errOtpSent} (dev OTP: ${res.devOtp})`
        : t.auth.errOtpSent,
    );
  };

  const handleSendOtp = async () => {
    if (phone.length < 10) { setError(t.auth.errPhoneInvalid); return; }
    if (tab === "signup" && !name.trim()) { setError(t.auth.errEnterName); return; }
    setLoading(true); setError(""); setSuccess(""); setLastAction(null);
    const phoneNumber = `+91${phone}`;

    // If Firebase isn't configured on the client, go straight to the backend.
    if (!firebasePhoneAvailable) {
      try {
        await sendOtpViaBackend(phoneNumber);
      } catch (err: any) {
        setError(err.message || t.auth.errSendOtpFailed);
      } finally {
        setLoading(false);
      }
      return;
    }

    try {
      setupRecaptcha();
      const result = await signInWithPhoneNumber(auth, phoneNumber, recaptchaVerifierRef.current!);
      confirmationResultRef.current = result;
      otpChannelRef.current = "firebase";
      setOtpSent(true);
      setSuccess(t.auth.errOtpSent);
    } catch (err: any) {
      // Reset recaptcha on error so it can be re-initialized
      if (recaptchaVerifierRef.current) {
        try { recaptchaVerifierRef.current.clear(); } catch {}
        recaptchaVerifierRef.current = null;
      }

      // Configuration-class Firebase errors mean the project / env isn't set
      // up for phone auth. Rather than leaving the user stuck, transparently
      // fall back to the backend OTP flow.
      const configFailure =
        err?.code === "auth/operation-not-allowed" ||
        err?.code === "auth/invalid-app-credential" ||
        err?.code === "auth/captcha-check-failed" ||
        err?.code === "auth/internal-error";

      if (configFailure) {
        try {
          await sendOtpViaBackend(phoneNumber);
          return;
        } catch (fallbackErr: any) {
          setError(fallbackErr.message || t.auth.errSendOtpFailed);
          return;
        } finally {
          setLoading(false);
        }
      }

      if (err.code === "auth/too-many-requests") {
        setError(t.auth.errTooManyAttempts);
      } else if (err.code === "auth/invalid-phone-number") {
        setError(t.auth.errPhoneInvalidFirebase);
      } else if (err.code === "auth/quota-exceeded") {
        setError(t.auth.errSmsQuotaExceeded);
      } else {
        setError(err.message || t.auth.errSendOtpFailed);
      }
    } finally { setLoading(false); }
  };

  const handleVerifyOtp = async () => {
    if (otp.length < 6) { setError(t.auth.errEnterOtp); return; }
    setLoading(true); setError(""); setSuccess("");
    try {
      if (otpChannelRef.current === "backend") {
        if (!backendOtpPhoneRef.current) {
          setError(t.auth.errRequestOtpFirst);
          return;
        }
        // On signup, pass the name so new phone users aren't defaulted to "User".
        const body: { phone: string; otp: string; name?: string } = {
          phone: backendOtpPhoneRef.current,
          otp,
        };
        if (tab === "signup" && name.trim()) body.name = name.trim();
        const res = await api.post<any>(
          "/auth/otp/verify",
          body,
          { timeoutMs: 30_000 },
        );
        setAuth(res.user, res.tokens.accessToken, res.tokens.refreshToken);
        applyUserLanguage(res.user?.preferredLanguage);
        router.push(res.user?.profileComplete ? "/my-day" : "/profile");
        return;
      }

      if (!confirmationResultRef.current) { setError(t.auth.errRequestOtpFirst); return; }
      const credential = await confirmationResultRef.current.confirm(otp);
      const idToken = await credential.user.getIdToken();
      await authenticateWithBackend(idToken);
    } catch (err: any) {
      if (err.code === "auth/invalid-verification-code") {
        setError(t.auth.errInvalidOtp);
      } else if (err.code === "auth/code-expired") {
        setError(t.auth.errOtpExpired);
        setOtpSent(false);
        setOtp("");
        confirmationResultRef.current = null;
      } else {
        setError(err.message || t.auth.errOtpFailed);
      }
    } finally { setLoading(false); }
  };

  const handleGoogleClick = async () => {
    setGoogleLoading(true); setError(""); setSuccess(""); setLastAction(null);
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const idToken = await result.user.getIdToken();
      await authenticateWithBackend(idToken);
    } catch (err: any) {
      if (err.code === "auth/popup-closed-by-user" || err.code === "auth/cancelled-popup-request") {
        // User closed popup, don't show error
      } else if (err.code === "auth/popup-blocked") {
        setError(t.auth.errPopupBlocked);
      } else {
        const { message, retryable } = mapAuthError(err, t.auth.errGoogleFailed);
        setError(message);
        if (retryable) setLastAction(() => handleGoogleClick);
      }
    } finally { setGoogleLoading(false); }
  };

  const handleEmailAuth = async () => {
    if (!email) { setError(t.auth.errEnterEmail); return; }
    if (!password || password.length < 8) { setError(t.auth.errPasswordShort); return; }
    if (tab === "signup" && !name) { setError(t.auth.errEnterName); return; }
    setLoading(true); setError(""); setSuccess(""); setLastAction(null);
    try {
      const endpoint = tab === "login" ? "/auth/login" : "/auth/register";
      const body = tab === "login" ? { email, password } : { name, email, password };
      // Cold-start tolerant timeout. The wake-up ping in useEffect usually
      // means the first real request is warm, but Render can take 30s from
      // stone-cold so we don't abort before that.
      const res = await api.post<any>(endpoint, body, { timeoutMs: 30_000 });
      setAuth(res.user, res.tokens.accessToken, res.tokens.refreshToken);
      applyUserLanguage(res.user?.preferredLanguage);
      router.push(res.user?.profileComplete ? "/my-day" : "/profile");
    } catch (err: any) {
      // Fall back to Firebase email/password ONLY when the backend rejected
      // the credentials (HTTP 401). We skip the fallback on timeouts, network
      // failures, and server errors so a slow backend doesn't compound into a
      // second 15-30s hang waiting for Firebase.
      const isCredentialError =
        tab === "login" &&
        (err?.status === 401 || (err?.message || "").toLowerCase().includes("invalid email or password")) &&
        typeof signInWithEmailAndPassword === "function";

      if (isCredentialError) {
        try {
          // Race the Firebase call against a short timer so a stuck
          // Firebase popup can't lock the login button forever.
          const credential = await Promise.race<any>([
            signInWithEmailAndPassword(auth, email, password),
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error("firebase-timeout")), 10_000),
            ),
          ]);
          const idToken = await credential.user.getIdToken();
          await authenticateWithBackend(idToken);
          return;
        } catch {
          // Firebase fallback also failed — fall through and surface the
          // original backend error below.
        }
      }
      const { message, retryable } = mapAuthError(err, t.auth.errAuthFailed);
      setError(message);
      if (retryable) setLastAction(() => handleEmailAuth);
    }
    finally { setLoading(false); }
  };

  const handleForgotPassword = async () => {
    if (!resetEmail) { setError(t.auth.errEnterEmailReset); return; }
    setLoading(true); setError(""); setSuccess(""); setLastAction(null);
    // Fire the backend hint in parallel (best-effort — it creates the
    // Firebase Auth user on-demand for users who registered before Firebase
    // was wired up). Its failure must NOT block the email being sent.
    api.post("/auth/forgot-password", { email: resetEmail }, { timeoutMs: 15_000 })
      .catch(() => {/* best-effort; Firebase path below is authoritative */});

    try {
      // Firebase sends the reset email directly — works even if our backend
      // is down, as long as the Firebase project is configured.
      await sendPasswordResetEmail(auth, resetEmail);
      setSuccess(t.auth.errResetLinkSent);
      setTimeout(() => {
        setShowForgotPassword(false);
        setSuccess("");
      }, 3000);
    } catch (err: any) {
      if (err.code === "auth/user-not-found") {
        setError(t.auth.errNoAccountFound);
      } else if (err.code === "auth/invalid-email") {
        setError(t.auth.errEmailInvalid);
      } else if (err.code === "auth/too-many-requests") {
        setError(t.auth.errResetTooManyRequests);
      } else if (err.code === "auth/network-request-failed") {
        setError(t.auth.errNetwork);
        setLastAction(() => handleForgotPassword);
      } else {
        setError(err.message || t.auth.errResetFailed);
      }
    } finally { setLoading(false); }
  };

  const passwordStrength = (pw: string) => {
    let score = 0;
    if (pw.length >= 8) score++;
    if (/[a-z]/.test(pw)) score++;
    if (/[A-Z]/.test(pw)) score++;
    if (/\d/.test(pw)) score++;
    if (/[^a-zA-Z0-9]/.test(pw)) score++;
    return score;
  };

  const strength = passwordStrength(password);
  const strengthLabel = ["", t.auth.strengthWeak, t.auth.strengthFair, t.auth.strengthGood, t.auth.strengthStrong, t.auth.strengthVeryStrong][strength] || "";
  const strengthColor = ["", "bg-red-500", "bg-orange-500", "bg-amber-500", "bg-emerald-500", "bg-emerald-400"][strength] || "";

  return (
    <div className="min-h-[85vh] flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm">
        {/* Invisible reCAPTCHA container */}
        <div ref={recaptchaContainerRef} id="recaptcha-container" />

        {/* Language switcher (anonymous users can change language before signing in) */}
        <div className="flex justify-end mb-4">
          <LanguageSwitcher />
        </div>

        {/* Header */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 mb-4">
            <LogoMark className="h-8 w-8" />
            <span className="text-lg font-semibold text-white">{t.auth.brandName}</span>
          </Link>
          <p className="text-sm text-white/40">{t.auth.subtitle}</p>
        </div>

        <div className="surface-card p-6">
          {/* Forgot Password View */}
          {showForgotPassword ? (
            <>
              <button
                onClick={() => { setShowForgotPassword(false); setError(""); setSuccess(""); }}
                className="flex items-center gap-1.5 text-xs text-white/40 hover:text-white/60 mb-4 transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
                {t.auth.backToLogin}
              </button>

              <h2 className="text-base font-semibold text-white mb-1">{t.auth.forgotTitle}</h2>
              <p className="text-xs text-white/40 mb-5">
                {t.auth.forgotDesc}
              </p>

              {error && (
                <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-start justify-between gap-2">
                  <span className="flex-1">{error}</span>
                  {lastAction && (
                    <button
                      onClick={() => { const fn = lastAction; setLastAction(null); fn(); }}
                      className="shrink-0 underline text-red-300 hover:text-red-200"
                    >
                      {t.auth.retry}
                    </button>
                  )}
                </div>
              )}
              {success && (
                <div className="mb-4 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs">
                  {success}
                </div>
              )}

              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-white/40 mb-1.5">{t.auth.emailLabel}</label>
                  <input
                    type="email"
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    placeholder={t.auth.emailPlaceholder}
                    className="w-full px-3 py-2.5 rounded-lg surface-input text-sm"
                    onKeyDown={(e) => e.key === "Enter" && handleForgotPassword()}
                  />
                </div>
                <button
                  onClick={handleForgotPassword}
                  disabled={loading}
                  className="w-full py-2.5 rounded-lg btn-primary text-sm disabled:opacity-50"
                >
                  {loading ? t.auth.sending : t.auth.sendResetLink}
                </button>
              </div>
            </>
          ) : (
            <>
              {/* Tabs */}
              <div className="flex mb-6 p-1 rounded-lg bg-white/[0.04]">
                <button
                  onClick={() => { setTab("login"); setError(""); setSuccess(""); }}
                  className={`flex-1 py-2 rounded-md text-sm font-medium transition-all ${tab === "login" ? "bg-primary-600 text-white" : "text-white/40 hover:text-white/60"}`}
                >
                  {t.auth.tabLogin}
                </button>
                <button
                  onClick={() => { setTab("signup"); setError(""); setSuccess(""); }}
                  className={`flex-1 py-2 rounded-md text-sm font-medium transition-all ${tab === "signup" ? "bg-primary-600 text-white" : "text-white/40 hover:text-white/60"}`}
                >
                  {t.auth.tabSignup}
                </button>
              </div>

              {error && (
                <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-start justify-between gap-2">
                  <span className="flex-1">{error}</span>
                  {lastAction && (
                    <button
                      onClick={() => { const fn = lastAction; setLastAction(null); fn(); }}
                      className="shrink-0 underline text-red-300 hover:text-red-200"
                    >
                      {t.auth.retry}
                    </button>
                  )}
                </div>
              )}
              {success && (
                <div className="mb-4 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs">
                  {success}
                </div>
              )}
              {serverWaking && !error && !success && (
                <div className="mb-4 p-2 rounded-md text-[11px] text-white/40 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                  {t.auth.wakingServer}
                </div>
              )}

              {/* Google */}
              <button onClick={handleGoogleClick} disabled={googleLoading}
                className="w-full flex items-center justify-center gap-2.5 py-2.5 rounded-lg btn-secondary text-sm mb-4 disabled:opacity-50">
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                {googleLoading ? t.auth.signingIn : t.auth.continueWithGoogle}
              </button>

              <div className="flex items-center gap-3 mb-4">
                <div className="flex-1 h-px bg-white/[0.06]" />
                <span className="text-[11px] text-white/25 uppercase">{t.auth.or}</span>
                <div className="flex-1 h-px bg-white/[0.06]" />
              </div>

              {/* Method Toggle */}
              <div className="flex gap-1.5 mb-4">
                <button
                  onClick={() => { setAuthMethod("phone"); setOtpSent(false); setError(""); setSuccess(""); }}
                  className={`flex-1 py-1.5 rounded-md text-xs font-medium transition-all ${authMethod === "phone" ? "bg-white/[0.08] text-white" : "text-white/30 hover:text-white/50"}`}
                >
                  {t.auth.phoneOtp}
                </button>
                <button
                  onClick={() => { setAuthMethod("email"); setError(""); setSuccess(""); }}
                  className={`flex-1 py-1.5 rounded-md text-xs font-medium transition-all ${authMethod === "email" ? "bg-white/[0.08] text-white" : "text-white/30 hover:text-white/50"}`}
                >
                  {t.auth.emailMethod}
                </button>
              </div>

              {/* Form */}
              <div className="space-y-3">
                {tab === "signup" && (
                  <div>
                    <label className="block text-xs text-white/40 mb-1.5">{t.auth.fullNameLabel}</label>
                    <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder={t.auth.fullNamePlaceholder}
                      className="w-full px-3 py-2.5 rounded-lg surface-input text-sm" />
                  </div>
                )}

                {authMethod === "phone" ? (
                  <>
                    <div>
                      <label className="block text-xs text-white/40 mb-1.5">{t.auth.phoneNumberLabel}</label>
                      <div className="flex gap-2">
                        <span className="flex items-center px-3 rounded-lg bg-white/[0.04] border border-white/[0.08] text-white/30 text-sm">+91</span>
                        <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))} placeholder={t.auth.phoneNumberPlaceholder}
                          disabled={otpSent} className="flex-1 px-3 py-2.5 rounded-lg surface-input text-sm disabled:opacity-40" />
                      </div>
                    </div>

                    {otpSent && (
                      <div>
                        <label className="block text-xs text-white/40 mb-1.5">{t.auth.enterOtpLabel}</label>
                        <input type="text" value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))} placeholder={t.auth.enterOtpPlaceholder} maxLength={6}
                          className="w-full px-3 py-2.5 rounded-lg surface-input text-sm tracking-[0.3em] text-center"
                          onKeyDown={(e) => e.key === "Enter" && handleVerifyOtp()} />
                        <div className="flex items-center justify-between mt-2">
                          <button onClick={handleSendOtp} disabled={loading} className="text-[11px] text-primary-400 hover:text-primary-300">{t.auth.resendOtp}</button>
                          <button onClick={() => { setOtpSent(false); setOtp(""); setSuccess(""); confirmationResultRef.current = null; backendOtpPhoneRef.current = ""; }} className="text-[11px] text-white/30 hover:text-white/50">{t.auth.changeNumber}</button>
                        </div>
                      </div>
                    )}

                    <button onClick={otpSent ? handleVerifyOtp : handleSendOtp} disabled={loading}
                      className="w-full py-2.5 rounded-lg btn-primary text-sm disabled:opacity-50">
                      {loading ? t.auth.pleaseWait : otpSent ? t.auth.verifyContinue : t.auth.sendOtp}
                    </button>
                  </>
                ) : (
                  <>
                    <div>
                      <label className="block text-xs text-white/40 mb-1.5">{t.auth.emailLabel}</label>
                      <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t.auth.emailPlaceholder}
                        className="w-full px-3 py-2.5 rounded-lg surface-input text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs text-white/40 mb-1.5">{t.auth.passwordLabel}</label>
                      <div className="relative">
                        <input type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder={t.auth.passwordPlaceholder}
                          className="w-full px-3 py-2.5 pr-14 rounded-lg surface-input text-sm"
                          onKeyDown={(e) => e.key === "Enter" && handleEmailAuth()} />
                        <button type="button" onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-white/25 hover:text-white/50 text-xs">
                          {showPassword ? t.auth.hide : t.auth.show}
                        </button>
                      </div>
                      {tab === "signup" && password.length > 0 && (
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

                    {tab === "login" && (
                      <div className="text-right -mt-1">
                        <button
                          type="button"
                          onClick={() => { setShowForgotPassword(true); setResetEmail(email); setError(""); setSuccess(""); }}
                          className="text-[11px] text-primary-400 hover:text-primary-300 transition-colors"
                        >
                          {t.auth.forgotPassword}
                        </button>
                      </div>
                    )}

                    <button onClick={handleEmailAuth} disabled={loading}
                      className="w-full py-2.5 rounded-lg btn-primary text-sm disabled:opacity-50">
                      {loading ? t.auth.pleaseWait : tab === "login" ? t.auth.loginButton : t.auth.createAccount}
                    </button>
                  </>
                )}
              </div>

              <p className="text-[11px] text-white/20 text-center mt-5">
                {t.auth.terms}
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AuthPage() {
  return (
    <Suspense fallback={
      <div className="min-h-[85vh] flex items-center justify-center">
        <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-primary-500" />
      </div>
    }>
      <AuthPageContent />
    </Suspense>
  );
}
