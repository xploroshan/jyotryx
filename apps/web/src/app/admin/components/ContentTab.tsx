"use client";

import React, { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";
import { TabError, errorMessage } from "./helpers";
import type { ContentStats } from "./types";

export function ContentTab({ token }: { token: string }) {
  const [contentStats, setContentStats] = useState<ContentStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const c = await api.get<ContentStats>("/admin/content/stats", { token });
      setContentStats(c);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("[admin/content/stats] failed to load", err);
      setError(errorMessage(err));
    }
    setLoading(false);
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

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

  const contentSections = contentStats ? [
    { title: "Knowledge Base", desc: "RAG documents for AI agent context", items: contentStats.knowledgeDocuments },
    { title: "Kundli Charts", desc: "User-generated birth charts", items: contentStats.kundliCharts },
    { title: "Chat Sessions", desc: "AI astrology consultation threads", items: contentStats.chatSessions },
    { title: "Reports", desc: "Generated life, career, and marriage reports", items: contentStats.reports },
    { title: "Palmistry Readings", desc: "Palm image analyses performed", items: contentStats.palmistryReadings },
    { title: "Matching Results", desc: "Kundli compatibility reports", items: contentStats.matchingResults },
    { title: "Tarot Readings", desc: "Tarot card spread consultations", items: contentStats.tarotReadings },
    { title: "Notifications", desc: "User push / in-app notifications", items: contentStats.notifications },
  ] : [];

  return (
    <div>
      <h2 className="text-xl font-bold text-gradient mb-6">Content Management</h2>
      {error ? (
        <TabError message={error} onRetry={load} />
      ) : !contentStats ? (
        <div className="surface-card p-8 text-center text-surface-900/40 text-sm">Loading content stats…</div>
      ) : (
        <>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {contentSections.map((section) => (
              <div key={section.title} className="surface-card p-5">
                <h3 className="font-bold text-surface-900 mb-1">{section.title}</h3>
                <p className="text-xs text-surface-900/40 mb-3">{section.desc}</p>
                <div className="flex items-center justify-between pt-3 border-t border-surface-900/[0.06]">
                  <div>
                    <p className="text-lg font-bold text-gradient">{section.items.toLocaleString()}</p>
                    <p className="text-[10px] text-surface-900/30">items</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {contentStats.knowledgeCategories.length > 0 && (
            <>
              <h3 className="text-lg font-bold text-surface-900 mt-8 mb-4">Knowledge Base by Category</h3>
              <div className="surface-card p-6">
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {contentStats.knowledgeCategories.map((cat) => (
                    <div key={cat.category} className="flex items-center justify-between p-3 rounded-lg bg-surface-900/[0.03]">
                      <span className="text-sm text-surface-900/70 capitalize">{cat.category}</span>
                      <span className="text-sm font-bold text-primary-600">{cat.count.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
