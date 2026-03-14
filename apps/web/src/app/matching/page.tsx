"use client";

import { useState } from "react";

interface PersonForm {
  name: string;
  dob: string;
  time: string;
  place: string;
}

const emptyPerson: PersonForm = { name: "", dob: "", time: "", place: "" };

const mockResults = {
  totalScore: 28,
  maxScore: 36,
  percentage: 78,
  manglikA: false,
  manglikB: true,
  koota: [
    { name: "Varna", description: "Spiritual compatibility", obtained: 1, max: 1 },
    { name: "Vashya", description: "Mutual attraction & control", obtained: 2, max: 2 },
    { name: "Tara", description: "Birth star compatibility", obtained: 3, max: 3 },
    { name: "Yoni", description: "Physical & sexual compatibility", obtained: 3, max: 4 },
    { name: "Graha Maitri", description: "Intellectual compatibility", obtained: 5, max: 5 },
    { name: "Gana", description: "Temperament compatibility", obtained: 4, max: 6 },
    { name: "Bhakoot", description: "Love & family harmony", obtained: 7, max: 7 },
    { name: "Nadi", description: "Health & genetic compatibility", obtained: 3, max: 8 },
  ],
  verdict: "Good Match",
  summary:
    "With a score of 28 out of 36, this is a favorable match for marriage. The couple shares strong intellectual and emotional compatibility. The Bhakoot score is excellent, indicating harmonious family life. The Nadi score suggests some caution regarding health aspects of progeny - simple remedies can address this. Overall, this alliance is recommended with minor considerations.",
};

