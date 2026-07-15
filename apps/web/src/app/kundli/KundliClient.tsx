"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslation } from "@/i18n";
import { Gift } from "lucide-react";
import type { TranslationKeys } from "@/i18n";
import { useAuthStore } from "@/lib/store";
import { RequiredMark } from "@/components/ui/RequiredMark";
import { PlaceAutocomplete, type PlaceCoords } from "@/components/ui/PlaceAutocomplete";
import { ScrollableRow } from "@/components/ui/ScrollableRow";
import { usePaywallVariant, recordPaywallConversion } from "@/lib/experiment";
import { track, trackOnce } from "@/lib/analytics";
import { NorthIndianChart } from "@/components/kundli/NorthIndianChart";
import { SouthIndianChart } from "@/components/kundli/SouthIndianChart";
import { orderPlanets } from "@/components/kundli/chart-common";
import { ShowYourWork, type ChartFactor } from "@/components/transparency/ShowYourWork";
import Interpretation from "@/components/interpretation/Interpretation";
import { type RemedyTempleSet } from "@/components/remedies/Remedies";
import Mitigation, { type MitigationPlan } from "@/components/mitigation/Mitigation";

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
    /** Essential-dignity / friendship label (Exalted, Own Sign, Friendly, …). */
    status?: string;
    /** Baladi Avastha — the planet's degree-based "age" (Bala…Mrita). */
    avastha?: string;
    /** True when the planet is combust (too close to the Sun). */
    isCombust?: boolean;
    /** Bhava Chalit (Sripati) house, 1–12. May differ from the whole-sign house. */
    bhava?: number;
  }[];
  dashas: {
    planet: string;
    startDate: string;
    endDate: string;
    subPeriods?: { planet: string; startDate: string; endDate: string }[];
  }[];
  yogas: { name: string; description: string; effect: string }[];
  divisionalCharts?: {
    D9?: DivisionalChart;
    D10?: DivisionalChart;
  };
  factors?: ChartFactor[];
}

interface DivisionalChart {
  ascendant: string;
  houses: { house: number; sign: string; planets: string[] }[];
  planetaryPositions: {
    planet: string;
    sign: string;
    house: number;
    degree: number;
    isRetrograde: boolean;
  }[];
}

interface DoshaData {
  doshas: {
    key?: string;
    name: string;
    present: boolean;
    severity: string;
    description: string;
    remedies: string[];
    remedyTemples?: RemedyTempleSet;
    mitigation?: MitigationPlan;
  }[];
  factors?: ChartFactor[];
}

