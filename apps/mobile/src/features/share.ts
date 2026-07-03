/**
 * Pure builder for the match-share POST body. Reshapes a matching result + the
 * collected partner names into the exact `POST /astrology/matching/share`
 * payload (partner1Name/partner2Name; percentage is server-computed, not sent).
 */
import type { Values } from './types';
import type { MatchingData } from './results/responses';
import type { CreateSharePayload } from './results/responses.p4';

export function buildSharePayload(data: MatchingData, values: Values, locale: string): CreateSharePayload {
  return {
    partner1Name: values.a_name?.trim() || 'Partner A',
    partner2Name: values.b_name?.trim() || 'Partner B',
    totalScore: data.totalScore,
    maxScore: data.maxScore,
    compatibility: data.compatibility,
    recommendation: data.recommendation,
    manglikA: data.manglikA,
    manglikB: data.manglikB,
    gunaDetails: (data.gunaDetails ?? []).map((g) => ({
      guna: g.guna,
      description: g.description,
      maxPoints: g.maxPoints,
      obtainedPoints: g.obtainedPoints,
    })),
    locale,
  };
}
