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
import TraditionDashboard, {
  SectionHead,
  FactCard,
} from '@/components/tradition/TraditionDashboard';

export default function HoraryDashboardPage() {
  const user = useAuthStore((s) => s.user);
  const firstName = user?.name?.split(' ')[0];

  const headline = firstName
    ? `${firstName}, {em}ask the chart{/em}`
    : `Ask the {em}chart{/em} a question`;

  return (
    <TraditionDashboard
      traditionId="HORARY"
      headline={headline}
      heroCta={{ label: 'Ask a question now', href: '/horary/ask' }}
      personalContent={
        <section className="border-b border-[rgba(26,20,16,0.10)]">
          <div className="mx-auto max-w-6xl px-5 sm:px-8 py-10 sm:py-12">
            <SectionHead
              eyebrow="What horary answers"
              title="Four kinds of question"
              tone="text-teal-700"
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
              <FactCard
                eyebrow="Lost objects"
                headline="Where is it?"
                subline="Cap. 7 of Lilly's Christian Astrology"
                note="The Moon and the second-house ruler describe the item; the house tells you what room or direction to search."
                accent="teal"
              />
              <FactCard
                eyebrow="Yes or no"
                headline="Will it happen?"
                subline="Reception, applying aspects, perfection"
                note="A 1700-year-old yes/no engine for decisions that can't wait for a natal consultation."
                accent="emerald"
              />
              <FactCard
                eyebrow="People & relationships"
                headline="What's their intent?"
                subline="Seventh-house questions"
                note="Read the querent's intent, the quesited's response, and whether the matter perfects naturally or by translation of light."
                accent="indigo"
              />
              <FactCard
                eyebrow="Timing"
                headline="When?"
                subline="Degrees-to-perfection"
                note="The number of degrees between the significators converts to days, weeks, months — depending on the angularity."
                accent="amber"
              />
            </div>
          </div>
        </section>
      }
    />
  );
}
