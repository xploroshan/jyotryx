"use client";

import { useState, useEffect, useCallback, useRef, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { api, wakeUpBackend, ApiError } from "@/lib/api";
import { useAuthStore } from "@/lib/store";
import { linkAnonymousAssignment, recordPaywallConversion } from "@/lib/experiment";
import { Toast } from "@/components/ui/Toast";
import { Gift } from "lucide-react";
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

// Where we stash a captured `?ref=…` so it survives navigation between
// /auth?ref=X and /auth/register, and any Firebase popup detours. The
// backend honours it only on first signup, so leaving it in storage
// for a few minutes is harmless.
const REFERRAL_STORAGE_KEY = "myastro360.referralCode";
const REFERRAL_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

interface ReferralPreview {
  valid: boolean;
  referrerName?: string;
  bonusDays?: number;
}

function loadStoredReferral(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(REFERRAL_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { code: string; savedAt: number };
    if (!parsed?.code) return null;
    if (Date.now() - parsed.savedAt > REFERRAL_TTL_MS) {
      window.localStorage.removeItem(REFERRAL_STORAGE_KEY);
      return null;
    }
    return parsed.code;
  } catch {
    return null;
  }
}

function saveStoredReferral(code: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      REFERRAL_STORAGE_KEY,
      JSON.stringify({ code, savedAt: Date.now() }),
    );
  } catch {
    // Quota / private mode: just drop it.
  }
}

function clearStoredReferral(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(REFERRAL_STORAGE_KEY);
  } catch {
    // ignore
  }
}

// "Remember me" — persists only the email/username. The password is
// intentionally NOT stored here; the browser's built-in password
// manager handles it via the input's autoComplete attribute, which
// keeps the secret in the OS keystore instead of plaintext localStorage.
const REMEMBERED_EMAIL_KEY = "myastro360.rememberedEmail";

function loadRememberedEmail(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(REMEMBERED_EMAIL_KEY);
  } catch {
    return null;
  }
}

function saveRememberedEmail(email: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(REMEMBERED_EMAIL_KEY, email);
  } catch {
    /* quota / private mode */
  }
}

function clearRememberedEmail(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(REMEMBERED_EMAIL_KEY);
  } catch {
    /* ignore */
  }
}

