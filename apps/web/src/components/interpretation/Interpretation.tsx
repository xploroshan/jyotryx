"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Sparkles } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { useAuthStore } from "@/lib/store";
import { useTranslation } from "@/i18n";

export interface InterpretationSection {
  title: string;
  body: string;
}

export interface InterpretationData {
  summary: string;
  points: string[];
  guidance: string;
  disclaimer?: string;
  sections?: InterpretationSection[];
  depth?: "teaser" | "deep";
}

// Calm sunrise gradient (gold → warm orange) — matches the brand .text-gradient-sunrise.
const SUNRISE = "linear-gradient(135deg, #f7b733 0%, #f8943f 48%, #ef6c1a 100%)";

/**
 * Reusable "What this means for you" block. Posts the already-computed result
 * (`input`) for a feature `domain` to /interpretation, which returns a short,
 * locale-aware, plain-language read (cached server-side per identical input).
 *
 * Below the free teaser it offers a paid "deep dive": a richer, section-by-
 * section reading. The deep dive requires sign-in and is charged once per
 * result (free to re-open); a 402 means "top up credits". Fails quietly — the
 * raw result is still on the page — so it never blocks a feature.
 *
 * Pass a COMPACT `input` (the key facts), not a giant raw payload.
 */
export default function Interpretation({
  domain,
  input,
  deepDive = true,
  className = "",
}: {
  domain: string;
  input: unknown;
  /** Set false to hide the paid deep-dive upsell (e.g. transient daily results). */
  deepDive?: boolean;
  className?: string;
}) {
  const { t, locale } = useTranslation();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const [data, setData] = useState<InterpretationData | null>(null);
  const [loading, setLoading] = useState(true);

  // Deep-dive state.
  const [deep, setDeep] = useState<InterpretationData | null>(null);
  const [deepLoading, setDeepLoading] = useState(false);
  const [deepError, setDeepError] = useState<"insufficient" | "generic" | null>(null);

  const inputKey = useMemo(() => {
    try {
      return JSON.stringify(input);
    } catch {
      return String(input);
    }
  }, [input]);

  useEffect(() => {
    if (input == null) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setDeep(null);
    setDeepError(null);
    Promise.resolve(api.post<InterpretationData>("/interpretation", { domain, payload: input, locale }))
      .then((res) => {
        if (!cancelled) {
          setData(res);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setData(null);
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [domain, locale, inputKey]);

  const unlockDeep = async () => {
    if (deepLoading || input == null) return;
    setDeepLoading(true);
    setDeepError(null);
    try {
      const res = await api.post<InterpretationData>("/interpretation/deep-dive", {
        domain,
        payload: input,
        locale,
      });
      setDeep(res);
    } catch (e) {
      if (e instanceof ApiError && e.status === 402) setDeepError("insufficient");
      else setDeepError("generic");
    } finally {
      setDeepLoading(false);
    }
  };

  if (loading) {
    return (
      <section className={`surface-card p-6 ${className}`} aria-busy="true">
        <h2 className="text-lg font-semibold text-surface-950 mb-3">{t.interpret.heading}</h2>
        <div className="space-y-2.5 animate-pulse" aria-hidden="true">
          <div className="h-3.5 w-3/4 rounded bg-[rgba(12,8,5,0.08)]" />
          <div className="h-3.5 w-full rounded bg-[rgba(12,8,5,0.08)]" />
          <div className="h-3.5 w-5/6 rounded bg-[rgba(12,8,5,0.08)]" />
        </div>
        <p className="sr-only">{t.interpret.loading}</p>
      </section>
    );
  }

  if (!data || (!data.summary && (!data.points || data.points.length === 0))) {
    return null;
  }

  const showDeep = deep && (deep.sections?.length || deep.summary);

  return (
    <section className={`surface-card p-6 ${className}`}>
      <h2 className="text-lg font-semibold text-surface-950 mb-3">{t.interpret.heading}</h2>

      {data.summary && <p className="text-sm text-emphasis leading-relaxed mb-4">{data.summary}</p>}

      {data.points && data.points.length > 0 && (
        <ul className="space-y-2 mb-4">
          {data.points.map((p, i) => (
            <li key={i} className="flex gap-2.5 text-sm text-emphasis leading-relaxed">
              <span aria-hidden="true" className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary-500" />
              <span>{p}</span>
            </li>
          ))}
        </ul>
      )}

      {data.guidance && (
        <div className="rounded-lg bg-primary-500/[0.06] p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-primary-700 mb-1.5">
            {t.interpret.guidance}
          </h3>
          <p className="text-sm text-emphasis leading-relaxed">{data.guidance}</p>
        </div>
      )}

      {/* Deep dive */}
      {showDeep ? (
        <div className="mt-5 border-t border-[rgba(12,8,5,0.08)] pt-5">
          <div className="mb-3 flex items-center gap-2">
            <span className="rounded-full bg-primary-500/[0.12] px-2.5 py-0.5 text-xs font-semibold text-primary-700">
              {t.interpret.deepBadge}
            </span>
          </div>
          {deep!.summary && <p className="text-sm text-emphasis leading-relaxed mb-4">{deep!.summary}</p>}
          {deep!.sections && deep!.sections.length > 0 && (
            <div className="space-y-4">
              {deep!.sections.map((s, i) => (
                <div key={i}>
                  <h3 className="text-sm font-semibold text-surface-950 mb-1">{s.title}</h3>
                  <p className="text-sm text-emphasis leading-relaxed">{s.body}</p>
                </div>
              ))}
            </div>
          )}
          {deep!.guidance && (
            <div className="mt-4 rounded-lg bg-primary-500/[0.06] p-4">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-primary-700 mb-1.5">
                {t.interpret.guidance}
              </h3>
              <p className="text-sm text-emphasis leading-relaxed">{deep!.guidance}</p>
            </div>
          )}
        </div>
      ) : (
        deepDive && (
          <div className="mt-5 overflow-hidden rounded-2xl border border-[#f8943f]/25 bg-gradient-to-br from-[#fff7e9] via-[#fff1df] to-[#ffe9d6] p-5 shadow-warm-sm">
            <div className="flex items-start gap-3.5">
              <span
                className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white shadow-warm-sm"
                style={{ backgroundImage: SUNRISE }}
              >
                <Sparkles className="h-5 w-5" strokeWidth={2} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-surface-950">{t.interpret.deepCta}</p>
                <p className="mt-1 text-xs leading-relaxed text-[rgba(12,8,5,0.62)]">{t.interpret.deepNote}</p>
                {isAuthenticated ? (
                  <>
                    <button
                      type="button"
                      onClick={unlockDeep}
                      disabled={deepLoading}
                      className="mt-3.5 inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold text-white shadow-warm-sm transition-all hover:shadow-warm-md hover:brightness-[1.03] active:scale-[0.98] disabled:cursor-default disabled:opacity-70"
                      style={{ backgroundImage: SUNRISE }}
                    >
                      {deepLoading ? (
                        <>
                          <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                          {t.interpret.deepLoading}
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-4 w-4" strokeWidth={2.2} />
                          {t.interpret.deepButton}
                        </>
                      )}
                    </button>
                    {deepError === "insufficient" && (
                      <p className="mt-2.5 text-xs text-red-600">
                        {t.interpret.deepInsufficient}{" "}
                        <Link href="/pricing" className="font-medium underline">
                          {t.interpret.deepTopUp}
                        </Link>
                      </p>
                    )}
                    {deepError === "generic" && (
                      <p className="mt-2.5 text-xs text-red-600">{t.interpret.deepError}</p>
                    )}
                  </>
                ) : (
                  <Link
                    href="/auth"
                    className="mt-3.5 inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold text-white shadow-warm-sm transition-all hover:shadow-warm-md hover:brightness-[1.03]"
                    style={{ backgroundImage: SUNRISE }}
                  >
                    <Sparkles className="h-4 w-4" strokeWidth={2.2} />
                    {t.interpret.deepSignIn}
                  </Link>
                )}
              </div>
            </div>
          </div>
        )
      )}

      <p className="mt-4 text-xs text-[rgba(12,8,5,0.5)]">{t.interpret.disclaimer}</p>
    </section>
  );
}
