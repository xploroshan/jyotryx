"use client";

import React, { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";
import { Badge, TabError, errorMessage } from "./helpers";

const llmProviders = [
  { id: "openai", name: "OpenAI", models: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "gpt-3.5-turbo", "o1", "o1-mini"], keyField: "llm.openai.key", color: "text-emerald-400" },
  { id: "anthropic", name: "Anthropic", models: ["claude-opus-4-20250514", "claude-sonnet-4-20250514", "claude-haiku-4-5-20251001", "claude-3.5-sonnet-20241022"], keyField: "llm.anthropic.key", color: "text-purple-400" },
  { id: "google", name: "Google Gemini", models: ["gemini-2.0-flash", "gemini-2.0-pro", "gemini-1.5-flash", "gemini-1.5-pro"], keyField: "llm.google.key", color: "text-blue-400" },
  { id: "mistral", name: "Mistral AI", models: ["mistral-large-latest", "mistral-medium-latest", "mistral-small-latest", "open-mixtral-8x22b"], keyField: "llm.mistral.key", color: "text-orange-400" },
  { id: "cohere", name: "Cohere", models: ["command-r-plus", "command-r", "command-light"], keyField: "llm.cohere.key", color: "text-sky-400" },
  { id: "groq", name: "Groq", models: ["llama-3.3-70b-versatile", "llama-3.1-8b-instant", "mixtral-8x7b-32768"], keyField: "llm.groq.key", color: "text-red-400" },
];

const aiFeatures = [
  { id: "chat", name: "AI Chat / Consult", desc: "Interactive astrology consultations", tokensPerCall: "~800-2000", needsAI: true, suggestion: "AI Required", sugColor: "text-red-400" },
  { id: "kundli", name: "Kundli Interpretation", desc: "Chart analysis & interpretations", tokensPerCall: "~1000-1500", needsAI: false, suggestion: "KB Sufficient", sugColor: "text-emerald-400" },
  { id: "horoscope", name: "Daily Horoscope", desc: "Daily sign-based predictions", tokensPerCall: "~500-800", needsAI: false, suggestion: "KB Sufficient", sugColor: "text-emerald-400" },
  { id: "palmistry", name: "Palmistry Reading", desc: "Palm image analysis (needs vision)", tokensPerCall: "~1200-2000", needsAI: true, suggestion: "AI Required (Vision)", sugColor: "text-red-400" },
  { id: "matching", name: "Kundli Matching", desc: "Compatibility analysis", tokensPerCall: "~800-1200", needsAI: false, suggestion: "KB Sufficient", sugColor: "text-emerald-400" },
  { id: "numerology", name: "Numerology", desc: "Name/number analysis", tokensPerCall: "~400-600", needsAI: false, suggestion: "KB Sufficient", sugColor: "text-emerald-400" },
  { id: "daily_briefing", name: "My Day Briefing", desc: "Daily personalized predictions", tokensPerCall: "~600-1000", needsAI: false, suggestion: "KB + Rules", sugColor: "text-emerald-400" },
  { id: "reports", name: "Report Generation", desc: "Detailed PDF reports (Life, Career, etc.)", tokensPerCall: "~2000-4000", needsAI: true, suggestion: "AI Recommended", sugColor: "text-amber-400" },
  { id: "remedy", name: "Remedy Suggestions", desc: "Gemstones, mantras, remedies", tokensPerCall: "~400-600", needsAI: false, suggestion: "KB Sufficient", sugColor: "text-emerald-400" },
  { id: "panchang", name: "Panchang", desc: "Daily Hindu calendar data", tokensPerCall: "0", needsAI: false, suggestion: "No AI Needed", sugColor: "text-emerald-400" },
  { id: "muhurat", name: "Muhurat", desc: "Auspicious timing calculations", tokensPerCall: "0", needsAI: false, suggestion: "No AI Needed", sugColor: "text-emerald-400" },
];

