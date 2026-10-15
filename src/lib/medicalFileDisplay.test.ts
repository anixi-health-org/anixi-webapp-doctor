import {
  formatMedicalFileTitle,
  isMachineMedicalFilename,
} from './medicalFileDisplay';

describe('medicalFileDisplay', () => {
  it('detects machine-generated filenames', () => {
    expect(
      isMachineMedicalFilename('1789439481954_5964B498-475A-48E8-9B16-E74B1E91EF06.heic'),
    ).toBe(true);
    expect(isMachineMedicalFilename('Discharge summary.pdf')).toBe(false);
  });

  it('formats a friendly title for shared uploads', () => {
    expect(
      formatMedicalFileTitle({
        title: '1789439481954_5964B498-475A-48E8-9B16-E74B1E91EF06.heic',
        category: 'notes',
        mimeType: 'image/heic',
      }),
    ).toBe('Patient note (HEIC)');
  });
});
