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
    if (phone.length < 10) {
      setError("Please enter a valid 10-digit phone number");
      return;
    }
    setLoading(true);
    setError("");
    setDevOtp(null);
    try {
      const res = await api.post<{ message: string; expiresIn: number; devOtp?: string }>(
        "/auth/otp/send",
        { phone: `+91${phone}` }
      );
      setOtpSent(true);
      if (res.devOtp) {
        setDevOtp(res.devOtp);
        setOtp(res.devOtp);
      }
    } catch (err: any) {
      setError(err.message || "Failed to send OTP");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (otp.length < 4) {
      setError("Please enter the OTP");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await api.post<any>("/auth/otp/verify", { phone: `+91${phone}`, otp });
      setAuth(res.user, res.tokens.accessToken, res.tokens.refreshToken);
      router.push("/chat");
    } catch (err: any) {
      setError(err.message || "OTP verification failed");
    } finally {
      setLoading(false);
    }
  };

  const handleEmailAuth = async () => {
    if (!email) { setError("Please enter your email"); return; }
    if (!password || password.length < 8) { setError("Password must be at least 8 characters"); return; }
    if (tab === "signup" && !name) { setError("Please enter your name"); return; }

    setLoading(true);
    setError("");
    try {
      const endpoint = tab === "login" ? "/auth/login" : "/auth/register";
      const body = tab === "login" ? { email, password } : { name, email, password };
      const res = await api.post<any>(endpoint, body);
      setAuth(res.user, res.tokens.accessToken, res.tokens.refreshToken);
      router.push("/chat");
    } catch (err: any) {
      setError(err.message || "Authentication failed");
    } finally {
      setLoading(false);
    }
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
    <div className="relative min-h-[85vh] flex items-center justify-center px-4 py-16">
      <div className="absolute inset-0 bg-gradient-to-b from-primary-900/20 via-gray-950 to-gray-950" />
      <div className="absolute top-20 left-1/3 w-80 h-80 bg-primary-500/10 rounded-full blur-3xl" />
      <div className="absolute bottom-20 right-1/3 w-80 h-80 bg-mystic-500/10 rounded-full blur-3xl" />

      <div className="relative z-10 w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="text-2xl font-display font-bold text-gradient">
            Jyotryx
          </Link>
          <p className="text-gray-400 mt-2">Your AI-powered astrology companion</p>
        </div>

        <div className="glass-card p-8">
          {/* Tabs */}
          <div className="flex mb-8 rounded-xl bg-white/5 p-1">
            <button
              onClick={() => { setTab("login"); setError(""); }}
              className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                tab === "login"
                  ? "bg-gradient-to-r from-primary-600 to-mystic-600 text-white"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              Log In
            </button>
            <button
              onClick={() => { setTab("signup"); setError(""); }}
              className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                tab === "signup"
                  ? "bg-gradient-to-r from-primary-600 to-mystic-600 text-white"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              Sign Up
            </button>
          </div>

          {error && (
            <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* Social Sign In */}
          <div className="space-y-3 mb-6">
            <button className="w-full flex items-center justify-center gap-3 py-3 rounded-xl glass hover:bg-white/10 transition-all text-sm font-medium">
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              Continue with Google
            </button>
          </div>

          <div className="flex items-center gap-3 mb-6">
            <div className="flex-1 h-px bg-white/10" />
            <span className="text-xs text-gray-500 uppercase">or</span>
            <div className="flex-1 h-px bg-white/10" />
          </div>

          {/* Auth Method Toggle */}
          <div className="flex gap-2 mb-6">
            <button
              onClick={() => { setAuthMethod("phone"); setOtpSent(false); setError(""); setDevOtp(null); }}
              className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all ${
                authMethod === "phone" ? "bg-white/10 text-white" : "text-gray-500 hover:text-gray-300"
              }`}
            >
              Phone (OTP)
            </button>
            <button
              onClick={() => { setAuthMethod("email"); setError(""); }}
              className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all ${
                authMethod === "email" ? "bg-white/10 text-white" : "text-gray-500 hover:text-gray-300"
              }`}
            >
              Email &amp; Password
            </button>
          </div>

          {/* Form */}
          <div className="space-y-4">
            {tab === "signup" && authMethod === "email" && (
              <div>
                <label className="block text-sm text-gray-400 mb-1.5">Full Name</label>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Enter your name"
                  className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-600 focus:outline-none focus:border-primary-500 transition-colors" />
              </div>
            )}

            {authMethod === "phone" ? (
              <>
                <div>
                  <label className="block text-sm text-gray-400 mb-1.5">Phone Number</label>
                  <div className="flex gap-2">
                    <span className="flex items-center px-3 rounded-xl bg-white/5 border border-white/10 text-gray-400 text-sm">+91</span>
                    <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))} placeholder="Enter phone number"
                      disabled={otpSent}
                      className="flex-1 px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-600 focus:outline-none focus:border-primary-500 transition-colors disabled:opacity-50" />
                  </div>
                </div>

                {otpSent && (
                  <div>
                    <label className="block text-sm text-gray-400 mb-1.5">Enter OTP</label>
                    <input type="text" value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="6-digit OTP" maxLength={6}
                      className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-600 focus:outline-none focus:border-primary-500 transition-colors tracking-widest text-center text-lg" />
                    {devOtp && (
                      <div className="mt-2 p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs text-center">
                        Dev Mode - OTP auto-filled: <span className="font-mono font-bold">{devOtp}</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between mt-2">
                      <button onClick={handleSendOtp} disabled={loading} className="text-xs text-primary-400 hover:text-primary-300">Resend OTP</button>
                      <button onClick={() => { setOtpSent(false); setOtp(""); setDevOtp(null); }} className="text-xs text-gray-500 hover:text-gray-300">Change Number</button>
                    </div>
                  </div>
                )}

                <button
                  onClick={otpSent ? handleVerifyOtp : handleSendOtp}
                  disabled={loading}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-primary-600 to-mystic-600 text-white font-semibold hover:from-primary-500 hover:to-mystic-500 transition-all glow disabled:opacity-50"
                >
                  {loading ? "Please wait..." : otpSent ? "Verify & Continue" : "Send OTP"}
                </button>
              </>
            ) : (
              <>
                <div>
                  <label className="block text-sm text-gray-400 mb-1.5">Email</label>
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com"
                    className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-600 focus:outline-none focus:border-primary-500 transition-colors" />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1.5">Password</label>
                  <div className="relative">
                    <input type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Min 8 characters"
                      className="w-full px-4 py-3 pr-12 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-600 focus:outline-none focus:border-primary-500 transition-colors" />
                    <button type="button" onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 text-sm">
                      {showPassword ? "Hide" : "Show"}
                    </button>
                  </div>
                  {/* Password strength meter for signup */}
                  {tab === "signup" && password.length > 0 && (
                    <div className="mt-2">
                      <div className="flex gap-1 mb-1">
                        {[1, 2, 3, 4, 5].map((i) => (
                          <div key={i} className={`h-1 flex-1 rounded-full ${i <= strength ? strengthColor : "bg-white/10"}`} />
                        ))}
                      </div>
                      <p className={`text-xs ${strength >= 4 ? "text-emerald-400" : strength >= 3 ? "text-amber-400" : "text-red-400"}`}>
                        {strengthLabel}
                        {strength < 3 && " - Use uppercase, lowercase, numbers"}
                      </p>
                    </div>
                  )}
                </div>

                <button
                  onClick={handleEmailAuth}
                  disabled={loading}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-primary-600 to-mystic-600 text-white font-semibold hover:from-primary-500 hover:to-mystic-500 transition-all glow disabled:opacity-50"
                >
                  {loading ? "Please wait..." : tab === "login" ? "Log In" : "Create Account"}
                </button>
              </>
            )}
          </div>

          <p className="text-xs text-gray-500 text-center mt-6">
            By continuing, you agree to our{" "}
            <span className="text-primary-400 cursor-pointer">Terms of Service</span> and{" "}
            <span className="text-primary-400 cursor-pointer">Privacy Policy</span>.
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
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary-500" />
      </div>
    }>
      <AuthPageContent />
    </Suspense>
  );
}
