import {
  buildClinicalReportAyahPrompt,
  consumeClinicalReportDraftForAppointment,
  persistClinicalReportDraftForAppointment,
} from './clinicalReportAyahBridge';

describe('clinicalReportAyahBridge', () => {
  it('builds scribe prompt with patient and appointment ids', () => {
    const prompt = buildClinicalReportAyahPrompt({
      patientName: 'Thabo M.',
      patientId: 'patient-1',
      appointmentId: 'appt-1',
      scribeSummary: 'Patient reports improved glucose.',
    });
    expect(prompt).toContain('patient-1');
    expect(prompt).toContain('appt-1');
    expect(prompt).toContain('draft-clinical-report');
    expect(prompt.toLowerCase()).toContain('never invent');
  });

  it('persists and consumes session draft payload', () => {
    persistClinicalReportDraftForAppointment('appt-99', { subjective: 'Test' });
    const payload = consumeClinicalReportDraftForAppointment('appt-99');
    expect(payload).toEqual({ subjective: 'Test' });
    expect(consumeClinicalReportDraftForAppointment('appt-99')).toBeNull();
  });
});
