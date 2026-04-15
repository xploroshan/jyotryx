"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "@/i18n";
import { useAuthStore } from "@/lib/store";

interface PersonForm {
  name: string;
  dob: string;
  time: string;
  place: string;
}

const emptyPerson: PersonForm = { name: "", dob: "", time: "", place: "" };

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
  const [personAPrefilled, setPersonAPrefilled] = useState(false);

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

  const handleMatch = async () => {
    if (!isValid) return;
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
        manglikA: false,
        manglikB: false,
        koota: res.gunaDetails?.map((g: any) => ({
          name: g.guna,
          description: g.description,
          obtained: g.obtainedPoints,
          max: g.maxPoints,
        })) || mockResults.koota,
        verdict: res.compatibility || (percentage >= 75 ? t.matching.verdictExcellent : percentage >= 50 ? t.matching.verdictGood : t.matching.verdictAverage),
        summary: res.recommendation || mockResults.summary,
      });
    } catch (err: any) {
      setError(err.message || t.matching.checkFailed);
    } finally {
      setLoading(false);
    }
  };

  const inputClass =
    "w-full px-4 py-3 rounded-xl surface-input";

  const PersonFormComponent = ({
    label,
    person,
    setPerson,
    gradient,
  }: {
    label: string;
    person: PersonForm;
    setPerson: (p: PersonForm) => void;
    gradient: string;
  }) => (
    <div className="surface-card p-6">
      <h3 className={`text-lg font-bold bg-gradient-to-r ${gradient} bg-clip-text text-transparent mb-5`}>
        {label}
      </h3>
      <div className="space-y-4">
        <div>
          <label className="block text-sm text-white/40 mb-1.5">{t.matching.fullName}</label>
          <input
            type="text"
            value={person.name}
            onChange={(e) => setPerson({ ...person, name: e.target.value })}
            placeholder={t.matching.enterName}
            className={inputClass}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-white/40 mb-1.5">{t.form.dateOfBirth}</label>
            <input
              type="date"
              value={person.dob}
              onChange={(e) => setPerson({ ...person, dob: e.target.value })}
              className={`${inputClass} [color-scheme:dark]`}
            />
          </div>
          <div>
            <label className="block text-sm text-white/40 mb-1.5">{t.form.timeOfBirth}</label>
            <input
              type="time"
              value={person.time}
              onChange={(e) => setPerson({ ...person, time: e.target.value })}
              className={`${inputClass} [color-scheme:dark]`}
            />
          </div>
        </div>
        <div>
          <label className="block text-sm text-white/40 mb-1.5">{t.form.placeOfBirth}</label>
          <input
            type="text"
            value={person.place}
            onChange={(e) => setPerson({ ...person, place: e.target.value })}
            placeholder={t.matching.searchCity}
            className={inputClass}
          />
        </div>
      </div>
    </div>
  );

  const scoreColor = (pct: number) =>
    pct >= 75 ? "text-emerald-400" : pct >= 50 ? "text-accent-400" : "text-red-400";

  return (
    <div className="relative min-h-screen">
      <div className="absolute inset-0 bg-gradient-to-b from-red-500/5 via-gray-950 to-gray-950" />
      <div className="absolute top-32 left-1/4 w-80 h-80 bg-pink-500/8 rounded-full blur-3xl" />
      <div className="absolute bottom-32 right-1/4 w-80 h-80 bg-primary-500/8 rounded-full blur-3xl" />

      <div className="relative z-10 mx-auto max-w-5xl px-4 py-12">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full btn-secondary text-sm text-white/60 mb-4">
            <span className="text-lg">💞</span>
            {t.matching.badge}
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold mb-4">
            {t.matching.title}{" "}
            <span className="text-gradient">{t.matching.titleHighlight}</span>
          </h1>
          <p className="text-white/40 max-w-xl mx-auto">
            {t.matching.description}
          </p>
        </div>

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
            />
          </div>
          <PersonFormComponent
            label={t.matching.personB}
            person={personB}
            setPerson={setPersonB}
            gradient="from-blue-400 to-cyan-400"
          />
        </div>

        {/* Match Button */}
        <div className="text-center mb-12">
          <button
            onClick={handleMatch}
            disabled={!isValid || loading}
            className="px-10 py-4 rounded-xl btn-primary text-lg disabled:opacity-50"
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
                <div className="p-4 rounded-xl bg-white/[0.03]">
                  <p className="text-xs text-white/30 mb-1">{t.matching.ashtakootaScore}</p>
                  <p className={`text-3xl font-bold ${scoreColor(results.percentage)}`}>
                    {results.totalScore}<span className="text-lg text-white/30">/{results.maxScore}</span>
                  </p>
                </div>
                <div className="p-4 rounded-xl bg-white/[0.03]">
                  <p className="text-xs text-white/30 mb-1">{t.matching.compatibility}</p>
                  <p className={`text-3xl font-bold ${scoreColor(results.percentage)}`}>{results.percentage}%</p>
                </div>
                <div className="p-4 rounded-xl bg-white/[0.03]">
                  <p className="text-xs text-white/30 mb-1">{t.matching.verdict}</p>
                  <p className="text-3xl font-bold text-emerald-400">{results.verdict}</p>
                </div>
              </div>

              {/* Manglik Status */}
              <div className="grid sm:grid-cols-2 gap-4 mb-6">
                <div className="p-4 rounded-xl bg-white/[0.03] flex items-center justify-between">
                  <span className="text-sm text-white/40">{personA.name || t.matching.personA} - {t.matching.manglik}</span>
                  <span className={`text-sm font-semibold ${results.manglikA ? "text-red-400" : "text-emerald-400"}`}>
                    {results.manglikA ? t.matching.yes : t.matching.no}
                  </span>
                </div>
                <div className="p-4 rounded-xl bg-white/[0.03] flex items-center justify-between">
                  <span className="text-sm text-white/40">{personB.name || t.matching.personB} - {t.matching.manglik}</span>
                  <span className={`text-sm font-semibold ${results.manglikB ? "text-red-400" : "text-emerald-400"}`}>
                    {results.manglikB ? t.matching.yesMild : t.matching.no}
                  </span>
                </div>
              </div>
            </div>

            {/* Koota Details */}
            <div className="surface-card p-6">
              <h3 className="text-lg font-bold text-white mb-4">{t.matching.ashtakootaBreakdown}</h3>
              <div className="space-y-3">
                {results.koota.map((k) => {
                  const pct = (k.obtained / k.max) * 100;
                  return (
                    <div key={k.name} className="p-4 rounded-xl bg-white/[0.03]">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <span className="font-medium text-white text-sm">{k.name}</span>
                          <span className="text-xs text-white/30 ml-2">{k.description}</span>
                        </div>
                        <span className={`text-sm font-bold ${scoreColor(pct)}`}>
                          {k.obtained}/{k.max}
                        </span>
                      </div>
                      <div className="w-full h-1.5 bg-white/[0.03] rounded-full overflow-hidden">
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
              <p className="text-white/60 leading-relaxed">{results.summary}</p>
              <div className="mt-4 pt-4 border-t divider">
                <button className="px-6 py-3 rounded-xl btn-secondary text-sm font-medium text-primary-400 hover:bg-white/[0.1] transition-all">
                  {t.matching.downloadReport}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
