"use client";

import React, { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useTranslation } from "@/i18n";
import { useAuthStore } from "@/lib/store";

interface DivisionalResult {
  type: string;
  divisor: number;
  positions: { planet: string; sign: string; degree: number }[];
}

export default function DivisionalPage() {
  const { t, locale } = useTranslation();
  const [chartType, setChartType] = useState("9");
  const [form, setForm] = useState({ dateOfBirth: "", timeOfBirth: "", placeOfBirth: "", latitude: "", longitude: "" });
  const [result, setResult] = useState<DivisionalResult | null>(null);
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

  const CHART_TYPES = [
    { value: "9", label: t.divisional.d9, description: t.divisional.d9Desc },
    { value: "10", label: t.divisional.d10, description: t.divisional.d10Desc },
  ];

  const generate = async () => {
    if (!form.dateOfBirth || !form.timeOfBirth || !form.placeOfBirth) { setError(t.form.fillAllFields); return; }
    setLoading(true); setError(""); setResult(null);
    try {
      const data = await api.post<DivisionalResult>(`/astrology/divisional/${chartType}`, {
        ...form,
        latitude: form.latitude ? parseFloat(form.latitude) : undefined,
        longitude: form.longitude ? parseFloat(form.longitude) : undefined,
        locale,
      });
      setResult(data);
    } catch (err: any) { setError(err.message || t.divisional.generateFailed); } finally { setLoading(false); }
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 fade-in-up">
      <h1 className="text-3xl font-bold text-surface-900 mb-2">{t.divisional.title}</h1>
      <p className="text-surface-900/40 mb-8">{t.divisional.description}</p>

      <div className="surface-card p-6 mb-6">
        {prefilled && (
          <div className="mb-4 p-3 rounded-xl bg-primary-500/10 border border-primary-500/20 text-primary-700 text-xs flex items-center gap-2">
            <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{t.common.usingProfileDetails}</span>
          </div>
        )}
        {/* Chart Type */}
        <div className="mb-4">
          <label className="text-sm text-surface-900/60 mb-2 block">{t.divisional.chartType}</label>
          <div className="grid grid-cols-2 gap-3">
            {CHART_TYPES.map((ct) => (
              <button key={ct.value} onClick={() => setChartType(ct.value)} className={`p-3 rounded-xl text-left transition-all ${chartType === ct.value ? "bg-primary-600/15 border border-primary-500/40" : "bg-surface-900/[0.03] border border-surface-900/[0.06]"}`}>
                <div className="text-sm font-semibold text-surface-900">{ct.label}</div>
                <div className="text-xs text-surface-900/40 mt-0.5">{ct.description}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Birth Details */}
        <div className="grid sm:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="text-sm text-surface-900/60 mb-1 block">{t.form.dateOfBirth}</label>
            <input type="date" value={form.dateOfBirth} onChange={(e) => setForm({ ...form, dateOfBirth: e.target.value })} className="w-full px-4 py-3 rounded-xl surface-input" />
          </div>
          <div>
            <label className="text-sm text-surface-900/60 mb-1 block">{t.form.timeOfBirth}</label>
            <input type="time" value={form.timeOfBirth} onChange={(e) => setForm({ ...form, timeOfBirth: e.target.value })} className="w-full px-4 py-3 rounded-xl surface-input" />
          </div>
          <div>
            <label className="text-sm text-surface-900/60 mb-1 block">{t.form.placeOfBirth}</label>
            <input type="text" value={form.placeOfBirth} onChange={(e) => setForm({ ...form, placeOfBirth: e.target.value })} placeholder={t.form.placePlaceholder} className="w-full px-4 py-3 rounded-xl surface-input" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-sm text-surface-900/60 mb-1 block">{t.form.latitude}</label>
              <input type="number" step="any" value={form.latitude} onChange={(e) => setForm({ ...form, latitude: e.target.value })} placeholder="28.61" className="w-full px-4 py-3 rounded-xl surface-input" />
            </div>
            <div>
              <label className="text-sm text-surface-900/60 mb-1 block">{t.form.longitude}</label>
              <input type="number" step="any" value={form.longitude} onChange={(e) => setForm({ ...form, longitude: e.target.value })} placeholder="77.20" className="w-full px-4 py-3 rounded-xl surface-input" />
            </div>
          </div>
        </div>

        <button onClick={generate} disabled={loading} className="w-full py-3 rounded-xl btn-primary text-sm font-medium disabled:opacity-50">
          {loading ? t.divisional.generating : t.divisional.generateChart}
        </button>
      </div>

      {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

      {result && (
        <div className="surface-card p-6">
          <h3 className="text-lg font-semibold text-surface-900 mb-4">{result.type} {t.divisional.chartLabel}</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-surface-900/40 border-b border-surface-900/[0.06]">
                  <th className="text-left py-2 px-3">{t.divisional.planet}</th>
                  <th className="text-left py-2 px-3">{t.divisional.sign}</th>
                  <th className="text-right py-2 px-3">{t.divisional.degree}</th>
                </tr>
              </thead>
              <tbody>
                {result.positions.map((p) => (
                  <tr key={p.planet} className="border-b border-surface-900/[0.03] text-surface-900/70">
                    <td className="py-2 px-3 font-medium text-surface-900">{p.planet}</td>
                    <td className="py-2 px-3 text-accent-400">{p.sign}</td>
                    <td className="py-2 px-3 text-right">{p.degree.toFixed(2)}°</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
