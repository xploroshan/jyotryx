/**
 * Client-side persistence for horary questions.
 *
 * Horary readings are cast for the exact moment a question was asked,
 * so the user needs to review their history. We persist the last 50
 * readings in `localStorage` keyed per user so history survives
 * refreshes without a backend DB migration.
 */

export interface HoraryRecord {
  id: string; // uuid-ish
  question: string;
  askedAt: string;
  chart: {
    ascendant: { sign: string; degree: number };
    significators: { querent: string; quesited: string; moon: string };
  };
  judgment: string;
}

const MAX_HISTORY = 50;

function keyFor(userId: string | undefined | null): string {
  return `horary:history:${userId ?? 'guest'}`;
}

export function loadHoraryHistory(userId?: string | null): HoraryRecord[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(keyFor(userId));
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export function saveHoraryRecord(
  userId: string | null | undefined,
  record: Omit<HoraryRecord, 'id'>,
): HoraryRecord {
  if (typeof window === 'undefined') {
    return { ...record, id: `${Date.now()}` };
  }
  const existing = loadHoraryHistory(userId);
  const full: HoraryRecord = {
    ...record,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  };
  const next = [full, ...existing].slice(0, MAX_HISTORY);
  try {
    window.localStorage.setItem(keyFor(userId), JSON.stringify(next));
  } catch {
    /* storage full or disabled — history simply won't persist */
  }
  return full;
}

export function deleteHoraryRecord(
  userId: string | null | undefined,
  id: string,
): void {
  if (typeof window === 'undefined') return;
  const existing = loadHoraryHistory(userId);
  const next = existing.filter((r) => r.id !== id);
  try {
    window.localStorage.setItem(keyFor(userId), JSON.stringify(next));
  } catch {
    /* ignore */
  }
}

export function clearHoraryHistory(userId?: string | null): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(keyFor(userId));
  } catch {
    /* ignore */
  }
}
