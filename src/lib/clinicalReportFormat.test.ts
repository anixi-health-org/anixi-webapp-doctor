import { buildClinicalReportAyahPrompt } from './clinicalReportAyahBridge';
import {
  buildIdentificationPrefill,
  clinicalReportFileName,
  emptyClinicalReportSections,
  formatClinicalReportText,
  parseClinicalReportSections,
} from './clinicalReportFormat';

describe('clinicalReportFormat', () => {
  it('formats non-empty sections with titles', () => {
    const sections = emptyClinicalReportSections();
    sections.chiefComplaint = 'Headache for 3 days';
    sections.assessment = 'Likely tension headache';
    const text = formatClinicalReportText(sections);
    expect(text).toContain('2. Chief complaint');
    expect(text).toContain('Headache for 3 days');
    expect(text).toContain('10. Assessment');
  });

  it('parses structured sections from metadata', () => {
    const sections = emptyClinicalReportSections();
    sections.plan = 'Follow up in 2 weeks';
    const parsed = parseClinicalReportSections('', {
      sections: JSON.stringify(sections),
      format: 'hp-v1',
    });
    expect(parsed.plan).toBe('Follow up in 2 weeks');
  });

  it('builds an Ayah prompt that requires chart tools and draft-clinical-report', () => {
    const prompt = buildClinicalReportAyahPrompt({
      patientName: 'Thabo M.',
      patientId: 'p1',
      appointmentId: 'a1',
      visitNote: 'Headache today',
    });
    expect(prompt).toContain('draft-clinical-report');
    expect(prompt).toContain('get-patient-overview');
    expect(prompt).toContain('Headache today');
  });

  it('builds export file names for pdf and docx', () => {
    expect(clinicalReportFileName('Thabo M.', 'pdf')).toMatch(/consultation-report-thabo-m-.*\.pdf$/);
    expect(clinicalReportFileName('Thabo M.', 'docx')).toMatch(/consultation-report-thabo-m-.*\.docx$/);
  });

  it('builds identification prefill from patient context', () => {
    const text = buildIdentificationPrefill({
      patientName: 'Thabo M.',
      patientAge: 42,
      doctorName: 'Dr Smith',
    });
    expect(text).toContain('Thabo M.');
    expect(text).toContain('42');
    expect(text).toContain('Dr Smith');
  });
});
