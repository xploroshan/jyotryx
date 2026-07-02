import { isQueuedAnalysis, isComplete, isFailed, isMajorLine, normalizeStrength, normalizeProminence } from './helpers';

describe('palmistry helpers', () => {
  it('detects queued vs sync analysis', () => {
    expect(isQueuedAnalysis({ status: 'processing', lines: [], id: 'x' })).toBe(true);
    expect(isQueuedAnalysis({ status: 'ok', lines: [], id: 'x' })).toBe(true); // empty lines + id
    expect(isQueuedAnalysis({ status: 'completed', lines: [{ name: 'Heart' } as never], id: 'x' })).toBe(false);
    expect(isQueuedAnalysis({ status: 'ok', lines: [], id: '' })).toBe(false); // no id
  });

  it('status checks', () => {
    expect(isComplete('completed')).toBe(true);
    expect(isComplete('processing')).toBe(false);
    expect(isFailed('failed')).toBe(true);
  });

  it('classifies major lines by keyword', () => {
    expect(isMajorLine('Heart Line')).toBe(true);
    expect(isMajorLine('Life line')).toBe(true);
    expect(isMajorLine('Girdle of Venus')).toBe(false);
  });

  it('normalizes strength and prominence (incl. backend synonyms)', () => {
    expect(normalizeStrength('deep')).toBe('strong');
    expect(normalizeStrength('average')).toBe('moderate');
    expect(normalizeStrength('faint')).toBe('weak');
    expect(normalizeProminence('elevated')).toBe('high');
    expect(normalizeProminence('flat')).toBe('low');
    expect(normalizeProminence('normal')).toBe('medium');
  });
});
