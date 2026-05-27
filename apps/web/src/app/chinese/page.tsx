'use client';

/**
 * Chinese tradition landing — editorial personal dashboard.
 *
 * Shows the visitor's year-animal and ruling element (computed from
 * DOB year, no API call), the polarity (Yang/Yin), and today's
 * year-animal as a "this is the year you're living in" context card.
 */

import { useAuthStore } from '@/lib/store';
import { greetingName } from '@/lib/displayName';
import { chineseZodiac, chineseZodiacToday } from '@/lib/astro/signs';
import TraditionDashboard, {
  SectionHead,
  FactCard,
} from '@/components/tradition/TraditionDashboard';

const ANIMAL_NOTE: Record<string, string> = {
  Rat:     "Resourceful, watchful, the first to spot the opening.",
  Ox:      "Patient, dependable, work that compounds quietly over time.",
  Tiger:   "Brave, magnetic, a force that needs an outlet.",
  Rabbit:  "Gentle, refined, the diplomat who notices what's unsaid.",
  Dragon:  "Charismatic, ambitious, a wide-angle vision.",
  Snake:   "Wise, private, the depths beneath a still surface.",
  Horse:   "Free-spirited, energetic, allergic to being held still.",
  Goat:    "Artistic, tender, the imagination that softens hard rooms.",
  Monkey:  "Inventive, witty, plays the angles others don't see.",
  Rooster: "Precise, candid, the one who notices the missing detail.",
  Dog:     "Loyal, protective, ethical to a fault.",
  Pig:     "Generous, sincere, the warmth that holds a table together.",
};
const ELEMENT_NOTE: Record<string, string> = {
  Wood:  "Growth, beginnings, the spring impulse to reach upward.",
  Fire:  "Brilliance, recognition, the noon sun at its full height.",
  Earth: "Centering, nourishing, the season between seasons that holds.",
  Metal: "Refinement, discernment, the autumn cut to what's essential.",
  Water: "Depth, intuition, the winter still that knows what's coming.",
};
const ELEMENT_ACCENT: Record<string, 'emerald' | 'red' | 'amber' | 'slate' | 'indigo'> = {
  Wood: 'emerald', Fire: 'red', Earth: 'amber', Metal: 'slate', Water: 'indigo',
};

export default function ChineseDashboardPage() {
  const user = useAuthStore((s) => s.user);
  const sign = user?.dateOfBirth ? chineseZodiac(user.dateOfBirth) : null;
  const todaySign = chineseZodiacToday();
  const firstName = greetingName(user);

  const headline = firstName
    ? `${firstName}, born in {em}the year of the ${sign?.animal ?? '…'}{/em}`
    : `Your {em}Chinese chart{/em}`;

  const metaLine = user?.dateOfBirth
    ? new Date(user.dateOfBirth).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
      + (user.placeOfBirth ? ` · ${user.placeOfBirth}` : '')
    : undefined;

  const chips = sign
    ? [
        { label: `${sign.element} ${sign.animal}`, tone: 'text-red-300' },
        { label: sign.polarity, tone: 'text-white/85' },
        todaySign ? { label: `Year of the ${todaySign.animal} (${todaySign.element})`, tone: 'text-white/70' } : null,
      ].filter(Boolean) as { label: string; tone: string }[]
    : undefined;

  return (
    <TraditionDashboard
      traditionId="CHINESE"
      headline={headline}
      metaLine={metaLine}
      chips={chips}
      personalContent={
        <section className="border-b border-[rgba(26,20,16,0.10)]">
          <div className="mx-auto max-w-6xl px-5 sm:px-8 py-10 sm:py-12">
            <SectionHead
              eyebrow={sign ? 'Your year pillar' : "Today's year"}
              title={sign ? 'The animal and the element' : "The year we're in"}
              tone="text-red-700"
            />

            {sign ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
                <FactCard
                  eyebrow="Year animal"
                  headline={sign.animal}
                  subline={`${sign.polarity} polarity`}
                  note={ANIMAL_NOTE[sign.animal]}
                  accent="red"
                />
                <FactCard
                  eyebrow="Ruling element"
                  headline={sign.element}
                  note={ELEMENT_NOTE[sign.element]}
                  accent={ELEMENT_ACCENT[sign.element]}
                />
                {todaySign && (
                  <>
                    <FactCard
                      eyebrow="This year"
                      headline={todaySign.animal}
                      subline={`${todaySign.element} · ${todaySign.polarity}`}
                      note={ANIMAL_NOTE[todaySign.animal]}
                      accent="amber"
                    />
                    <FactCard
                      eyebrow="Year energy"
                      headline={todaySign.element}
                      note={ELEMENT_NOTE[todaySign.element]}
                      accent={ELEMENT_ACCENT[todaySign.element]}
                    />
                  </>
                )}
              </div>
            ) : todaySign ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
                <FactCard
                  eyebrow="This year"
                  headline={todaySign.animal}
                  subline={`${todaySign.element} · ${todaySign.polarity}`}
                  note={ANIMAL_NOTE[todaySign.animal]}
                  accent="amber"
                />
                <FactCard
                  eyebrow="Add your birth details"
                  headline="See your pillar"
                  subline="Animal, element, polarity"
                  note="Your Chinese year pillar — the foundation stone of your bāzī chart."
                  accent="red"
                />
              </div>
            ) : null}
          </div>
        </section>
      }
    />
  );
}
