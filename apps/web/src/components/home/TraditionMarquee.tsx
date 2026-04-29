'use client';

import { TRADITION_LIST } from '@/lib/traditions';
import { useTranslation } from '@/i18n';

/**
 * Two stacked infinite marquees of the tradition names, scrolling in
 * opposite directions at slightly different speeds. Pure CSS animation —
 * no JS reflow on each frame. Decorative, so the whole strip is
 * aria-hidden and excluded from the tab order; the same labels are
 * reachable via TraditionRail above.
 *
 * The grain band underneath is what makes this read as editorial paper
 * rather than a gimmicky brand banner.
 */
export default function TraditionMarquee() {
  const { t } = useTranslation();

  const readLabel = (path: string, fallback: string): string => {
    const parts = path.split('.');
    let node: any = t;
    for (const part of parts) {
      if (node && typeof node === 'object' && part in node) node = node[part];
      else return fallback;
    }
    return typeof node === 'string' ? node : fallback;
  };

  const labels = TRADITION_LIST.map((cfg) => readLabel(cfg.labelKey, cfg.slug));

  return (
    <section
      aria-hidden
      className="relative border-y border-surface-900/[0.08] py-6 sm:py-8 overflow-hidden bg-surface-100/60"
    >
      <Track labels={labels} reverse={false} duration={55} />
      <Track labels={labels} reverse offsetTop="mt-2" duration={70} />
    </section>
  );
}

function Track({
  labels,
  reverse,
  duration,
  offsetTop = '',
}: {
  labels: string[];
  reverse?: boolean;
  duration: number;
  offsetTop?: string;
}) {
  // We render the label set TWICE so the keyframe can translate by -50%
  // of the inner element's width and still leave a fully-painted strip on
  // screen. Keys are namespaced by track so React doesn't try to reuse.
  const seq = [...labels, ...labels];

  return (
    <div className={`flex w-full overflow-hidden ${offsetTop}`}>
      <div
        className="flex shrink-0 items-center will-change-transform [&:hover]:[animation-play-state:paused]"
        style={{
          animation: `${reverse ? 'marquee-reverse' : 'marquee-forward'} ${duration}s linear infinite`,
        }}
      >
        {seq.map((label, i) => (
          <span key={`${reverse ? 'r' : 'f'}-${i}`} className="flex items-center">
            <span
              className="serif-italic text-surface-900/85 whitespace-nowrap px-8 sm:px-12"
              style={{ fontSize: 'clamp(40px, 6vw, 96px)', lineHeight: 1 }}
            >
              {label}
            </span>
            <span
              aria-hidden
              className="text-[#FFB627] text-2xl sm:text-3xl shrink-0"
              style={{ filter: 'drop-shadow(0 1px 0 rgba(192,80,0,0.18))' }}
            >
              ★
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}
