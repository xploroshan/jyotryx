"use client";

import { useState } from "react";

const tabs = [
  { id: "chart", label: "Birth Chart" },
  { id: "planets", label: "Planetary Details" },
  { id: "houses", label: "House Analysis" },
  { id: "dasha", label: "Dasha Periods" },
  { id: "yogas", label: "Yogas" },
  { id: "doshas", label: "Doshas" },
];

const mockPlanets = [
  { name: "Sun (Surya)", sign: "Leo", house: "10th", degree: "15\u00b024'", nakshatra: "Magha", status: "Own Sign" },
  { name: "Moon (Chandra)", sign: "Cancer", house: "9th", degree: "22\u00b011'", nakshatra: "Ashlesha", status: "Own Sign" },
  { name: "Mars (Mangal)", sign: "Aries", house: "6th", degree: "8\u00b045'", nakshatra: "Ashwini", status: "Own Sign" },
  { name: "Mercury (Budh)", sign: "Virgo", house: "11th", degree: "3\u00b018'", nakshatra: "Uttara Phalguni", status: "Exalted" },
  { name: "Jupiter (Guru)", sign: "Sagittarius", house: "2nd", degree: "19\u00b052'", nakshatra: "Purva Ashadha", status: "Own Sign" },
  { name: "Venus (Shukra)", sign: "Libra", house: "12th", degree: "27\u00b033'", nakshatra: "Vishakha", status: "Own Sign" },
  { name: "Saturn (Shani)", sign: "Aquarius", house: "4th", degree: "11\u00b007'", nakshatra: "Shatabhisha", status: "Own Sign" },
  { name: "Rahu", sign: "Gemini", house: "8th", degree: "14\u00b029'", nakshatra: "Ardra", status: "Neutral" },
  { name: "Ketu", sign: "Sagittarius", house: "2nd", degree: "14\u00b029'", nakshatra: "Moola", status: "Neutral" },
];

const mockHouses = [
  { house: "1st (Lagna)", sign: "Scorpio", lord: "Mars", significance: "Self, personality, physical body", interpretation: "Strong Lagna lord Mars in 6th house gives competitive spirit and ability to overcome enemies." },
  { house: "2nd", sign: "Sagittarius", lord: "Jupiter", significance: "Wealth, family, speech", interpretation: "Jupiter in own sign in 2nd house indicates abundant wealth, good family values, and eloquent speech." },
  { house: "3rd", sign: "Capricorn", lord: "Saturn", significance: "Courage, siblings, communication", interpretation: "Saturn's influence gives determined communication style and responsible relationships with siblings." },
  { house: "4th", sign: "Aquarius", lord: "Saturn", significance: "Home, mother, comfort", interpretation: "Saturn in own sign provides stable domestic life and strong connection to heritage." },
  { house: "5th", sign: "Pisces", lord: "Jupiter", significance: "Children, education, creativity", interpretation: "Jupiter's lordship blesses with intelligent children and strong creative or spiritual inclinations." },
  { house: "7th", sign: "Taurus", lord: "Venus", significance: "Marriage, partnerships, business", interpretation: "Venus as 7th lord indicates a harmonious marriage with an attractive and cultured partner." },
  { house: "10th", sign: "Leo", lord: "Sun", significance: "Career, status, authority", interpretation: "Sun in own sign in 10th house gives leadership roles, government connections, and high status." },
];

const mockDasha = [
  { planet: "Jupiter", period: "2018 - 2034", sub: [
    { planet: "Jupiter-Jupiter", period: "2018-2020", status: "completed" },
    { planet: "Jupiter-Saturn", period: "2020-2023", status: "completed" },
    { planet: "Jupiter-Mercury", period: "2023-2025", status: "completed" },
    { planet: "Jupiter-Ketu", period: "2025-2026", status: "active" },
    { planet: "Jupiter-Venus", period: "2026-2029", status: "upcoming" },
    { planet: "Jupiter-Sun", period: "2029-2030", status: "upcoming" },
    { planet: "Jupiter-Moon", period: "2030-2032", status: "upcoming" },
    { planet: "Jupiter-Mars", period: "2032-2034", status: "upcoming" },
  ]},
];

