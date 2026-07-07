'use client';

/**
 * Chinese tradition landing — editorial personal dashboard.
 *
 * Shows the visitor's year-animal and ruling element (computed from
 * DOB year, no API call), the polarity (Yang/Yin), and today's
 * year-animal as a "this is the year you're living in" context card.
 */

import { useAuthStore } from '@/lib/store';
import { useTranslation } from '@/i18n';
import { greetingName } from '@/lib/displayName';
import { chineseZodiac, chineseZodiacToday } from '@/lib/astro/signs';
import TraditionDashboard, {
  SectionHead,
  FactCard,
} from '@/components/tradition/TraditionDashboard';

const ELEMENT_ACCENT: Record<string, 'emerald' | 'red' | 'amber' | 'slate' | 'indigo'> = {
  Wood: 'emerald', Fire: 'red', Earth: 'amber', Metal: 'slate', Water: 'indigo',
};

export default function ChineseDashboardPage() {
  const { t } = useTranslation();
  const d = t.dashboards.chinese;
  const user = useAuthStore((s) => s.user);
  const sign = user?.dateOfBirth ? chineseZodiac(user.dateOfBirth) : null;
  const todaySign = chineseZodiacToday();
  const firstName = greetingName(user);

  const animalNote: Record<string, string> = {
    Rat: d.animalRatNote, Ox: d.animalOxNote, Tiger: d.animalTigerNote,
    Rabbit: d.animalRabbitNote, Dragon: d.animalDragonNote, Snake: d.animalSnakeNote,
    Horse: d.animalHorseNote, Goat: d.animalGoatNote, Monkey: d.animalMonkeyNote,
    Rooster: d.animalRoosterNote, Dog: d.animalDogNote, Pig: d.animalPigNote,
  };
  const elementNote: Record<string, string> = {
    Wood: d.elementWoodNote, Fire: d.elementFireNote, Earth: d.elementEarthNote,
    Metal: d.elementMetalNote, Water: d.elementWaterNote,
  };

  const headline = firstName
    ? d.heroTitle.replace('{name}', firstName).replace('{animal}', sign?.animal ?? '…')
    : d.heroTitleGuest;

  const metaLine = user?.dateOfBirth
    ? new Date(user.dateOfBirth).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
      + (user.placeOfBirth ? ` · ${user.placeOfBirth}` : '')
    : undefined;

  const chips = sign
    ? [
        { label: d.animalElementChip.replace('{element}', sign.element).replace('{animal}', sign.animal), tone: 'text-red-300' },
        { label: sign.polarity, tone: 'text-white/85' },
        todaySign ? { label: d.yearOfChip.replace('{animal}', todaySign.animal).replace('{element}', todaySign.element), tone: 'text-white/70' } : null,
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
              eyebrow={sign ? d.yourYearPillarEyebrow : d.todaysYearEyebrow}
              title={sign ? d.animalElementTitle : d.yearWeAreInTitle}
              tone="text-red-700"
            />

            {sign ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
                <FactCard
                  eyebrow={d.yearAnimalEyebrow}
                  headline={sign.animal}
                  subline={d.polaritySuffix.replace('{polarity}', sign.polarity)}
                  note={animalNote[sign.animal]}
                  accent="red"
                />
                <FactCard
                  eyebrow={d.rulingElementEyebrow}
                  headline={sign.element}
                  note={elementNote[sign.element]}
                  accent={ELEMENT_ACCENT[sign.element]}
                />
                {todaySign && (
                  <>
                    <FactCard
                      eyebrow={d.thisYearEyebrow}
                      headline={todaySign.animal}
                      subline={`${todaySign.element} · ${todaySign.polarity}`}
                      note={animalNote[todaySign.animal]}
                      accent="amber"
                    />
                    <FactCard
                      eyebrow={d.yearEnergyEyebrow}
                      headline={todaySign.element}
                      note={elementNote[todaySign.element]}
                      accent={ELEMENT_ACCENT[todaySign.element]}
                    />
                  </>
                )}
              </div>
            ) : todaySign ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
                <FactCard
                  eyebrow={d.thisYearEyebrow}
                  headline={todaySign.animal}
                  subline={`${todaySign.element} · ${todaySign.polarity}`}
                  note={animalNote[todaySign.animal]}
                  accent="amber"
                />
                <FactCard
                  eyebrow={t.dashboards.common.addBirthEyebrow}
                  headline={d.seeYourPillar}
                  subline={d.animalElementPolarity}
                  note={d.addBirthNote}
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
