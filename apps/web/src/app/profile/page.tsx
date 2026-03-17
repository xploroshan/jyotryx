"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/store";

interface UserProfile {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  dateOfBirth?: string | null;
  timeOfBirth?: string | null;
  placeOfBirth?: any;
  profilePhoto?: string | null;
  credits: number;
  role: string;
  createdAt: string;
}

interface CreditInfo {
  available: number;
  used: number;
  total: number;
  role: string;
  resetsAt: string;
}

export default function ProfilePage() {
  const router = useRouter();
  const { isAuthenticated, accessToken, logout, updateCredits } = useAuthStore();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [creditInfo, setCreditInfo] = useState<CreditInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [activeTab, setActiveTab] = useState<"profile" | "credits" | "security">("profile");

  // Profile form
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [dob, setDob] = useState("");
  const [tob, setTob] = useState("");
  const [pob, setPob] = useState("");

  // Security form
  const [hasPassword, setHasPassword] = useState(true);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [changingPw, setChangingPw] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      router.push("/auth");
      return;
    }
    loadProfile();
  }, [isAuthenticated]);

  const loadProfile = async () => {
    setLoading(true);
    setError("");
    try {
      const [profileData, creditsData, authStatus] = await Promise.all([
        api.get<UserProfile>("/users/me", { token: accessToken! }),
        api.get<CreditInfo>("/users/me/credits", { token: accessToken! }),
        api.get<{ hasPassword: boolean }>("/auth/status", { token: accessToken! }),
      ]);
      setProfile(profileData);
      setCreditInfo(creditsData);
      setHasPassword(authStatus.hasPassword);
      setName(profileData.name || "");
      setPhone(profileData.phone || "");
      setDob(profileData.dateOfBirth ? profileData.dateOfBirth.split("T")[0] : "");
      setTob(profileData.timeOfBirth || "");
      setPob(typeof profileData.placeOfBirth === "object" ? profileData.placeOfBirth?.name || "" : profileData.placeOfBirth || "");
      updateCredits(profileData.credits);
    } catch (err: any) {
      setError(err.message || "Failed to load profile");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const updated = await api.put<UserProfile>(
        "/users/me",
        {
          name: name || undefined,
          phone: phone || undefined,
          dateOfBirth: dob || undefined,
          timeOfBirth: tob || undefined,
          placeOfBirth: pob || undefined,
        },
        { token: accessToken! }
      );
      setProfile(updated);
      updateCredits(updated.credits);
      setSuccess("Profile updated successfully!");
      setTimeout(() => setSuccess(""), 3000);
    } catch (err: any) {
      setError(err.message || "Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    setError("");
    setSuccess("");

    if (!hasPassword) {
      // Setting password for OTP/social users
      if (!newPassword || newPassword.length < 8) {
        setError("Password must be at least 8 characters");
        return;
      }
      if (newPassword !== confirmPassword) {
        setError("Passwords do not match");
        return;
      }
      setChangingPw(true);
      try {
        const res = await api.post<{ message: string }>("/auth/set-password", { password: newPassword }, { token: accessToken! });
        setSuccess(res.message);
        setHasPassword(true);
        setNewPassword("");
        setConfirmPassword("");
        setTimeout(() => setSuccess(""), 3000);
      } catch (err: any) {
        setError(err.message || "Failed to set password");
      } finally {
        setChangingPw(false);
      }
      return;
    }

    // Changing existing password
    if (!currentPassword) {
      setError("Please enter your current password");
      return;
    }
    if (!newPassword || newPassword.length < 8) {
      setError("New password must be at least 8 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("New passwords do not match");
      return;
    }
    if (currentPassword === newPassword) {
      setError("New password must be different from current password");
      return;
    }

    setChangingPw(true);
    try {
      const res = await api.post<{ message: string }>(
        "/auth/change-password",
        { currentPassword, newPassword },
        { token: accessToken! }
      );
      setSuccess(res.message);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setTimeout(() => setSuccess(""), 3000);
    } catch (err: any) {
      setError(err.message || "Failed to change password");
    } finally {
      setChangingPw(false);
    }
  };

  const handleLogout = () => {
    logout();
    router.push("/");
  };

  const roleBadge = (role: string) =>
    role === "ADMIN" ? "bg-red-500/20 text-red-400" : role === "PREMIUM" ? "bg-purple-500/20 text-purple-400" : "bg-white/[0.03] text-white/40";

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
  const strengthLabel = ["", "Weak", "Fair", "Good", "Strong", "Very Strong"][strength] || "";
  const strengthColor = ["", "bg-red-500", "bg-orange-500", "bg-amber-500", "bg-emerald-500", "bg-emerald-400"][strength] || "";

  return (
    <div className="relative min-h-screen">
      <div className="absolute inset-0 bg-surface-950" />

      <div className="relative z-10 mx-auto max-w-3xl px-4 py-12">
        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold mb-2">
            My <span className="text-gradient">Profile</span>
          </h1>
          <p className="text-white/40 text-sm">Manage your account and birth details for accurate predictions</p>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-20">
            <svg className="w-8 h-8 animate-spin text-primary-500" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
        )}

        {error && (
          <div className="mb-6 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-center justify-between">
            {error}
            <button onClick={() => setError("")} className="text-red-400 hover:text-red-300 ml-2">&times;</button>
          </div>
        )}
        {success && (
          <div className="mb-6 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm">{success}</div>
        )}

        {profile && !loading && (
          <>
            {/* Profile Header Card */}
            <div className="surface-card p-6 mb-6 flex flex-col sm:flex-row items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary-500 to-mystic-500 flex items-center justify-center text-2xl font-bold text-white">
                {profile.name?.charAt(0)?.toUpperCase() || "U"}
              </div>
              <div className="text-center sm:text-left flex-1">
                <h2 className="text-xl font-bold text-white">{profile.name}</h2>
                <p className="text-sm text-white/40">{profile.email}</p>
                <div className="flex items-center gap-2 mt-1 justify-center sm:justify-start">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${roleBadge(profile.role)}`}>{profile.role}</span>
                  <span className="text-xs text-white/30">Member since {new Date(profile.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
              <button onClick={handleLogout} className="px-4 py-2 rounded-xl btn-secondary text-sm text-red-400 hover:bg-red-500/10 transition-all">
                Logout
              </button>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 mb-6 rounded-xl bg-white/[0.03] p-1 w-fit">
              {([
                { id: "profile" as const, label: "Birth Details" },
                { id: "security" as const, label: "Security" },
              ]).map((t) => (
                <button key={t.id} onClick={() => { setActiveTab(t.id); setError(""); setSuccess(""); }}
                  className={`px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${activeTab === t.id ? "btn-primary" : "text-white/40 hover:text-white"}`}>
                  {t.label}
                </button>
              ))}
            </div>

            {/* Birth Details Tab */}
            {activeTab === "profile" && (
              <div className="surface-card p-6">
                <h3 className="text-lg font-bold text-white mb-6">Birth Details</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs text-white/30 mb-2">Full Name</label>
                    <input type="text" value={name} onChange={(e) => setName(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl surface-input" />
                  </div>
                  <div>
                    <label className="block text-xs text-white/30 mb-2">Phone Number</label>
                    <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 9876543210"
                      className="w-full px-4 py-3 rounded-xl surface-input" />
                  </div>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs text-white/30 mb-2">Date of Birth</label>
                      <input type="date" value={dob} onChange={(e) => setDob(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl surface-input" />
                    </div>
                    <div>
                      <label className="block text-xs text-white/30 mb-2">Time of Birth</label>
                      <input type="time" value={tob} onChange={(e) => setTob(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl surface-input" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-white/30 mb-2">Place of Birth</label>
                    <input type="text" value={pob} onChange={(e) => setPob(e.target.value)} placeholder="e.g. Mumbai, India"
                      className="w-full px-4 py-3 rounded-xl surface-input" />
                  </div>
                  <button onClick={handleSave} disabled={saving}
                    className="mt-2 px-8 py-3 rounded-xl btn-primary text-white font-medium  transition-all disabled:opacity-50">
                    {saving ? "Saving..." : "Save Changes"}
                  </button>
                </div>
              </div>
            )}

            {/* Security Tab */}
            {activeTab === "security" && (
              <div className="space-y-6">
                <div className="surface-card p-6">
                  <h3 className="text-lg font-bold text-white mb-2">
                    {hasPassword ? "Change Password" : "Set Password"}
                  </h3>
                  <p className="text-sm text-white/40 mb-6">
                    {hasPassword
                      ? "Update your password to keep your account secure."
                      : "You signed in via OTP/social login. Set a password to also log in with email."}
                  </p>

                  <div className="space-y-4">
                    {hasPassword && (
                      <div>
                        <label className="block text-xs text-white/30 mb-2">Current Password</label>
                        <div className="relative">
                          <input type={showCurrentPw ? "text" : "password"} value={currentPassword}
                            onChange={(e) => setCurrentPassword(e.target.value)} placeholder="Enter current password"
                            className="w-full px-4 py-3 pr-16 rounded-xl surface-input" />
                          <button type="button" onClick={() => setShowCurrentPw(!showCurrentPw)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-white/30 hover:text-white/60">
                            {showCurrentPw ? "Hide" : "Show"}
                          </button>
                        </div>
                      </div>
                    )}

                    <div>
                      <label className="block text-xs text-white/30 mb-2">New Password</label>
                      <div className="relative">
                        <input type={showNewPw ? "text" : "password"} value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)} placeholder="Min 8 chars, upper + lower + number"
                          className="w-full px-4 py-3 pr-16 rounded-xl surface-input" />
                        <button type="button" onClick={() => setShowNewPw(!showNewPw)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-white/30 hover:text-white/60">
                          {showNewPw ? "Hide" : "Show"}
                        </button>
                      </div>
                      {newPassword.length > 0 && (
                        <div className="mt-2">
                          <div className="flex gap-1 mb-1">
                            {[1, 2, 3, 4, 5].map((i) => (
                              <div key={i} className={`h-1 flex-1 rounded-full ${i <= strength ? strengthColor : "bg-white/10"}`} />
                            ))}
                          </div>
                          <p className={`text-xs ${strength >= 4 ? "text-emerald-400" : strength >= 3 ? "text-amber-400" : "text-red-400"}`}>
                            {strengthLabel}
                          </p>
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="block text-xs text-white/30 mb-2">Confirm New Password</label>
                      <input type="password" value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Re-enter new password"
                        className="w-full px-4 py-3 rounded-xl surface-input" />
                      {confirmPassword && newPassword !== confirmPassword && (
                        <p className="text-xs text-red-400 mt-1">Passwords do not match</p>
                      )}
                    </div>

                    <button onClick={handleChangePassword} disabled={changingPw}
                      className="px-8 py-3 rounded-xl btn-primary text-white font-medium  transition-all disabled:opacity-50">
                      {changingPw ? "Saving..." : hasPassword ? "Change Password" : "Set Password"}
                    </button>
                  </div>
                </div>

                {/* Account Info */}
                <div className="surface-card p-6">
                  <h3 className="text-lg font-bold text-white mb-4">Account Security</h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 rounded-lg bg-white/[0.03]">
                      <div>
                        <p className="text-sm text-white">Password</p>
                        <p className="text-xs text-white/30">Authentication method</p>
                      </div>
                      <span className={`text-xs px-2 py-1 rounded-full ${hasPassword ? "bg-emerald-500/20 text-emerald-400" : "bg-amber-500/20 text-amber-400"}`}>
                        {hasPassword ? "Set" : "Not Set"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-lg bg-white/[0.03]">
                      <div>
                        <p className="text-sm text-white">Email</p>
                        <p className="text-xs text-white/30">{profile.email}</p>
                      </div>
                      <span className="text-xs px-2 py-1 rounded-full bg-emerald-500/20 text-emerald-400">Verified</span>
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-lg bg-white/[0.03]">
                      <div>
                        <p className="text-sm text-white">Phone</p>
                        <p className="text-xs text-white/30">{profile.phone || "Not added"}</p>
                      </div>
                      <span className={`text-xs px-2 py-1 rounded-full ${profile.phone ? "bg-emerald-500/20 text-emerald-400" : "bg-white/[0.03] text-white/30"}`}>
                        {profile.phone ? "Linked" : "Not Linked"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-lg bg-white/[0.03]">
                      <div>
                        <p className="text-sm text-white">Two-Factor Auth</p>
                        <p className="text-xs text-white/30">Extra security layer</p>
                      </div>
                      <span className="text-xs px-2 py-1 rounded-full bg-white/[0.03] text-white/30">Coming Soon</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

          </>
        )}
      </div>
    </div>
  );
}