function AuthPageContent() {
  const { t, setLocale } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();
  const setAuth = useAuthStore((s) => s.setAuth);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const existingUser = useAuthStore((s) => s.user);
  const [tab, setTab] = useState<"login" | "signup">("login");
  // Referral code captured from `?ref=…` (or restored from localStorage on
  // a subsequent visit). Sent on every signup-flavoured backend call.
  const [referralCode, setReferralCode] = useState<string>("");
  const [referralPreview, setReferralPreview] = useState<ReferralPreview | null>(null);

  useEffect(() => {
    if (isAuthenticated) {
      router.replace(existingUser?.profileComplete ? "/my-day" : "/profile");
      return;
    }
    const mode = searchParams.get("mode");
    if (mode === "signup") setTab("signup");
    else if (mode === "login") setTab("login");

    // Capture / restore the referral code. URL param wins over storage so a
    // newer link overrides an older one, but we fall back to storage so the
    // user doesn't lose the bonus by closing the tab and coming back.
    const fromUrl = (searchParams.get("ref") || "").trim().toUpperCase();
    const stored = loadStoredReferral();
    const next = fromUrl || stored || "";
    if (next) {
      setReferralCode(next);
      if (fromUrl) saveStoredReferral(fromUrl);
      // The user came in via an invite link — default to the signup tab
      // so they don't have to switch manually.
      if (mode !== "login" && fromUrl) setTab("signup");
    }
  }, [searchParams, isAuthenticated, existingUser, router]);

  // Look up the referrer's name + the active bonus_days so the banner
  // can read "Sign up via Anjali's invite — both of you get 30 days
  // of Premium free." If the code is unknown or the program is paused,
  // the response is { valid: false } and we silently hide the banner.
  useEffect(() => {
    if (!referralCode) {
      setReferralPreview(null);
      return;
    }
    let cancelled = false;
    api
      .get<ReferralPreview>(`/referral/preview?code=${encodeURIComponent(referralCode)}`)
      .then((res) => {
        if (cancelled) return;
        setReferralPreview(res);
        if (!res.valid) clearStoredReferral();
      })
      .catch(() => {
        if (!cancelled) setReferralPreview(null);
      });
    return () => {
      cancelled = true;
    };
  }, [referralCode]);

  const [authMethod, setAuthMethod] = useState<"phone" | "email">("phone");
  const [phone, setPhone] = useState("");
  // Inline (field-level) validation errors surfaced onBlur, independent of the
  // top error banner. Cleared once the value becomes valid again.
  const [phoneFieldError, setPhoneFieldError] = useState("");
  const [emailFieldError, setEmailFieldError] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  // "Remember me" persists the email so it's pre-filled on next visit.
  // The password itself is never stored in localStorage — storing
  // plaintext credentials is unsafe; we let the browser's built-in
  // password manager handle the password (the autoComplete attrs on
  // the input below give it the hook it needs). Defaults to true on
  // first visit so users who tick "remember me" don't have to do it
  // every session.
  const [rememberMe, setRememberMe] = useState(true);
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
  // Once the user has typed 6 digits we auto-submit exactly once. The ref
  // prevents re-triggering the verify call if the user edits and retypes
  // the last digit, or if React re-runs the effect for other reasons.
  const otpAutoSubmittedRef = useRef(false);
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

  // Reset the one-shot auto-submit flag whenever a new OTP is requested, so
  // that each freshly-sent OTP gets exactly one auto-verify attempt.
  useEffect(() => {
    if (!otpSent) otpAutoSubmittedRef.current = false;
  }, [otpSent]);

  // Hydrate "Remember me" from localStorage on mount. If we've stashed
  // an email from a previous login, prefill it and pre-check the box
  // so the user can hit Log in without retyping. The browser handles
  // the password autofill (we never persist that ourselves).
  useEffect(() => {
    const remembered = loadRememberedEmail();
    if (remembered) {
      setEmail(remembered);
      setRememberMe(true);
    } else {
      setRememberMe(false);
    }
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
    const body: { idToken: string; ref?: string } = { idToken: firebaseIdToken };
    if (referralCode) body.ref = referralCode;
    const res = await api.post<any>("/auth/firebase", body, { timeoutMs: 30_000 });
    setAuth(res.user, res.tokens.accessToken, res.tokens.refreshToken);
    // Promote any anonymous-cookie paywall assignment to this user id and
    // mark the conversion. Both calls are no-ops on a return-login (the
    // backend's `convertedAt IS NULL` guard makes this idempotent), so
    // putting them at every auth landing is safe and avoids the
    // "is this signup or login?" branching mess.
    void linkAnonymousAssignment();
    void recordPaywallConversion("signup");
    applyUserLanguage(res.user?.preferredLanguage);
    // The bonus has been claimed (or rejected) server-side. Either way,
    // don't carry the code into a subsequent session.
    if (referralCode) clearStoredReferral();
    // Profile onboarding needs to open with `?complete=1` so the guided
    // two-step flow kicks in, not the "edit profile" view.
    router.push(res.user?.profileComplete ? "/my-day" : "/profile?complete=1");
  }, [setAuth, router, applyUserLanguage, referralCode]);

  const setupRecaptcha = useCallback(() => {
    // Tear down any previous verifier instance.
    if (recaptchaVerifierRef.current) {
      try { recaptchaVerifierRef.current.clear(); } catch {}
      recaptchaVerifierRef.current = null;
    }
    const wrapper = recaptchaContainerRef.current;
    if (!wrapper) return;

    // Firebase's clear() doesn't reliably remove the grecaptcha widget from
    // the DOM, so pointing a new RecaptchaVerifier at the SAME node throws
    // "reCAPTCHA has already been rendered in this element" on the next
    // attempt (Resend OTP, or a retry after an earlier send failed). That
    // error aborts signInWithPhoneNumber before any SMS goes out. Render into
    // a FRESH child node each time: wipe the wrapper and hand grecaptcha a
    // virgin element it has never rendered into.
    wrapper.innerHTML = "";
    const host = document.createElement("div");
    wrapper.appendChild(host);

    recaptchaVerifierRef.current = new RecaptchaVerifier(auth, host, {
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
    if (phone.length < 10) { setError(t.auth.errPhoneInvalid); document.getElementById("auth-phone")?.focus(); return; }
    if (tab === "signup" && !name.trim()) { setError(t.auth.errEnterName); document.getElementById("auth-name")?.focus(); return; }
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
      // fall back to the backend OTP flow (which uses its own SMS provider,
      // independent of Firebase's billing/plan state).
      const configFailure =
        err?.code === "auth/operation-not-allowed" ||
        err?.code === "auth/invalid-app-credential" ||
        err?.code === "auth/captcha-check-failed" ||
        err?.code === "auth/internal-error" ||
        // Firebase Phone Auth now requires the Blaze plan; on a project
        // without billing it throws this. The backend OTP path doesn't go
        // through Firebase, so fall back to it instead of dead-ending.
        err?.code === "auth/billing-not-enabled";

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
    if (otp.length < 6) { setError(t.auth.errEnterOtp); document.getElementById("auth-otp")?.focus(); return; }
    setLoading(true); setError(""); setSuccess("");
    try {
      if (otpChannelRef.current === "backend") {
        if (!backendOtpPhoneRef.current) {
          setError(t.auth.errRequestOtpFirst);
          return;
        }
        // On signup, pass the name so new phone users aren't defaulted to "User".
        const body: { phone: string; otp: string; name?: string; ref?: string } = {
          phone: backendOtpPhoneRef.current,
          otp,
        };
        if (tab === "signup" && name.trim()) body.name = name.trim();
        if (tab === "signup" && referralCode) body.ref = referralCode;
        const res = await api.post<any>(
          "/auth/otp/verify",
          body,
          { timeoutMs: 30_000 },
        );
        setAuth(res.user, res.tokens.accessToken, res.tokens.refreshToken);
    // Promote any anonymous-cookie paywall assignment to this user id and
    // mark the conversion. Both calls are no-ops on a return-login (the
    // backend's `convertedAt IS NULL` guard makes this idempotent), so
    // putting them at every auth landing is safe and avoids the
    // "is this signup or login?" branching mess.
    void linkAnonymousAssignment();
    void recordPaywallConversion("signup");
        applyUserLanguage(res.user?.preferredLanguage);
        if (tab === "signup" && referralCode) clearStoredReferral();
        router.push(res.user?.profileComplete ? "/my-day" : "/profile?complete=1");
        return;
      }

      if (!confirmationResultRef.current) { setError(t.auth.errRequestOtpFirst); return; }
      const credential = await confirmationResultRef.current.confirm(otp);
      const idToken = await credential.user.getIdToken();
      await authenticateWithBackend(idToken);
    } catch (err: any) {
      // Allow the user to retry auto-submit by clearing and re-entering the OTP
      otpAutoSubmittedRef.current = false;
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
    if (!email) { setError(t.auth.errEnterEmail); document.getElementById("auth-email")?.focus(); return; }
    if (!password || password.length < 8) { setError(t.auth.errPasswordShort); document.getElementById("auth-password")?.focus(); return; }
    if (tab === "signup" && !name) { setError(t.auth.errEnterName); document.getElementById("auth-name")?.focus(); return; }
    setLoading(true); setError(""); setSuccess(""); setLastAction(null);
    try {
      const endpoint = tab === "login" ? "/auth/login" : "/auth/register";
      const body =
        tab === "login"
          ? { email, password }
          : ({
              name,
              email,
              password,
              ...(referralCode ? { ref: referralCode } : {}),
            } as Record<string, unknown>);
      // Cold-start tolerant timeout. The wake-up ping in useEffect usually
      // means the first real request is warm, but Render can take 30s from
      // stone-cold so we don't abort before that.
      const res = await api.post<any>(endpoint, body, { timeoutMs: 30_000 });
      setAuth(res.user, res.tokens.accessToken, res.tokens.refreshToken);
      // Persist or clear the remembered email based on the checkbox.
      // We only ever store the email; the password stays with the
      // browser's password manager.
      if (rememberMe) saveRememberedEmail(email);
      else clearRememberedEmail();
    // Promote any anonymous-cookie paywall assignment to this user id and
    // mark the conversion. Both calls are no-ops on a return-login (the
    // backend's `convertedAt IS NULL` guard makes this idempotent), so
    // putting them at every auth landing is safe and avoids the
    // "is this signup or login?" branching mess.
    void linkAnonymousAssignment();
    void recordPaywallConversion("signup");
      applyUserLanguage(res.user?.preferredLanguage);
      if (tab === "signup" && referralCode) clearStoredReferral();
      router.push(res.user?.profileComplete ? "/my-day" : "/profile?complete=1");
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
    <div className="relative min-h-[85vh] flex items-center justify-center px-4 py-16 overflow-hidden">
      <h1 className="sr-only">{t.auth.tabLogin}</h1>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-90"
        style={{
          background:
            'radial-gradient(ellipse 70% 60% at 50% 10%, rgba(255,182,39,0.18) 0%, rgba(255,77,0,0.10) 35%, transparent 70%)',
        }}
      />
      <div className="relative w-full max-w-sm fade-in-up">
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
            <span className="text-lg font-semibold text-surface-950">{t.auth.brandName}</span>
          </Link>
          <p className="text-sm text-[rgba(12,8,5,0.66)]">{t.auth.subtitle}</p>
        </div>

        <div className="surface-card p-6">
          {/* Forgot Password View */}
          {showForgotPassword ? (
            <>
              <button
                onClick={() => { setShowForgotPassword(false); setError(""); setSuccess(""); }}
                className="flex items-center gap-1.5 text-xs text-[rgba(12,8,5,0.66)] hover:text-secondary mb-4 transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
                {t.auth.backToLogin}
              </button>

              <h2 className="text-base font-semibold text-surface-950 mb-1">{t.auth.forgotTitle}</h2>
              <p className="text-xs text-[rgba(12,8,5,0.66)] mb-5">
                {t.auth.forgotDesc}
              </p>

              {error && (
                <div role="alert" aria-live="assertive" className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-xs flex items-start justify-between gap-2">
                  <span className="flex-1">{error}</span>
                  {lastAction && (
                    <button
                      onClick={() => { const fn = lastAction; setLastAction(null); fn(); }}
                      className="focus-ring rounded shrink-0 underline text-red-200 hover:text-red-100"
                    >
                      {t.auth.retry}
                    </button>
                  )}
                </div>
              )}
              {success && (
                <div role="status" aria-live="polite" className="mb-4 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs">
                  {success}
                </div>
              )}

              <div className="space-y-3">
                <div>
                  <label htmlFor="reset-email" className="block text-xs text-secondary mb-1.5">{t.auth.emailLabel}</label>
                  <input
                    id="reset-email"
                    type="email"
                    autoComplete="email"
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
                  className="focus-ring w-full py-2.5 rounded-lg btn-primary text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? t.auth.sending : t.auth.sendResetLink}
                </button>
              </div>
            </>
          ) : (
            <>
              {/* Tabs */}
              <div role="tablist" aria-label="Authentication mode" className="flex mb-6 p-1 rounded-lg bg-[rgba(255,252,245,0.86)]">
                <button
                  role="tab"
                  aria-selected={tab === "login"}
                  onClick={() => { setTab("login"); setError(""); setSuccess(""); }}
                  className={`focus-ring flex-1 py-2 rounded-md text-sm font-medium transition-all ${tab === "login" ? "bg-primary-600 text-white" : "text-secondary hover:text-emphasis"}`}
                >
                  {t.auth.tabLogin}
                </button>
                <button
                  role="tab"
                  aria-selected={tab === "signup"}
                  onClick={() => { setTab("signup"); setError(""); setSuccess(""); }}
                  className={`focus-ring flex-1 py-2 rounded-md text-sm font-medium transition-all ${tab === "signup" ? "bg-primary-600 text-white" : "text-secondary hover:text-emphasis"}`}
                >
                  {t.auth.tabSignup}
                </button>
              </div>

              {error && (
                <div role="alert" aria-live="assertive" className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-xs flex items-start justify-between gap-2">
                  <span className="flex-1">{error}</span>
                  {lastAction && (
                    <button
                      onClick={() => { const fn = lastAction; setLastAction(null); fn(); }}
                      className="focus-ring rounded shrink-0 underline text-red-200 hover:text-red-100"
                    >
                      {t.auth.retry}
                    </button>
                  )}
                </div>
              )}
              {success && (
                <div role="status" aria-live="polite" className="mb-4 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs">
                  {success}
                </div>
              )}
              {serverWaking && !error && !success && (
                <div className="mb-4 p-2 rounded-md text-[11px] text-[rgba(12,8,5,0.66)] flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                  {t.auth.wakingServer}
                </div>
              )}

              {/* Referral banner — only shown when the captured code resolves
                  to a real referrer AND the program is enabled. The backend
                  /referral/preview endpoint deliberately returns
                  { valid: false } for unknown codes / disabled programs so
                  the banner stays out of the way unless it has something to
                  promise. */}
              {tab === "signup" && referralPreview?.valid && (
                <div
                  role="status"
                  aria-live="polite"
                  className="mb-4 p-3 rounded-lg bg-primary-500/10 border border-primary-500/30 text-primary-300 text-xs flex items-start gap-2"
                >
                  <Gift size={16} strokeWidth={1.8} aria-hidden className="mt-0.5 shrink-0" />
                  <div className="flex-1">
                    <strong className="font-semibold">{referralPreview.referrerName}</strong>{" "}
                    invited you to myastro360 — you'll both get{" "}
                    <strong className="font-semibold">
                      {referralPreview.bonusDays} days
                    </strong>{" "}
                    of Premium free when you sign up.
                  </div>
                </div>
              )}

              {/* Google */}
              <button onClick={handleGoogleClick} disabled={googleLoading}
                className="focus-ring w-full flex items-center justify-center gap-2.5 py-2.5 rounded-lg btn-secondary text-sm mb-4 disabled:opacity-50">
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                {googleLoading ? t.auth.signingIn : t.auth.continueWithGoogle}
              </button>

              <div className="flex items-center gap-3 mb-4">
                <div className="flex-1 h-px bg-[rgba(255,252,245,0.92)]" />
                <span className="text-[11px] text-[rgba(12,8,5,0.66)] uppercase">{t.auth.or}</span>
                <div className="flex-1 h-px bg-[rgba(255,252,245,0.92)]" />
              </div>

              {/* Method Toggle */}
              <div role="tablist" aria-label="Sign-in method" className="flex gap-1.5 mb-4">
                <button
                  role="tab"
                  aria-selected={authMethod === "phone"}
                  onClick={() => { setAuthMethod("phone"); setOtpSent(false); setError(""); setSuccess(""); }}
                  className={`focus-ring flex-1 py-1.5 rounded-md text-xs font-medium transition-all ${authMethod === "phone" ? "bg-[rgba(12,8,5,0.05)] text-surface-950" : "text-secondary hover:text-emphasis"}`}
                >
                  {t.auth.phoneOtp}
                </button>
                <button
                  role="tab"
                  aria-selected={authMethod === "email"}
                  onClick={() => { setAuthMethod("email"); setError(""); setSuccess(""); }}
                  className={`focus-ring flex-1 py-1.5 rounded-md text-xs font-medium transition-all ${authMethod === "email" ? "bg-[rgba(12,8,5,0.05)] text-surface-950" : "text-secondary hover:text-emphasis"}`}
                >
                  {t.auth.emailMethod}
                </button>
              </div>

              {/* Form */}
              <div className="space-y-3">
                {tab === "signup" && (
                  <div>
                    <label htmlFor="auth-name" className="block text-xs text-secondary mb-1.5">{t.auth.fullNameLabel}</label>
                    <input id="auth-name" type="text" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} placeholder={t.auth.fullNamePlaceholder}
                      className="w-full px-3 py-2.5 rounded-lg surface-input text-sm" />
                  </div>
                )}

                {authMethod === "phone" ? (
                  <>
                    <div>
                      <label htmlFor="auth-phone" className="flex items-center justify-between text-xs text-secondary mb-1.5">
                        <span>{t.auth.phoneNumberLabel}</span>
                        <span className="text-[10px] tabular-nums text-[rgba(12,8,5,0.66)]" aria-live="polite">{phone.length}/10</span>
                      </label>
                      <div className="flex gap-2">
                        <span className="flex items-center px-3 rounded-lg bg-[rgba(255,252,245,0.86)] border border-[rgba(12,8,5,0.10)] text-secondary text-sm">+91</span>
                        <input
                          id="auth-phone"
                          type="tel"
                          inputMode="numeric"
                          autoComplete="tel-national"
                          aria-describedby="auth-phone-hint"
                          aria-invalid={Boolean(phoneFieldError)}
                          value={phone}
                          onChange={(e) => {
                            setPhone(e.target.value.replace(/\D/g, "").slice(0, 10));
                            if (phoneFieldError) setPhoneFieldError("");
                          }}
                          onBlur={() => setPhoneFieldError(phone.length > 0 && phone.length < 10 ? t.auth.errPhoneInvalid : "")}
                          placeholder={t.auth.phoneNumberPlaceholder}
                          disabled={otpSent}
                          className="flex-1 px-3 py-2.5 rounded-lg surface-input text-sm disabled:opacity-40"
                        />
                      </div>
                      {phoneFieldError && <p role="alert" className="text-xs text-red-600 mt-1">{phoneFieldError}</p>}
                      <p id="auth-phone-hint" className="text-[10px] text-[rgba(12,8,5,0.66)] mt-1">10-digit Indian mobile number.</p>
                    </div>

                    {otpSent && (
                      <div>
                        <label htmlFor="auth-otp" className="block text-xs text-secondary mb-1.5">{t.auth.enterOtpLabel}</label>
                        <input
                          id="auth-otp"
                          type="text"
                          inputMode="numeric"
                          autoComplete="one-time-code"
                          autoFocus
                          value={otp}
                          onChange={(e) => {
                            const next = e.target.value.replace(/\D/g, "").slice(0, 6);
                            setOtp(next);
                            // Auto-verify once the user reaches 6 digits; guarded so
                            // retyping the last digit after a rejected attempt doesn't
                            // loop.
                            if (next.length === 6 && !loading && !otpAutoSubmittedRef.current) {
                              otpAutoSubmittedRef.current = true;
                              handleVerifyOtp();
                            }
                          }}
                          placeholder={t.auth.enterOtpPlaceholder}
                          maxLength={6}
                          className="w-full px-3 py-2.5 rounded-lg surface-input text-sm tracking-[0.3em] text-center"
                          onKeyDown={(e) => e.key === "Enter" && handleVerifyOtp()}
                        />
                        <div className="flex items-center justify-between mt-2">
                          <button onClick={handleSendOtp} disabled={loading} className="focus-ring rounded text-[11px] text-primary-400 hover:text-primary-300">{t.auth.resendOtp}</button>
                          <button onClick={() => { setOtpSent(false); setOtp(""); setSuccess(""); otpAutoSubmittedRef.current = false; confirmationResultRef.current = null; backendOtpPhoneRef.current = ""; }} className="focus-ring rounded text-[11px] text-[rgba(12,8,5,0.72)] hover:text-emphasis">{t.auth.changeNumber}</button>
                        </div>
                      </div>
                    )}

                    <button onClick={otpSent ? handleVerifyOtp : handleSendOtp} disabled={loading}
                      className="focus-ring w-full py-2.5 rounded-lg btn-primary text-sm disabled:opacity-50 disabled:cursor-not-allowed">
                      {loading ? t.auth.pleaseWait : otpSent ? t.auth.verifyContinue : t.auth.sendOtp}
                    </button>
                  </>
                ) : (
                  <>
                    <div>
                      <label htmlFor="auth-email" className="block text-xs text-secondary mb-1.5">{t.auth.emailLabel}</label>
                      <input id="auth-email" type="email" autoComplete="email" aria-invalid={Boolean(emailFieldError)} value={email}
                        onChange={(e) => { setEmail(e.target.value); if (emailFieldError) setEmailFieldError(""); }}
                        onBlur={() => setEmailFieldError(email.length > 0 && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? t.auth.errEmailInvalid : "")}
                        placeholder={t.auth.emailPlaceholder}
                        className="w-full px-3 py-2.5 rounded-lg surface-input text-sm" />
                      {emailFieldError && <p role="alert" className="text-xs text-red-600 mt-1">{emailFieldError}</p>}
                    </div>
                    <div>
                      <label htmlFor="auth-password" className="block text-xs text-secondary mb-1.5">{t.auth.passwordLabel}</label>
                      <div className="relative">
                        <input id="auth-password" type={showPassword ? "text" : "password"} autoComplete={tab === "signup" ? "new-password" : "current-password"} aria-describedby={tab === "signup" ? "auth-password-rules" : undefined} value={password} onChange={(e) => setPassword(e.target.value)} placeholder={t.auth.passwordPlaceholder}
                          className="w-full px-3 py-2.5 pr-14 rounded-lg surface-input text-sm"
                          onKeyDown={(e) => e.key === "Enter" && handleEmailAuth()} />
                        <button type="button" onClick={() => setShowPassword(!showPassword)}
                          aria-label={showPassword ? t.auth.hide : t.auth.show}
                          aria-pressed={showPassword}
                          className="focus-ring absolute right-3 top-1/2 -translate-y-1/2 rounded text-[rgba(12,8,5,0.72)] hover:text-emphasis text-xs px-1">
                          {showPassword ? t.auth.hide : t.auth.show}
                        </button>
                      </div>
                      {tab === "signup" && (
                        <p id="auth-password-rules" className="mt-1.5 text-[10px] text-[rgba(12,8,5,0.72)] leading-relaxed">
                          At least 8 characters. Mix upper + lower case, a number, and a symbol for a strong password.
                        </p>
                      )}
                      {tab === "signup" && password.length > 0 && (
                        <div className="mt-2">
                          <div className="flex gap-0.5 mb-1" aria-hidden>
                            {[1, 2, 3, 4, 5].map((i) => (
                              <div key={i} className={`h-0.5 flex-1 rounded-full ${i <= strength ? strengthColor : "bg-[rgba(255,252,245,0.92)]"}`} />
                            ))}
                          </div>
                          <p className={`text-[11px] ${strength >= 4 ? "text-emerald-400" : strength >= 3 ? "text-amber-400" : "text-red-400"}`} aria-live="polite">
                            {strengthLabel}
                          </p>
                        </div>
                      )}
                    </div>

                    {tab === "login" && (
                      <div className="flex items-center justify-between gap-3 -mt-1">
                        <label className="flex items-center gap-2 text-[12px] text-secondary cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={rememberMe}
                            onChange={(e) => setRememberMe(e.target.checked)}
                            className="w-3.5 h-3.5 rounded border-[rgba(26,20,16,0.20)] text-primary-600 focus:ring-primary-500 focus:ring-1"
                          />
                          {t.auth.rememberMe}
                        </label>
                        <button
                          type="button"
                          onClick={() => { setShowForgotPassword(true); setResetEmail(email); setError(""); setSuccess(""); }}
                          className="text-[11px] text-primary-400 hover:text-primary-300 transition-colors"
                        >
                          {t.auth.forgotPassword}
                        </button>
                      </div>
                    )}

                    <button
                      onClick={handleEmailAuth}
                      disabled={loading}
                      className="focus-ring w-full py-2.5 rounded-lg btn-primary text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {loading ? t.auth.pleaseWait : tab === "login" ? t.auth.loginButton : t.auth.createAccount}
                    </button>
                  </>
                )}
              </div>

              <p className="text-[11px] text-[rgba(12,8,5,0.66)] text-center mt-5">
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
