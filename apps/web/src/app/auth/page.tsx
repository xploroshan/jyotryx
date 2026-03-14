"use client";

import { useState } from "react";
import Link from "next/link";

export default function AuthPage() {
  const [tab, setTab] = useState<"login" | "signup">("login");
  const [authMethod, setAuthMethod] = useState<"phone" | "email">("phone");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");

  const handleSendOtp = () => {
    if (phone.length >= 10) setOtpSent(true);
  };

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
              onClick={() => setTab("login")}
              className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                tab === "login"
                  ? "bg-gradient-to-r from-primary-600 to-mystic-600 text-white"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              Log In
            </button>
            <button
              onClick={() => setTab("signup")}
              className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                tab === "signup"
                  ? "bg-gradient-to-r from-primary-600 to-mystic-600 text-white"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              Sign Up
            </button>
          </div>

          {/* Social Sign In */}
          <div className="space-y-3 mb-6">
            <button className="w-full flex items-center justify-center gap-3 py-3 rounded-xl glass hover:bg-white/10 transition-all text-sm font-medium">
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              Continue with Google
            </button>
            <button className="w-full flex items-center justify-center gap-3 py-3 rounded-xl glass hover:bg-white/10 transition-all text-sm font-medium">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
              </svg>
              Continue with Apple
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
              onClick={() => { setAuthMethod("phone"); setOtpSent(false); }}
              className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all ${
                authMethod === "phone" ? "bg-white/10 text-white" : "text-gray-500 hover:text-gray-300"
              }`}
            >
              Phone (OTP)
            </button>
            <button
              onClick={() => setAuthMethod("email")}
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
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter your name"
                  className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-600 focus:outline-none focus:border-primary-500 transition-colors"
                />
              </div>
            )}

            {authMethod === "phone" ? (
              <>
                <div>
                  <label className="block text-sm text-gray-400 mb-1.5">Phone Number</label>
                  <div className="flex gap-2">
                    <span className="flex items-center px-3 rounded-xl bg-white/5 border border-white/10 text-gray-400 text-sm">
                      +91
                    </span>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="Enter phone number"
                      className="flex-1 px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-600 focus:outline-none focus:border-primary-500 transition-colors"
                    />
                  </div>
                </div>

                {otpSent && (
                  <div>
                    <label className="block text-sm text-gray-400 mb-1.5">Enter OTP</label>
                    <input
                      type="text"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value)}
                      placeholder="6-digit OTP"
                      maxLength={6}
                      className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-600 focus:outline-none focus:border-primary-500 transition-colors tracking-widest text-center text-lg"
                    />
                    <button className="text-xs text-primary-400 hover:text-primary-300 mt-2">
                      Resend OTP
                    </button>
                  </div>
                )}

                <button
                  onClick={otpSent ? undefined : handleSendOtp}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-primary-600 to-mystic-600 text-white font-semibold hover:from-primary-500 hover:to-mystic-500 transition-all glow"
                >
                  {otpSent ? "Verify & Continue" : "Send OTP"}
                </button>
              </>
            ) : (
              <>
                <div>
                  <label className="block text-sm text-gray-400 mb-1.5">Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-600 focus:outline-none focus:border-primary-500 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1.5">Password</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter password"
                    className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-600 focus:outline-none focus:border-primary-500 transition-colors"
                  />
                </div>

                {tab === "login" && (
                  <div className="text-right">
                    <button className="text-xs text-primary-400 hover:text-primary-300">
                      Forgot password?
                    </button>
                  </div>
                )}

                <button className="w-full py-3 rounded-xl bg-gradient-to-r from-primary-600 to-mystic-600 text-white font-semibold hover:from-primary-500 hover:to-mystic-500 transition-all glow">
                  {tab === "login" ? "Log In" : "Create Account"}
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
