import { hasPdfFieldContent, visiblePdfFields } from './practicePatientRecordPdfFormat';

describe('practicePatientRecordPdfFormat', () => {
  it('hides empty contact rows in PDF exports', () => {
    const fields = [
      { label: 'Email', value: 'a@b.co' },
      { label: 'Home phone', value: '—' },
      { label: 'Work phone', value: '' },
    ];
    expect(visiblePdfFields(fields)).toEqual([{ label: 'Email', value: 'a@b.co' }]);
  });

  it('detects meaningful field content', () => {
    expect(hasPdfFieldContent('—')).toBe(false);
    expect(hasPdfFieldContent('Director')).toBe(true);
  });
});
