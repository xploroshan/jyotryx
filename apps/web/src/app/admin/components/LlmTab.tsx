"use client";

import React, { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";
import { TabError, errorMessage } from "./helpers";

// Only providers with a real runtime client in the API (LlmService failover
// chain). The old list also offered Mistral/Cohere/Groq cards whose keys and
// toggles were stored but consumed by nothing — decorative controls an admin
// would reasonably (and wrongly) trust.
const llmProviders = [
  { id: "openai", name: "OpenAI", models: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "gpt-3.5-turbo", "o1", "o1-mini"], keyField: "llm.openai.key", color: "text-emerald-400" },
  { id: "anthropic", name: "Anthropic", models: ["claude-sonnet-4-6", "claude-opus-4-6", "claude-haiku-4-5"], keyField: "llm.anthropic.key", color: "text-purple-400" },
  { id: "gemini", name: "Google Gemini", models: ["gemini-2.0-flash", "gemini-2.0-flash-lite", "gemini-1.5-pro", "gemini-1.5-flash"], keyField: "llm.gemini.key", color: "text-blue-400" },
];

// The REAL feature roots tagged on llm_usage rows and consumed by the
// per-feature overrides (llm.feature.{id}.provider|model|max_tokens) in
// LlmService. Overrides here actually route/cap the calls.
const aiFeatures = [
  { id: "chat", name: "AI Chat / Consult", desc: "Interactive astrology consultations", tokensPerCall: "~800-2000" },
  { id: "report", name: "Report Generation", desc: "Detailed reports (Life, Career, etc.)", tokensPerCall: "~2000-4000" },
  { id: "interpretation", name: "Kundli Deep-Dive", desc: "Long-form chart interpretation", tokensPerCall: "~1000-2000" },
  { id: "horoscope", name: "Horoscope", desc: "Daily/weekly/monthly sign forecasts", tokensPerCall: "~500-800" },
  { id: "tarot", name: "Tarot Reading", desc: "Spread interpretations", tokensPerCall: "~600-1200" },
  { id: "vastu", name: "Vastu Analysis", desc: "Home/office vastu guidance", tokensPerCall: "~600-1000" },
  { id: "palmistry", name: "Palmistry (vision)", desc: "Palm image analysis — model set via the palmistry vision setting, not overridable here", tokensPerCall: "~1200-2000" },
];

type TodayByFeature = Record<string, { tokens: number; costUsd: number }>;