const mockYogas = [
  { name: "Gajakesari Yoga", planets: "Jupiter + Moon", effect: "Wisdom, wealth, and high social status. The native will be renowned and hold positions of authority.", strength: "Strong" },
  { name: "Budhaditya Yoga", planets: "Sun + Mercury", effect: "Intelligence, fame, and success in education. The native excels in analytical and communication fields.", strength: "Strong" },
  { name: "Dhana Yoga", planets: "2nd & 11th lords", effect: "Significant wealth accumulation through career and investments. Financial stability throughout life.", strength: "Moderate" },
  { name: "Raja Yoga", planets: "9th & 10th lords", effect: "Power, authority, and high status. The native will achieve prominent positions in career or public life.", strength: "Strong" },
];

const mockDoshas = [
  { name: "Manglik Dosha", status: "Mild", description: "Mars is placed in the 6th house, which is considered a mild Manglik position. Its effects are significantly reduced after the age of 28.", remedy: "Worship Lord Hanuman on Tuesdays. Chant Mangal Stotra." },
  { name: "Kaal Sarp Dosha", status: "Absent", description: "All planets are not between Rahu and Ketu. This dosha is not present in your chart.", remedy: "No remedies required." },
  { name: "Pitru Dosha", status: "Absent", description: "Sun is well-placed and not afflicted. No Pitru Dosha detected.", remedy: "No remedies required." },
];

