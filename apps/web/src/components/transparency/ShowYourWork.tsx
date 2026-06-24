"use client";

import { useTranslation } from "@/i18n";

/**
 * A single deterministic chart factor behind a reading. Mirrors the API's
 * `ChartFactor` shape (apps/api/src/modules/astrology/factors.util.ts).
 */
export interface ChartFactor {
  code: string;
  label: string;
  detail?: string;
  contribution: "positive" | "negative" | "neutral";
  source: "planet" | "yoga" | "dasha" | "dosha";
}

/**
 * "Show Your Work" — the trust differentiator. Surfaces the *exact* chart
 * factors driving a reading, grouped by whether they read as supportive,
 * challenging, or neutral context. This is what turns the deterministic
 * engine into something a user can see and verify, instead of a vague
 * prediction from a black box.
 */
export function ShowYourWork({ factors }: { factors: ChartFactor[] }) {
  const { t } = useTranslation();

  const groups = [
    {
      key: "positive" as const,
      label: t.showYourWork.supportive,
      chip: "bg-emerald-500/15 text-emerald-600",
      dot: "bg-emerald-500",
    },
    {
      key: "negative" as const,
      label: t.showYourWork.challenging,
      chip: "bg-red-500/15 text-red-600",
      dot: "bg-red-500",
    },
    {
      key: "neutral" as const,
      label: t.showYourWork.context,
      chip: "bg-amber-500/15 text-amber-600",
      dot: "bg-amber-500",
    },
  ];

  const hasFactors = factors.length > 0;

  return (
    <div className="surface-card p-6 sm:p-8">
      <h3 className="text-lg font-bold text-gradient mb-1">{t.showYourWork.title}</h3>
      <p className="text-sm text-secondary mb-6">{t.showYourWork.subtitle}</p>

      {!hasFactors ? (
        <div className="rounded-xl bg-[rgba(255,252,245,0.78)] p-6 text-center text-sm text-[rgba(12,8,5,0.46)]">
          {t.showYourWork.empty}
        </div>
      ) : (
        <div className="space-y-6">
          {groups.map((group) => {
            const items = factors.filter((f) => f.contribution === group.key);
            if (items.length === 0) return null;
            return (
              <div key={group.key}>
                <div className="flex items-center gap-2 mb-3">
                  <span className={`inline-block h-2 w-2 rounded-full ${group.dot}`} aria-hidden />
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-[rgba(12,8,5,0.55)]">
                    {group.label}
                  </h4>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${group.chip}`}>{items.length}</span>
                </div>
                <ul className="space-y-2">
                  {items.map((f) => (
                    <li
                      key={f.code}
                      className="rounded-xl bg-[rgba(255,252,245,0.78)] px-4 py-3 border border-[rgba(12,8,5,0.06)]"
                    >
                      <p className="text-sm font-medium text-surface-950">{f.label}</p>
                      {f.detail && <p className="text-xs text-secondary mt-0.5">{f.detail}</p>}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      )}

      <p className="text-xs text-[rgba(12,8,5,0.40)] mt-6 border-t divider pt-4">
        {t.showYourWork.note}
      </p>
    </div>
  );
}
