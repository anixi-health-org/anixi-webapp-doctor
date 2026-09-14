import { buildAppointmentListQuery } from './djangoApiService';

describe('buildAppointmentListQuery', () => {
  it('keeps doctor role lists on the doctor filter', () => {
    expect(buildAppointmentListQuery('doctor')).toBe('role=doctor');
  });

  it('sends practiceId for clinic-wide lists instead of role=doctor', () => {
    expect(
      buildAppointmentListQuery({
        practiceId: 'practice-1',
        fromDate: '2026-09-14',
        toDate: '2026-09-14',
      }),
    ).toBe('practiceId=practice-1&fromDate=2026-09-14&toDate=2026-09-14');
  });

  it('includes doctorId when filtering a practice diary', () => {
    expect(
      buildAppointmentListQuery({
        practiceId: 'practice-1',
        doctorId: 'doc-9',
      }),
    ).toBe('practiceId=practice-1&doctorId=doc-9');
  });
});
