'use client';

/**
 * Western tradition landing — editorial personal dashboard.
 *
 * Shows the visitor's tropical sun sign (computed deterministically
 * from DOB, no /astrology/kundli credit charged) alongside its
 * element / mode / ruler and the sign the sun is in today.
 */

import { useAuthStore } from '@/lib/store';
import { greetingName } from '@/lib/displayName';
import { westernSunSign, westernSunSignToday } from '@/lib/astro/signs';
import TraditionDashboard, {
  SectionHead,
  FactCard,
} from '@/components/tradition/TraditionDashboard';

const ELEMENT_NOTE: Record<string, string> = {
  Fire:  "Spark, drive, the will to move — burns hot, burns out.",
  Earth: "Substance, patience, what's actually built — slow and lasting.",
  Air:   "Idea, exchange, the space between people — fast, social.",
  Water: "Feeling, memory, what can't be said outright — deep, tidal.",
};
const MODE_NOTE: Record<string, string> = {
  Cardinal: 'You start things. The season begins with you.',
  Fixed:    'You hold things. The season settles into you.',
  Mutable:  'You change things. The season passes through you.',
};
const ELEMENT_ACCENT: Record<string, 'red' | 'amber' | 'sky' | 'indigo'> = {
  Fire: 'red', Earth: 'amber', Air: 'sky', Water: 'indigo',
};

export default function WesternDashboardPage() {
  const user = useAuthStore((s) => s.user);
  const sign = user?.dateOfBirth ? westernSunSign(user.dateOfBirth) : null;
  const todaySign = westernSunSignToday();
  const firstName = greetingName(user);

  const headline = firstName
    ? `${firstName}'s {em}Western chart{/em}`
    : `Your {em}Western chart{/em}`;

  const metaLine = user?.dateOfBirth
    ? new Date(user.dateOfBirth).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
      + (user.placeOfBirth ? ` · ${user.placeOfBirth}` : '')
    : undefined;

  const chips = sign
    ? [
        { label: `${sign.name} Sun`, tone: 'text-sky-300' },
        { label: `${sign.element} element`, tone: 'text-white/85' },
        { label: `${sign.mode} mode`, tone: 'text-white/85' },
      ]
    : undefined;

  return (
    <TraditionDashboard
      traditionId="WESTERN"
      headline={headline}
      metaLine={metaLine}
      chips={chips}
      personalContent={
        <section className="border-b border-[rgba(26,20,16,0.10)]">
          <div className="mx-auto max-w-6xl px-5 sm:px-8 py-10 sm:py-12">
            <SectionHead
              eyebrow={sign ? 'Your sun sign' : "Today's sky"}
              title={sign ? 'The four corners' : 'The Sun right now'}
              tone="text-sky-700"
            />

            {sign ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
                <FactCard
                  eyebrow="Sun (tropical)"
                  headline={sign.name}
                  subline={`Ruler: ${sign.ruler}`}
                  note="The role you're here to play; the steady light."
                  accent="sky"
                />
                <FactCard
                  eyebrow="Element"
                  headline={sign.element}
                  note={ELEMENT_NOTE[sign.element]}
                  accent={ELEMENT_ACCENT[sign.element]}
                />
                <FactCard
                  eyebrow="Modality"
                  headline={sign.mode}
                  note={MODE_NOTE[sign.mode]}
                  accent="violet"
                />
                {todaySign && (
                  <FactCard
                    eyebrow="The Sun today"
                    headline={todaySign.name}
                    subline={`${todaySign.element} · ${todaySign.mode}`}
                    note={`Season's flavor: ${ELEMENT_NOTE[todaySign.element].split('—')[0].trim()}.`}
                    accent="amber"
                  />
                )}
              </div>
            ) : todaySign ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
                <FactCard
                  eyebrow="The Sun today"
                  headline={todaySign.name}
                  subline={`${todaySign.element} · ${todaySign.mode}`}
                  note={ELEMENT_NOTE[todaySign.element]}
                  accent="amber"
                />
                <FactCard
                  eyebrow="Add your birth details"
                  headline="See your chart"
                  subline="Sun, element, mode, ruler"
                  note="Your tropical sun sign and the chapter the sun is writing in your life."
                  accent="sky"
                />
              </div>
            ) : null}
          </div>
        </section>
      }
    />
  );
}
