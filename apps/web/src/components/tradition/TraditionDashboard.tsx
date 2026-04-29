'use client';

import Link from 'next/link';
import { useTranslation } from '@/i18n';
import { WEB_TRADITIONS, type TraditionId } from '@/lib/traditions';
import { PageTransition, Stagger } from '@/components/ui/PageTransition';
import { TraditionGlyph, FeatureGlyph } from '@/components/icons';

export default function TraditionDashboard({ traditionId }: { traditionId: TraditionId }) {
  const { t } = useTranslation();
  const cfg = WEB_TRADITIONS[traditionId];

  const readLabel = (path: string, fallback?: string): string => {
    const parts = path.split('.');
    let node: any = t;
    for (const part of parts) {
      if (node && typeof node === 'object' && part in node) node = node[part];
      else return fallback ?? path;
    }
    return typeof node === 'string' ? node : (fallback ?? path);
  };

  const name = readLabel(cfg.labelKey, cfg.slug);
  const tagline = readLabel(cfg.taglineKey, '');
  const exploreCta = readLabel('traditionsUi.heroCta', 'Explore features');

  return (
    <PageTransition className="mx-auto max-w-6xl px-5 sm:px-8 py-10 sm:py-14">
      {/* Hero — deep ink island on the cream canvas. The tradition glyph
          sits in a saffron-tinted plinth so the brand orange carries the
          eye. White text in here is intentional: this card is the dark
          editorial moment on a light page. */}
      <section className="relative overflow-hidden rounded-3xl bg-surface-950 border border-white/[0.06] shadow-warm-md px-8 sm:px-12 py-12 sm:py-14 mb-12">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-20 -top-24 w-[560px] h-[560px] rounded-full opacity-90"
          style={{
            background:
              'radial-gradient(circle, rgba(255,182,39,0.30) 0%, rgba(255,77,0,0.16) 45%, transparent 75%)',
          }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -left-32 bottom-[-30%] w-[420px] h-[420px] rounded-full opacity-60"
          style={{
            background:
              'radial-gradient(circle, rgba(255,122,64,0.18) 0%, rgba(255,77,0,0.08) 45%, transparent 75%)',
          }}
        />

        <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center gap-8">
          <div className="shrink-0 grid place-items-center w-28 h-28 rounded-3xl bg-primary-500/22 border border-primary-500/45 text-primary-200 shadow-[0_0_48px_-8px_rgba(255,77,0,0.55)]">
            <TraditionGlyph id={traditionId} size={64} weight={1.4} />
          </div>
          <div className="flex-1 min-w-0">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full bg-primary-500/20 border border-primary-500/45 text-primary-200 uppercase tracking-[0.18em] mb-4">
              {name}
            </span>
            <h1
              className="font-display font-semibold text-surface-50 tracking-[-0.01em] leading-[1.0]"
              style={{ fontSize: 'clamp(36px, 5vw, 64px)' }}
            >
              {name}
            </h1>
            {tagline && (
              <p className="mt-4 text-base sm:text-lg text-surface-50/72 max-w-2xl leading-relaxed">
                {tagline}
              </p>
            )}
          </div>
        </div>
      </section>

      {/* Feature tiles — cream cards on the page canvas. Crisp white surface
          with a saffron-glowing icon plinth so the orange echoes through
          the editorial light theme. */}
      <section>
        <h2 className="text-[12px] uppercase tracking-[0.22em] text-primary-600 font-semibold mb-6">
          {exploreCta}
        </h2>
        <Stagger.Container className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
          {cfg.features.map((f) => {
            const label = readLabel(f.labelKey, f.slug);
            const tile = (
              <div
                className={`group rounded-2xl card-cream-hover shadow-warm-sm p-6 h-full flex items-center gap-4 ${
                  f.available
                    ? ''
                    : 'opacity-50 cursor-not-allowed pointer-events-none'
                }`}
              >
                <div className="shrink-0 grid place-items-center w-12 h-12 rounded-xl bg-primary-500/15 border border-primary-500/30 text-primary-600 shadow-[0_0_24px_-6px_rgba(255,77,0,0.40)] group-hover:bg-primary-500/25 group-hover:border-primary-500/55 transition-colors">
                  <FeatureGlyph slug={f.slug} size={22} />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="font-display text-base sm:text-lg font-semibold text-surface-950 leading-tight">
                    {label}
                  </h3>
                  {!f.available && (
                    <p className="mt-1 text-xs text-secondary">
                      {readLabel('traditionsUi.comingSoon', 'Coming soon')}
                    </p>
                  )}
                </div>
              </div>
            );
            if (!f.available) {
              return (
                <Stagger.Item key={f.slug} className="block">
                  <div aria-disabled="true">{tile}</div>
                </Stagger.Item>
              );
            }
            return (
              <Stagger.Item key={f.slug} className="block">
                <Link href={f.href} className="block focus-ring rounded-2xl">
                  {tile}
                </Link>
              </Stagger.Item>
            );
          })}
        </Stagger.Container>
      </section>
    </PageTransition>
  );
}