export function LlmTab({ token }: { token: string }) {
  const [aiSettings, setAiSettings] = useState<Record<string, string>>({});
  const [todayUsage, setTodayUsage] = useState<TodayByFeature>({});
  const [aiSaving, setAiSaving] = useState(false);
  const [aiSubTab, setAiSubTab] = useState<"providers" | "usage" | "features">("providers");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [rotating, setRotating] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    // Settings + today's live usage from /admin/llm/usage/today in
    // parallel. The usage endpoint replaces what used to be a
    // hardcoded "0" value pulled from llm.usage.*.today_tokens. A
    // failure of the settings call is fatal — without it the form
    // can't render — so it surfaces as a TabError. A usage failure
    // is silently absorbed since the form is still usable without
    // today's numbers.
    const [settingsRes, usageRes] = await Promise.allSettled([
      api.get<Record<string, string>>("/admin/settings?prefix=llm.", { token }),
      api.get<TodayByFeature>("/admin/llm/usage/today", { token }),
    ]);
    if (settingsRes.status === "fulfilled") {
      setAiSettings(settingsRes.value);
    } else {
      // eslint-disable-next-line no-console
      console.error("[admin/settings?prefix=llm.] failed to load", settingsRes.reason);
      setLoadError(errorMessage(settingsRes.reason));
    }
    if (usageRes.status === "fulfilled") setTodayUsage(usageRes.value);
    setLoading(false);
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const getAiSetting = (key: string, fallback: string = "") => aiSettings[key] || fallback;

  /**
   * Is a provider enabled? MUST mirror the backend's absence-means-enabled
   * rule (LlmService.readEnabled): an unset flag counts as ON. The old UI
   * defaulted non-OpenAI toggles to unchecked, showing "disabled" while the
   * provider was actively serving failover traffic on its env key.
   * Both key shapes are honoured (llm.{id}.enabled and the OpsTab
   * kill-switch's llm.provider.{id}.enabled) — either set to "false" wins,
   * matching the backend.
   */
  const isProviderEnabled = (id: string) => {
    const a = aiSettings[`llm.provider.${id}.enabled`];
    const b = aiSettings[`llm.${id}.enabled`];
    const effective = a !== undefined ? a : b;
    return effective === undefined ? true : effective !== "false";
  };

  /**
   * Fold every `chat:*`, `report:*`, `tarot:*`, `horoscope:*` sub-tag
   * back onto its root feature key. Feature tagging in llm_usage is
   * intentionally granular ("chat:career", "report:life") so the Cost
   * tab can break them down — but this older table lists only the
   * root IDs and expects aggregates at that level.
   */
  const todayTokensForFeature = (featureId: string): number => {
    let tokens = 0;
    for (const [tag, row] of Object.entries(todayUsage)) {
      const root = tag.split(":")[0];
      if (root === featureId) tokens += row.tokens;
    }
    return tokens;
  };
  const setAiSetting = (key: string, value: string) => setAiSettings(prev => ({ ...prev, [key]: value }));

  const saveAiSettings = async () => {
    setAiSaving(true);
    setError("");
    try {
      const updated = await api.put<Record<string, string>>("/admin/settings", aiSettings, { token });
      setAiSettings(updated);
      setSuccess("AI settings saved — live now (config caches invalidated).");
      setTimeout(() => setSuccess(""), 3000);
    } catch (err: any) {
      setError(err.message || "Failed to save AI settings");
    } finally {
      setAiSaving(false);
    }
  };

  /**
   * Rotate a provider's API key via the dedicated admin endpoint
   * (not the bulk settings PUT). The backend writes the new key,
   * invalidates the LlmService config cache, and logs an
   * `LLM_KEY_ROTATE` row — everything the bulk settings path does NOT
   * do, which is why a separate action exists. The key is read from
   * the staged value in state so an admin can paste a new key and hit
   * "Rotate" without saving the whole settings blob first.
   */
  const rotateProviderKey = async (providerId: string, keyField: string) => {
    const key = (aiSettings[keyField] || "").trim();
    if (!key || key.length < 8) {
      setError(`Enter a new ${providerId} API key (≥ 8 chars) before rotating.`);
      return;
    }
    setRotating(providerId);
    setError("");
    try {
      await api.post(`/admin/llm/keys/${encodeURIComponent(providerId)}/rotate`, { key }, { token });
      setSuccess(`${providerId} key rotated — picks up within 30s.`);
      // Clear the typed key from the input so it isn't re-saved by a
      // later "Save All Changes" click. The server stores the canonical
      // value now.
      setAiSetting(keyField, "");
      setTimeout(() => setSuccess(""), 3000);
    } catch (err: any) {
      setError(err.message || `Failed to rotate ${providerId} key`);
    } finally {
      setRotating(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <svg className="w-8 h-8 animate-spin text-primary-500" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    );
  }

  if (loadError) return <TabError message={loadError} onRetry={load} />;

  return (
    <div>
      {error && (
        <div className="mb-6 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-center justify-between">
          {error}
          <button onClick={() => setError("")} className="text-red-400 hover:text-red-300">&times;</button>
        </div>
      )}
      {success && (
        <div className="mb-6 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm">
          {success}
        </div>
      )}

      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-gradient">AI &amp; LLM Management</h2>
        <button onClick={saveAiSettings} disabled={aiSaving} className="px-5 py-2 btn-primary rounded-xl text-sm disabled:opacity-50">
          {aiSaving ? "Saving..." : "Save All Changes"}
        </button>
      </div>

      {/* Sub-tabs */}
      <div className="flex gap-1.5 mb-6 p-1 rounded-xl bg-black/[0.04] w-fit">
        {([
          { id: "providers" as const, label: "LLM Providers" },
          { id: "usage" as const, label: "Token Usage" },
          { id: "features" as const, label: "Feature Routing" },
        ]).map(t => (
          <button key={t.id} onClick={() => setAiSubTab(t.id)}
            className={`px-4 py-2 rounded-lg text-xs font-medium transition-all ${aiSubTab === t.id ? "bg-primary-600 text-white" : "text-ink-500 hover:text-ink-700"}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Providers */}
      {aiSubTab === "providers" && (
        <div className="space-y-6">
          <div className="surface-card p-5">
            <h3 className="text-sm font-semibold text-ink-900 mb-1">Global Defaults</h3>
            <p className="text-xs text-ink-500 mb-4">
              The default provider is tried FIRST for every request; the other enabled
              providers act as automatic failover in case it errors.
            </p>
            <div className="grid sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs text-ink-500 mb-1.5">Default Provider</label>
                <select value={getAiSetting("llm.default.provider", "openai")} onChange={e => setAiSetting("llm.default.provider", e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg surface-input text-sm">
                  {llmProviders.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-ink-500 mb-1.5">Default Model</label>
                <select value={getAiSetting("llm.default.model", "gpt-4o")} onChange={e => setAiSetting("llm.default.model", e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg surface-input text-sm">
                  {(llmProviders.find(p => p.id === getAiSetting("llm.default.provider", "openai"))?.models || []).map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-ink-500 mb-1.5">Temperature</label>
                <input type="number" min={0} max={2} step={0.1} value={getAiSetting("llm.default.temperature", "0.7")} onChange={e => setAiSetting("llm.default.temperature", e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg surface-input text-sm" />
              </div>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            {llmProviders.map(provider => {
              const enabled = isProviderEnabled(provider.id);
              const hasKey = !!getAiSetting(provider.keyField);
              return (
                <div key={provider.id} className={`surface-card p-5 transition-all ${enabled ? "ring-1 ring-black/[0.1]" : "opacity-60"}`}>
                  <div className="flex items-center justify-between mb-4">
                    <span className={`text-lg font-bold ${provider.color}`}>{provider.name}</span>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" checked={enabled} onChange={e => setAiSetting(`llm.${provider.id}.enabled`, e.target.checked ? "true" : "false")} className="sr-only peer" />
                      <div className="w-9 h-5 bg-black/10 peer-checked:bg-primary-600 rounded-full after:content-[''] after:absolute after:top-0.5 after:left-[2px] peer-checked:after:translate-x-full after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all" />
                    </label>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-[11px] text-ink-500 mb-1">API Key</label>
                      <div className="flex gap-2">
                        <input type="password" placeholder={hasKey ? "•••••••• (saved)" : "Enter API key..."} value={getAiSetting(provider.keyField)} onChange={e => setAiSetting(provider.keyField, e.target.value)}
                          className="flex-1 px-3 py-2 rounded-lg surface-input text-xs font-mono" />
                        <button
                          type="button"
                          onClick={() => rotateProviderKey(provider.id, provider.keyField)}
                          disabled={rotating === provider.id || (getAiSetting(provider.keyField) || "").trim().length < 8}
                          data-testid={`rotate-key-${provider.id}`}
                          className="px-3 py-2 rounded-lg bg-amber-500/10 text-amber-400 text-[11px] font-medium hover:bg-amber-500/20 disabled:opacity-40"
                          title="Write the typed key as the new provider key and invalidate the LlmService cache."
                        >
                          {rotating === provider.id ? "Rotating…" : "Rotate"}
                        </button>
                      </div>
                      <p className="text-[10px] text-ink-500 mt-1">
                        Keys can also come from the server environment — an empty field here
                        does not mean the provider has no key.
                      </p>
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t border-black/[0.08]">
                      <div className="flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full ${enabled ? "bg-emerald-400" : "bg-black/15"}`} />
                        <span className="text-[11px] text-ink-500">{enabled ? "Enabled" : "Disabled (kill switch)"}</span>
                      </div>
                      <span className="text-[11px] text-ink-500">{provider.models.length} models</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Token Usage */}
      {aiSubTab === "usage" && (
        <div className="space-y-6">
          <div className="surface-card p-5">
            <h3 className="text-sm font-semibold text-ink-900 mb-4">Token Usage by Feature</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-black/[0.10]">
                    <th className="text-left text-[11px] text-ink-500 font-medium py-2 pr-4">Feature</th>
                    <th className="text-right text-[11px] text-ink-500 font-medium py-2 px-3">Tokens/Call</th>
                    <th className="text-right text-[11px] text-ink-500 font-medium py-2 px-3">Today</th>
                    <th className="text-right text-[11px] text-ink-500 font-medium py-2 pl-3">Today Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {aiFeatures.map(feature => {
                    // Real values folded from llm_usage feature sub-tags. The
                    // old table also showed "This Month"/"Calls"/"Limit"
                    // columns backed by llm.usage.*/llm.limit.* settings that
                    // nothing ever wrote or read — decorative numbers.
                    const todayTokens = todayTokensForFeature(feature.id);
                    let todayCost = 0;
                    for (const [tag, row] of Object.entries(todayUsage)) {
                      if (tag.split(":")[0] === feature.id) todayCost += row.costUsd;
                    }
                    return (
                      <tr key={feature.id} className="border-b border-black/[0.06] hover:bg-black/[0.03]">
                        <td className="py-2.5 pr-4">
                          <p className="text-ink-700 font-medium">{feature.name}</p>
                          <p className="text-[11px] text-ink-500">{feature.desc}</p>
                        </td>
                        <td className="text-right text-ink-500 px-3 tabular-nums">{feature.tokensPerCall}</td>
                        <td className="text-right text-ink-700 px-3 tabular-nums">{todayTokens.toLocaleString()}</td>
                        <td className="text-right text-accent-400/80 pl-3 tabular-nums">${todayCost.toFixed(4)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="text-[11px] text-ink-500 mt-3">
              Full history, per-model breakdowns and spend alerts live in the Cost tab.
            </p>
          </div>
        </div>
      )}

      {/* Feature Routing — per-feature provider/model/max-token overrides,
          consumed live by LlmService (llm.feature.{id}.*). The old
          "Feature Controls" AI/Hybrid/KB mode buttons and the token-budget
          card wrote settings that no code read — removed rather than
          promising behavior the backend doesn't have. */}
      {aiSubTab === "features" && (
        <div className="space-y-6">
          <div className="surface-card p-4">
            <p className="text-xs text-ink-500">
              Route individual features to a specific provider/model or cap their output
              tokens. Empty = use the global defaults above. Changes apply on save.
            </p>
          </div>

          <div className="space-y-2">
            {aiFeatures.filter(f => f.id !== "palmistry").map(feature => {
              const model = getAiSetting(`llm.feature.${feature.id}.model`, "");
              const provider = getAiSetting(`llm.feature.${feature.id}.provider`, "");
              const maxTokens = getAiSetting(`llm.feature.${feature.id}.max_tokens`, "");
              return (
                <div key={feature.id} className="surface-card p-4">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${provider || model || maxTokens ? "bg-primary-500" : "bg-black/15"}`} />
                    <h4 className="text-sm font-medium text-ink-900">{feature.name}</h4>
                    <span className="text-[11px] text-ink-500">{feature.desc}</span>
                  </div>
                  <div className="mt-3 pt-3 border-t border-black/[0.08] grid grid-cols-2 sm:grid-cols-4 gap-3 ml-4">
                    <div>
                      <label className="block text-[10px] text-ink-500 mb-1">Provider Override</label>
                      <select value={provider} onChange={e => setAiSetting(`llm.feature.${feature.id}.provider`, e.target.value)}
                        className="w-full px-2 py-1.5 rounded surface-input text-xs">
                        <option value="">Use Default</option>
                        {llmProviders.filter(p => isProviderEnabled(p.id)).map(p => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] text-ink-500 mb-1">Model Override</label>
                      <select value={model} onChange={e => setAiSetting(`llm.feature.${feature.id}.model`, e.target.value)}
                        className="w-full px-2 py-1.5 rounded surface-input text-xs">
                        <option value="">Use Default</option>
                        {(llmProviders.find(p => p.id === (provider || getAiSetting("llm.default.provider", "openai")))?.models || []).map(m => (
                          <option key={m} value={m}>{m}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] text-ink-500 mb-1">Max Tokens</label>
                      <input type="number" placeholder="Default" value={maxTokens} onChange={e => setAiSetting(`llm.feature.${feature.id}.max_tokens`, e.target.value)}
                        className="w-full px-2 py-1.5 rounded surface-input text-xs" />
                    </div>
                    <div>
                      <label className="block text-[10px] text-ink-500 mb-1">Est. Tokens/Call</label>
                      <p className="text-xs text-ink-500 py-1.5">{feature.tokensPerCall}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="p-4 rounded-2xl bg-gradient-to-r from-primary-600/8 to-accent-500/5 border border-primary-500/10">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-primary-500/15 flex items-center justify-center shrink-0 mt-0.5">
                <svg className="w-4 h-4 text-primary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 18v-5.25m0 0a6.01 6.01 0 001.5-.189m-1.5.189a6.01 6.01 0 01-1.5-.189m3.75 7.478a12.06 12.06 0 01-4.5 0m3.75 2.383a14.406 14.406 0 01-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 10-7.517 0c.85.493 1.509 1.333 1.509 2.316V18" />
                </svg>
              </div>
              <div>
                <h4 className="text-sm font-semibold text-primary-400 mb-1">Cost Optimization Suggestion</h4>
                <p className="text-xs text-ink-500 leading-relaxed">
                  Route high-volume, low-stakes features (Horoscope, Vastu) to a cheaper model
                  like <strong className="text-ink-700">gpt-4o-mini</strong> or{" "}
                  <strong className="text-ink-700">gemini-2.0-flash</strong>, and keep
                  accuracy-critical paid features (Reports, Deep-Dive) on a precision model.
                  Max-token caps bound the worst-case cost per call.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
