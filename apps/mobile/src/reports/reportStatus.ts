/**
 * Report status normalization. The API lowercases DB statuses to
 * `generating | ready | failed`, and the synchronous generate path additionally
 * emits `completed`. Treat ready+completed as done; failed as failed; anything
 * else as still generating. Pure — unit-tested.
 */
export function normalizeReportStatus(status: string | undefined | null): string {
  return (status ?? '').toLowerCase();
}

export function isReportDone(status: string | undefined | null): boolean {
  const s = normalizeReportStatus(status);
  return s === 'ready' || s === 'completed';
}

export function isReportFailed(status: string | undefined | null): boolean {
  return normalizeReportStatus(status) === 'failed';
}

export function isReportGenerating(status: string | undefined | null): boolean {
  return !isReportDone(status) && !isReportFailed(status);
}

export const REPORT_TYPES: { type: string; label: string; icon: string; desc: string }[] = [
  { type: 'LIFE', label: 'Life', icon: '🌟', desc: 'Your full life blueprint' },
  { type: 'CAREER', label: 'Career', icon: '💼', desc: 'Vocation & timing' },
  { type: 'MARRIAGE', label: 'Marriage', icon: '💍', desc: 'Love & partnership' },
  { type: 'WEALTH', label: 'Wealth', icon: '💰', desc: 'Money & prosperity' },
  { type: 'ANNUAL', label: 'Annual', icon: '📅', desc: 'The year ahead' },
  { type: 'PALM', label: 'Palm', icon: '✋', desc: 'Palmistry report' },
];
