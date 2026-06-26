"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { useTranslation } from "@/i18n";

export interface InterpretationData {
  summary: string;
  points: string[];
  guidance: string;
  disclaimer?: string;
}

/**
 * Reusable "What this means for you" block. Posts the already-computed result
 * (`input`) for a feature `domain` to /interpretation, which returns a short,
 * locale-aware, plain-language read (cached server-side per identical input).
 * Renders into the app's standard `surface-card` section. Fails quietly — the
 * raw result is still on the page — so it never blocks a feature.
 *
 * Pass a COMPACT `input` (the key facts), not a giant raw payload; the server
 * also caps payload size.
 */
export default function Interpretation({
  domain,
  input,
  className = "",
}: {
  domain: string;
  input: unknown;
  className?: string;
}) {
  const { t, locale } = useTranslation();
  const [data, setData] = useState<InterpretationData | null>(null);
  const [loading, setLoading] = useState(true);
  // Stable dependency for the fetch effect — input objects are recreated each
  // render, so key off their serialized content.
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
    // Wrap in Promise.resolve so the component tolerates any api stub/return
    // shape (and never throws synchronously in an effect).
    Promise.resolve(
      api.post<InterpretationData>("/interpretation", { domain, payload: input, locale }),
    )
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

  return (
    <section className={`surface-card p-6 ${className}`}>
      <h2 className="text-lg font-semibold text-surface-950 mb-3">{t.interpret.heading}</h2>

      {data.summary && (
        <p className="text-sm text-emphasis leading-relaxed mb-4">{data.summary}</p>
      )}

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

      <p className="mt-4 text-xs text-[rgba(12,8,5,0.5)]">{t.interpret.disclaimer}</p>
    </section>
  );
}
