"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/store";

function AuthPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [tab, setTab] = useState<"login" | "signup">("login");

  useEffect(() => {
    const mode = searchParams.get("mode");
    if (mode === "signup") setTab("signup");
    else if (mode === "login") setTab("login");
  }, [searchParams]);
  const [authMethod, setAuthMethod] = useState<"phone" | "email">("phone");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [devOtp, setDevOtp] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const handleSendOtp = async () => {
    if (phone.length < 10) { setError("Please enter a valid 10-digit phone number"); return; }
    setLoading(true); setError(""); setDevOtp(null);
    try {
      const res = await api.post<{ message: string; expiresIn: number; devOtp?: string }>("/auth/otp/send", { phone: `+91${phone}` });
      setOtpSent(true);
      if (res.devOtp) { setDevOtp(res.devOtp); setOtp(res.devOtp); }
    } catch (err: any) { setError(err.message || "Failed to send OTP"); }
    finally { setLoading(false); }
  };

  const handleVerifyOtp = async () => {
    if (otp.length < 4) { setError("Please enter the OTP"); return; }
    setLoading(true); setError("");
    try {
      const res = await api.post<any>("/auth/otp/verify", { phone: `+91${phone}`, otp });
      setAuth(res.user, res.tokens.accessToken, res.tokens.refreshToken);
      router.push("/chat");
    } catch (err: any) { setError(err.message || "OTP verification failed"); }
    finally { setLoading(false); }
  };

  const handleEmailAuth = async () => {
    if (!email) { setError("Please enter your email"); return; }
    if (!password || password.length < 8) { setError("Password must be at least 8 characters"); return; }
    if (tab === "signup" && !name) { setError("Please enter your name"); return; }
    setLoading(true); setError("");
    try {
      const endpoint = tab === "login" ? "/auth/login" : "/auth/register";
      const body = tab === "login" ? { email, password } : { name, email, password };
      const res = await api.post<any>(endpoint, body);
      setAuth(res.user, res.tokens.accessToken, res.tokens.refreshToken);
      router.push("/chat");
    } catch (err: any) { setError(err.message || "Authentication failed"); }
    finally { setLoading(false); }
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
  const strengthLabel = ["", "Weak", "Fair", "Good", "Strong", "Very Strong"][strength] || "";
  const strengthColor = ["", "bg-red-500", "bg-orange-500", "bg-amber-500", "bg-emerald-500", "bg-emerald-400"][strength] || "";

  return (
    <div className="min-h-[85vh] flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm">
        {/* Header */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 mb-4">
            <div className="h-7 w-7 rounded-md bg-primary-600 flex items-center justify-center">
              <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="4" />
                <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
              </svg>
            </div>
            <span className="text-lg font-semibold text-white">Jyotron</span>
          </Link>
          <p className="text-sm text-white/40">AI-powered Vedic astrology</p>
        </div>

        <div className="surface-card p-6">
          {/* Tabs */}
          <div className="flex mb-6 p-1 rounded-lg bg-white/[0.04]">
            <button
              onClick={() => { setTab("login"); setError(""); }}
              className={`flex-1 py-2 rounded-md text-sm font-medium transition-all ${tab === "login" ? "bg-primary-600 text-white" : "text-white/40 hover:text-white/60"}`}
            >
              Log in
            </button>
            <button
              onClick={() => { setTab("signup"); setError(""); }}
              className={`flex-1 py-2 rounded-md text-sm font-medium transition-all ${tab === "signup" ? "bg-primary-600 text-white" : "text-white/40 hover:text-white/60"}`}
            >
              Sign up
            </button>
          </div>

          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
              {error}
            </div>
          )}

          {/* Google */}
          <button className="w-full flex items-center justify-center gap-2.5 py-2.5 rounded-lg btn-secondary text-sm mb-4">
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            Continue with Google
          </button>

          <div className="flex items-center gap-3 mb-4">
            <div className="flex-1 h-px bg-white/[0.06]" />
            <span className="text-[11px] text-white/25 uppercase">or</span>
            <div className="flex-1 h-px bg-white/[0.06]" />
          </div>

          {/* Method Toggle */}
          <div className="flex gap-1.5 mb-4">
            <button
              onClick={() => { setAuthMethod("phone"); setOtpSent(false); setError(""); setDevOtp(null); }}
              className={`flex-1 py-1.5 rounded-md text-xs font-medium transition-all ${authMethod === "phone" ? "bg-white/[0.08] text-white" : "text-white/30 hover:text-white/50"}`}
            >
              Phone (OTP)
            </button>
            <button
              onClick={() => { setAuthMethod("email"); setError(""); }}
              className={`flex-1 py-1.5 rounded-md text-xs font-medium transition-all ${authMethod === "email" ? "bg-white/[0.08] text-white" : "text-white/30 hover:text-white/50"}`}
            >
              Email
            </button>
          </div>

          {/* Form */}
          <div className="space-y-3">
            {tab === "signup" && authMethod === "email" && (
              <div>
                <label className="block text-xs text-white/40 mb-1.5">Full Name</label>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Enter your name"
                  className="w-full px-3 py-2.5 rounded-lg surface-input text-sm" />
              </div>
            )}

            {authMethod === "phone" ? (
              <>
                <div>
                  <label className="block text-xs text-white/40 mb-1.5">Phone Number</label>
                  <div className="flex gap-2">
                    <span className="flex items-center px-3 rounded-lg bg-white/[0.04] border border-white/[0.08] text-white/30 text-sm">+91</span>
                    <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))} placeholder="Phone number"
                      disabled={otpSent} className="flex-1 px-3 py-2.5 rounded-lg surface-input text-sm disabled:opacity-40" />
                  </div>
                </div>

                {otpSent && (
                  <div>
                    <label className="block text-xs text-white/40 mb-1.5">Enter OTP</label>
                    <input type="text" value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="6-digit OTP" maxLength={6}
                      className="w-full px-3 py-2.5 rounded-lg surface-input text-sm tracking-[0.3em] text-center" />
                    {devOtp && (
                      <div className="mt-2 p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[11px] text-center">
                        Dev OTP: <span className="font-mono font-bold">{devOtp}</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between mt-2">
                      <button onClick={handleSendOtp} disabled={loading} className="text-[11px] text-primary-400 hover:text-primary-300">Resend</button>
                      <button onClick={() => { setOtpSent(false); setOtp(""); setDevOtp(null); }} className="text-[11px] text-white/30 hover:text-white/50">Change Number</button>
                    </div>
                  </div>
                )}

                <button onClick={otpSent ? handleVerifyOtp : handleSendOtp} disabled={loading}
                  className="w-full py-2.5 rounded-lg btn-primary text-sm disabled:opacity-50">
                  {loading ? "Please wait..." : otpSent ? "Verify & Continue" : "Send OTP"}
                </button>
              </>
            ) : (
              <>
                <div>
                  <label className="block text-xs text-white/40 mb-1.5">Email</label>
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com"
                    className="w-full px-3 py-2.5 rounded-lg surface-input text-sm" />
                </div>
                <div>
                  <label className="block text-xs text-white/40 mb-1.5">Password</label>
                  <div className="relative">
                    <input type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Min 8 characters"
                      className="w-full px-3 py-2.5 pr-14 rounded-lg surface-input text-sm" />
                    <button type="button" onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-white/25 hover:text-white/50 text-xs">
                      {showPassword ? "Hide" : "Show"}
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
                <button onClick={handleEmailAuth} disabled={loading}
                  className="w-full py-2.5 rounded-lg btn-primary text-sm disabled:opacity-50">
                  {loading ? "Please wait..." : tab === "login" ? "Log in" : "Create Account"}
                </button>
              </>
            )}
          </div>

          <p className="text-[11px] text-white/20 text-center mt-5">
            By continuing, you agree to our Terms of Service and Privacy Policy.
          </p>
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
