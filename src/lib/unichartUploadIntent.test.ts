import {
  isBulkRosterPdfIntent,
  isClinicUniChartsBulkExport,
  shouldUseUnichartBatchApply,
} from './unichartUploadIntent';

describe('isClinicUniChartsBulkExport', () => {
  it('detects Clinic_unicharts.pdf', () => {
    expect(isClinicUniChartsBulkExport('Clinic_unicharts.pdf')).toBe(true);
  });
});

describe('isBulkRosterPdfIntent', () => {
  it('treats clinic unicharts export as bulk even without keywords', () => {
    expect(isBulkRosterPdfIntent('Clinic_unicharts.pdf', '')).toBe(true);
  });

  it('matches backfill phrasing', () => {
    expect(
      isBulkRosterPdfIntent('export.pdf', 'Backfill and update all patient records'),
    ).toBe(true);
  });

  it('does not treat single chart filenames as bulk without intent', () => {
    expect(isBulkRosterPdfIntent('Smith_John_chart.pdf', 'review this chart')).toBe(false);
  });
});

describe('shouldUseUnichartBatchApply', () => {
  it('uses batch for large PDFs', () => {
    expect(shouldUseUnichartBatchApply('one.pdf', '', 6 * 1024 * 1024)).toBe(true);
  });

  it('uses preview path for small single-chart files', () => {
    expect(shouldUseUnichartBatchApply('Smith_chart.pdf', 'apply', 500_000)).toBe(false);
  });
});
