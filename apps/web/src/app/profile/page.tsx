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
  const [activeTab, setActiveTab] = useState<"profile" | "credits">("profile");

  // Form state
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [dob, setDob] = useState("");
  const [tob, setTob] = useState("");
  const [pob, setPob] = useState("");

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
      const [profileData, creditsData] = await Promise.all([
        api.get<UserProfile>("/users/me", { token: accessToken! }),
        api.get<CreditInfo>("/users/me/credits", { token: accessToken! }),
      ]);
      setProfile(profileData);
      setCreditInfo(creditsData);
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

  const handleLogout = () => {
    logout();
    router.push("/");
  };

  const roleBadge = (role: string) =>
    role === "ADMIN" ? "bg-red-500/20 text-red-400" : role === "PREMIUM" ? "bg-purple-500/20 text-purple-400" : "bg-white/5 text-gray-400";

  return (
    <div className="relative min-h-screen">
      <div className="absolute inset-0 bg-gradient-to-b from-mystic-900/10 via-gray-950 to-gray-950" />
      <div className="absolute top-32 left-1/4 w-80 h-80 bg-mystic-500/8 rounded-full blur-3xl" />

      <div className="relative z-10 mx-auto max-w-3xl px-4 py-12">
        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="text-4xl font-display font-bold mb-2">
            My <span className="text-gradient">Profile</span>
          </h1>
          <p className="text-gray-400 text-sm">Manage your account and birth details for accurate predictions</p>
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
          <div className="mb-6 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">{error}</div>
        )}
        {success && (
          <div className="mb-6 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm">{success}</div>
        )}

        {profile && !loading && (
          <>
            {/* Profile Header Card */}
            <div className="glass-card p-6 mb-6 flex flex-col sm:flex-row items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary-500 to-mystic-500 flex items-center justify-center text-2xl font-bold text-white">
                {profile.name?.charAt(0)?.toUpperCase() || "U"}
              </div>
              <div className="text-center sm:text-left flex-1">
                <h2 className="text-xl font-display font-bold text-white">{profile.name}</h2>
                <p className="text-sm text-gray-400">{profile.email}</p>
                <div className="flex items-center gap-2 mt-1 justify-center sm:justify-start">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${roleBadge(profile.role)}`}>{profile.role}</span>
                  <span className="text-xs text-gray-500">Member since {new Date(profile.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
              <button onClick={handleLogout} className="px-4 py-2 rounded-xl glass text-sm text-red-400 hover:bg-red-500/10 transition-all">
                Logout
              </button>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 mb-6 rounded-xl bg-white/5 p-1 w-fit">
              {(["profile", "credits"] as const).map((tab) => (
                <button key={tab} onClick={() => setActiveTab(tab)}
                  className={`px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${activeTab === tab ? "bg-gradient-to-r from-primary-600 to-mystic-600 text-white" : "text-gray-400 hover:text-white"}`}>
                  {tab === "profile" ? "Birth Details" : "Credits"}
                </button>
              ))}
            </div>

            {activeTab === "profile" && (
              <div className="glass-card p-6">
                <h3 className="text-lg font-display font-bold text-white mb-6">Birth Details</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs text-gray-500 mb-2">Full Name</label>
                    <input type="text" value={name} onChange={(e) => setName(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-primary-500" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-2">Phone Number</label>
                    <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 9876543210"
                      className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-600 focus:outline-none focus:border-primary-500" />
                  </div>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs text-gray-500 mb-2">Date of Birth</label>
                      <input type="date" value={dob} onChange={(e) => setDob(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-primary-500" />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-2">Time of Birth</label>
                      <input type="time" value={tob} onChange={(e) => setTob(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-primary-500" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-2">Place of Birth</label>
                    <input type="text" value={pob} onChange={(e) => setPob(e.target.value)} placeholder="e.g. Mumbai, India"
                      className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-600 focus:outline-none focus:border-primary-500" />
                  </div>
                  <button onClick={handleSave} disabled={saving}
                    className="mt-2 px-8 py-3 rounded-xl bg-gradient-to-r from-primary-600 to-mystic-600 text-white font-medium hover:from-primary-500 hover:to-mystic-500 transition-all disabled:opacity-50">
                    {saving ? "Saving..." : "Save Changes"}
                  </button>
                </div>
              </div>
            )}

            {activeTab === "credits" && creditInfo && (
              <div className="space-y-6">
                {/* Credit Overview */}
                <div className="glass-card p-6">
                  <h3 className="text-lg font-display font-bold text-white mb-4">Credit Balance</h3>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="text-center">
                      <p className="text-3xl font-bold text-gradient">{creditInfo.available}</p>
                      <p className="text-xs text-gray-500 mt-1">Available</p>
                    </div>
                    <div className="text-center">
                      <p className="text-3xl font-bold text-accent-400">{creditInfo.used}</p>
                      <p className="text-xs text-gray-500 mt-1">Used</p>
                    </div>
                    <div className="text-center">
                      <p className="text-3xl font-bold text-gray-400">{creditInfo.total}</p>
                      <p className="text-xs text-gray-500 mt-1">Total Earned</p>
                    </div>
                  </div>
                  <div className="mt-4 w-full h-2 bg-white/5 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-primary-500 to-accent-500 rounded-full transition-all"
                      style={{ width: `${creditInfo.total > 0 ? (creditInfo.available / creditInfo.total) * 100 : 0}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-3">
                    Credits reset on {new Date(creditInfo.resetsAt).toLocaleDateString()}
                  </p>
                </div>

                {/* Buy More */}
                <div className="glass-card p-6">
                  <h3 className="text-lg font-display font-bold text-white mb-2">Need More Credits?</h3>
                  <p className="text-sm text-gray-400 mb-4">
                    Purchase credit packs or upgrade to Premium for unlimited access.
                  </p>
                  <button onClick={() => router.push("/pricing")}
                    className="px-6 py-3 rounded-xl bg-gradient-to-r from-primary-600 to-mystic-600 text-white font-medium hover:from-primary-500 hover:to-mystic-500 transition-all">
                    View Plans & Pricing
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
