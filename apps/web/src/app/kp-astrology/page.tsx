"use client";

import React, { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useTranslation } from "@/i18n";
import { useAuthStore } from "@/lib/store";

interface KPResult {
  system: string;
  cusps: { cusp: number; sign: string; nakshatra: string; starLord: string; subLord: string; longitude: number }[];
  planets: { planet: string; sign: string; nakshatra: string; starLord: string; subLord: string; degree: number }[];
  significators: Record<number, string[]>;
}

export default function KPAstrologyPage() {
  const { t, locale } = useTranslation();
  const [form, setForm] = useState({ dateOfBirth: "", timeOfBirth: "", placeOfBirth: "", latitude: "", longitude: "" });
  const [result, setResult] = useState<KPResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [prefilled, setPrefilled] = useState(false);
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    if (!user) return;
    setForm((prev) => {
      const next = {
        dateOfBirth: prev.dateOfBirth || user.dateOfBirth || "",
        timeOfBirth: prev.timeOfBirth || user.timeOfBirth || "",
        placeOfBirth: prev.placeOfBirth || user.placeOfBirth || "",
        latitude: prev.latitude,
        longitude: prev.longitude,
      };
      const didPrefill = Boolean(
        (user.dateOfBirth && !prev.dateOfBirth) ||
          (user.timeOfBirth && !prev.timeOfBirth) ||
          (user.placeOfBirth && !prev.placeOfBirth),
      );
      if (didPrefill) setPrefilled(true);
      return next;
    });
  }, [user]);

  const generate = async () => {
    if (!form.dateOfBirth || !form.timeOfBirth || !form.placeOfBirth) { setError(t.form.fillAllFields); return; }
    setLoading(true); setError(""); setResult(null);
    try {
      const data = await api.post<KPResult>("/astrology/kp-chart", {
        ...form,
        latitude: form.latitude ? parseFloat(form.latitude) : undefined,
        longitude: form.longitude ? parseFloat(form.longitude) : undefined,
        locale,
      });
      setResult(data);
    } catch (err: any) { setError(err.message || t.kp.generateFailed); } finally { setLoading(false); }
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 fade-in-up">
      <h1 className="text-3xl font-bold text-white mb-2">{t.kp.title}</h1>
      <p className="text-white/40 mb-8">{t.kp.description}</p>

      <div className="surface-card p-6 mb-6">
        {prefilled && (
          <div className="mb-4 p-3 rounded-xl bg-primary-500/10 border border-primary-500/20 text-primary-300 text-xs flex items-center gap-2">
            <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{t.common.usingProfileDetails}</span>
          </div>
        )}
        <div className="grid sm:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="text-sm text-white/60 mb-1 block">{t.form.dateOfBirth}</label>
            <input type="date" value={form.dateOfBirth} onChange={(e) => setForm({ ...form, dateOfBirth: e.target.value })} className="w-full px-4 py-3 rounded-xl surface-input" />
          </div>
          <div>
            <label className="text-sm text-white/60 mb-1 block">{t.form.timeOfBirth}</label>
            <input type="time" value={form.timeOfBirth} onChange={(e) => setForm({ ...form, timeOfBirth: e.target.value })} className="w-full px-4 py-3 rounded-xl surface-input" />
          </div>
          <div>
            <label className="text-sm text-white/60 mb-1 block">{t.form.placeOfBirth}</label>
            <input type="text" value={form.placeOfBirth} onChange={(e) => setForm({ ...form, placeOfBirth: e.target.value })} placeholder={t.form.placePlaceholder} className="w-full px-4 py-3 rounded-xl surface-input" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-sm text-white/60 mb-1 block">{t.form.latitude}</label>
              <input type="number" step="any" value={form.latitude} onChange={(e) => setForm({ ...form, latitude: e.target.value })} placeholder="28.61" className="w-full px-4 py-3 rounded-xl surface-input" />
            </div>
            <div>
              <label className="text-sm text-white/60 mb-1 block">{t.form.longitude}</label>
              <input type="number" step="any" value={form.longitude} onChange={(e) => setForm({ ...form, longitude: e.target.value })} placeholder="77.20" className="w-full px-4 py-3 rounded-xl surface-input" />
            </div>
          </div>
        </div>
        <button onClick={generate} disabled={loading} className="w-full py-3 rounded-xl btn-primary text-sm font-medium disabled:opacity-50">
          {loading ? t.kp.generating : t.kp.generateChart}
        </button>
      </div>

      {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

      {result && (
        <div className="space-y-6">
          <div className="surface-card p-6">
            <h3 className="text-lg font-semibold text-white mb-4">{t.kp.cuspTable}</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-white/40 border-b border-white/[0.06]">
                  <th className="text-left py-2 px-2">{t.kp.cusp}</th><th className="text-left py-2 px-2">{t.kp.sign}</th><th className="text-left py-2 px-2">{t.kp.nakshatra}</th><th className="text-left py-2 px-2">{t.kp.starLord}</th><th className="text-left py-2 px-2">{t.kp.subLord}</th><th className="text-right py-2 px-2">{t.kp.longitude}</th>
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
            <h3 className="text-lg font-semibold text-white mb-4">{t.kp.planetPositions}</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-white/40 border-b border-white/[0.06]">
                  <th className="text-left py-2 px-2">{t.kp.planet}</th><th className="text-left py-2 px-2">{t.kp.sign}</th><th className="text-left py-2 px-2">{t.kp.nakshatra}</th><th className="text-left py-2 px-2">{t.kp.starLord}</th><th className="text-left py-2 px-2">{t.kp.subLord}</th><th className="text-right py-2 px-2">{t.kp.degree}</th>
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
            <h3 className="text-lg font-semibold text-white mb-4">{t.kp.houseSignificators}</h3>
            <div className="grid sm:grid-cols-3 gap-3">
              {Object.entries(result.significators).map(([house, planets]) => (
                <div key={house} className="bg-white/[0.03] rounded-lg p-3">
                  <div className="text-sm font-medium text-primary-400">{t.kp.house} {house}</div>
                  <div className="text-xs text-white/60 mt-1">{(planets as string[]).length > 0 ? (planets as string[]).join(", ") : t.kp.none}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