export default function KundliPage() {
  const [activeTab, setActiveTab] = useState("chart");
  const [generated, setGenerated] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [form, setForm] = useState({ name: "", dob: "", time: "", place: "" });

  const handleGenerate = async () => {
    if (!form.name || !form.dob || !form.time || !form.place) return;
    setGenerating(true);
    try {
      const { useAuthStore } = await import("@/lib/store");
      const token = useAuthStore.getState().accessToken;
      if (token) {
        const { api } = await import("@/lib/api");
        await api.post("/astrology/kundli", {
          dateOfBirth: form.dob,
          timeOfBirth: form.time,
          placeOfBirth: form.place,
        }, { token });
      }
      setGenerated(true);
    } catch {
      setGenerated(true); // Still show results with mock data
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="relative min-h-screen">
      <div className="absolute inset-0 bg-gradient-to-b from-mystic-500/5 via-gray-950 to-gray-950" />
      <div className="absolute top-32 right-1/4 w-80 h-80 bg-mystic-500/8 rounded-full blur-3xl" />
      <div className="absolute bottom-32 left-1/4 w-80 h-80 bg-primary-500/8 rounded-full blur-3xl" />

      <div className="relative z-10 mx-auto max-w-6xl px-4 py-12">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass text-sm text-gray-300 mb-4">
            <span className="text-lg">🪐</span>
            Vedic Birth Chart
          </div>
          <h1 className="text-4xl sm:text-5xl font-display font-bold mb-4">
            Kundli <span className="text-gradient">Generator</span>
          </h1>
          <p className="text-gray-400 max-w-xl mx-auto">
            Generate your complete Vedic birth chart with planetary positions, Dasha periods, Yogas, and detailed house analysis.
          </p>
        </div>

        {/* Birth Details Form */}
        {!generated && (
          <div className="max-w-lg mx-auto">
            <div className="glass-card p-8">
              <h2 className="text-lg font-display font-bold text-white mb-6">Enter Birth Details</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1.5">Full Name</label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="Enter your full name"
                    className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-600 focus:outline-none focus:border-primary-500 transition-colors"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-gray-400 mb-1.5">Date of Birth</label>
                    <input
                      type="date"
                      value={form.dob}
                      onChange={(e) => setForm({ ...form, dob: e.target.value })}
                      className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-primary-500 transition-colors [color-scheme:dark]"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1.5">Time of Birth</label>
                    <input
                      type="time"
                      value={form.time}
                      onChange={(e) => setForm({ ...form, time: e.target.value })}
                      className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-primary-500 transition-colors [color-scheme:dark]"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1.5">Place of Birth</label>
                  <input
                    type="text"
                    value={form.place}
                    onChange={(e) => setForm({ ...form, place: e.target.value })}
                    placeholder="Search city..."
                    className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-600 focus:outline-none focus:border-primary-500 transition-colors"
                  />
                  <p className="text-xs text-gray-600 mt-1">Start typing for city suggestions</p>
                </div>
                <button
                  onClick={handleGenerate}
                  disabled={generating || !form.name || !form.dob || !form.time || !form.place}
                  className="w-full py-3.5 rounded-xl bg-gradient-to-r from-primary-600 to-mystic-600 text-white font-semibold hover:from-primary-500 hover:to-mystic-500 transition-all glow disabled:opacity-50"
                >
                  {generating ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Generating Kundli...
                    </span>
                  ) : (
                    "Generate Kundli"
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Kundli Results */}
        {generated && (
          <div>
            {/* Profile summary */}
            <div className="glass-card p-6 mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-white">{form.name}</h2>
                <p className="text-sm text-gray-400">
                  {form.dob} at {form.time} &bull; {form.place}
                </p>
                <p className="text-xs text-gray-500 mt-1">Ascendant: Scorpio &bull; Moon Sign: Cancer &bull; Sun Sign: Leo</p>
              </div>
              <button
                onClick={() => { setGenerated(false); setForm({ name: "", dob: "", time: "", place: "" }); }}
                className="px-4 py-2 rounded-xl glass text-sm text-gray-400 hover:text-white hover:bg-white/10 transition-all"
              >
                New Kundli
              </button>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 mb-6 rounded-xl bg-white/5 p-1 overflow-x-auto">
              {tabs.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setActiveTab(t.id)}
                  className={`flex-shrink-0 flex-1 py-2.5 px-3 rounded-lg text-xs font-medium transition-all ${
                    activeTab === t.id
                      ? "bg-gradient-to-r from-primary-600 to-mystic-600 text-white"
                      : "text-gray-400 hover:text-white"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* Tab Content */}
            {activeTab === "chart" && (
              <div className="glass-card p-8 flex flex-col items-center">
                <h3 className="text-lg font-display font-bold text-gradient mb-6">Rashi Chart (D1)</h3>
                {/* Placeholder North Indian chart */}
                <div className="relative w-80 h-80 sm:w-96 sm:h-96">
                  <svg viewBox="0 0 400 400" className="w-full h-full">
                    {/* Outer square */}
                    <rect x="10" y="10" width="380" height="380" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="1.5" />
                    {/* Diagonals */}
                    <line x1="10" y1="10" x2="390" y2="390" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
                    <line x1="390" y1="10" x2="10" y2="390" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
                    {/* Inner diamond */}
                    <line x1="200" y1="10" x2="390" y2="200" stroke="rgba(255,255,255,0.1)" strokeWidth="1.5" />
                    <line x1="390" y1="200" x2="200" y2="390" stroke="rgba(255,255,255,0.1)" strokeWidth="1.5" />
                    <line x1="200" y1="390" x2="10" y2="200" stroke="rgba(255,255,255,0.1)" strokeWidth="1.5" />
                    <line x1="10" y1="200" x2="200" y2="10" stroke="rgba(255,255,255,0.1)" strokeWidth="1.5" />
                    {/* House numbers and planets */}
                    <text x="190" y="110" fill="rgba(217,70,239,0.6)" fontSize="11" fontFamily="sans-serif">Asc</text>
                    <text x="185" y="130" fill="rgba(255,255,255,0.7)" fontSize="10" fontFamily="sans-serif">Sc</text>
                    <text x="295" y="100" fill="rgba(255,255,255,0.5)" fontSize="10" fontFamily="sans-serif">Ju,Ke</text>
                    <text x="310" y="200" fill="rgba(255,255,255,0.5)" fontSize="10" fontFamily="sans-serif">Sa</text>
                    <text x="295" y="310" fill="rgba(255,255,255,0.5)" fontSize="10" fontFamily="sans-serif">Me</text>
                    <text x="60" y="310" fill="rgba(255,255,255,0.5)" fontSize="10" fontFamily="sans-serif">Ve</text>
                    <text x="55" y="100" fill="rgba(255,255,255,0.5)" fontSize="10" fontFamily="sans-serif">Su,Mo</text>
                    <text x="80" y="200" fill="rgba(255,255,255,0.5)" fontSize="10" fontFamily="sans-serif">Ma</text>
                    <text x="185" y="295" fill="rgba(255,255,255,0.5)" fontSize="10" fontFamily="sans-serif">Ra</text>
                  </svg>
                </div>
                <p className="text-xs text-gray-500 mt-4">North Indian style birth chart. Click on planets for details.</p>
              </div>
            )}

            {activeTab === "planets" && (
              <div className="glass-card overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-white/10">
                        <th className="text-left px-6 py-4 text-xs font-medium text-gray-400 uppercase">Planet</th>
                        <th className="text-left px-6 py-4 text-xs font-medium text-gray-400 uppercase">Sign</th>
                        <th className="text-left px-6 py-4 text-xs font-medium text-gray-400 uppercase">House</th>
                        <th className="text-left px-6 py-4 text-xs font-medium text-gray-400 uppercase">Degree</th>
                        <th className="text-left px-6 py-4 text-xs font-medium text-gray-400 uppercase">Nakshatra</th>
                        <th className="text-left px-6 py-4 text-xs font-medium text-gray-400 uppercase">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {mockPlanets.map((p) => (
                        <tr key={p.name} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                          <td className="px-6 py-3 font-medium text-white">{p.name}</td>
                          <td className="px-6 py-3 text-gray-300">{p.sign}</td>
                          <td className="px-6 py-3 text-gray-300">{p.house}</td>
                          <td className="px-6 py-3 text-gray-400">{p.degree}</td>
                          <td className="px-6 py-3 text-gray-400">{p.nakshatra}</td>
                          <td className="px-6 py-3">
                            <span className={`text-xs px-2 py-1 rounded-full ${
                              p.status === "Exalted" ? "bg-emerald-500/20 text-emerald-400" :
                              p.status === "Own Sign" ? "bg-primary-500/20 text-primary-400" :
                              "bg-white/5 text-gray-400"
                            }`}>
                              {p.status}
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
                {mockHouses.map((h) => (
                  <div key={h.house} className="glass-card p-5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-2 gap-2">
                      <h4 className="font-semibold text-white">{h.house}</h4>
                      <div className="flex gap-2">
                        <span className="text-xs px-2 py-1 rounded-full bg-mystic-500/20 text-mystic-400">{h.sign}</span>
                        <span className="text-xs px-2 py-1 rounded-full bg-primary-500/20 text-primary-400">Lord: {h.lord}</span>
                      </div>
                    </div>
                    <p className="text-xs text-gray-500 mb-1">{h.significance}</p>
                    <p className="text-sm text-gray-300">{h.interpretation}</p>
                  </div>
                ))}
              </div>
            )}

            {activeTab === "dasha" && (
              <div className="glass-card p-6">
                <h3 className="text-lg font-display font-bold text-gradient mb-4">Vimshottari Dasha</h3>
                {mockDasha.map((d) => (
                  <div key={d.planet}>
                    <div className="flex items-center gap-3 mb-4">
                      <span className="text-sm font-semibold text-white">Mahadasha: {d.planet}</span>
                      <span className="text-xs text-gray-500">{d.period}</span>
                    </div>
                    <div className="space-y-2">
                      {d.sub.map((s) => (
                        <div
                          key={s.planet}
                          className={`flex items-center justify-between p-3 rounded-xl ${
                            s.status === "active"
                              ? "bg-gradient-to-r from-primary-600/20 to-mystic-600/20 border border-primary-500/30"
                              : s.status === "completed"
                              ? "bg-white/3"
                              : "bg-white/5"
                          }`}
                        >
                          <span className={`text-sm ${s.status === "active" ? "text-white font-medium" : "text-gray-400"}`}>
                            {s.planet}
                          </span>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-500">{s.period}</span>
                            {s.status === "active" && (
                              <span className="text-xs px-2 py-0.5 rounded-full bg-primary-500/30 text-primary-300">Current</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {activeTab === "yogas" && (
              <div className="space-y-4">
                {mockYogas.map((y) => (
                  <div key={y.name} className="glass-card p-5">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-semibold text-white">{y.name}</h4>
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        y.strength === "Strong" ? "bg-emerald-500/20 text-emerald-400" : "bg-accent-500/20 text-accent-400"
                      }`}>
                        {y.strength}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mb-1">Formed by: {y.planets}</p>
                    <p className="text-sm text-gray-300">{y.effect}</p>
                  </div>
                ))}
              </div>
            )}

            {activeTab === "doshas" && (
              <div className="space-y-4">
                {mockDoshas.map((d) => (
                  <div key={d.name} className="glass-card p-5">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-semibold text-white">{d.name}</h4>
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        d.status === "Absent" ? "bg-emerald-500/20 text-emerald-400" :
                        d.status === "Mild" ? "bg-accent-500/20 text-accent-400" :
                        "bg-red-500/20 text-red-400"
                      }`}>
                        {d.status}
                      </span>
                    </div>
                    <p className="text-sm text-gray-300 mb-2">{d.description}</p>
                    <div className="p-3 rounded-lg bg-white/3">
                      <p className="text-xs text-gray-400"><span className="text-primary-400 font-medium">Remedy:</span> {d.remedy}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
