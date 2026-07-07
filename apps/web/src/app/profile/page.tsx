"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import { useAuthStore, useAuthHydrated } from "@/lib/store";
import { useTranslation } from "@/i18n";
import LanguageSwitcher from "@/components/ui/LanguageSwitcher";
import AstrologyTraditionSelector from "@/components/ui/AstrologyTraditionSelector";
import { Toast } from "@/components/ui/Toast";
import { RequiredMark } from "@/components/ui/RequiredMark";
import BriefingPreferenceSection from "@/components/profile/BriefingPreferenceSection";
import SubscriptionSection from "@/components/profile/SubscriptionSection";
import MemorySection from "@/components/profile/MemorySection";
import TimeOfBirthInput from "@/components/ui/TimeOfBirthInput";
import { track } from "@/lib/analytics";

interface UserProfile {
  id: string;
  name: string;
  /** Optional informal name. See lib/displayName.ts for usage. */
  nickname?: string | null;
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
  const { isAuthenticated, accessToken, logout, updateCredits, setProfileComplete, updateBirthDetails, updateAstrologyTraditions, updatePrimaryTradition } = useAuthStore();
  const isHydrated = useAuthHydrated();
  const completeMode = searchParams.get("complete") === "1";
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [creditInfo, setCreditInfo] = useState<CreditInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [activeTab, setActiveTab] = useState<"profile" | "subscription" | "credits" | "security">("profile");

  // Onboarding step: 1 = birth details, 2 = astrology traditions
  const [onboardingStep, setOnboardingStep] = useState(1);
  // Set after a failed required-fields submit so empty birth fields render an
  // inline error in addition to the top banner. Each field's error clears
  // itself once filled because it's derived from the live value below.
  const [showBirthFieldErrors, setShowBirthFieldErrors] = useState(false);

  // Profile form
  const [name, setName] = useState("");
  const [nickname, setNickname] = useState("");
  const [phone, setPhone] = useState("");
  const [dob, setDob] = useState("");
  const [tob, setTob] = useState("");
  const [pob, setPob] = useState("");
  const [gender, setGender] = useState("");
  const [profession, setProfession] = useState("");
  const [selectedTraditions, setSelectedTraditions] = useState<string[]>(["VEDIC", "WESTERN", "CHINESE", "HELLENISTIC", "HORARY", "MEDICAL"]);
  const [primaryTradition, setPrimaryTradition] = useState<string | null>(null);

  // Security form
  const [hasPassword, setHasPassword] = useState(true);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [changingPw, setChangingPw] = useState(false);

