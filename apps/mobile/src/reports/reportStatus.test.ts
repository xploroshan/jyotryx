import { isReportDone, isReportFailed, isReportGenerating, REPORT_TYPES } from './reportStatus';

describe('report status', () => {
  it('treats ready and completed as done', () => {
    expect(isReportDone('ready')).toBe(true);
    expect(isReportDone('completed')).toBe(true);
    expect(isReportDone('READY')).toBe(true);
    expect(isReportDone('generating')).toBe(false);
  });
  it('detects failure', () => {
    expect(isReportFailed('failed')).toBe(true);
    expect(isReportFailed('ready')).toBe(false);
  });
  it('treats generating/unknown as still generating', () => {
    expect(isReportGenerating('generating')).toBe(true);
    expect(isReportGenerating('')).toBe(true);
    expect(isReportGenerating('ready')).toBe(false);
    expect(isReportGenerating('failed')).toBe(false);
  });
  it('exposes the 6 report types', () => {
    expect(REPORT_TYPES.map((r) => r.type).sort()).toEqual(
      ['ANNUAL', 'CAREER', 'LIFE', 'MARRIAGE', 'PALM', 'WEALTH'],
    );
  });
});
