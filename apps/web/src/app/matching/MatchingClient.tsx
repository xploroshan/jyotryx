"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslation } from "@/i18n";
import { useAuthStore } from "@/lib/store";
import FeatureHeader from "@/components/editorial/FeatureHeader";
import { FeatureGlyph } from "@/components/icons";
import { RequiredMark } from "@/components/ui/Toast";

interface PersonForm {
  name: string;
  dob: string;
  time: string;
  place: string;
}

const emptyPerson: PersonForm = { name: "", dob: "", time: "", place: "" };

const inputClass = "w-full px-4 py-3 rounded-xl surface-input";

/**
 * Person form — hoisted to module scope so it keeps a STABLE component identity.
 * Defining it inside MatchingPage created a new function type on every render,
 * which made React unmount + remount the whole subtree each time — losing input
 * focus on every keystroke, and defeating the focus-first-empty-field behaviour
 * on submit (the `.focus()` ran against a node that was immediately destroyed).
 * `t` is passed in as a prop instead of captured from the parent closure.
 */
function PersonFormComponent({
  label,
  person,
  setPerson,
  gradient,
  idPrefix,
  showErrors,
  t,
}: {
  label: string;
  person: PersonForm;
  setPerson: (p: PersonForm) => void;
  gradient: string;
  idPrefix: string;
  showErrors: boolean;
  t: ReturnType<typeof useTranslation>["t"];
}) {
  return (
    <div className="surface-card p-6">
      <h3 className={`text-lg font-bold bg-gradient-to-r ${gradient} bg-clip-text text-transparent mb-5`}>
        {label}
      </h3>
      <div className="space-y-4">
        <div>
          <label htmlFor={`${idPrefix}-name`} className="flex items-center text-sm text-[rgba(12,8,5,0.66)] mb-1.5">{t.matching.fullName} <RequiredMark /></label>
          <input
            id={`${idPrefix}-name`}
            type="text"
            value={person.name}
            onChange={(e) => setPerson({ ...person, name: e.target.value })}
            placeholder={t.matching.enterName}
            aria-invalid={showErrors && !person.name}
            className={inputClass}
          />
          {showErrors && !person.name && (
            <p role="alert" className="text-xs text-red-600 mt-1">{t.form.fillAllFields}</p>
          )}
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor={`${idPrefix}-dob`} className="flex items-center text-sm text-[rgba(12,8,5,0.66)] mb-1.5">{t.form.dateOfBirth} <RequiredMark /></label>
            <input
              id={`${idPrefix}-dob`}
              type="date"
              value={person.dob}
              onChange={(e) => setPerson({ ...person, dob: e.target.value })}
              aria-invalid={showErrors && !person.dob}
              className={`${inputClass} [color-scheme:dark]`}
            />
            {showErrors && !person.dob && (
              <p role="alert" className="text-xs text-red-600 mt-1">{t.form.fillAllFields}</p>
            )}
          </div>
          <div>
            <label htmlFor={`${idPrefix}-time`} className="flex items-center text-sm text-[rgba(12,8,5,0.66)] mb-1.5">{t.form.timeOfBirth} <RequiredMark /></label>
            <input
              id={`${idPrefix}-time`}
              type="time"
              value={person.time}
              onChange={(e) => setPerson({ ...person, time: e.target.value })}
              aria-invalid={showErrors && !person.time}
              className={`${inputClass} [color-scheme:dark]`}
            />
            {showErrors && !person.time && (
              <p role="alert" className="text-xs text-red-600 mt-1">{t.form.fillAllFields}</p>
            )}
          </div>
        </div>
        <div>
          <label htmlFor={`${idPrefix}-place`} className="flex items-center text-sm text-[rgba(12,8,5,0.66)] mb-1.5">{t.form.placeOfBirth} <RequiredMark /></label>
          <input
            id={`${idPrefix}-place`}
            type="text"
            value={person.place}
            onChange={(e) => setPerson({ ...person, place: e.target.value })}
            placeholder={t.matching.searchCity}
            aria-invalid={showErrors && !person.place}
            className={inputClass}
          />
          {showErrors && !person.place && (
            <p role="alert" className="text-xs text-red-600 mt-1">{t.form.fillAllFields}</p>
          )}
        </div>
      </div>
    </div>
  );
}