export function LlmTab({ token }: { token: string }) {
  const [aiSettings, setAiSettings] = useState<Record<string, string>>({});
  const [aiSaving, setAiSaving] = useState(false);
  const [aiSubTab, setAiSubTab] = useState<"providers" | "usage" | "features">("providers");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const s = await api.get<Record<string, string>>("/admin/settings?prefix=llm.", { token });
      setAiSettings(s);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("[admin/settings?prefix=llm.] failed to load", err);
      setLoadError(errorMessage(err));
    }
    setLoading(false);
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const getAiSetting = (key: string, fallback: string = "") => aiSettings[key] || fallback;
  const setAiSetting = (key: string, value: string) => setAiSettings(prev => ({ ...prev, [key]: value }));

  const saveAiSettings = async () => {
    setAiSaving(true);
    setError("");
    try {
      const updated = await api.put<Record<string, string>>("/admin/settings", aiSettings, { token });
      setAiSettings(updated);
      setSuccess("AI settings saved successfully!");
      setTimeout(() => setSuccess(""), 3000);
    } catch (err: any) {
      setError(err.message || "Failed to save AI settings");
    } finally {
      setAiSaving(false);
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
      <div className="flex gap-1.5 mb-6 p-1 rounded-xl bg-white/[0.03] w-fit">
        {([
          { id: "providers" as const, label: "LLM Providers" },
          { id: "usage" as const, label: "Token Usage" },
          { id: "features" as const, label: "Feature Controls" },
        ]).map(t => (
          <button key={t.id} onClick={() => setAiSubTab(t.id)}
            className={`px-4 py-2 rounded-lg text-xs font-medium transition-all ${aiSubTab === t.id ? "bg-primary-600 text-white" : "text-white/40 hover:text-white/60"}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Providers */}
      {aiSubTab === "providers" && (
        <div className="space-y-6">
          <div className="surface-card p-5">
            <h3 className="text-sm font-semibold text-white mb-4">Global Defaults</h3>
            <div className="grid sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs text-white/30 mb-1.5">Default Provider</label>
                <select value={getAiSetting("llm.default.provider", "openai")} onChange={e => setAiSetting("llm.default.provider", e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg surface-input text-sm">
                  {llmProviders.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-white/30 mb-1.5">Default Model</label>
                <select value={getAiSetting("llm.default.model", "gpt-4o")} onChange={e => setAiSetting("llm.default.model", e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg surface-input text-sm">
                  {(llmProviders.find(p => p.id === getAiSetting("llm.default.provider", "openai"))?.models || []).map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-white/30 mb-1.5">Temperature</label>
                <input type="number" min={0} max={2} step={0.1} value={getAiSetting("llm.default.temperature", "0.7")} onChange={e => setAiSetting("llm.default.temperature", e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg surface-input text-sm" />
              </div>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            {llmProviders.map(provider => {
              const enabled = getAiSetting(`llm.${provider.id}.enabled`, provider.id === "openai" ? "true" : "false") === "true";
              const hasKey = !!getAiSetting(provider.keyField);
              return (
                <div key={provider.id} className={`surface-card p-5 transition-all ${enabled ? "ring-1 ring-white/[0.1]" : "opacity-60"}`}>
                  <div className="flex items-center justify-between mb-4">
                    <span className={`text-lg font-bold ${provider.color}`}>{provider.name}</span>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" checked={enabled} onChange={e => setAiSetting(`llm.${provider.id}.enabled`, e.target.checked ? "true" : "false")} className="sr-only peer" />
                      <div className="w-9 h-5 bg-white/10 peer-checked:bg-primary-600 rounded-full after:content-[''] after:absolute after:top-0.5 after:left-[2px] peer-checked:after:translate-x-full after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all" />
                    </label>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-[11px] text-white/30 mb-1">API Key</label>
                      <input type="password" placeholder={hasKey ? "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022 (saved)" : "Enter API key..."} value={getAiSetting(provider.keyField)} onChange={e => setAiSetting(provider.keyField, e.target.value)}
                        className="w-full px-3 py-2 rounded-lg surface-input text-xs font-mono" />
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t border-white/[0.04]">
                      <div className="flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full ${hasKey && enabled ? "bg-emerald-400" : hasKey ? "bg-amber-400" : "bg-white/20"}`} />
                        <span className="text-[11px] text-white/40">{hasKey && enabled ? "Active" : hasKey ? "Key set, disabled" : "No key"}</span>
                      </div>
                      <span className="text-[11px] text-white/30">{provider.models.length} models</span>
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
            <h3 className="text-sm font-semibold text-white mb-1">Global Token Budget</h3>
            <p className="text-xs text-white/30 mb-4">Set monthly token limits. When exceeded, features auto-fallback to Knowledge Base.</p>
            <div className="grid sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-[11px] text-white/30 mb-1">Monthly Token Limit (global)</label>
                <input type="number" value={getAiSetting("llm.budget.monthly_tokens", "1000000")} onChange={e => setAiSetting("llm.budget.monthly_tokens", e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg surface-input text-sm" />
              </div>
              <div>
                <label className="block text-[11px] text-white/30 mb-1">Per-User Daily Limit</label>
                <input type="number" value={getAiSetting("llm.budget.user_daily_tokens", "10000")} onChange={e => setAiSetting("llm.budget.user_daily_tokens", e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg surface-input text-sm" />
              </div>
              <div>
                <label className="block text-[11px] text-white/30 mb-1">Fallback Behavior</label>
                <select value={getAiSetting("llm.budget.fallback", "knowledge_base")} onChange={e => setAiSetting("llm.budget.fallback", e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg surface-input text-sm">
                  <option value="knowledge_base">Use Knowledge Base</option>
                  <option value="block">Block &amp; Show Limit Message</option>
                  <option value="degrade">Use Cheaper Model</option>
                </select>
              </div>
            </div>
          </div>

          <div className="surface-card p-5">
            <h3 className="text-sm font-semibold text-white mb-4">Token Usage by Feature</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/[0.06]">
                    <th className="text-left text-[11px] text-white/30 font-medium py-2 pr-4">Feature</th>
                    <th className="text-right text-[11px] text-white/30 font-medium py-2 px-3">Tokens/Call</th>
                    <th className="text-right text-[11px] text-white/30 font-medium py-2 px-3">Today</th>
                    <th className="text-right text-[11px] text-white/30 font-medium py-2 px-3">This Month</th>
                    <th className="text-right text-[11px] text-white/30 font-medium py-2 px-3">Calls</th>
                    <th className="text-right text-[11px] text-white/30 font-medium py-2 px-3">Est. Cost</th>
                    <th className="text-right text-[11px] text-white/30 font-medium py-2 pl-3">Limit</th>
                  </tr>
                </thead>
                <tbody>
                  {aiFeatures.filter(f => f.tokensPerCall !== "0").map(feature => {
                    const monthlyTokens = parseInt(getAiSetting(`llm.usage.${feature.id}.monthly_tokens`, "0"));
                    const todayTokens = parseInt(getAiSetting(`llm.usage.${feature.id}.today_tokens`, "0"));
                    const calls = parseInt(getAiSetting(`llm.usage.${feature.id}.calls`, "0"));
                    const featureLimit = getAiSetting(`llm.limit.${feature.id}`, "");
                    const estCost = (monthlyTokens / 1000000 * 2.5).toFixed(2);
                    return (
                      <tr key={feature.id} className="border-b border-white/[0.03] hover:bg-white/[0.02]">
                        <td className="py-2.5 pr-4">
                          <p className="text-white/80 font-medium">{feature.name}</p>
                          <p className="text-[11px] text-white/30">{feature.desc}</p>
                        </td>
                        <td className="text-right text-white/40 px-3 tabular-nums">{feature.tokensPerCall}</td>
                        <td className="text-right text-white/60 px-3 tabular-nums">{todayTokens.toLocaleString()}</td>
                        <td className="text-right text-white/60 px-3 tabular-nums">{monthlyTokens.toLocaleString()}</td>
                        <td className="text-right text-white/40 px-3 tabular-nums">{calls.toLocaleString()}</td>
                        <td className="text-right text-accent-400/80 px-3 tabular-nums">${estCost}</td>
                        <td className="text-right pl-3">
                          <input type="number" placeholder="No limit" value={featureLimit} onChange={e => setAiSetting(`llm.limit.${feature.id}`, e.target.value)}
                            className="w-20 px-2 py-1 rounded text-right surface-input text-xs tabular-nums" />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="surface-card p-5">
            <h3 className="text-sm font-semibold text-white mb-1">Top Token Consumers</h3>
            <p className="text-xs text-white/30 mb-4">Users ranked by token consumption this month. Set per-user overrides from the Users tab.</p>
            <p className="text-sm text-white/30 text-center py-6">Load the Users tab to see per-user token stats.</p>
          </div>
        </div>
      )}

      {/* Feature Controls */}
      {aiSubTab === "features" && (
        <div className="space-y-6">
          <div className="surface-card p-4 flex flex-wrap gap-4 text-xs">
            <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-primary-500" /> <span className="text-white/40">Using AI / LLM</span></div>
            <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500" /> <span className="text-white/40">Using Knowledge Base only</span></div>
            <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-500" /> <span className="text-white/40">Hybrid (AI + KB fallback)</span></div>
          </div>

          <div className="space-y-2">
            {aiFeatures.map(feature => {
              const mode = getAiSetting(`llm.feature.${feature.id}.mode`, feature.needsAI ? "ai" : "kb");
              const model = getAiSetting(`llm.feature.${feature.id}.model`, "");
              const provider = getAiSetting(`llm.feature.${feature.id}.provider`, "");
              const maxTokens = getAiSetting(`llm.feature.${feature.id}.max_tokens`, "");
              return (
                <div key={feature.id} className="surface-card p-4">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${mode === "ai" ? "bg-primary-500" : mode === "hybrid" ? "bg-amber-500" : "bg-emerald-500"}`} />
                        <h4 className="text-sm font-medium text-white">{feature.name}</h4>
                      </div>
                      <p className="text-[11px] text-white/30 mt-0.5 ml-4">{feature.desc}</p>
                    </div>
                    <div className="sm:text-right shrink-0">
                      <span className={`text-[11px] font-medium ${feature.sugColor}`}>{feature.suggestion}</span>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      {(["ai", "hybrid", "kb"] as const).map(m => (
                        <button key={m} onClick={() => setAiSetting(`llm.feature.${feature.id}.mode`, m)}
                          className={`px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all ${mode === m
                            ? m === "ai" ? "bg-primary-600 text-white" : m === "hybrid" ? "bg-amber-600 text-white" : "bg-emerald-600 text-white"
                            : "bg-white/[0.04] text-white/30 hover:text-white/50"
                          }`}>
                          {m === "ai" ? "AI" : m === "hybrid" ? "Hybrid" : "KB Only"}
                        </button>
                      ))}
                    </div>
                  </div>
                  {(mode === "ai" || mode === "hybrid") && (
                    <div className="mt-3 pt-3 border-t border-white/[0.04] grid grid-cols-2 sm:grid-cols-4 gap-3 ml-4">
                      <div>
                        <label className="block text-[10px] text-white/25 mb-1">Provider Override</label>
                        <select value={provider} onChange={e => setAiSetting(`llm.feature.${feature.id}.provider`, e.target.value)}
                          className="w-full px-2 py-1.5 rounded surface-input text-xs">
                          <option value="">Use Default</option>
                          {llmProviders.filter(p => getAiSetting(`llm.${p.id}.enabled`, p.id === "openai" ? "true" : "false") === "true").map(p => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] text-white/25 mb-1">Model Override</label>
                        <select value={model} onChange={e => setAiSetting(`llm.feature.${feature.id}.model`, e.target.value)}
                          className="w-full px-2 py-1.5 rounded surface-input text-xs">
                          <option value="">Use Default</option>
                          {(llmProviders.find(p => p.id === (provider || getAiSetting("llm.default.provider", "openai")))?.models || []).map(m => (
                            <option key={m} value={m}>{m}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] text-white/25 mb-1">Max Tokens</label>
                        <input type="number" placeholder="Default" value={maxTokens} onChange={e => setAiSetting(`llm.feature.${feature.id}.max_tokens`, e.target.value)}
                          className="w-full px-2 py-1.5 rounded surface-input text-xs" />
                      </div>
                      <div>
                        <label className="block text-[10px] text-white/25 mb-1">Est. Tokens/Call</label>
                        <p className="text-xs text-white/40 py-1.5">{feature.tokensPerCall}</p>
                      </div>
                    </div>
                  )}
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
                <p className="text-xs text-white/50 leading-relaxed">
                  <strong className="text-white/70">Panchang, Muhurat, Numerology, Kundli Matching, and Daily Horoscope</strong> can run entirely on the Knowledge Base with rule-based computation, saving ~60% of token costs.
                  Only <strong className="text-white/70">AI Chat, Palmistry (vision), and Report Generation</strong> truly require LLM calls.
                  Use <strong className="text-white/70">Hybrid mode</strong> for features like Kundli Interpretation to use KB first and fall back to AI only for complex queries.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
