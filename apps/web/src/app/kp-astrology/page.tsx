"use client";

import React, { useState } from "react";
import { api } from "@/lib/api";

interface KPResult {
  system: string;
  cusps: { cusp: number; sign: string; nakshatra: string; starLord: string; subLord: string; longitude: number }[];
  planets: { planet: string; sign: string; nakshatra: string; starLord: string; subLord: string; degree: number }[];
  significators: Record<number, string[]>;
}

export default function KPAstrologyPage() {
  const [form, setForm] = useState({ dateOfBirth: "", timeOfBirth: "", placeOfBirth: "", latitude: "", longitude: "" });
  const [result, setResult] = useState<KPResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const generate = async () => {
    if (!form.dateOfBirth || !form.timeOfBirth || !form.placeOfBirth) { setError("Please fill all fields"); return; }
    setLoading(true); setError(""); setResult(null);
    try {
      const data = await api.post<KPResult>("/astrology/kp-chart", {
        ...form,
        latitude: form.latitude ? parseFloat(form.latitude) : undefined,
        longitude: form.longitude ? parseFloat(form.longitude) : undefined,
      });
      setResult(data);
    } catch (err: any) { setError(err.message || "Failed to generate KP chart"); } finally { setLoading(false); }
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="text-3xl font-bold text-white mb-2">KP Astrology</h1>
      <p className="text-white/40 mb-8">Krishnamurti Paddhati system with Placidus cusps and sub-lord analysis</p>

      <div className="surface-card p-6 mb-6">
        <div className="grid sm:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="text-sm text-white/60 mb-1 block">Date of Birth</label>
            <input type="date" value={form.dateOfBirth} onChange={(e) => setForm({ ...form, dateOfBirth: e.target.value })} className="w-full px-4 py-3 rounded-xl surface-input" />
          </div>
          <div>
            <label className="text-sm text-white/60 mb-1 block">Time of Birth</label>
            <input type="time" value={form.timeOfBirth} onChange={(e) => setForm({ ...form, timeOfBirth: e.target.value })} className="w-full px-4 py-3 rounded-xl surface-input" />
          </div>
          <div>
            <label className="text-sm text-white/60 mb-1 block">Place of Birth</label>
            <input type="text" value={form.placeOfBirth} onChange={(e) => setForm({ ...form, placeOfBirth: e.target.value })} placeholder="City, Country" className="w-full px-4 py-3 rounded-xl surface-input" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-sm text-white/60 mb-1 block">Latitude</label>
              <input type="number" step="any" value={form.latitude} onChange={(e) => setForm({ ...form, latitude: e.target.value })} placeholder="28.61" className="w-full px-4 py-3 rounded-xl surface-input" />
            </div>
            <div>
              <label className="text-sm text-white/60 mb-1 block">Longitude</label>
              <input type="number" step="any" value={form.longitude} onChange={(e) => setForm({ ...form, longitude: e.target.value })} placeholder="77.20" className="w-full px-4 py-3 rounded-xl surface-input" />
            </div>
          </div>
        </div>
        <button onClick={generate} disabled={loading} className="w-full py-3 rounded-xl btn-primary text-sm font-medium disabled:opacity-50">
          {loading ? "Generating..." : "Generate KP Chart"}
        </button>
      </div>

      {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

      {result && (
        <div className="space-y-6">
          <div className="surface-card p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Cusp Table</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-white/40 border-b border-white/[0.06]">
                  <th className="text-left py-2 px-2">Cusp</th><th className="text-left py-2 px-2">Sign</th><th className="text-left py-2 px-2">Nakshatra</th><th className="text-left py-2 px-2">Star Lord</th><th className="text-left py-2 px-2">Sub Lord</th><th className="text-right py-2 px-2">Longitude</th>
                </tr></thead>
                <tbody>
                  {result.cusps.map((c) => (
                    <tr key={c.cusp} className="border-b border-white/[0.03] text-white/70">
                      <td className="py-2 px-2 font-medium text-primary-400">{c.cusp}</td>
                      <td className="py-2 px-2">{c.sign}</td>
                      <td className="py-2 px-2">{c.nakshatra}</td>
                      <td className="py-2 px-2">{c.starLord}</td>
                      <td className="py-2 px-2 text-accent-400">{c.subLord}</td>
                      <td className="py-2 px-2 text-right">{c.longitude.toFixed(2)}°</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="surface-card p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Planet Positions</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-white/40 border-b border-white/[0.06]">
                  <th className="text-left py-2 px-2">Planet</th><th className="text-left py-2 px-2">Sign</th><th className="text-left py-2 px-2">Nakshatra</th><th className="text-left py-2 px-2">Star Lord</th><th className="text-left py-2 px-2">Sub Lord</th><th className="text-right py-2 px-2">Degree</th>
                </tr></thead>
                <tbody>
                  {result.planets.map((p) => (
                    <tr key={p.planet} className="border-b border-white/[0.03] text-white/70">
                      <td className="py-2 px-2 font-medium text-white">{p.planet}</td>
                      <td className="py-2 px-2">{p.sign}</td>
                      <td className="py-2 px-2">{p.nakshatra}</td>
                      <td className="py-2 px-2">{p.starLord}</td>
                      <td className="py-2 px-2 text-accent-400">{p.subLord}</td>
                      <td className="py-2 px-2 text-right">{p.degree.toFixed(2)}°</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="surface-card p-6">
            <h3 className="text-lg font-semibold text-white mb-4">House Significators</h3>
            <div className="grid sm:grid-cols-3 gap-3">
              {Object.entries(result.significators).map(([house, planets]) => (
                <div key={house} className="bg-white/[0.03] rounded-lg p-3">
                  <div className="text-sm font-medium text-primary-400">House {house}</div>
                  <div className="text-xs text-white/60 mt-1">{(planets as string[]).length > 0 ? (planets as string[]).join(", ") : "None"}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
