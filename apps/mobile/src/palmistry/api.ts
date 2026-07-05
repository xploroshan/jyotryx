import { ApiError, endpoints } from '@myastro360/shared';
import { api } from '@/api/client';
import type { PalmistryAnalysis, PalmistryStatusResponse } from '@/features/results/responses.p4';
import { isQueuedAnalysis, isComplete, isFailed } from './helpers';

export interface PalmImage {
  uri: string;
  name: string;
  type: string;
}

/** Multipart upload — field `image` + `gender` (drives hand), `locale` only when ≠ en. */
export async function analyze(image: PalmImage, gender: string, locale: string): Promise<PalmistryAnalysis> {
  const form = new FormData();
  // React Native FormData accepts a {uri,name,type} file part.
  form.append('image', { uri: image.uri, name: image.name, type: image.type } as unknown as Blob);
  if (gender) form.append('gender', gender);
  if (locale && locale !== 'en') form.append('locale', locale);
  return api.upload<PalmistryAnalysis>(endpoints.palmistry.analyze, form);
}

export const pollStatus = (id: string) => api.get<PalmistryStatusResponse>(endpoints.palmistry.status(id));

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const POLL_INTERVAL_MS = 3000;
const POLL_MAX_ATTEMPTS = 40;

/**
 * Upload → (poll if queued) → resolve with the completed analysis. Sync mode
 * returns the full analysis inline; queued mode returns a placeholder we poll on
 * `GET /palmistry/:id/status` (reading is embedded in `status.analysis`). A 402
 * from upload propagates (locked → paywall).
 */
export async function analyzeAndWait(image: PalmImage, gender: string, locale: string): Promise<PalmistryAnalysis> {
  const initial = await analyze(image, gender, locale);
  if (!isQueuedAnalysis(initial)) return initial;

  const id = initial.id;
  let consecutiveErrors = 0;
  for (let i = 0; i < POLL_MAX_ATTEMPTS; i++) {
    await sleep(POLL_INTERVAL_MS);
    let st: PalmistryStatusResponse;
    try {
      st = await pollStatus(id);
      consecutiveErrors = 0;
    } catch {
      // A single transient network/timeout error must NOT abandon a reading the
      // user already paid for — the server is still completing it. Tolerate a
      // few consecutive failures and keep polling.
      if (++consecutiveErrors >= 5) {
        throw new ApiError('Your reading is taking longer than expected. Please try again.');
      }
      continue;
    }
    if (isFailed(st.status)) throw new ApiError('Palmistry analysis failed. Please try another photo.');
    if (isComplete(st.status) && st.analysis) return st.analysis;
  }
  throw new ApiError('Your reading is taking longer than expected. Please try again.');
}
