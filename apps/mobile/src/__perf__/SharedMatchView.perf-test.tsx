/**
 * Reassure render-performance regression test (plan §6/§7d). Measures the
 * SharedMatchView — a representative data-heavy result screen (score bar +
 * koota table). Run via `npm run perf`; CI compares against the committed
 * baseline (.reassure/baseline.perf).
 */
import { measureRenders } from 'reassure';
import { SharedMatchView } from '@/components/match/SharedMatchView';
import type { SharedMatchPayload } from '@/features/results/responses.p4';

// Reassure runs many measured render passes; the jest default 5s is too tight.
jest.setTimeout(120_000);

const data: SharedMatchPayload = {
  token: 't',
  personAName: 'Asha',
  personBName: 'Ravi',
  totalScore: 28,
  maxScore: 36,
  percentage: 78,
  compatibility: 'Very good',
  recommendation: 'A promising match with strong emotional alignment.',
  manglikA: false,
  manglikB: true,
  gunaDetails: Array.from({ length: 8 }, (_, i) => ({
    guna: `Koota ${i + 1}`,
    description: 'Compatibility dimension',
    maxPoints: 8,
    obtainedPoints: (i * 3) % 8,
  })),
  createdAt: '2026-07-02T00:00:00Z',
};

test('SharedMatchView renders within budget', async () => {
  await measureRenders(<SharedMatchView data={data} />);
});
