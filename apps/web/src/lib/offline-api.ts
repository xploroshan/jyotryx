/**
 * Offline-Aware API Layer
 *
 * Wraps the regular API client with offline fallbacks.
 * When the device is offline, returns locally computed data
 * for features that support it.
 *
 * Offline-capable features:
 * - Numerology (name/brand/personal year)
 * - Planetary hours
 * - Panchang
 * - Daily briefing (basic)
 * - Day quality assessment
 *
 * Online-required features (graceful error):
 * - Chat
 * - Kundli generation
 * - Palmistry (requires image analysis)
 * - Report generation
 */

import { api } from './api';
import {
  analyzeNameOffline,
  getPersonalYearOffline,
  calculatePlanetaryHoursOffline,
  calculatePanchangOffline,
  assessDayQualityOffline,
  generateOfflineDailyPackage,
  getOfflineCache,
  setOfflineCache,
} from './offline-engine';

function isOnline(): boolean {
  if (typeof navigator === 'undefined') return true;
  return navigator.onLine;
}

export const offlineApi = {
  /**
   * Get daily briefing — works offline with local computation
   */
  async getDailyBriefing() {
    if (isOnline()) {
      try {
        const result = await api.get<any>('/daily-briefing');
        // Cache for offline use
        setOfflineCache({
          dailyBriefing: result,
          lastSyncedAt: new Date().toISOString(),
        });
        return { data: result, source: 'server' as const };
      } catch {
        // Fall through to offline
      }
    }

    // Offline: use cached or compute fresh
    const cached = getOfflineCache();
    const today = new Date().toISOString().split('T')[0];

    if (cached?.dailyBriefing && cached.cachedDate === today) {
      return { data: cached.dailyBriefing, source: 'cache' as const };
    }

    const fresh = generateOfflineDailyPackage();
    return { data: fresh.dailyBriefing, source: 'offline' as const };
  },

  /**
   * Get planetary hours — works offline
   */
  async getPlanetaryHours() {
    if (isOnline()) {
      try {
        const result = await api.get<any>('/daily-briefing/planetary-hours');
        return { data: result, source: 'server' as const };
      } catch {
        // Fall through
      }
    }

    const hours = calculatePlanetaryHoursOffline();
    return { data: hours, source: 'offline' as const };
  },

  /**
   * Get panchang — works offline
   */
  async getPanchang() {
    if (isOnline()) {
      try {
        const result = await api.get<any>('/astrology/panchang');
        return { data: result, source: 'server' as const };
      } catch {
        // Fall through
      }
    }

    const panchang = calculatePanchangOffline();
    return { data: panchang, source: 'offline' as const };
  },

  /**
   * Analyze name numerology — works offline
   */
  async analyzeName(name: string) {
    if (isOnline()) {
      try {
        const result = await api.post<any>('/numerology/name', { name });
        return { data: result, source: 'server' as const };
      } catch {
        // Fall through
      }
    }

    const result = analyzeNameOffline(name);
    return { data: result, source: 'offline' as const };
  },

  /**
   * Get personal year — works offline
   */
  async getPersonalYear(dateOfBirth: string) {
    if (isOnline()) {
      try {
        const result = await api.get<any>('/numerology/personal-year');
        return { data: result, source: 'server' as const };
      } catch {
        // Fall through
      }
    }

    const personalYear = getPersonalYearOffline(dateOfBirth);
    return { data: { personalYear }, source: 'offline' as const };
  },

  /**
   * Get day quality assessment — works offline
   */
  async getDayQuality() {
    const assessment = assessDayQualityOffline();
    return { data: assessment, source: 'offline' as const };
  },

  /**
   * Sync daily data from server (call on app launch when online)
   */
  async syncDailyData() {
    if (!isOnline()) return { synced: false, reason: 'offline' };

    try {
      const [briefing, panchang] = await Promise.all([
        api.get<any>('/daily-briefing').catch(() => null),
        api.get<any>('/astrology/panchang').catch(() => null),
      ]);

      setOfflineCache({
        dailyBriefing: briefing,
        panchang,
        planetaryHours: calculatePlanetaryHoursOffline(),
        lastSyncedAt: new Date().toISOString(),
      });

      return { synced: true };
    } catch {
      return { synced: false, reason: 'error' };
    }
  },
};
