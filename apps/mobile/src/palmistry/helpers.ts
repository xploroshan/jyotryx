/**
 * Pure palmistry helpers — queued-vs-sync detection, status checks, and the
 * strength/prominence normalizers the web client applies (`mapAnalysis`).
 * Unit-tested; no React/native deps.
 */
import type { PalmistryAnalysis } from '@/features/results/responses.p4';

/** The analyze POST is queued (must poll) when status is processing, or when it
 *  returns an id with an empty lines[] placeholder. Otherwise it's the full
 *  sync analysis. */
export function isQueuedAnalysis(a: Pick<PalmistryAnalysis, 'status' | 'lines' | 'id'>): boolean {
  if (a.status === 'processing') return true;
  return Array.isArray(a.lines) && a.lines.length === 0 && !!a.id;
}

export const isComplete = (status: string | undefined | null) => (status ?? '').toLowerCase() === 'completed';
export const isFailed = (status: string | undefined | null) => (status ?? '').toLowerCase() === 'failed';

const MAJOR_LINE_KEYWORDS = ['heart', 'head', 'life', 'fate', 'sun'];
export function isMajorLine(name: string): boolean {
  const n = name.toLowerCase();
  return MAJOR_LINE_KEYWORDS.some((k) => n.includes(k));
}

export function normalizeStrength(raw: string | undefined): 'strong' | 'moderate' | 'weak' {
  const s = (raw ?? '').toLowerCase();
  if (['strong', 'prominent', 'deep'].includes(s)) return 'strong';
  if (['moderate', 'medium', 'normal', 'average'].includes(s)) return 'moderate';
  return 'weak';
}

export function normalizeProminence(raw: string | undefined): 'high' | 'medium' | 'low' {
  const p = (raw ?? '').toLowerCase();
  if (['elevated', 'high', 'prominent'].includes(p)) return 'high';
  if (['flat', 'low', 'underdeveloped'].includes(p)) return 'low';
  return 'medium';
}
