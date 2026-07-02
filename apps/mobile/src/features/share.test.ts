import { buildSharePayload } from './share';
import type { MatchingData } from './results/responses';

const data: MatchingData = {
  totalScore: 28,
  maxScore: 36,
  manglikA: false,
  manglikB: true,
  compatibility: 'Very good',
  recommendation: 'A promising match.',
  gunaDetails: [
    { guna: 'Varna', description: 'work/ego', obtainedPoints: 1, maxPoints: 1 },
    { guna: 'Nadi', description: 'health', obtainedPoints: 8, maxPoints: 8 },
  ],
};

describe('buildSharePayload', () => {
  it('uses collected names and reshapes gunaDetails; omits percentage', () => {
    const p = buildSharePayload(data, { a_name: 'Asha', b_name: 'Ravi' }, 'en');
    expect(p).toEqual({
      partner1Name: 'Asha',
      partner2Name: 'Ravi',
      totalScore: 28,
      maxScore: 36,
      compatibility: 'Very good',
      recommendation: 'A promising match.',
      manglikA: false,
      manglikB: true,
      gunaDetails: [
        { guna: 'Varna', description: 'work/ego', obtainedPoints: 1, maxPoints: 1 },
        { guna: 'Nadi', description: 'health', obtainedPoints: 8, maxPoints: 8 },
      ],
      locale: 'en',
    });
    expect(p).not.toHaveProperty('percentage');
  });

  it('falls back to Partner A/B when names are blank', () => {
    const p = buildSharePayload(data, { a_name: '', b_name: '  ' }, 'hi');
    expect(p.partner1Name).toBe('Partner A');
    expect(p.partner2Name).toBe('Partner B');
    expect(p.locale).toBe('hi');
  });
});