export default function MatchingPage() {
  const { t, locale } = useTranslation();
  const user = useAuthStore((s) => s.user);
  // Kundli Matching is a Vedic-specific flow (Ashtakoota / guna milan).
  // Other traditions surface their own compatibility tools (e.g. Western
  // Synastry) via dedicated feature pages.
  const activeTradition = "VEDIC" as const;

  const mockResults = {
    totalScore: 28,
    maxScore: 36,
    percentage: 78,
    manglikA: false,
    manglikB: true,
    koota: [
      { name: t.matching.kootaVarna, description: t.matching.kootaVarnaDesc, obtained: 1, max: 1 },
      { name: t.matching.kootaVashya, description: t.matching.kootaVashyaDesc, obtained: 2, max: 2 },
      { name: t.matching.kootaTara, description: t.matching.kootaTaraDesc, obtained: 3, max: 3 },
      { name: t.matching.kootaYoni, description: t.matching.kootaYoniDesc, obtained: 3, max: 4 },
      { name: t.matching.kootaGrahaMaitri, description: t.matching.kootaGrahaMaitriDesc, obtained: 5, max: 5 },
      { name: t.matching.kootaGana, description: t.matching.kootaGanaDesc, obtained: 4, max: 6 },
      { name: t.matching.kootaBhakoot, description: t.matching.kootaBhakootDesc, obtained: 7, max: 7 },
      { name: t.matching.kootaNadi, description: t.matching.kootaNadiDesc, obtained: 3, max: 8 },
    ],
    verdict: t.matching.verdictGood,
    summary: t.matching.mockSummary,
  };
  const [personA, setPersonA] = useState<PersonForm>({ ...emptyPerson });
  const [personB, setPersonB] = useState<PersonForm>({ ...emptyPerson });
  const [results, setResults] = useState<typeof mockResults | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  // Set after a failed "Check Compatibility" so empty person fields surface an
  // inline error and aria-invalid alongside the top banner.
  const [showFieldErrors, setShowFieldErrors] = useState(false);
  const [personAPrefilled, setPersonAPrefilled] = useState(false);
  const [shareUrl, setShareUrl] = useState("");
  const [shareLoading, setShareLoading] = useState(false);
  const [shareError, setShareError] = useState("");
  const [copied, setCopied] = useState(false);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (copyTimer.current) clearTimeout(copyTimer.current);
  }, []);

  // Prepopulate Person A from the logged-in user's profile (Person B is always the partner).
  useEffect(() => {
    if (!user) return;
    setPersonA((prev) => {
      const next: PersonForm = {
        name: prev.name || user.name || "",
        dob: prev.dob || user.dateOfBirth || "",
        time: prev.time || user.timeOfBirth || "",
        place: prev.place || user.placeOfBirth || "",
      };
      const didPrefill = Boolean(
        (user.name && !prev.name) ||
          (user.dateOfBirth && !prev.dob) ||
          (user.timeOfBirth && !prev.time) ||
          (user.placeOfBirth && !prev.place),
      );
      if (didPrefill) setPersonAPrefilled(true);
      return next;
    });
  }, [user]);

  const isValid = personA.name && personA.dob && personA.time && personA.place && personB.name && personB.dob && personB.time && personB.place;

  // Focus the first empty field, walking Person A (name → dob → time → place)
  // then Person B in the same order. Ids are assigned in PersonFormComponent.
  const focusFirstEmptyMatchField = () => {
    const checks: Array<[boolean, string]> = [
      [!personA.name, "person-a-name"],
      [!personA.dob, "person-a-dob"],
      [!personA.time, "person-a-time"],
      [!personA.place, "person-a-place"],
      [!personB.name, "person-b-name"],
      [!personB.dob, "person-b-dob"],
      [!personB.time, "person-b-time"],
      [!personB.place, "person-b-place"],
    ];
    const first = checks.find(([empty]) => empty);
    if (first) document.getElementById(first[1])?.focus();
  };

  const handleMatch = async () => {
    if (!isValid) {
      setError(t.form.fillAllFields);
      setShowFieldErrors(true);
      focusFirstEmptyMatchField();
      return;
    }
    setShowFieldErrors(false);
    setLoading(true);
    setError("");
    try {
      const token = useAuthStore.getState().accessToken;
      if (!token) {
        setError(t.matching.loginRequired);
        return;
      }
      const { api } = await import("@/lib/api");
      const res = await api.post<any>("/astrology/matching", {
        partner1: { dateOfBirth: personA.dob, timeOfBirth: personA.time, placeOfBirth: personA.place },
        partner2: { dateOfBirth: personB.dob, timeOfBirth: personB.time, placeOfBirth: personB.place },
        locale,
        tradition: activeTradition,
      }, { token });

      const totalScore = res.totalScore ?? mockResults.totalScore;
      const maxScore = res.maxScore ?? mockResults.maxScore;
      const percentage = Math.round((totalScore / maxScore) * 100);

      setResults({
        totalScore,
        maxScore,
        percentage,
        manglikA: Boolean(res.manglikA),
        manglikB: Boolean(res.manglikB),
        koota: res.gunaDetails?.map((g: any) => ({
          name: g.guna,
          description: g.description,
          obtained: g.obtainedPoints,
          max: g.maxPoints,
        })) || mockResults.koota,
        verdict: res.compatibility || (percentage >= 75 ? t.matching.verdictExcellent : percentage >= 50 ? t.matching.verdictGood : t.matching.verdictAverage),
        summary: res.recommendation || mockResults.summary,
      });
      // A fresh match invalidates any previously created share link.
      setShareUrl("");
      setShareError("");
      setCopied(false);
    } catch (err: any) {
      setError(err.message || t.matching.checkFailed);
    } finally {
      setLoading(false);
    }
  };

  const handleShare = async () => {
    if (!results) return;
    setShareLoading(true);
    setShareError("");
    setCopied(false);
    try {
      const token = useAuthStore.getState().accessToken;
      if (!token) {
        setShareError(t.matching.loginRequired);
        return;
      }
      const { api } = await import("@/lib/api");
      const { token: shareToken } = await api.post<{ token: string }>(
        "/astrology/matching/share",
        {
          partner1Name: personA.name,
          partner2Name: personB.name,
          totalScore: results.totalScore,
          maxScore: results.maxScore,
          compatibility: results.verdict,
          recommendation: results.summary,
          manglikA: results.manglikA,
          manglikB: results.manglikB,
          gunaDetails: results.koota.map((k) => ({
            guna: k.name,
            description: k.description,
            maxPoints: k.max,
            obtainedPoints: k.obtained,
          })),
          locale,
        },
        { token },
      );
      const origin = typeof window !== "undefined" ? window.location.origin : "";
      setShareUrl(`${origin}/match/${shareToken}`);
    } catch (err: any) {
      setShareError(err?.message || t.matchShare.shareFailed);
    } finally {
      setShareLoading(false);
    }
  };

  const copyShareUrl = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      if (copyTimer.current) clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API unavailable (e.g. insecure context); the field stays selectable.
    }
  };

  const scoreColor = (pct: number) =>
    pct >= 75 ? "text-emerald-400" : pct >= 50 ? "text-accent-400" : "text-red-400";

  return (
    <div>
      <FeatureHeader
        tint="pink"
        eyebrow={t.matching.badge}
        eyebrowIcon={<FeatureGlyph slug="matching" size={18} />}
        headline={`${t.matching.title} {em}${t.matching.titleHighlight}{/em}`}
        tagline={t.matching.description}
      />

      <div className="relative mx-auto max-w-5xl px-4 py-10 sm:py-14 fade-in-up">

        {/* Forms */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <div>
            {personAPrefilled && (
              <div className="mb-3 p-3 rounded-xl bg-primary-500/10 border border-primary-500/20 text-primary-300 text-xs flex items-center gap-2">
                <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>{t.common.usingProfileDetails}</span>
              </div>
            )}
            <PersonFormComponent
              label={t.matching.personA}
              person={personA}
              setPerson={setPersonA}
              gradient="from-pink-400 to-red-400"
              idPrefix="person-a"
              showErrors={showFieldErrors}
              t={t}
            />
          </div>
          <PersonFormComponent
            label={t.matching.personB}
            person={personB}
            setPerson={setPersonB}
            gradient="from-blue-400 to-cyan-400"
            idPrefix="person-b"
            showErrors={showFieldErrors}
            t={t}
          />
        </div>

        {/* Match Button */}
        <div className="text-center mb-12">
          <button
            onClick={handleMatch}
            disabled={loading}
            aria-disabled={!isValid}
            className={`px-10 py-4 rounded-xl btn-primary text-lg disabled:opacity-50 ${!isValid ? "opacity-50" : ""}`}
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                {t.matching.matchingKundlis}
              </span>
            ) : (
              t.matching.checkCompatibility
            )}
          </button>
        </div>

        {error && (
          <div className="mb-6 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm text-center">
            {error}
          </div>
        )}

        {/* Results */}
        {results && (
          <div className="space-y-6">
            {/* Score Overview */}
            <div className="surface-card p-8 text-center">
              <h2 className="text-2xl font-bold text-gradient mb-6">{t.matching.results}</h2>
              <div className="grid sm:grid-cols-3 gap-6 mb-8">
                <div className="p-4 rounded-xl bg-[rgba(255,252,245,0.78)]">
                  <p className="text-xs text-[rgba(12,8,5,0.66)] mb-1">{t.matching.ashtakootaScore}</p>
                  <p className={`text-3xl font-bold ${scoreColor(results.percentage)}`}>
                    {results.totalScore}<span className="text-lg text-[rgba(12,8,5,0.66)]">/{results.maxScore}</span>
                  </p>
                </div>
                <div className="p-4 rounded-xl bg-[rgba(255,252,245,0.78)]">
                  <p className="text-xs text-[rgba(12,8,5,0.66)] mb-1">{t.matching.compatibility}</p>
                  <p className={`text-3xl font-bold ${scoreColor(results.percentage)}`}>{results.percentage}%</p>
                </div>
                <div className="p-4 rounded-xl bg-[rgba(255,252,245,0.78)]">
                  <p className="text-xs text-[rgba(12,8,5,0.66)] mb-1">{t.matching.verdict}</p>
                  <p className="text-3xl font-bold text-emerald-400">{results.verdict}</p>
                </div>
              </div>

              {/* Manglik Status */}
              <div className="grid sm:grid-cols-2 gap-4 mb-6">
                <div className="p-4 rounded-xl bg-[rgba(255,252,245,0.78)] flex items-center justify-between">
                  <span className="text-sm text-[rgba(12,8,5,0.66)]">{personA.name || t.matching.personA} - {t.matching.manglik}</span>
                  <span className={`text-sm font-semibold ${results.manglikA ? "text-red-400" : "text-emerald-400"}`}>
                    {results.manglikA ? t.matching.yes : t.matching.no}
                  </span>
                </div>
                <div className="p-4 rounded-xl bg-[rgba(255,252,245,0.78)] flex items-center justify-between">
                  <span className="text-sm text-[rgba(12,8,5,0.66)]">{personB.name || t.matching.personB} - {t.matching.manglik}</span>
                  <span className={`text-sm font-semibold ${results.manglikB ? "text-red-400" : "text-emerald-400"}`}>
                    {results.manglikB ? t.matching.yesMild : t.matching.no}
                  </span>
                </div>
              </div>
            </div>

            {/* Koota Details */}
            <div className="surface-card p-6">
              <h3 className="text-lg font-bold text-surface-950 mb-4">{t.matching.ashtakootaBreakdown}</h3>
              <div className="space-y-3">
                {results.koota.map((k) => {
                  const pct = (k.obtained / k.max) * 100;
                  return (
                    <div key={k.name} className="p-4 rounded-xl bg-[rgba(255,252,245,0.78)]">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <span className="font-medium text-surface-950 text-sm">{k.name}</span>
                          <span className="text-xs text-[rgba(12,8,5,0.66)] ml-2">{k.description}</span>
                        </div>
                        <span className={`text-sm font-bold ${scoreColor(pct)}`}>
                          {k.obtained}/{k.max}
                        </span>
                      </div>
                      <div className="w-full h-1.5 bg-[rgba(255,252,245,0.78)] rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            pct >= 75 ? "bg-emerald-500" : pct >= 50 ? "bg-accent-500" : "bg-red-500"
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Summary */}
            <div className="surface-card p-6">
              <h3 className="text-lg font-bold text-gradient mb-4">{t.matching.analysisSummary}</h3>
              <p className="text-secondary leading-relaxed">{results.summary}</p>
              <div className="mt-4 pt-4 border-t divider flex flex-wrap gap-3">
                <button
                  onClick={handleShare}
                  disabled={shareLoading}
                  className="px-6 py-3 rounded-xl btn-primary text-sm font-medium disabled:opacity-50"
                >
                  {shareLoading ? t.matchShare.sharing : t.matchShare.share}
                </button>
                <button className="px-6 py-3 rounded-xl btn-secondary text-sm font-medium text-primary-400 hover:bg-[rgba(12,8,5,0.06)] transition-all">
                  {t.matching.downloadReport}
                </button>
              </div>

              {shareError && <p className="mt-3 text-sm text-red-400">{shareError}</p>}

              {shareUrl && (
                <div className="mt-4 p-4 rounded-xl bg-[rgba(255,252,245,0.78)] border divider">
                  <p className="text-sm font-semibold text-surface-950">{t.matchShare.shareTitle}</p>
                  <p className="text-xs text-[rgba(12,8,5,0.66)] mt-0.5 mb-3">{t.matchShare.shareHint}</p>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      readOnly
                      value={shareUrl}
                      onFocus={(e) => e.currentTarget.select()}
                      className="flex-1 px-4 py-2.5 rounded-xl surface-input text-sm"
                      aria-label={t.matchShare.shareTitle}
                    />
                    <button
                      onClick={copyShareUrl}
                      className="px-5 py-2.5 rounded-xl btn-secondary text-sm font-medium whitespace-nowrap"
                    >
                      {copied ? t.matchShare.copied : t.matchShare.copyLink}
                    </button>
                  </div>
                  <a
                    href={`https://wa.me/?text=${encodeURIComponent(
                      `${t.matchShare.whatsappText
                        .replace("{score}", String(results.totalScore))
                        .replace("{max}", String(results.maxScore))
                        .replace("{percentage}", String(results.percentage))} ${shareUrl}`,
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 mt-3 px-5 py-2.5 rounded-xl text-sm font-medium text-white bg-[#25D366] hover:bg-[#1ebe5b] transition-colors"
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M.057 24l1.687-6.163a11.867 11.867 0 01-1.587-5.945C.16 5.335 5.495 0 12.05 0a11.817 11.817 0 018.413 3.488 11.824 11.824 0 013.48 8.414c-.003 6.557-5.338 11.892-11.893 11.892a11.9 11.9 0 01-5.688-1.448L.057 24zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884a9.86 9.86 0 001.51 5.26l-.999 3.648 3.74-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.521.149-.174.198-.298.298-.497.099-.198.05-.372-.025-.521-.074-.149-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413z" />
                    </svg>
                    {t.matchShare.shareWhatsapp}
                  </a>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
