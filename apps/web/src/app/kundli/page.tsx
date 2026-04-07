"use client";

import { useState } from "react";
import { useTranslation } from "@/i18n";

interface KundliData {
  id: string;
  ascendant: string;
  moonSign: string;
  sunSign: string;
  nakshatra: string;
  houses: { house: number; sign: string; planets: string[] }[];
  planetaryPositions: {
    planet: string;
    sign: string;
    house: number;
    degree: number;
    isRetrograde: boolean;
    nakshatra: string;
  }[];
  dashas: {
    planet: string;
    startDate: string;
    endDate: string;
    subPeriods?: { planet: string; startDate: string; endDate: string }[];
  }[];
  yogas: { name: string; description: string; effect: string }[];
}

interface DoshaData {
  doshas: {
    name: string;
    present: boolean;
    severity: string;
    description: string;
    remedies: string[];
  }[];
}

export default function KundliPage() {
  const { t, locale } = useTranslation();

  const tabs = [
    { id: "chart", label: t.kundli.birthChart },
    { id: "planets", label: t.kundli.planetaryDetails },
    { id: "houses", label: t.kundli.houseAnalysis },
    { id: "dasha", label: t.kundli.dashaPeriods },
    { id: "yogas", label: t.kundli.yogas },
    { id: "doshas", label: t.kundli.doshasTab },
  ];

  const [activeTab, setActiveTab] = useState("chart");
  const [kundli, setKundli] = useState<KundliData | null>(null);
  const [doshas, setDoshas] = useState<DoshaData | null>(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ name: "", dob: "", time: "", place: "" });

  const handleGenerate = async () => {
    if (!form.name || !form.dob || !form.time || !form.place) return;
    setGenerating(true);
    setError("");
    try {
      const { useAuthStore } = await import("@/lib/store");
      const token = useAuthStore.getState().accessToken;
      if (token) {
        const { api } = await import("@/lib/api");
        const result = await api.post<KundliData>("/astrology/kundli", {
          dateOfBirth: form.dob,
          timeOfBirth: form.time,
          placeOfBirth: form.place,
          locale,
        }, { token });
        setKundli(result);

        // Also fetch doshas
        try {
          const doshaResult = await api.get<DoshaData>("/astrology/dosha", { token });
          setDoshas(doshaResult);
        } catch {
          // Dosha fetch is optional
        }
      } else {
        setError(t.kundli.loginRequired);
      }
    } catch (err: any) {
      setError(err.message || "Failed to generate Kundli. Please try again.");
    } finally {
      setGenerating(false);
    }
  };

  // Build chart SVG data from houses
  const getChartPlanets = (houseNum: number) => {
    if (!kundli?.houses) return "";
    const house = kundli.houses.find(h => h.house === houseNum);
    return house?.planets?.join(", ") || "";
  };

  // North Indian chart house positions (approximate SVG text coords)
  const housePositions = [
    { x: 185, y: 120 }, // 1 - top center
    { x: 295, y: 95 },  // 2 - top right
    { x: 315, y: 200 }, // 3 - right top
    { x: 295, y: 310 }, // 4 - right bottom
    { x: 185, y: 290 }, // 5 - bottom center
    { x: 75, y: 310 },  // 6 - left bottom
    { x: 55, y: 200 },  // 7 - left top
    { x: 75, y: 95 },   // 8 - top left
    { x: 185, y: 60 },  // 9 - far top
    { x: 340, y: 60 },  // 10 - far top right
    { x: 340, y: 340 }, // 11 - far bottom right
    { x: 55, y: 340 },  // 12 - far bottom left
  ];

  return (
    <div className="relative min-h-screen">
      <div className="absolute inset-0 bg-gradient-to-b from-primary-900/10 via-gray-950 to-gray-950" />
      <div className="absolute top-32 right-1/4 w-80 h-80 bg-mystic-500/8 rounded-full blur-3xl" />
      <div className="absolute bottom-32 left-1/4 w-80 h-80 bg-primary-500/8 rounded-full blur-3xl" />

      <div className="relative z-10 mx-auto max-w-6xl px-4 py-12">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full surface-card text-sm text-white/60 mb-4">
            {t.kundli.badge}
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold mb-4">
            {t.kundli.title} <span className="text-gradient">{t.kundli.titleHighlight}</span>
          </h1>
          <p className="text-white/40 max-w-xl mx-auto">
            {t.kundli.description}
          </p>
        </div>

        {/* Birth Details Form */}
        {!kundli && (
          <div className="max-w-lg mx-auto">
            <div className="surface-card p-8">
              <h2 className="text-lg font-bold text-white mb-6">{t.kundli.enterBirthDetails}</h2>

              {error && (
                <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">{error}</div>
              )}

              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-white/40 mb-1.5">{t.kundli.fullName}</label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder={t.kundli.enterName}
                    className="w-full px-4 py-3 rounded-xl surface-input"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-white/40 mb-1.5">{t.form.dateOfBirth}</label>
                    <input
                      type="date"
                      value={form.dob}
                      onChange={(e) => setForm({ ...form, dob: e.target.value })}
                      className="w-full px-4 py-3 rounded-xl surface-input [color-scheme:dark]"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-white/40 mb-1.5">{t.form.timeOfBirth}</label>
                    <input
                      type="time"
                      value={form.time}
                      onChange={(e) => setForm({ ...form, time: e.target.value })}
                      className="w-full px-4 py-3 rounded-xl surface-input [color-scheme:dark]"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm text-white/40 mb-1.5">{t.form.placeOfBirth}</label>
                  <input
                    type="text"
                    value={form.place}
                    onChange={(e) => setForm({ ...form, place: e.target.value })}
                    placeholder={t.kundli.searchCity}
                    className="w-full px-4 py-3 rounded-xl surface-input"
                  />
                  <p className="text-xs text-white/20 mt-1">{t.kundli.birthCityNote}</p>
                </div>
                <button
                  onClick={handleGenerate}
                  disabled={generating || !form.name || !form.dob || !form.time || !form.place}
                  className="w-full py-3.5 rounded-xl btn-primary disabled:opacity-50"
                >
                  {generating ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      {t.kundli.generating}
                    </span>
                  ) : (
                    t.kundli.generateKundli
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Kundli Results */}
        {kundli && (
          <div>
            {/* Profile summary - actual data */}
            <div className="surface-card p-6 mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-white">{form.name}</h2>
                <p className="text-sm text-white/40">
                  {form.dob} at {form.time} &bull; {form.place}
                </p>
                <p className="text-xs text-white/30 mt-1">
                  {t.kundli.ascendant}: <span className="text-primary-400">{kundli.ascendant}</span> &bull;
                  {t.kundli.moonSign}: <span className="text-primary-400">{kundli.moonSign}</span> &bull;
                  {t.kundli.sunSign}: <span className="text-primary-400">{kundli.sunSign}</span> &bull;
                  {t.kundli.nakshatra}: <span className="text-primary-400">{kundli.nakshatra}</span>
                </p>
              </div>
              <button
                onClick={() => { setKundli(null); setDoshas(null); setForm({ name: "", dob: "", time: "", place: "" }); setError(""); }}
                className="px-4 py-2 rounded-xl btn-secondary text-sm"
              >
                {t.kundli.newKundli}
              </button>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 mb-6 rounded-xl bg-white/[0.03] p-1 overflow-x-auto">
              {tabs.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setActiveTab(t.id)}
                  className={`flex-shrink-0 flex-1 py-2.5 px-3 rounded-lg text-xs font-medium transition-all ${
                    activeTab === t.id
                      ? "btn-primary"
                      : "text-white/40 hover:text-white"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* Tab Content */}
            {activeTab === "chart" && (
              <div className="surface-card p-8 flex flex-col items-center">
                <h3 className="text-lg font-bold text-gradient mb-6">{t.kundli.rashiChart}</h3>
                <div className="relative w-80 h-80 sm:w-96 sm:h-96">
                  <svg viewBox="0 0 400 400" className="w-full h-full">
                    <rect x="10" y="10" width="380" height="380" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="1.5" />
                    <line x1="10" y1="10" x2="390" y2="390" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
                    <line x1="390" y1="10" x2="10" y2="390" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
                    <line x1="200" y1="10" x2="390" y2="200" stroke="rgba(255,255,255,0.1)" strokeWidth="1.5" />
                    <line x1="390" y1="200" x2="200" y2="390" stroke="rgba(255,255,255,0.1)" strokeWidth="1.5" />
                    <line x1="200" y1="390" x2="10" y2="200" stroke="rgba(255,255,255,0.1)" strokeWidth="1.5" />
                    <line x1="10" y1="200" x2="200" y2="10" stroke="rgba(255,255,255,0.1)" strokeWidth="1.5" />
                    {/* Ascendant label */}
                    <text x="185" y="105" fill="rgba(217,70,239,0.6)" fontSize="11" fontFamily="sans-serif">Asc</text>
                    <text x="180" y="125" fill="rgba(255,255,255,0.7)" fontSize="10" fontFamily="sans-serif">
                      {kundli.ascendant?.substring(0, 3)}
                    </text>
                    {/* Display planets in houses */}
                    {kundli.houses?.slice(0, 12).map((house, i) => {
                      const pos = housePositions[i];
                      if (!pos) return null;
                      const planetText = house.planets?.join(", ") || "";
                      return planetText ? (
                        <text key={i} x={pos.x} y={pos.y} fill="rgba(255,255,255,0.5)" fontSize="9" fontFamily="sans-serif">
                          {planetText.length > 12 ? planetText.substring(0, 12) + "..." : planetText}
                        </text>
                      ) : null;
                    })}
                  </svg>
                </div>
                <p className="text-xs text-white/30 mt-4">{t.kundli.chartNote}</p>
              </div>
            )}

            {activeTab === "planets" && (
              <div className="surface-card overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b divider">
                        <th className="text-left px-6 py-4 text-xs font-medium text-white/40 uppercase">{t.kundli.planet}</th>
                        <th className="text-left px-6 py-4 text-xs font-medium text-white/40 uppercase">{t.kundli.sign}</th>
                        <th className="text-left px-6 py-4 text-xs font-medium text-white/40 uppercase">{t.kundli.house}</th>
                        <th className="text-left px-6 py-4 text-xs font-medium text-white/40 uppercase">{t.kundli.degree}</th>
                        <th className="text-left px-6 py-4 text-xs font-medium text-white/40 uppercase">{t.kundli.nakshatra}</th>
                        <th className="text-left px-6 py-4 text-xs font-medium text-white/40 uppercase">{t.kundli.status}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {kundli.planetaryPositions?.map((p) => (
                        <tr key={p.planet} className="border-b border-white/[0.03] hover:bg-white/[0.03] transition-colors">
                          <td className="px-6 py-3 font-medium text-white">{p.planet}</td>
                          <td className="px-6 py-3 text-white/60">{p.sign}</td>
                          <td className="px-6 py-3 text-white/60">{p.house}</td>
                          <td className="px-6 py-3 text-white/40">{p.degree}&deg;</td>
                          <td className="px-6 py-3 text-white/40">{p.nakshatra}</td>
                          <td className="px-6 py-3">
                            <span className={`text-xs px-2 py-1 rounded-full ${
                              p.isRetrograde ? "bg-red-500/20 text-red-400" : "bg-emerald-500/20 text-emerald-400"
                            }`}>
                              {p.isRetrograde ? t.kundli.retrograde : t.kundli.direct}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeTab === "houses" && (
              <div className="space-y-4">
                {kundli.houses?.map((h) => (
                  <div key={h.house} className="surface-card p-5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-2 gap-2">
                      <h4 className="font-semibold text-white">House {h.house}</h4>
                      <div className="flex gap-2">
                        <span className="text-xs px-2 py-1 rounded-full bg-mystic-500/20 text-mystic-400">{h.sign}</span>
                        {h.planets.length > 0 && (
                          <span className="text-xs px-2 py-1 rounded-full bg-primary-500/20 text-primary-400">
                            {h.planets.join(", ")}
                          </span>
                        )}
                      </div>
                    </div>
                    <p className="text-sm text-white/60">
                      {h.planets.length > 0
                        ? `${h.planets.join(", ")} ${h.planets.length === 1 ? "is" : "are"} placed in ${h.sign} in the ${h.house}${getOrdinal(h.house)} house.`
                        : `${h.sign} rules the ${h.house}${getOrdinal(h.house)} house with no planets placed here.`
                      }
                    </p>
                  </div>
                ))}
              </div>
            )}

            {activeTab === "dasha" && (
              <div className="surface-card p-6">
                <h3 className="text-lg font-bold text-gradient mb-4">{t.kundli.vimshottariDasha}</h3>
                {kundli.dashas?.map((d, di) => (
                  <div key={di} className="mb-6">
                    <div className="flex items-center gap-3 mb-4">
                      <span className="text-sm font-semibold text-white">{t.kundli.mahadasha}: {d.planet}</span>
                      <span className="text-xs text-white/30">{d.startDate} to {d.endDate}</span>
                    </div>
                    {d.subPeriods && d.subPeriods.length > 0 && (
                      <div className="space-y-2 ml-4">
                        {d.subPeriods.map((s, si) => {
                          const now = new Date();
                          const start = new Date(s.startDate);
                          const end = new Date(s.endDate);
                          const isActive = now >= start && now <= end;
                          const isCompleted = now > end;
                          return (
                            <div
                              key={si}
                              className={`flex items-center justify-between p-3 rounded-xl ${
                                isActive
                                  ? "bg-primary-600/10 border border-primary-500/20"
                                  : isCompleted
                                  ? "bg-white/[0.02]"
                                  : "bg-white/[0.03]"
                              }`}
                            >
                              <span className={`text-sm ${isActive ? "text-white font-medium" : "text-white/40"}`}>
                                {d.planet}-{s.planet}
                              </span>
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-white/30">{s.startDate} - {s.endDate}</span>
                                {isActive && (
                                  <span className="text-xs px-2 py-0.5 rounded-full bg-primary-500/30 text-primary-300">{t.kundli.current}</span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {activeTab === "yogas" && (
              <div className="space-y-4">
                {kundli.yogas && kundli.yogas.length > 0 ? (
                  kundli.yogas.map((y, i) => (
                    <div key={i} className="surface-card p-5">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-semibold text-white">{y.name}</h4>
                        <span className={`text-xs px-2 py-1 rounded-full ${
                          y.effect === "benefic" ? "bg-emerald-500/20 text-emerald-400" :
                          y.effect === "malefic" ? "bg-red-500/20 text-red-400" :
                          "bg-accent-500/20 text-accent-400"
                        }`}>
                          {y.effect.charAt(0).toUpperCase() + y.effect.slice(1)}
                        </span>
                      </div>
                      <p className="text-sm text-white/60">{y.description}</p>
                    </div>
                  ))
                ) : (
                  <div className="surface-card p-8 text-center text-white/30">
                    {t.kundli.noYogas}
                  </div>
                )}
              </div>
            )}

            {activeTab === "doshas" && (
              <div className="space-y-4">
                {doshas?.doshas ? (
                  doshas.doshas.map((d, i) => (
                    <div key={i} className="surface-card p-5">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-semibold text-white">{d.name}</h4>
                        <span className={`text-xs px-2 py-1 rounded-full ${
                          !d.present ? "bg-emerald-500/20 text-emerald-400" :
                          d.severity === "mild" ? "bg-accent-500/20 text-accent-400" :
                          d.severity === "moderate" ? "bg-amber-500/20 text-amber-400" :
                          "bg-red-500/20 text-red-400"
                        }`}>
                          {d.present ? d.severity.charAt(0).toUpperCase() + d.severity.slice(1) : t.kundli.absent}
                        </span>
                      </div>
                      <p className="text-sm text-white/60 mb-2">{d.description}</p>
                      {d.remedies && d.remedies.length > 0 && (
                        <div className="p-3 rounded-lg bg-white/[0.03]">
                          <p className="text-xs text-white/40">
                            <span className="text-primary-400 font-medium">{t.kundli.remedies}:</span>{" "}
                            {d.remedies.join(". ")}
                          </p>
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="surface-card p-8 text-center">
                    <p className="text-white/30">{t.kundli.doshaNote}</p>
                    <p className="text-xs text-white/20 mt-2">{t.kundli.doshaComplete}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function getOrdinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}