export default function MatchingPage() {
  const [personA, setPersonA] = useState<PersonForm>({ ...emptyPerson });
  const [personB, setPersonB] = useState<PersonForm>({ ...emptyPerson });
  const [results, setResults] = useState<typeof mockResults | null>(null);
  const [loading, setLoading] = useState(false);

  const isValid = personA.name && personA.dob && personA.time && personA.place && personB.name && personB.dob && personB.time && personB.place;

  const handleMatch = async () => {
    if (!isValid) return;
    setLoading(true);
    try {
      const { useAuthStore } = await import("@/lib/store");
      const token = useAuthStore.getState().accessToken;
      if (token) {
        const { api } = await import("@/lib/api");
        const res = await api.post<any>("/astrology/matching", {
          partner1: { dateOfBirth: personA.dob, timeOfBirth: personA.time, placeOfBirth: personA.place },
          partner2: { dateOfBirth: personB.dob, timeOfBirth: personB.time, placeOfBirth: personB.place },
        }, { token });
        if (res?.totalScore) {
          setResults({
            ...mockResults,
            totalScore: res.totalScore,
            maxScore: res.maxScore,
            percentage: Math.round((res.totalScore / res.maxScore) * 100),
            koota: res.gunaDetails?.map((g: any) => ({
              name: g.guna,
              description: g.description,
              obtained: g.obtainedPoints,
              max: g.maxPoints,
            })) || mockResults.koota,
            verdict: res.compatibility || mockResults.verdict,
            summary: res.recommendation || mockResults.summary,
          });
          return;
        }
      }
      setResults(mockResults);
    } catch {
      setResults(mockResults);
    } finally {
      setLoading(false);
    }
  };

  const inputClass =
    "w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-600 focus:outline-none focus:border-primary-500 transition-colors";

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
    <div className="glass-card p-6">
      <h3 className={`text-lg font-display font-bold bg-gradient-to-r ${gradient} bg-clip-text text-transparent mb-5`}>
        {label}
      </h3>
      <div className="space-y-4">
        <div>
          <label className="block text-sm text-gray-400 mb-1.5">Full Name</label>
          <input
            type="text"
            value={person.name}
            onChange={(e) => setPerson({ ...person, name: e.target.value })}
            placeholder="Enter name"
            className={inputClass}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1.5">Date of Birth</label>
            <input
              type="date"
              value={person.dob}
              onChange={(e) => setPerson({ ...person, dob: e.target.value })}
              className={`${inputClass} [color-scheme:dark]`}
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1.5">Time of Birth</label>
            <input
              type="time"
              value={person.time}
              onChange={(e) => setPerson({ ...person, time: e.target.value })}
              className={`${inputClass} [color-scheme:dark]`}
            />
          </div>
        </div>
        <div>
          <label className="block text-sm text-gray-400 mb-1.5">Place of Birth</label>
          <input
            type="text"
            value={person.place}
            onChange={(e) => setPerson({ ...person, place: e.target.value })}
            placeholder="Search city..."
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
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass text-sm text-gray-300 mb-4">
            <span className="text-lg">💞</span>
            Ashtakoota Guna Milan
          </div>
          <h1 className="text-4xl sm:text-5xl font-display font-bold mb-4">
            Kundli <span className="text-gradient">Matching</span>
          </h1>
          <p className="text-gray-400 max-w-xl mx-auto">
            Check marriage compatibility with detailed Ashtakoota analysis, Manglik check, and AI-powered compatibility insights.
          </p>
        </div>

        {/* Forms */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <PersonFormComponent
            label="Person A"
            person={personA}
            setPerson={setPersonA}
            gradient="from-pink-400 to-red-400"
          />
          <PersonFormComponent
            label="Person B"
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
            className="px-10 py-4 rounded-xl bg-gradient-to-r from-pink-600 to-primary-600 text-white font-semibold text-lg hover:from-pink-500 hover:to-primary-500 transition-all glow disabled:opacity-50"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Matching Kundlis...
              </span>
            ) : (
              "Check Compatibility"
            )}
          </button>
        </div>

        {/* Results */}
        {results && (
          <div className="space-y-6">
            {/* Score Overview */}
            <div className="glass-card p-8 text-center">
              <h2 className="text-2xl font-display font-bold text-gradient mb-6">Compatibility Results</h2>
              <div className="grid sm:grid-cols-3 gap-6 mb-8">
                <div className="p-4 rounded-xl bg-white/5">
                  <p className="text-xs text-gray-500 mb-1">Ashtakoota Score</p>
                  <p className={`text-3xl font-bold ${scoreColor(results.percentage)}`}>
                    {results.totalScore}<span className="text-lg text-gray-500">/{results.maxScore}</span>
                  </p>
                </div>
                <div className="p-4 rounded-xl bg-white/5">
                  <p className="text-xs text-gray-500 mb-1">Compatibility</p>
                  <p className={`text-3xl font-bold ${scoreColor(results.percentage)}`}>{results.percentage}%</p>
                </div>
                <div className="p-4 rounded-xl bg-white/5">
                  <p className="text-xs text-gray-500 mb-1">Verdict</p>
                  <p className="text-3xl font-bold text-emerald-400">{results.verdict}</p>
                </div>
              </div>

              {/* Manglik Status */}
              <div className="grid sm:grid-cols-2 gap-4 mb-6">
                <div className="p-4 rounded-xl bg-white/5 flex items-center justify-between">
                  <span className="text-sm text-gray-400">{personA.name || "Person A"} - Manglik</span>
                  <span className={`text-sm font-semibold ${results.manglikA ? "text-red-400" : "text-emerald-400"}`}>
                    {results.manglikA ? "Yes" : "No"}
                  </span>
                </div>
                <div className="p-4 rounded-xl bg-white/5 flex items-center justify-between">
                  <span className="text-sm text-gray-400">{personB.name || "Person B"} - Manglik</span>
                  <span className={`text-sm font-semibold ${results.manglikB ? "text-red-400" : "text-emerald-400"}`}>
                    {results.manglikB ? "Yes (Mild)" : "No"}
                  </span>
                </div>
              </div>
            </div>

            {/* Koota Details */}
            <div className="glass-card p-6">
              <h3 className="text-lg font-display font-bold text-white mb-4">Ashtakoota Breakdown</h3>
              <div className="space-y-3">
                {results.koota.map((k) => {
                  const pct = (k.obtained / k.max) * 100;
                  return (
                    <div key={k.name} className="p-4 rounded-xl bg-white/5">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <span className="font-medium text-white text-sm">{k.name}</span>
                          <span className="text-xs text-gray-500 ml-2">{k.description}</span>
                        </div>
                        <span className={`text-sm font-bold ${scoreColor(pct)}`}>
                          {k.obtained}/{k.max}
                        </span>
                      </div>
                      <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
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
            <div className="glass-card p-6">
              <h3 className="text-lg font-display font-bold text-gradient mb-4">AI Analysis Summary</h3>
              <p className="text-gray-300 leading-relaxed">{results.summary}</p>
              <div className="mt-4 pt-4 border-t border-white/10">
                <button className="px-6 py-3 rounded-xl glass text-sm font-medium text-primary-400 hover:bg-white/10 transition-all">
                  Download Detailed Report (PDF) - 5 Credits
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