export default function KundliPage() {
  const { t, locale } = useTranslation();
  const user = useAuthStore((s) => s.user);
  // SEO landing pages at /kundli/[city] deep-link here with `?place=`
  // pre-filled. Picking this up here means the user lands on the form
  // with the place-of-birth field already set, and only has to fill in
  // name + DOB + time. We treat the param as a hint only — the user
  // can still edit the place freely.
  const searchParams = useSearchParams();
  const placeFromQuery = searchParams.get("place")?.trim() || "";
  // Kundli is a Vedic-specific feature. Other traditions have their own
  // dedicated feature pages (Western Natal, Chinese BaZi, …) surfaced via
  // the tradition rail, so there's no in-page tradition switcher here.
  const activeTradition = "VEDIC" as const;

  const tabs = [
    { id: "chart", label: t.kundli.birthChart },
    { id: "planets", label: t.kundli.planetaryDetails },
    { id: "houses", label: t.kundli.houseAnalysis },
    { id: "dasha", label: t.kundli.dashaPeriods },
    { id: "yogas", label: t.kundli.yogas },
    { id: "doshas", label: t.kundli.doshasTab },
    { id: "transparency", label: t.showYourWork.tab },
  ];

  const [activeTab, setActiveTab] = useState("chart");
  // North vs South Indian Rashi chart style (like AstroTalk's toggle).
  const [chartStyle, setChartStyle] = useState<"north" | "south">("north");
  const [kundli, setKundli] = useState<KundliData | null>(null);
  const [doshas, setDoshas] = useState<DoshaData | null>(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ name: "", dob: "", time: "", place: "" });
  // Coordinates captured when the birthplace is picked from the autocomplete.
  // Null for a name typed by hand or prefilled from the profile — the API then
  // backfills the signed-in user's own stored coordinates for a self-chart.
  const [placeCoords, setPlaceCoords] = useState<PlaceCoords | null>(null);
  const [prefilled, setPrefilled] = useState(false);

  // "Show Your Work": merge the deterministic factors the API returns for the
  // chart with those from the dosha analysis so the transparency tab presents
  // a single, unified list of the reasons behind the reading.
  const factors: ChartFactor[] = [
    ...(kundli?.factors ?? []),
    ...(doshas?.factors ?? []),
  ];

  // Prepopulate from user profile when available
  useEffect(() => {
    if (!user) return;
    setForm((prev) => {
      const next = {
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
      if (didPrefill) setPrefilled(true);
      return next;
    });
  }, [user]);

  // Pre-fill the place from the SEO landing page deep-link. Runs once
  // and only writes if the field is still empty, so it doesn't fight
  // the user-profile prefill above or stomp on what the user typed.
  useEffect(() => {
    if (!placeFromQuery) return;
    setForm((prev) => (prev.place ? prev : { ...prev, place: placeFromQuery }));
  }, [placeFromQuery]);

  // Paywall A/B variant: the "first_free" treatment shows a banner
  // promising the first kundli at zero credit cost. The actual credit
  // grant is server-side; the UI just messages it. Until the variant
  // resolves we render nothing so we don't flash the wrong copy.
  const paywall = usePaywallVariant();

  // Surface which specific fields are missing so the disabled Generate button
  // is self-explanatory — previously it was a silent `disabled` with no clue.
  const missingFields: string[] = [];
  if (!form.name.trim()) missingFields.push(t.kundli.fullName);
  if (!form.dob) missingFields.push(t.form.dateOfBirth);
  if (!form.time) missingFields.push(t.form.timeOfBirth);
  if (!form.place.trim()) missingFields.push(t.form.placeOfBirth);

  const handleGenerate = async () => {
    if (!form.name || !form.dob || !form.time || !form.place) return;
    setGenerating(true);
    setError("");
    try {
      const token = useAuthStore.getState().accessToken;
      if (token) {
        const { api } = await import("@/lib/api");
        // Run kundli + dosha fetches in parallel to cut wait time roughly in half.
        const [result, doshaResult] = await Promise.all([
          api.post<KundliData>(
            "/astrology/kundli",
            {
              dateOfBirth: form.dob,
              timeOfBirth: form.time,
              placeOfBirth: form.place,
              latitude: placeCoords?.lat,
              longitude: placeCoords?.lng,
              locale,
              tradition: activeTradition,
            },
            { token },
          ),
          activeTradition === "VEDIC"
            ? api.get<DoshaData>("/astrology/dosha", { token }).catch(() => null)
            : Promise.resolve(null),
        ]);
        setKundli(result);
        if (doshaResult) setDoshas(doshaResult);
        // First successful paid kundli is the conversion the paywall
        // A/B test optimises for. Backend dedupes, so firing on every
        // successful generation is safe and gives us a "user did pay"
        // signal even when the credit balance was already > 0.
        void recordPaywallConversion("first_paid_kundli");
        trackOnce("first_reading", "first_reading", { surface: "kundli" });
        track("kundli_generated", { tradition: activeTradition });
      } else {
        setError(t.kundli.loginRequired);
      }
    } catch (err: any) {
      setError(err.message || t.kundli.generateFailed);
    } finally {
      setGenerating(false);
    }
  };

  // NOTE: the page H1 (FeatureHeader) is rendered by the SERVER wrappers in
  // page.tsx / [locale]/kundli/page.tsx — this whole component sits inside a
  // <Suspense fallback={null}> (it reads ?place= via useSearchParams), so
  // anything rendered here is ABSENT from the crawler-visible initial HTML.
  return (
    <div>
      <div className="relative mx-auto max-w-6xl px-4 py-10 sm:py-14 fade-in-up">
        {/* Birth Details Form */}
        {!kundli && (
          <div className="max-w-lg mx-auto">
            <div className="surface-card p-8">
              <h2 className="text-lg font-bold text-surface-950 mb-6">{t.kundli.enterBirthDetails}</h2>

              {/* Paywall A/B variant banner — only the "first_free"
                  treatment shows it, and only after the variant is
                  resolved (no flash of the wrong copy). Both variants
                  hit the same /astrology/kundli endpoint; the paid-vs-
                  free framing is purely the user-facing message. */}
              {!paywall.loading && paywall.variant === "first_free" && (
                <div className="mb-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-200 text-xs flex items-start gap-2">
                  <Gift aria-hidden size={16} strokeWidth={1.8} className="mt-0.5 shrink-0" />
                  <span>
                    Your first kundli is on us — no credits required. Just fill in your birth
                    details and you'll have your full Vedic chart in seconds.
                  </span>
                </div>
              )}

              {prefilled && (
                <div className="mb-4 p-3 rounded-xl bg-primary-500/10 border border-primary-500/20 text-primary-300 text-xs flex items-center gap-2">
                  <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>{t.common.usingProfileDetails}</span>
                </div>
              )}

              {error && (
                <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">{error}</div>
              )}

              <div className="space-y-4">
                <div>
                  <label htmlFor="kundli-name" className="flex items-center text-sm text-emphasis mb-1.5">{t.kundli.fullName}<RequiredMark /></label>
                  <input
                    id="kundli-name"
                    type="text"
                    autoComplete="name"
                    required
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder={t.kundli.enterName}
                    className="w-full px-4 py-3 rounded-xl surface-input"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="kundli-dob" className="flex items-center text-sm text-emphasis mb-1.5">{t.form.dateOfBirth}<RequiredMark /></label>
                    <input
                      id="kundli-dob"
                      type="date"
                      required
                      value={form.dob}
                      onChange={(e) => setForm({ ...form, dob: e.target.value })}
                      className="w-full px-4 py-3 rounded-xl surface-input [color-scheme:dark]"
                    />
                  </div>
                  <div>
                    <label htmlFor="kundli-tob" className="flex items-center text-sm text-emphasis mb-1.5">{t.form.timeOfBirth}<RequiredMark /></label>
                    <input
                      id="kundli-tob"
                      type="time"
                      required
                      value={form.time}
                      onChange={(e) => setForm({ ...form, time: e.target.value })}
                      className="w-full px-4 py-3 rounded-xl surface-input [color-scheme:dark]"
                    />
                  </div>
                </div>
                <div>
                  <label htmlFor="kundli-pob" className="flex items-center text-sm text-emphasis mb-1.5">{t.form.placeOfBirth}<RequiredMark /></label>
                  <PlaceAutocomplete
                    id="kundli-pob"
                    required
                    value={form.place}
                    coords={placeCoords}
                    onChange={(name, coords) => { setForm((f) => ({ ...f, place: name })); setPlaceCoords(coords); }}
                    placeholder={t.kundli.searchCity}
                    aria-describedby="kundli-pob-hint"
                  />
                  <p id="kundli-pob-hint" className="text-xs text-[rgba(12,8,5,0.72)] mt-1">{t.kundli.birthCityNote}</p>
                </div>
                {missingFields.length > 0 && (
                  <p id="kundli-generate-hint" className="text-[11px] text-secondary -mt-1">
                    Fill in {missingFields.join(", ")} to continue.
                  </p>
                )}
                <button
                  onClick={handleGenerate}
                  disabled={generating || missingFields.length > 0}
                  aria-describedby={missingFields.length > 0 ? "kundli-generate-hint" : undefined}
                  className="focus-ring w-full py-3.5 rounded-xl btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
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
                {/* SEO city directory link — gives indexable internal-link
                    juice to the static landing pages and gives users an
                    alternate entry point if they're browsing for a
                    specific city's content rather than filling the form. */}
                <p className="mt-3 text-xs text-[rgba(12,8,5,0.66)] text-center">
                  Or browse{' '}
                  <Link href="/kundli/cities" className="text-primary-300 hover:text-primary-300">
                    free Kundli pages by city
                  </Link>
                  .
                </p>
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
                <h2 className="text-lg font-bold text-surface-950">{form.name}</h2>
                <p className="text-sm text-[rgba(12,8,5,0.66)]">
                  {form.dob} at {form.time} &bull; {form.place}
                </p>
                <p className="text-xs text-[rgba(12,8,5,0.66)] mt-1">
                  {t.kundli.ascendant}: <span className="text-primary-400">{kundli.ascendant}</span> &bull;
                  {t.kundli.moonSign}: <span className="text-primary-400">{kundli.moonSign}</span> &bull;
                  {t.kundli.sunSign}: <span className="text-primary-400">{kundli.sunSign}</span> &bull;
                  {t.kundli.nakshatra}: <span className="text-primary-400">{kundli.nakshatra}</span>
                </p>
              </div>
              <button
                onClick={() => { setKundli(null); setDoshas(null); setForm({ name: "", dob: "", time: "", place: "" }); setError(""); }}
                className="focus-ring px-4 py-2 rounded-xl btn-secondary text-sm"
              >
                {t.kundli.newKundli}
              </button>
            </div>

            {/* Tabs — on mobile scroll horizontally so all 6 stay reachable;
                on md+ they stretch to equal widths. */}
            <ScrollableRow
              className="mb-6 rounded-xl bg-[rgba(255,252,245,0.78)] p-1"
              innerClassName="snap-x"
              fadeColor="rgb(255, 252, 245)"
              controls={false}
            >
              <div role="tablist" aria-label={t.kundli.birthChart} className="flex gap-1">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    role="tab"
                    aria-selected={activeTab === tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`focus-ring flex-shrink-0 snap-start md:flex-1 py-2.5 px-4 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                      activeTab === tab.id
                        ? "btn-primary"
                        : "text-emphasis hover:text-surface-950"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </ScrollableRow>

            {/* Tab Content */}
            {activeTab === "chart" && (
              <>
              <div className="surface-card p-6 sm:p-8">
                <h3 className="text-lg font-bold text-gradient mb-6 text-center">{t.kundli.rashiChart}</h3>

                {/* North / South Indian style toggle (mirrors AstroTalk). */}
                <div className="flex justify-center mb-6">
                  <div role="tablist" aria-label="Chart style" className="inline-flex rounded-full bg-[rgba(255,252,245,0.78)] p-1 border divider">
                    {([["north", "North Indian"], ["south", "South Indian"]] as const).map(([style, label]) => (
                      <button
                        key={style}
                        role="tab"
                        aria-selected={chartStyle === style}
                        onClick={() => setChartStyle(style)}
                        className={`focus-ring px-4 py-1.5 rounded-full text-xs font-medium transition-all ${
                          chartStyle === style ? "btn-primary" : "text-emphasis hover:text-surface-950"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* The chart scales to a generous width and renders each planet
                    with its degree + retrograde marker in the correct cell. */}
                {chartStyle === "north" ? (
                  <NorthIndianChart
                    houses={kundli.houses}
                    planetaryPositions={kundli.planetaryPositions}
                    ascendant={kundli.ascendant}
                    className="w-full max-w-lg mx-auto aspect-square"
                  />
                ) : (
                  <SouthIndianChart
                    houses={kundli.houses}
                    planetaryPositions={kundli.planetaryPositions}
                    ascendant={kundli.ascendant}
                    className="w-full max-w-lg mx-auto aspect-square"
                  />
                )}

                <p className="text-xs text-[rgba(12,8,5,0.66)] mt-4 text-center">
                  {chartStyle === "north"
                    ? t.kundli.chartNote
                    : "South Indian style birth chart — signs are fixed, the ascendant marks the 1st house."}
                </p>

                {/* Planet legend — decodes the chart's abbreviations and adds
                    each planet's sign / house / degree / dignity. */}
                {kundli.planetaryPositions && kundli.planetaryPositions.length > 0 && (
                  <div className="mt-8 border-t divider pt-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2">
                      {orderPlanets(kundli.planetaryPositions).map((p) => (
                        <div
                          key={p.planet}
                          className="flex items-center justify-between gap-3 py-1.5 border-b border-[rgba(12,8,5,0.06)] last:border-0"
                        >
                          <span className="font-medium text-surface-950 min-w-[5.5rem]">{p.planet}</span>
                          <span className="text-sm text-secondary flex-1">
                            {p.sign} {Math.floor(p.degree)}&deg;
                            <span className="text-[rgba(12,8,5,0.66)]"> &bull; {t.kundli.houseLabel} {p.house}</span>
                            {typeof p.bhava === 'number' && p.bhava !== p.house ? (
                              <span className="text-[rgba(12,8,5,0.66)]"> &bull; {t.kundli.bhavaLabel} {p.bhava}</span>
                            ) : null}
                            {p.status ? <span className="text-[rgba(12,8,5,0.66)]"> &bull; {p.status}</span> : null}
                          </span>
                          {p.isRetrograde && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/15 text-red-500 whitespace-nowrap">
                              {t.kundli.retrograde}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Divisional (varga) charts — Navamsa (D9) and Dashamsha (D10),
                  the two most-consulted vargas, shown side by side like
                  AstroTalk. They honour the same North/South toggle. */}
              {kundli.divisionalCharts && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
                  {([
                    ["D9", "Navamsa (D9)", "Marriage, dharma & inner strength", kundli.divisionalCharts.D9],
                    ["D10", "Dashamsha (D10)", "Career & profession", kundli.divisionalCharts.D10],
                  ] as const).map(([key, title, subtitle, chart]) =>
                    chart ? (
                      <div key={key} className="surface-card p-6">
                        <h3 className="text-base font-bold text-gradient text-center">{title}</h3>
                        <p className="text-xs text-[rgba(12,8,5,0.66)] text-center mb-4">{subtitle}</p>
                        {chartStyle === "north" ? (
                          <NorthIndianChart
                            houses={chart.houses}
                            planetaryPositions={chart.planetaryPositions}
                            ascendant={chart.ascendant}
                            className="w-full max-w-sm mx-auto aspect-square"
                          />
                        ) : (
                          <SouthIndianChart
                            houses={chart.houses}
                            planetaryPositions={chart.planetaryPositions}
                            ascendant={chart.ascendant}
                            className="w-full max-w-sm mx-auto aspect-square"
                          />
                        )}
                      </div>
                    ) : null,
                  )}
                </div>
              )}
              </>
            )}

            {activeTab === "planets" && (
              <div className="surface-card overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b divider">
                        <th className="text-left px-6 py-4 text-xs font-medium text-[rgba(12,8,5,0.66)] uppercase">{t.kundli.planet}</th>
                        <th className="text-left px-6 py-4 text-xs font-medium text-[rgba(12,8,5,0.66)] uppercase">{t.kundli.sign}</th>
                        <th className="text-left px-6 py-4 text-xs font-medium text-[rgba(12,8,5,0.66)] uppercase">{t.kundli.house}</th>
                        <th className="text-left px-6 py-4 text-xs font-medium text-[rgba(12,8,5,0.66)] uppercase">{t.kundli.degree}</th>
                        <th className="text-left px-6 py-4 text-xs font-medium text-[rgba(12,8,5,0.66)] uppercase">{t.kundli.nakshatra}</th>
                        <th className="text-left px-6 py-4 text-xs font-medium text-[rgba(12,8,5,0.66)] uppercase">Avastha</th>
                        <th className="text-left px-6 py-4 text-xs font-medium text-[rgba(12,8,5,0.66)] uppercase">Combust</th>
                        <th className="text-left px-6 py-4 text-xs font-medium text-[rgba(12,8,5,0.66)] uppercase">{t.kundli.status}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {orderPlanets(kundli.planetaryPositions ?? []).map((p) => (
                        <tr key={p.planet} className="border-b border-[rgba(12,8,5,0.08)] hover:bg-[rgba(255,252,245,0.78)] transition-colors">
                          <td className="px-6 py-3 font-medium text-surface-950">{p.planet}</td>
                          <td className="px-6 py-3 text-secondary">{p.sign}</td>
                          <td className="px-6 py-3 text-secondary">{p.house}</td>
                          <td className="px-6 py-3 text-[rgba(12,8,5,0.66)]">
                            {p.degree}&deg;
                            {p.isRetrograde && (
                              <span className="ml-1.5 text-[10px] font-semibold text-red-500" title={t.kundli.retrograde}>(R)</span>
                            )}
                          </td>
                          <td className="px-6 py-3 text-[rgba(12,8,5,0.66)]">{p.nakshatra}</td>
                          <td className="px-6 py-3 text-secondary">{p.avastha || "—"}</td>
                          <td className="px-6 py-3">
                            {p.isCombust
                              ? <span className="text-xs font-medium text-red-500">Yes</span>
                              : <span className="text-[rgba(12,8,5,0.66)]">No</span>}
                          </td>
                          <td className="px-6 py-3 text-secondary">{p.status || "—"}</td>
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
                      <h4 className="font-semibold text-surface-950">{t.kundli.houseLabel} {h.house}</h4>
                      <div className="flex gap-2">
                        <span className="text-xs px-2 py-1 rounded-full bg-mystic-500/20 text-mystic-400">{h.sign}</span>
                        {h.planets.length > 0 && (
                          <span className="text-xs px-2 py-1 rounded-full bg-primary-500/20 text-primary-400">
                            {h.planets.join(", ")}
                          </span>
                        )}
                      </div>
                    </div>
                    <p className="text-sm text-secondary">
                      {h.planets.length > 0
                        ? `${h.planets.join(", ")} ${h.planets.length === 1 ? t.kundli.isPlaced : t.kundli.arePlaced} ${h.sign} ${t.kundli.inThe} ${h.house}${getOrdinal(h.house, t)} ${t.kundli.houseWord}.`
                        : `${h.sign} ${t.kundli.rulesWithNoPlanets} ${h.house}${getOrdinal(h.house, t)} ${t.kundli.withNoPlanets}`
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
                      <span className="text-sm font-semibold text-surface-950">{t.kundli.mahadasha}: {d.planet}</span>
                      <span className="text-xs text-[rgba(12,8,5,0.66)]">{d.startDate} to {d.endDate}</span>
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
                                  ? "bg-[rgba(255,252,245,0.70)]"
                                  : "bg-[rgba(255,252,245,0.78)]"
                              }`}
                            >
                              <span className={`text-sm ${isActive ? "text-surface-950 font-medium" : "text-[rgba(12,8,5,0.66)]"}`}>
                                {d.planet}-{s.planet}
                              </span>
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-[rgba(12,8,5,0.66)]">{s.startDate} - {s.endDate}</span>
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
                        <h4 className="font-semibold text-surface-950">{y.name}</h4>
                        <span className={`text-xs px-2 py-1 rounded-full ${
                          y.effect === "benefic" ? "bg-emerald-500/20 text-emerald-400" :
                          y.effect === "malefic" ? "bg-red-500/20 text-red-400" :
                          "bg-accent-500/20 text-accent-400"
                        }`}>
                          {y.effect === "benefic" ? t.kundli.effectBenefic : y.effect === "malefic" ? t.kundli.effectMalefic : t.kundli.effectNeutral}
                        </span>
                      </div>
                      <p className="text-sm text-secondary">{y.description}</p>
                    </div>
                  ))
                ) : (
                  <div className="surface-card p-8 text-center text-[rgba(12,8,5,0.66)]">
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
                        <h4 className="font-semibold text-surface-950">{d.name}</h4>
                        <span className={`text-xs px-2 py-1 rounded-full ${
                          !d.present ? "bg-emerald-500/20 text-emerald-400" :
                          d.severity === "mild" ? "bg-accent-500/20 text-accent-400" :
                          d.severity === "moderate" ? "bg-amber-500/20 text-amber-400" :
                          "bg-red-500/20 text-red-400"
                        }`}>
                          {!d.present
                            ? t.kundli.absent
                            : d.severity === "mild"
                              ? t.kundli.severityMild
                              : d.severity === "moderate"
                                ? t.kundli.severityModerate
                                : d.severity === "severe"
                                  ? t.kundli.severitySevere
                                  : t.kundli.severityNone}
                        </span>
                      </div>
                      <p className="text-sm text-secondary mb-3">{d.description}</p>
                      {d.present && (
                        <div className="p-3 rounded-lg bg-[rgba(255,252,245,0.78)]">
                          <Mitigation plan={d.mitigation} remedies={d.remedies} bare />
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="surface-card p-8 text-center">
                    <p className="text-[rgba(12,8,5,0.66)]">{t.kundli.doshaNote}</p>
                    <p className="text-xs text-[rgba(12,8,5,0.66)] mt-2">{t.kundli.doshaComplete}</p>
                  </div>
                )}
              </div>
            )}

            {activeTab === "transparency" && <ShowYourWork factors={factors} />}

            <Interpretation
              domain="kundli"
              className="mt-6"
              input={{
                ascendant: kundli.ascendant,
                moonSign: kundli.moonSign,
                sunSign: kundli.sunSign,
                nakshatra: kundli.nakshatra,
                planets: kundli.planetaryPositions?.slice(0, 9).map((p) => ({
                  planet: p.planet,
                  sign: p.sign,
                  house: p.house,
                  status: p.status,
                })),
                yogas: kundli.yogas?.map((y) => y.name),
                currentMahadasha: (kundli.dashas?.find((d) => {
                  const now = Date.now();
                  return now >= new Date(d.startDate).getTime() && now <= new Date(d.endDate).getTime();
                }) ?? kundli.dashas?.[0])?.planet,
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function getOrdinal(n: number, t: TranslationKeys): string {
  const s = [t.kundli.ordTh, t.kundli.ordSt, t.kundli.ordNd, t.kundli.ordRd];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}