  useEffect(() => {
    if (!isHydrated) return;
    if (!isAuthenticated) {
      router.push("/auth");
      return;
    }
    loadProfile();
  }, [isHydrated, isAuthenticated]);

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
      setNickname(profileData.nickname || "");
      setPhone(profileData.phone || "");
      setDob(profileData.dateOfBirth ? profileData.dateOfBirth.split("T")[0] : "");
      setTob(profileData.timeOfBirth || "");
      setPob(typeof profileData.placeOfBirth === "object" ? profileData.placeOfBirth?.name || "" : profileData.placeOfBirth || "");
      setGender(profileData.gender || "");
      setProfession(profileData.profession || "");
      setSelectedTraditions((profileData as any).astrologyTraditions?.length ? (profileData as any).astrologyTraditions : ["VEDIC", "WESTERN", "CHINESE", "HELLENISTIC", "HORARY", "MEDICAL"]);
      setPrimaryTradition((profileData as any).primaryTradition ?? null);
      updateCredits(profileData.credits);
      updateBirthDetails({
        name: profileData.name,
        nickname: profileData.nickname ?? null,
        dateOfBirth: profileData.dateOfBirth ? profileData.dateOfBirth.split("T")[0] : null,
        timeOfBirth: profileData.timeOfBirth || null,
        placeOfBirth: typeof profileData.placeOfBirth === "object" ? profileData.placeOfBirth?.name || null : profileData.placeOfBirth || null,
        gender: profileData.gender || null,
      });
    } catch (err: any) {
      setError(err.message || t.profile.loadFailed);
    } finally {
      setLoading(false);
    }
  };

  // Move keyboard focus to the first empty required birth field so the user
  // is taken straight to what they need to fix.
  const focusFirstMissingBirthField = () => {
    const firstMissingId = !dob
      ? "profile-dob"
      : !tob
        ? "profile-tob"
        : !pob.trim()
          ? "profile-pob"
          : !gender
            ? "profile-gender"
            : null;
    if (firstMissingId) document.getElementById(firstMissingId)?.focus();
  };

  // During onboarding step 1, validate birth details and proceed to step 2
  const handleNextStep = () => {
    setError("");
    const missing: string[] = [];
    if (!dob) missing.push(t.profile.missingDob);
    if (!tob) missing.push(t.profile.missingTob);
    if (!pob.trim()) missing.push(t.profile.missingPob);
    if (!gender) missing.push(t.profile.missingGender);
    if (missing.length) {
      setError(`${t.profile.pleaseFillIn} ${missing.join(", ")}`);
      setShowBirthFieldErrors(true);
      focusFirstMissingBirthField();
      return;
    }
    setShowBirthFieldErrors(false);
    setOnboardingStep(2);
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
        setShowBirthFieldErrors(true);
        focusFirstMissingBirthField();
        return;
      }
    }
    setShowBirthFieldErrors(false);

    setSaving(true);
    try {
      const updated = await api.put<UserProfile>(
        "/users/me",
        {
          name: name || undefined,
          // Always send nickname (even blank) so the user can clear it.
          // The backend treats `nickname: ""` → null in the DB.
          nickname: nickname.trim(),
          phone: phone || undefined,
          dateOfBirth: dob || undefined,
          timeOfBirth: tob || undefined,
          placeOfBirth: pob || undefined,
          gender: gender || undefined,
          profession: profession || undefined,
          astrologyTraditions: selectedTraditions,
          primaryTradition: primaryTradition ?? selectedTraditions[0] ?? null,
        },
        { token: accessToken! }
      );
      setProfile(updated);
      updateCredits(updated.credits);
      setProfileComplete(updated.profileComplete);
      updateBirthDetails({
        name: updated.name,
        nickname: updated.nickname ?? null,
        dateOfBirth: updated.dateOfBirth ? updated.dateOfBirth.split("T")[0] : null,
        timeOfBirth: updated.timeOfBirth || null,
        placeOfBirth: typeof updated.placeOfBirth === "object" ? updated.placeOfBirth?.name || null : updated.placeOfBirth || null,
        gender: updated.gender || null,
      });
      updateAstrologyTraditions(selectedTraditions);
      updatePrimaryTradition(primaryTradition ?? selectedTraditions[0] ?? null);

      // First-time completion → unlock the rest of the app.
      if (wasIncomplete && updated.profileComplete) {
        track("profile_completed");
        setSuccess(t.profile.profileCompleteRedirecting);
        setTimeout(() => router.push("/my-day"), 1200);
        return;
      }

      setSuccess(t.profile.profileUpdatedSuccess);
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
        // skipAuthRefreshOn401: a 401 here means "current password
        // was wrong", not "access token expired" — surface the
        // error instead of bouncing the user to /auth.
        { token: accessToken!, skipAuthRefreshOn401: true }
      );
      setSuccess(res.message);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
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
    role === "ADMIN" ? "bg-red-500/20 text-red-400" : role === "PREMIUM" ? "bg-purple-500/20 text-purple-400" : "bg-[rgba(255,252,245,0.78)] text-[rgba(12,8,5,0.66)]";

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
      <div className="relative z-10 mx-auto max-w-3xl px-4 py-12 fade-in-up">
        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold mb-2">
            {profile && !profile.profileComplete ? (
              <>{t.profile.welcomePrefix} <span className="text-gradient">{t.profile.brandName}</span></>
            ) : (
              <>{t.profile.myPrefix} <span className="text-gradient">{t.profile.profileHighlight}</span></>
            )}
          </h1>
          <p className="text-emphasis text-sm">
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
              <p className="text-surface-950 font-medium mb-0.5">
                {completeMode ? t.profile.almostThere : t.profile.completeYourProfile}
              </p>
              <p className="text-secondary text-xs leading-relaxed">
                {t.profile.completeDescPart1} <span className="text-surface-950">{t.profile.completeDescBirth}</span>{" "}
                {t.profile.completeDescPlus} <span className="text-surface-950">{t.profile.completeDescGender}</span>{" "}
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
          <div className="mb-6">
            <Toast
              message={error}
              tone="error"
              onClose={() => setError("")}
              closeLabel={t.common.close}
            />
          </div>
        )}
        {success && (
          <div className="mb-6">
            <Toast
              message={success}
              tone="success"
              onClose={() => setSuccess("")}
              closeLabel={t.common.close}
            />
          </div>
        )}

        {profile && !loading && (
          <>
            {/* Profile Header Card */}
            <div className="surface-card p-6 mb-6 flex flex-col sm:flex-row items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary-500 to-mystic-500 flex items-center justify-center text-2xl font-bold text-white shadow-warm-sm">
                {profile.name?.charAt(0)?.toUpperCase() || "U"}
              </div>
              <div className="text-center sm:text-left flex-1">
                <h2 className="text-xl font-bold text-surface-950">{profile.name}</h2>
                <p className="text-sm text-[rgba(12,8,5,0.66)]">{profile.email}</p>
                <div className="flex items-center gap-2 mt-1 justify-center sm:justify-start">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${roleBadge(profile.role)}`}>{profile.role}</span>
                  <span className="text-xs text-[rgba(12,8,5,0.66)]">{t.profile.memberSince} {new Date(profile.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
              <button onClick={handleLogout} className="focus-ring px-4 py-2 rounded-xl btn-secondary text-sm text-red-400 hover:bg-red-500/10 transition-all">
                {t.profile.logout}
              </button>
            </div>

            {/* Language preference card */}
            <div className="surface-card p-6 mb-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-lg font-bold text-surface-950 mb-1">{t.profile.language}</h3>
                  <p className="text-sm text-[rgba(12,8,5,0.66)]">{t.profile.languageDesc}</p>
                </div>
                <LanguageSwitcher />
              </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 mb-6 rounded-xl bg-[rgba(255,252,245,0.78)] p-1 w-fit">
              {([
                { id: "profile" as const, label: t.profile.tabBirthDetails },
                { id: "subscription" as const, label: "Subscription" },
                { id: "security" as const, label: t.profile.tabSecurity },
              ]).map((tab) => (
                <button key={tab.id} onClick={() => { setActiveTab(tab.id); setError(""); setSuccess(""); }}
                  className={`px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${activeTab === tab.id ? "btn-primary" : "text-[rgba(12,8,5,0.66)] hover:text-surface-950"}`}>
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Subscription Tab */}
            {activeTab === "subscription" && accessToken && (
              <SubscriptionSection token={accessToken} onCancelled={loadProfile} />
            )}

            {/* Birth Details Tab (hidden during onboarding step 2) */}
            {activeTab === "profile" && !(completeMode && !profile?.profileComplete && onboardingStep === 2) && (
              <div className="surface-card p-6">
                <h3 className="text-lg font-bold text-surface-950 mb-6">{t.profile.birthDetails}</h3>
                <div className="space-y-4">
                  <div>
                    <label htmlFor="profile-name" className="block text-xs font-medium text-emphasis mb-2">{t.profile.name}</label>
                    <input id="profile-name" type="text" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl surface-input" />
                    <p className="mt-1 text-[11px] text-[rgba(12,8,5,0.72)]">
                      {t.profile.nameHint}
                    </p>
                  </div>
                  <div>
                    <label htmlFor="profile-nickname" className="block text-xs font-medium text-emphasis mb-2">{t.profile.nickname}</label>
                    <input id="profile-nickname" type="text" autoComplete="nickname" value={nickname} onChange={(e) => setNickname(e.target.value)} placeholder={t.profile.nicknamePlaceholder}
                      className="w-full px-4 py-3 rounded-xl surface-input" />
                    <p className="mt-1 text-[11px] text-[rgba(12,8,5,0.72)]">
                      {t.profile.nicknameHint}
                    </p>
                  </div>
                  <div>
                    <label htmlFor="profile-phone" className="block text-xs font-medium text-emphasis mb-2">{t.profile.phoneNumberLabel}</label>
                    <input id="profile-phone" type="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder={t.profile.phoneNumberPlaceholder}
                      className="w-full px-4 py-3 rounded-xl surface-input" />
                  </div>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="profile-dob" className="flex items-center text-xs font-medium text-emphasis mb-2">
                        {t.profile.dob} <RequiredMark />
                      </label>
                      <input id="profile-dob" type="date" required value={dob} onChange={(e) => setDob(e.target.value)}
                        aria-invalid={showBirthFieldErrors && !dob}
                        className="w-full px-4 py-3 rounded-xl surface-input [color-scheme:dark]" />
                      {showBirthFieldErrors && !dob && (
                        <p role="alert" className="text-xs text-red-600 mt-1">{t.profile.missingDob}</p>
                      )}
                    </div>
                    <div>
                      <label htmlFor="profile-tob" className="flex items-center text-xs font-medium text-emphasis mb-2">
                        {t.profile.tob} <RequiredMark />
                      </label>
                      <TimeOfBirthInput id="profile-tob" required value={tob} onChange={setTob} />
                      {showBirthFieldErrors && !tob && (
                        <p role="alert" className="text-xs text-red-600 mt-1">{t.profile.missingTob}</p>
                      )}
                    </div>
                  </div>
                  <div>
                    <label htmlFor="profile-pob" className="flex items-center text-xs font-medium text-emphasis mb-2">
                      {t.profile.pob} <RequiredMark />
                    </label>
                    <input id="profile-pob" type="text" required value={pob} onChange={(e) => setPob(e.target.value)} placeholder={t.profile.pobPlaceholderEg}
                      aria-invalid={showBirthFieldErrors && !pob.trim()}
                      className="w-full px-4 py-3 rounded-xl surface-input" />
                    {showBirthFieldErrors && !pob.trim() && (
                      <p role="alert" className="text-xs text-red-600 mt-1">{t.profile.missingPob}</p>
                    )}
                    <p className="mt-1 text-[11px] text-[rgba(12,8,5,0.72)]">
                      City where you were born — used for precise latitude/longitude in chart calculations.
                    </p>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="profile-gender" className="flex items-center text-xs font-medium text-emphasis mb-2">
                        {t.profile.gender} <RequiredMark />
                      </label>
                      <select id="profile-gender" required value={gender} onChange={(e) => setGender(e.target.value)}
                        aria-invalid={showBirthFieldErrors && !gender}
                        className="w-full px-4 py-3 rounded-xl surface-input">
                        <option value="">{t.profile.selectGender}</option>
                        <option value="Male">{t.profile.genderMale}</option>
                        <option value="Female">{t.profile.genderFemale}</option>
                        <option value="Other">{t.profile.genderOther}</option>
                      </select>
                      {showBirthFieldErrors && !gender && (
                        <p role="alert" className="text-xs text-red-600 mt-1">{t.profile.missingGender}</p>
                      )}
                    </div>
                    <div>
                      <label htmlFor="profile-profession" className="block text-xs font-medium text-emphasis mb-2">{t.profile.profession}</label>
                      <select id="profile-profession" value={profession} onChange={(e) => setProfession(e.target.value)}
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
                  {/* In onboarding mode step 1: show Next button, in step 2 or normal mode: show Save */}
                  {completeMode && !profile?.profileComplete && onboardingStep === 1 ? (
                    <div className="mt-2">
                      <button onClick={handleNextStep}
                        className="focus-ring px-8 py-3 rounded-xl btn-primary text-white font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        disabled={!dob || !tob || !pob.trim() || !gender}
                        aria-describedby="profile-next-hint"
                      >
                        {t.traditions.next || "Next"}
                      </button>
                      {(!dob || !tob || !pob.trim() || !gender) && (
                        <p id="profile-next-hint" className="mt-2 text-[11px] text-[rgba(12,8,5,0.72)]">
                          Fill in date, time and place of birth plus gender to continue.
                        </p>
                      )}
                    </div>
                  ) : (
                    <button onClick={handleSave} disabled={saving}
                      className="focus-ring mt-2 px-8 py-3 rounded-xl btn-primary text-white font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                      {saving
                        ? t.profile.saving
                        : profile && !profile.profileComplete
                          ? t.profile.completeAndContinue
                          : t.profile.saveChanges}
                    </button>
                  )}
                </div>

                {/* Astrology Traditions section - shown inline for normal profile editing */}
                {(profile?.profileComplete || !completeMode) && (
                  <div className="mt-8 pt-8 border-t border-[rgba(12,8,5,0.08)]">
                    <h3 className="text-lg font-bold text-surface-950 mb-2">{t.traditions.title}</h3>
                    <p className="text-sm text-[rgba(12,8,5,0.66)] mb-5">{t.traditions.description}</p>
                    <AstrologyTraditionSelector
                      value={selectedTraditions}
                      onChange={setSelectedTraditions}
                      compact
                    />
                    {selectedTraditions.length > 1 && (
                      <div className="mt-5">
                        <h4 className="text-sm font-semibold text-surface-950 mb-1">
                          {(t as any).traditionsUi?.primaryLabel || "Primary tradition"}
                        </h4>
                        <p className="text-xs text-[rgba(12,8,5,0.66)] mb-3">
                          {(t as any).traditionsUi?.primaryHint ||
                            "Your dashboard and default views focus on this tradition."}
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {selectedTraditions.map((trad) => {
                            const active = (primaryTradition ?? selectedTraditions[0]) === trad;
                            return (
                              <button
                                key={trad}
                                type="button"
                                onClick={() => setPrimaryTradition(trad)}
                                className={`text-xs px-3 py-1.5 rounded-full border transition ${
                                  active
                                    ? "bg-primary-500/20 border-primary-500/40 text-white"
                                    : "bg-[rgba(255,252,245,0.70)] border-[rgba(12,8,5,0.10)] text-secondary hover:text-emphasis"
                                }`}
                                aria-pressed={active}
                              >
                                {trad}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Daily briefing email opt-in (Phase 1 monetization).
                    The toggle is its own self-saving control so the
                    user doesn't have to remember to hit "Save changes"
                    afterwards — that pattern is the #1 reason
                    notification settings get half-flipped. */}
                {(profile?.profileComplete || !completeMode) && (
                  <BriefingPreferenceSection token={accessToken!} />
                )}
                {(profile?.profileComplete || !completeMode) && (
                  <MemorySection token={accessToken!} />
                )}
              </div>
            )}

            {/* Onboarding Step 2: Astrology Tradition Selection */}
            {activeTab === "profile" && completeMode && !profile?.profileComplete && onboardingStep === 2 && (
              <div className="surface-card p-6">
                <div className="flex items-center gap-3 mb-2">
                  <button onClick={() => setOnboardingStep(1)} aria-label={t.common.back} className="focus-ring rounded-lg p-1 text-secondary hover:text-surface-950 transition-colors">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                    </svg>
                  </button>
                  <div>
                    <h3 className="text-lg font-bold text-surface-950">{t.traditions.title}</h3>
                    <p className="text-sm text-[rgba(12,8,5,0.66)]">{t.traditions.description}</p>
                  </div>
                </div>

                {/* Step indicator */}
                <div className="flex items-center gap-2 mb-6 mt-4">
                  <div className="flex items-center gap-1.5">
                    <div className="w-6 h-6 rounded-full bg-primary-500/20 border border-primary-500/50 flex items-center justify-center">
                      <svg className="w-3.5 h-3.5 text-primary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <span className="text-xs text-primary-400">{t.traditions.stepBirthDetails || "Birth Details"}</span>
                  </div>
                  <div className="w-8 h-px bg-[rgba(12,8,5,0.07)]" />
                  <div className="flex items-center gap-1.5">
                    <div className="w-6 h-6 rounded-full bg-primary-500 flex items-center justify-center text-xs font-bold text-white">2</div>
                    <span className="text-xs text-surface-950">{t.traditions.stepTraditions || "Traditions"}</span>
                  </div>
                </div>

                <AstrologyTraditionSelector
                  value={selectedTraditions}
                  onChange={setSelectedTraditions}
                />

                <button onClick={handleSave} disabled={saving || selectedTraditions.length === 0}
                  className="focus-ring mt-6 px-8 py-3 rounded-xl btn-primary text-white font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                  {saving ? t.profile.saving : t.profile.completeAndContinue}
                </button>
              </div>
            )}

            {/* Security Tab */}
            {activeTab === "security" && (
              <div className="space-y-6">
                <div className="surface-card p-6">
                  <h3 className="text-lg font-bold text-surface-950 mb-2">
                    {hasPassword ? t.profile.changePassword : t.profile.setPassword}
                  </h3>
                  <p className="text-sm text-[rgba(12,8,5,0.66)] mb-6">
                    {hasPassword ? t.profile.changePasswordDesc : t.profile.setPasswordDesc}
                  </p>

                  <div className="space-y-4">
                    {hasPassword && (
                      <div>
                        <label htmlFor="profile-current-password" className="block text-xs font-medium text-emphasis mb-2">{t.profile.currentPassword}</label>
                        <div className="relative">
                          <input id="profile-current-password" type={showCurrentPw ? "text" : "password"} autoComplete="current-password" value={currentPassword}
                            onChange={(e) => setCurrentPassword(e.target.value)} placeholder={t.profile.currentPasswordPlaceholder}
                            className="w-full px-4 py-3 pr-16 rounded-xl surface-input" />
                          <button type="button" onClick={() => setShowCurrentPw(!showCurrentPw)}
                            aria-label={showCurrentPw ? t.profile.hide : t.profile.show}
                            aria-pressed={showCurrentPw}
                            className="focus-ring absolute right-3 top-1/2 -translate-y-1/2 rounded text-xs text-secondary hover:text-emphasis px-1">
                            {showCurrentPw ? t.profile.hide : t.profile.show}
                          </button>
                        </div>
                      </div>
                    )}

                    <div>
                      <label htmlFor="profile-new-password" className="block text-xs font-medium text-emphasis mb-2">{t.profile.newPassword}</label>
                      <div className="relative">
                        <input id="profile-new-password" type={showNewPw ? "text" : "password"} autoComplete="new-password" aria-describedby="profile-new-password-rules" value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)} placeholder={t.profile.newPasswordPlaceholder}
                          className="w-full px-4 py-3 pr-16 rounded-xl surface-input" />
                        <button type="button" onClick={() => setShowNewPw(!showNewPw)}
                          aria-label={showNewPw ? t.profile.hide : t.profile.show}
                          aria-pressed={showNewPw}
                          className="focus-ring absolute right-3 top-1/2 -translate-y-1/2 rounded text-xs text-secondary hover:text-emphasis px-1">
                          {showNewPw ? t.profile.hide : t.profile.show}
                        </button>
                      </div>
                      <p id="profile-new-password-rules" className="mt-1.5 text-[11px] text-[rgba(12,8,5,0.72)] leading-relaxed">
                        At least 8 characters. Stronger: mix upper + lower case, a number, and a symbol.
                      </p>
                      {newPassword.length > 0 && (
                        <div className="mt-2">
                          <div className="flex gap-1 mb-1" aria-hidden>
                            {[1, 2, 3, 4, 5].map((i) => (
                              <div key={i} className={`h-1 flex-1 rounded-full ${i <= strength ? strengthColor : "bg-[rgba(12,8,5,0.07)]"}`} />
                            ))}
                          </div>
                          <p className={`text-xs ${strength >= 4 ? "text-emerald-400" : strength >= 3 ? "text-amber-400" : "text-red-400"}`} aria-live="polite">
                            {strengthLabel}
                          </p>
                        </div>
                      )}
                    </div>

                    <div>
                      <label htmlFor="profile-confirm-password" className="block text-xs font-medium text-emphasis mb-2">{t.profile.confirmNewPassword}</label>
                      <input id="profile-confirm-password" type="password" autoComplete="new-password" value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)} placeholder={t.profile.confirmPasswordPlaceholder}
                        aria-invalid={Boolean(confirmPassword) && newPassword !== confirmPassword}
                        className="w-full px-4 py-3 rounded-xl surface-input" />
                      {confirmPassword && newPassword !== confirmPassword && (
                        <p role="alert" className="text-xs text-red-400 mt-1">{t.profile.errPasswordsMismatchInline}</p>
                      )}
                    </div>

                    <button onClick={handleChangePassword}
                      disabled={changingPw}
                      className="focus-ring px-8 py-3 rounded-xl btn-primary text-white font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                      {changingPw ? t.profile.saving : hasPassword ? t.profile.changePassword : t.profile.setPassword}
                    </button>
                  </div>
                </div>

                {/* Account Info */}
                <div className="surface-card p-6">
                  <h3 className="text-lg font-bold text-surface-950 mb-4">{t.profile.accountSecurity}</h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 rounded-lg bg-[rgba(255,252,245,0.78)]">
                      <div>
                        <p className="text-sm text-surface-950">{t.profile.passwordStatus}</p>
                        <p className="text-xs text-[rgba(12,8,5,0.66)]">{t.profile.authMethod}</p>
                      </div>
                      <span className={`text-xs px-2 py-1 rounded-full ${hasPassword ? "bg-emerald-500/20 text-emerald-400" : "bg-amber-500/20 text-amber-400"}`}>
                        {hasPassword ? t.profile.passwordSet : t.profile.passwordNotSet}
                      </span>
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-lg bg-[rgba(255,252,245,0.78)]">
                      <div>
                        <p className="text-sm text-surface-950">{t.profile.emailField}</p>
                        <p className="text-xs text-[rgba(12,8,5,0.66)]">{profile.email}</p>
                      </div>
                      <span className="text-xs px-2 py-1 rounded-full bg-emerald-500/20 text-emerald-400">{t.profile.verified}</span>
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-lg bg-[rgba(255,252,245,0.78)]">
                      <div>
                        <p className="text-sm text-surface-950">{t.profile.phoneField}</p>
                        <p className="text-xs text-[rgba(12,8,5,0.66)]">{profile.phone || t.profile.notAdded}</p>
                      </div>
                      <span className={`text-xs px-2 py-1 rounded-full ${profile.phone ? "bg-emerald-500/20 text-emerald-400" : "bg-[rgba(255,252,245,0.78)] text-[rgba(12,8,5,0.66)]"}`}>
                        {profile.phone ? t.profile.linked : t.profile.notLinked}
                      </span>
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-lg bg-[rgba(255,252,245,0.78)]">
                      <div>
                        <p className="text-sm text-surface-950">{t.profile.twoFactorAuth}</p>
                        <p className="text-xs text-[rgba(12,8,5,0.66)]">{t.profile.extraSecurityLayer}</p>
                      </div>
                      <span className="text-xs px-2 py-1 rounded-full bg-[rgba(255,252,245,0.78)] text-[rgba(12,8,5,0.66)]">{t.profile.comingSoon}</span>
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
