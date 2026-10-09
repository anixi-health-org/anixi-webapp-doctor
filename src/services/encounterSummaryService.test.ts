import {
  extractAyahEncounterSummary,
  mergePatientEncounterTimeline,
} from './encounterSummaryService';
import type { Appointment } from '../types';
import { AYAH_SCRIBE_ACTION_ID } from './consultScribeService';

describe('extractAyahEncounterSummary', () => {
  it('returns structured summary from Ayah scribe action', () => {
    const appointment = {
      id: 'apt-1',
      patientId: 'p1',
      doctorId: 'd1',
      date: new Date('2026-10-08'),
      time: '10:00',
      status: 'completed',
      postConsultActions: [
        {
          id: AYAH_SCRIBE_ACTION_ID,
          type: 'post_consult_note',
          title: 'Ayah consult note',
          content: 'Visit summary\nFollow-up in 2 weeks',
          status: 'draft',
          metadata: {
            source: 'ayah_scribe',
            summary: 'Patient reviewed palpitations and agreed on beta blocker plan.',
          },
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
    } as unknown as Appointment;

    const row = extractAyahEncounterSummary(appointment);
    expect(row?.note.summary).toContain('palpitations');
    expect(row?.appointmentId).toBe('apt-1');
  });
});

describe('mergePatientEncounterTimeline', () => {
  it('merges Ayah summaries with imported rows and dedupes identical imports', () => {
    const ayah = [
      {
        appointmentId: 'apt-2',
        date: new Date('2026-10-08'),
        time: '09:30',
        typeLabel: 'Video consult',
        note: {
          summary: 'Stable on current meds.',
          subjective: '',
          objective: '',
          assessment: '',
          plan: '',
          followUps: [],
          fullText: 'Stable on current meds.',
        },
      },
    ];

    const timeline = mergePatientEncounterTimeline(ayah, [
      { date: '2011-04-06', type: 'Office Visit - New', number: '1' },
      { date: '2011-04-06', type: 'Office Visit - New', number: '1' },
    ]);

    expect(timeline).toHaveLength(2);
    expect(timeline[0]?.source).toBe('ayah');
    expect(timeline[1]?.source).toBe('unichart');
    expect(timeline[1]?.summaryLine).toContain('Office Visit - New');
  });
});
