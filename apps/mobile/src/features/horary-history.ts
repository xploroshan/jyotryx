/**
 * Client-side horary history — the mobile mirror of
 * `apps/web/src/app/horary/_history.ts`. Horary questions are personal and
 * ephemeral, so (as on web) they are NOT sent to the backend; they persist
 * locally. Web uses localStorage; mobile uses MMKV. Same key scheme, same cap,
 * same newest-first ordering.
 */
import { storage } from '@/lib/mmkv';
import type { HoraryChart } from './results/responses.p3';

export interface HoraryRecord {
  id: string;
  question: string;
  askedAt: string;
  chart: HoraryChart;
  judgment: string;
}

const MAX_HISTORY = 50;
const keyFor = (userId?: string | null) => `horary:history:${userId ?? 'guest'}`;

export function loadHoraryHistory(userId?: string | null): HoraryRecord[] {
  try {
    const raw = storage.getString(keyFor(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as HoraryRecord[]) : [];
  } catch {
    return [];
  }
}

export function saveHoraryRecord(userId: string | null | undefined, record: Omit<HoraryRecord, 'id'>): HoraryRecord {
  const full: HoraryRecord = { ...record, id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}` };
  try {
    const next = [full, ...loadHoraryHistory(userId)].slice(0, MAX_HISTORY);
    storage.set(keyFor(userId), JSON.stringify(next));
  } catch {
    /* storage full / unavailable — history is best-effort */
  }
  return full;
}

export function deleteHoraryRecord(userId: string | null | undefined, id: string): void {
  try {
    const next = loadHoraryHistory(userId).filter((r) => r.id !== id);
    storage.set(keyFor(userId), JSON.stringify(next));
  } catch {
    /* ignore */
  }
}

export function clearHoraryHistory(userId?: string | null): void {
  try {
    storage.delete(keyFor(userId));
  } catch {
    /* ignore */
  }
}
