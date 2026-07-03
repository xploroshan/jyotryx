import { ApiError, endpoints } from '@myastro360/shared';
import { api } from '@/api/client';
import type { ReportResponse, ReportListItem, ReportStatusResponse } from '@/features/results/responses.p4';
import { isReportDone, isReportFailed } from './reportStatus';

export const generateReport = (type: string, locale: string) =>
  api.post<ReportResponse>(endpoints.reports.generate, { type, locale });

export const getReportStatus = (id: string) => api.get<ReportStatusResponse>(endpoints.reports.status(id));
export const getReport = (id: string) => api.get<ReportResponse>(endpoints.reports.byId(id));
export const listReports = () => api.get<ReportListItem[]>(endpoints.reports.list);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const POLL_INTERVAL_MS = 3000;
const POLL_MAX_ATTEMPTS = 40;

/**
 * Generate a report and resolve with the FULL report (sections populated). The
 * sync backend path returns sections inline; the queued path returns
 * `generating` with empty sections, so we poll status then GET the full report.
 * A 402 from generate propagates (locked → paywall).
 */
export async function generateAndWait(type: string, locale: string): Promise<ReportResponse> {
  const initial = await generateReport(type, locale);
  if (isReportDone(initial.status) && initial.sections?.length) return initial;
  if (isReportFailed(initial.status)) throw new ApiError('Report generation failed');

  for (let i = 0; i < POLL_MAX_ATTEMPTS; i++) {
    await sleep(POLL_INTERVAL_MS);
    const st = await getReportStatus(initial.id);
    if (isReportFailed(st.status)) throw new ApiError('Report generation failed');
    if (isReportDone(st.status)) return getReport(initial.id);
  }
  throw new ApiError('Your report is taking longer than expected. Check back shortly.');
}
