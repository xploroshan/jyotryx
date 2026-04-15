'use client';

import { useMemo } from 'react';

import { useTranslation } from '@/i18n';
import { useAuthStore } from '@/lib/store';
import { useUiStore } from '@/stores/ui';
import {
  TRADITION_IDS,
  WEB_TRADITIONS,
  type TraditionId,
} from '@/lib/traditions';

function readLabel(t: any, key: string, fallback: string): string {
  const parts = key.split('.');
  let node: any = t;
  for (const p of parts) {
    if (node && typeof node === 'object' && p in node) node = node[p];
    else return fallback;
  }
  return typeof node === 'string' ? node : fallback;
}

/**
 * Multi-tradition pages (My Day, Horoscope) use this toggle to let the
 * user narrow the view to a single tradition without changing their
 * saved multi-select. Selection is persisted in `useUiStore`.
 */
export default function FocusModeToggle() {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const { focusTradition, setFocusTradition, clearFocusTradition } = useUiStore();

  const available = useMemo<TraditionId[]>(() => {
    const traditions = user?.astrologyTraditions ?? [];
    const ids = traditions.filter((id): id is TraditionId =>
      TRADITION_IDS.includes(id as TraditionId),
    );
    return ids.length ? ids : [...TRADITION_IDS];
  }, [user?.astrologyTraditions]);

  if (available.length < 2) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs font-medium text-white/40 uppercase tracking-wider">
        {readLabel(t, 'focusMode.label', 'Focus mode')}
      </span>
      <button
        type="button"
        onClick={clearFocusTradition}
        className={`text-[11px] px-3 py-1 rounded-full border transition ${
          focusTradition === null
            ? 'bg-white/10 border-white/20 text-white'
            : 'bg-white/[0.02] border-white/10 text-white/50 hover:text-white/80'
        }`}
      >
        {readLabel(t, 'focusMode.toggleOff', 'All traditions')}
      </button>
      {available.map((id) => {
        const cfg = WEB_TRADITIONS[id];
        const active = focusTradition === id;
        return (
          <button
            key={id}
            type="button"
            onClick={() => setFocusTradition(id)}
            className={`text-[11px] px-3 py-1 rounded-full border transition ${
              active
                ? cfg.badgeClass
                : 'bg-white/[0.02] border-white/10 text-white/50 hover:text-white/80'
            }`}
            aria-pressed={active}
          >
            <span className="mr-1">{cfg.icon}</span>
            {readLabel(t, cfg.labelKey, id)}
          </button>
        );
      })}
    </div>
  );
}
