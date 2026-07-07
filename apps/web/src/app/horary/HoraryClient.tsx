'use client';

/**
 * Horary tradition landing — editorial dashboard.
 *
 * Horary is question-driven; there's no birth chart to fill the
 * "personal" panel with. Instead we open with an editorial prompt
 * ("Ask the chart a question") and the four classical question
 * shapes the technique is best at answering.
 */

import { useAuthStore } from '@/lib/store';
import { useTranslation } from '@/i18n';
import { greetingName } from '@/lib/displayName';
import TraditionDashboard, {
  SectionHead,
  FactCard,
} from '@/components/tradition/TraditionDashboard';

export default function HoraryDashboardPage() {
  const { t } = useTranslation();
  const d = t.dashboards.horary;
  const user = useAuthStore((s) => s.user);
  const firstName = greetingName(user);

  const headline = firstName
    ? d.heroTitle.replace('{name}', firstName)
    : d.heroTitleGuest;

  return (
    <TraditionDashboard
      traditionId="HORARY"
      headline={headline}
      heroCta={{ label: d.askNowCta, href: '/horary/ask' }}
      personalContent={
        <section className="border-b border-[rgba(26,20,16,0.10)]">
          <div className="mx-auto max-w-6xl px-5 sm:px-8 py-10 sm:py-12">
            <SectionHead
              eyebrow={d.whatHoraryEyebrow}
              title={d.fourKindsTitle}
              tone="text-teal-700"
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
              <FactCard
                eyebrow={d.lostEyebrow}
                headline={d.lostHeadline}
                subline={d.lostSubline}
                note={d.lostNote}
                accent="teal"
              />
              <FactCard
                eyebrow={d.yesNoEyebrow}
                headline={d.yesNoHeadline}
                subline={d.yesNoSubline}
                note={d.yesNoNote}
                accent="emerald"
              />
              <FactCard
                eyebrow={d.peopleEyebrow}
                headline={d.peopleHeadline}
                subline={d.peopleSubline}
                note={d.peopleNote}
                accent="indigo"
              />
              <FactCard
                eyebrow={d.timingEyebrow}
                headline={d.timingHeadline}
                subline={d.timingSubline}
                note={d.timingNote}
                accent="amber"
              />
            </div>
          </div>
        </section>
      }
    />
  );
}
