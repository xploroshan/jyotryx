"use client";

import React, { useState } from "react";
import { api } from "@/lib/api";
import { useTranslation } from "@/i18n";
import SavedBirthDetails, { type BirthDetailsValue } from "@/components/ui/SavedBirthDetails";
import Interpretation from "@/components/interpretation/Interpretation";

interface KPResult {
  system: string;
  cusps: { cusp: number; sign: string; nakshatra: string; starLord: string; subLord: string; longitude: number }[];
  planets: { planet: string; sign: string; nakshatra: string; starLord: string; subLord: string; degree: number }[];
  significators: Record<number, string[]>;
}

export default function KPAstrologyPage() {
  const { t, locale } = useTranslation();
  const [birth, setBirth] = useState<BirthDetailsValue>({ dateOfBirth: "", timeOfBirth: "", placeOfBirth: "" });
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [result, setResult] = useState<KPResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const generate = async () => {
    if (!birth.dateOfBirth || !birth.timeOfBirth || !birth.placeOfBirth) { setError(t.form.fillAllFields); return; }
    setLoading(true); setError(""); setResult(null);
    try {
      const data = await api.post<KPResult>("/astrology/kp-chart", {
        ...birth,
        // Manual lat/lng is an advanced override; otherwise use the coordinates
        // captured when the birthplace was picked from the autocomplete.
        latitude: latitude ? parseFloat(latitude) : birth.latitude,
        longitude: longitude ? parseFloat(longitude) : birth.longitude,
        locale,
      });
      setResult(data);
    } catch (err: any) { setError(err.message || t.kp.generateFailed); } finally { setLoading(false); }
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 fade-in-up">
      <h1 className="text-3xl font-bold text-surface-950 mb-2">{t.kp.title}</h1>
      <p className="text-[rgba(12,8,5,0.66)] mb-8">{t.kp.description}</p>

      <div className="surface-card p-6 mb-6">
        <div className="mb-4">
          <SavedBirthDetails value={birth} onChange={setBirth} idPrefix="kp" />
        </div>
        <div className="grid grid-cols-2 gap-2 mb-4">
          <div>
            <label htmlFor="kp-latitude" className="text-sm text-secondary mb-1 block">{t.form.latitude}</label>
            <input id="kp-latitude" type="number" step="any" value={latitude} onChange={(e) => setLatitude(e.target.value)} placeholder="28.61" className="w-full px-4 py-3 rounded-xl surface-input" />
          </div>
          <div>
            <label htmlFor="kp-longitude" className="text-sm text-secondary mb-1 block">{t.form.longitude}</label>
            <input id="kp-longitude" type="number" step="any" value={longitude} onChange={(e) => setLongitude(e.target.value)} placeholder="77.20" className="w-full px-4 py-3 rounded-xl surface-input" />
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
            <h3 className="text-lg font-semibold text-surface-950 mb-4">{t.kp.cuspTable}</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-[rgba(12,8,5,0.66)] border-b border-[rgba(12,8,5,0.08)]">
                  <th className="text-left py-2 px-2">{t.kp.cusp}</th><th className="text-left py-2 px-2">{t.kp.sign}</th><th className="text-left py-2 px-2">{t.kp.nakshatra}</th><th className="text-left py-2 px-2">{t.kp.starLord}</th><th className="text-left py-2 px-2">{t.kp.subLord}</th><th className="text-right py-2 px-2">{t.kp.longitude}</th>
                </tr></thead>
                <tbody>
                  {result.cusps.map((c) => (
                    <tr key={c.cusp} className="border-b border-[rgba(12,8,5,0.08)] text-emphasis">
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
            <h3 className="text-lg font-semibold text-surface-950 mb-4">{t.kp.planetPositions}</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-[rgba(12,8,5,0.66)] border-b border-[rgba(12,8,5,0.08)]">
                  <th className="text-left py-2 px-2">{t.kp.planet}</th><th className="text-left py-2 px-2">{t.kp.sign}</th><th className="text-left py-2 px-2">{t.kp.nakshatra}</th><th className="text-left py-2 px-2">{t.kp.starLord}</th><th className="text-left py-2 px-2">{t.kp.subLord}</th><th className="text-right py-2 px-2">{t.kp.degree}</th>
                </tr></thead>
                <tbody>
                  {result.planets.map((p) => (
                    <tr key={p.planet} className="border-b border-[rgba(12,8,5,0.08)] text-emphasis">
                      <td className="py-2 px-2 font-medium text-surface-950">{p.planet}</td>
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
            <h3 className="text-lg font-semibold text-surface-950 mb-4">{t.kp.houseSignificators}</h3>
            <div className="grid sm:grid-cols-3 gap-3">
              {Object.entries(result.significators).map(([house, planets]) => (
                <div key={house} className="bg-[rgba(255,252,245,0.78)] rounded-lg p-3">
                  <div className="text-sm font-medium text-primary-400">{t.kp.house} {house}</div>
                  <div className="text-xs text-secondary mt-1">{(planets as string[]).length > 0 ? (planets as string[]).join(", ") : t.kp.none}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {result && (
        <Interpretation
          domain="kp"
          className="mt-6"
          input={{
            cusps: result.cusps?.slice(0, 12).map((c) => ({
              cusp: c.cusp,
              sign: c.sign,
              starLord: c.starLord,
              subLord: c.subLord,
            })),
          }}
        />
      )}
    </div>
  );
}
