import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import type { TraditionId } from '@/lib/traditions';

/**
 * UI-preferences store.
 *
 * `focusTradition` powers the Focus Mode toggle on multi-tradition pages
 * (My Day, Horoscope). When `null` the page renders all traditions; when
 * set, the page renders only the selected tradition's sections.
 */
interface UiState {
  focusTradition: TraditionId | null;
  setFocusTradition: (tradition: TraditionId | null) => void;
  clearFocusTradition: () => void;
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      focusTradition: null,
      setFocusTradition: (tradition) => set({ focusTradition: tradition }),
      clearFocusTradition: () => set({ focusTradition: null }),
    }),
    { name: 'jyotron-ui' },
  ),
);
