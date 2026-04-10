"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/store";
import { useTranslation } from "@/i18n";
import LanguageSwitcher from "@/components/ui/LanguageSwitcher";

interface UserProfile {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  dateOfBirth?: string | null;
  timeOfBirth?: string | null;
  placeOfBirth?: any;
  gender?: string | null;
  profession?: string | null;
  profilePhoto?: string | null;
  credits: number;
  role: string;
  createdAt: string;
  profileComplete: boolean;
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
  const searchParams = useSearchParams();
  const { t } = useTranslation();
  const { isAuthenticated, accessToken, logout, updateCredits, setProfileComplete } = useAuthStore();
  const completeMode = searchParams.get("complete") === "1";
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
  const [gender, setGender] = useState("");
  const [profession, setProfession] = useState("");

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
      setGender(profileData.gender || "");
      setProfession(profileData.profession || "");
      updateCredits(profileData.credits);
    } catch (err: any) {
      setError(err.message || t.profile.loadFailed);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setError("");
    setSuccess("");

    // When the user is completing their profile for the first time, enforce
    // that the required birth fields are filled before hitting the API.
    const wasIncomplete = profile ? !profile.profileComplete : true;
    if (wasIncomplete) {
      const missing: string[] = [];
      if (!dob) missing.push(t.profile.missingDob);
      if (!tob) missing.push(t.profile.missingTob);
      if (!pob.trim()) missing.push(t.profile.missingPob);
      if (!gender) missing.push(t.profile.missingGender);
      if (missing.length) {
        setError(`${t.profile.pleaseFillIn} ${missing.join(", ")}`);
        return;
      }
    }

    setSaving(true);
    try {
      const updated = await api.put<UserProfile>(
        "/users/me",
        {
          name: name || undefined,
          phone: phone || undefined,
          dateOfBirth: dob || undefined,
          timeOfBirth: tob || undefined,
          placeOfBirth: pob || undefined,
          gender: gender || undefined,
          profession: profession || undefined,
        },
        { token: accessToken! }
      );
      setProfile(updated);
      updateCredits(updated.credits);
      setProfileComplete(updated.profileComplete);

      // First-time completion → unlock the rest of the app.
      if (wasIncomplete && updated.profileComplete) {
        setSuccess(t.profile.profileCompleteRedirecting);
        setTimeout(() => router.push("/my-day"), 1200);
        return;
      }

      setSuccess(t.profile.profileUpdatedSuccess);
      setTimeout(() => setSuccess(""), 3000);
    } catch (err: any) {
      setError(err.message || t.profile.updateFailed);
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
        setError(t.profile.errPasswordShort);
        return;
      }
      if (newPassword !== confirmPassword) {
        setError(t.profile.errPasswordsMismatchInline);
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
        setError(err.message || t.profile.errSetFailed);
      } finally {
        setChangingPw(false);
      }
      return;
    }

    // Changing existing password
    if (!currentPassword) {
      setError(t.profile.errCurrentRequired);
      return;
    }
    if (!newPassword || newPassword.length < 8) {
      setError(t.profile.errNewPasswordShort);
      return;
    }
    if (newPassword !== confirmPassword) {
      setError(t.profile.errPasswordsMismatch);
      return;
    }
    if (currentPassword === newPassword) {
      setError(t.profile.errPasswordSame);
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
      setError(err.message || t.profile.errChangeFailed);
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
  const strengthLabel = ["", t.profile.strengthWeak, t.profile.strengthFair, t.profile.strengthGood, t.profile.strengthStrong, t.profile.strengthVeryStrong][strength] || "";
  const strengthColor = ["", "bg-red-500", "bg-orange-500", "bg-amber-500", "bg-emerald-500", "bg-emerald-400"][strength] || "";

  return (
    <div className="relative min-h-screen">
      <div className="absolute inset-0 bg-surface-950" />

      <div className="relative z-10 mx-auto max-w-3xl px-4 py-12">
        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold mb-2">
            {profile && !profile.profileComplete ? (
              <>{t.profile.welcomePrefix} <span className="text-gradient">{t.profile.brandName}</span></>
            ) : (
              <>{t.profile.myPrefix} <span className="text-gradient">{t.profile.profileHighlight}</span></>
            )}
          </h1>
          <p className="text-white/40 text-sm">
            {profile && !profile.profileComplete
              ? t.profile.subtitleIncomplete
              : t.profile.subtitleComplete}
          </p>
        </div>

        {/* Onboarding banner — only shown when profile is incomplete */}
        {profile && !profile.profileComplete && (
          <div className="mb-6 p-4 rounded-xl border border-primary-500/30 bg-primary-500/10 flex gap-3">
            <div className="shrink-0 w-9 h-9 rounded-full bg-primary-500/20 flex items-center justify-center text-primary-300">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
              </svg>
            </div>
            <div className="text-sm">
              <p className="text-white font-medium mb-0.5">
                {completeMode ? t.profile.almostThere : t.profile.completeYourProfile}
              </p>
              <p className="text-white/60 text-xs leading-relaxed">
                {t.profile.completeDescPart1} <span className="text-white">{t.profile.completeDescBirth}</span>{" "}
                {t.profile.completeDescPlus} <span className="text-white">{t.profile.completeDescGender}</span>{" "}
                {t.profile.completeDescPart2}
              </p>
            </div>
          </div>
        )}

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
                  <span className="text-xs text-white/30">{t.profile.memberSince} {new Date(profile.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
              <button onClick={handleLogout} className="px-4 py-2 rounded-xl btn-secondary text-sm text-red-400 hover:bg-red-500/10 transition-all">
                {t.profile.logout}
              </button>
            </div>

            {/* Language preference card */}
            <div className="surface-card p-6 mb-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-lg font-bold text-white mb-1">{t.profile.language}</h3>
                  <p className="text-sm text-white/40">{t.profile.languageDesc}</p>
                </div>
                <LanguageSwitcher />
              </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 mb-6 rounded-xl bg-white/[0.03] p-1 w-fit">
              {([
                { id: "profile" as const, label: t.profile.tabBirthDetails },
                { id: "security" as const, label: t.profile.tabSecurity },
              ]).map((tab) => (
                <button key={tab.id} onClick={() => { setActiveTab(tab.id); setError(""); setSuccess(""); }}
                  className={`px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${activeTab === tab.id ? "btn-primary" : "text-white/40 hover:text-white"}`}>
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Birth Details Tab */}
            {activeTab === "profile" && (
              <div className="surface-card p-6">
                <h3 className="text-lg font-bold text-white mb-6">{t.profile.birthDetails}</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs text-white/30 mb-2">{t.profile.name}</label>
                    <input type="text" value={name} onChange={(e) => setName(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl surface-input" />
                  </div>
                  <div>
                    <label className="block text-xs text-white/30 mb-2">{t.profile.phoneNumberLabel}</label>
                    <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder={t.profile.phoneNumberPlaceholder}
                      className="w-full px-4 py-3 rounded-xl surface-input" />
                  </div>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs text-white/30 mb-2">
                        {t.profile.dob} <span className="text-primary-400">*</span>
                      </label>
                      <input type="date" value={dob} onChange={(e) => setDob(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl surface-input" />
                    </div>
                    <div>
                      <label className="block text-xs text-white/30 mb-2">
                        {t.profile.tob} <span className="text-primary-400">*</span>
                      </label>
                      <input type="time" value={tob} onChange={(e) => setTob(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl surface-input" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-white/30 mb-2">
                      {t.profile.pob} <span className="text-primary-400">*</span>
                    </label>
                    <input type="text" value={pob} onChange={(e) => setPob(e.target.value)} placeholder={t.profile.pobPlaceholderEg}
                      className="w-full px-4 py-3 rounded-xl surface-input" />
                  </div>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs text-white/30 mb-2">
                        {t.profile.gender} <span className="text-primary-400">*</span>
                      </label>
                      <select value={gender} onChange={(e) => setGender(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl surface-input">
                        <option value="">{t.profile.selectGender}</option>
                        <option value="Male">{t.profile.genderMale}</option>
                        <option value="Female">{t.profile.genderFemale}</option>
                        <option value="Other">{t.profile.genderOther}</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-white/30 mb-2">{t.profile.profession}</label>
                      <select value={profession} onChange={(e) => setProfession(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl surface-input">
                        <option value="">{t.profile.selectProfession}</option>
                        <option value="SOFTWARE">{t.profile.profSoftwareFull}</option>
                        <option value="SALES">{t.profile.profSalesFull}</option>
                        <option value="MARKETING">{t.profile.profMarketingFull}</option>
                        <option value="FINANCE">{t.profile.profFinanceFull}</option>
                        <option value="STUDENT">{t.profile.profStudentFull}</option>
                        <option value="BUSINESS">{t.profile.profBusinessFull}</option>
                        <option value="HEALTHCARE">{t.profile.profHealthcareFull}</option>
                        <option value="CREATIVE">{t.profile.profCreativeFull}</option>
                        <option value="GOVERNMENT">{t.profile.profGovernmentFull}</option>
                        <option value="OTHER">{t.profile.profOtherFull}</option>
                      </select>
                    </div>
                  </div>
                  <button onClick={handleSave} disabled={saving}
                    className="mt-2 px-8 py-3 rounded-xl btn-primary text-white font-medium  transition-all disabled:opacity-50">
                    {saving
                      ? t.profile.saving
                      : profile && !profile.profileComplete
                        ? t.profile.completeAndContinue
                        : t.profile.saveChanges}
                  </button>
                </div>
              </div>
            )}

            {/* Security Tab */}
            {activeTab === "security" && (
              <div className="space-y-6">
                <div className="surface-card p-6">
                  <h3 className="text-lg font-bold text-white mb-2">
                    {hasPassword ? t.profile.changePassword : t.profile.setPassword}
                  </h3>
                  <p className="text-sm text-white/40 mb-6">
                    {hasPassword ? t.profile.changePasswordDesc : t.profile.setPasswordDesc}
                  </p>

                  <div className="space-y-4">
                    {hasPassword && (
                      <div>
                        <label className="block text-xs text-white/30 mb-2">{t.profile.currentPassword}</label>
                        <div className="relative">
                          <input type={showCurrentPw ? "text" : "password"} value={currentPassword}
                            onChange={(e) => setCurrentPassword(e.target.value)} placeholder={t.profile.currentPasswordPlaceholder}
                            className="w-full px-4 py-3 pr-16 rounded-xl surface-input" />
                          <button type="button" onClick={() => setShowCurrentPw(!showCurrentPw)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-white/30 hover:text-white/60">
                            {showCurrentPw ? t.profile.hide : t.profile.show}
                          </button>
                        </div>
                      </div>
                    )}

                    <div>
                      <label className="block text-xs text-white/30 mb-2">{t.profile.newPassword}</label>
                      <div className="relative">
                        <input type={showNewPw ? "text" : "password"} value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)} placeholder={t.profile.newPasswordPlaceholder}
                          className="w-full px-4 py-3 pr-16 rounded-xl surface-input" />
                        <button type="button" onClick={() => setShowNewPw(!showNewPw)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-white/30 hover:text-white/60">
                          {showNewPw ? t.profile.hide : t.profile.show}
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
                      <label className="block text-xs text-white/30 mb-2">{t.profile.confirmNewPassword}</label>
                      <input type="password" value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)} placeholder={t.profile.confirmPasswordPlaceholder}
                        className="w-full px-4 py-3 rounded-xl surface-input" />
                      {confirmPassword && newPassword !== confirmPassword && (
                        <p className="text-xs text-red-400 mt-1">{t.profile.errPasswordsMismatchInline}</p>
                      )}
                    </div>

                    <button onClick={handleChangePassword} disabled={changingPw}
                      className="px-8 py-3 rounded-xl btn-primary text-white font-medium  transition-all disabled:opacity-50">
                      {changingPw ? t.profile.saving : hasPassword ? t.profile.changePassword : t.profile.setPassword}
                    </button>
                  </div>
                </div>

                {/* Account Info */}
                <div className="surface-card p-6">
                  <h3 className="text-lg font-bold text-white mb-4">{t.profile.accountSecurity}</h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 rounded-lg bg-white/[0.03]">
                      <div>
                        <p className="text-sm text-white">{t.profile.passwordStatus}</p>
                        <p className="text-xs text-white/30">{t.profile.authMethod}</p>
                      </div>
                      <span className={`text-xs px-2 py-1 rounded-full ${hasPassword ? "bg-emerald-500/20 text-emerald-400" : "bg-amber-500/20 text-amber-400"}`}>
                        {hasPassword ? t.profile.passwordSet : t.profile.passwordNotSet}
                      </span>
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-lg bg-white/[0.03]">
                      <div>
                        <p className="text-sm text-white">{t.profile.emailField}</p>
                        <p className="text-xs text-white/30">{profile.email}</p>
                      </div>
                      <span className="text-xs px-2 py-1 rounded-full bg-emerald-500/20 text-emerald-400">{t.profile.verified}</span>
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-lg bg-white/[0.03]">
                      <div>
                        <p className="text-sm text-white">{t.profile.phoneField}</p>
                        <p className="text-xs text-white/30">{profile.phone || t.profile.notAdded}</p>
                      </div>
                      <span className={`text-xs px-2 py-1 rounded-full ${profile.phone ? "bg-emerald-500/20 text-emerald-400" : "bg-white/[0.03] text-white/30"}`}>
                        {profile.phone ? t.profile.linked : t.profile.notLinked}
                      </span>
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-lg bg-white/[0.03]">
                      <div>
                        <p className="text-sm text-white">{t.profile.twoFactorAuth}</p>
                        <p className="text-xs text-white/30">{t.profile.extraSecurityLayer}</p>
                      </div>
                      <span className="text-xs px-2 py-1 rounded-full bg-white/[0.03] text-white/30">{t.profile.comingSoon}</span>
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
