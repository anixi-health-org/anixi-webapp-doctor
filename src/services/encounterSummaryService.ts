import type { Appointment, PostConsultAction } from '../types';
import {
  getDoctorPatientAppointments,
  getPracticePatientEncounterAppointments,
} from './appointmentService';
import { AYAH_SCRIBE_ACTION_ID } from './consultScribeService';
import { scribeNoteFromAction, type ConsultScribeNote } from '../lib/consultScribeNote';
import { formatAppointmentTypeLabel } from '../utils/teleconsult';

export type PatientEncounterSummary = {
  appointmentId: string;
  date: Date;
  time?: string;
  typeLabel: string;
  patientName?: string;
  doctorName?: string;
  note: ConsultScribeNote;
};

function isAyahScribeAction(action: PostConsultAction): boolean {
  if (action.type !== 'post_consult_note') return false;
  if (action.id === AYAH_SCRIBE_ACTION_ID) return true;
  if (action.metadata?.source === 'ayah_scribe') return true;
  return Boolean(action.title?.toLowerCase().includes('ayah'));
}

export function extractAyahEncounterSummary(
  appointment: Appointment,
): PatientEncounterSummary | null {
  const action = (appointment.postConsultActions ?? []).find(isAyahScribeAction);
  if (!action?.content?.trim()) return null;
  const note = scribeNoteFromAction(action);
  if (!note.summary && !note.fullText) return null;
  return {
    appointmentId: appointment.id,
    date: appointment.date,
    time: appointment.time,
    typeLabel: formatAppointmentTypeLabel(appointment),
    patientName: appointment.patientName,
    doctorName: appointment.doctorName,
    note,
  };
}

function sortByVisitDate(a: Appointment, b: Appointment): number {
  return b.date.getTime() - a.date.getTime();
}

export type UnichartEncounterRow = {
  number?: string;
  date?: string;
  type?: string;
};

export type PatientEncounterTimelineItem = {
  id: string;
  sortDate: Date;
  dateLabel: string;
  title: string;
  summaryLine: string;
  source: 'ayah' | 'unichart';
  appointmentId?: string;
  doctorName?: string;
  note?: ConsultScribeNote;
  unichart?: UnichartEncounterRow;
};

async function loadPatientAppointments(
  patientId: string,
  opts?: { doctorId?: string; practiceId?: string },
): Promise<Appointment[]> {
  if (!patientId) return [];

  let appointments: Appointment[] = [];
  if (opts?.practiceId) {
    appointments = await getPracticePatientEncounterAppointments(opts.practiceId, patientId);
  } else if (opts?.doctorId) {
    appointments = await getDoctorPatientAppointments(opts.doctorId, patientId);
  }
  return [...appointments].sort(sortByVisitDate);
}

export async function getPatientEncounterSummaries(
  patientId: string,
  opts?: { doctorId?: string; practiceId?: string },
): Promise<PatientEncounterSummary[]> {
  const appointments = await loadPatientAppointments(patientId, opts);
  const rows: PatientEncounterSummary[] = [];
  for (const apt of appointments) {
    const summary = extractAyahEncounterSummary(apt);
    if (summary) rows.push(summary);
  }
  return rows;
}

export async function getLastPatientEncounterSummary(
  patientId: string,
  opts?: { doctorId?: string; practiceId?: string },
): Promise<PatientEncounterSummary | null> {
  if (!opts?.practiceId && !opts?.doctorId) return null;
  const rows = await getPatientEncounterSummaries(patientId, opts);
  return rows[0] ?? null;
}

function parseUnichartDate(date?: string): Date {
  if (!date?.trim()) return new Date(0);
  const parsed = new Date(date.includes('T') ? date : `${date}T12:00:00`);
  return Number.isNaN(parsed.getTime()) ? new Date(0) : parsed;
}

function formatEncounterDateLabel(date: Date, time?: string): string {
  if (date.getTime() === 0) return 'Date unknown';
  const label = date.toLocaleDateString('en-ZA', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
  return time ? `${label} · ${time}` : label;
}

function unichartSummaryLine(row: UnichartEncounterRow): string {
  const headline = [row.type, row.number ? `#${row.number}` : ''].filter(Boolean).join(' · ');
  return headline ? `${headline} · imported chart` : 'Imported chart encounter';
}

export function mergePatientEncounterTimeline(
  ayahSummaries: PatientEncounterSummary[],
  unichartEncounters: UnichartEncounterRow[] = [],
): PatientEncounterTimelineItem[] {
  const items: PatientEncounterTimelineItem[] = ayahSummaries.map((row) => ({
    id: `ayah-${row.appointmentId}`,
    sortDate: row.date,
    dateLabel: formatEncounterDateLabel(row.date, row.time),
    title: row.typeLabel,
    summaryLine:
      row.note.summary.trim() ||
      row.note.fullText.trim().slice(0, 280) ||
      'Ayah visit summary available — expand for full SOAP note.',
    source: 'ayah',
    appointmentId: row.appointmentId,
    doctorName: row.doctorName,
    note: row.note,
  }));

  const seenUnichart = new Set<string>();
  for (const row of unichartEncounters) {
    const signature = [row.date ?? '', row.type ?? '', row.number ?? ''].join('|');
    if (seenUnichart.has(signature)) continue;
    seenUnichart.add(signature);

    const sortDate = parseUnichartDate(row.date);
    items.push({
      id: `unichart-${signature}`,
      sortDate,
      dateLabel: formatEncounterDateLabel(sortDate),
      title: row.type?.trim() || 'Imported encounter',
      summaryLine: unichartSummaryLine(row),
      source: 'unichart',
      unichart: row,
    });
  }

  return items.sort((a, b) => b.sortDate.getTime() - a.sortDate.getTime());
}

export async function getPatientEncounterTimeline(
  patientId: string,
  opts?: {
    doctorId?: string;
    practiceId?: string;
    unichartEncounters?: UnichartEncounterRow[];
  },
): Promise<PatientEncounterTimelineItem[]> {
  if (!patientId) return [];
  const ayahSummaries =
    opts?.practiceId || opts?.doctorId
      ? await getPatientEncounterSummaries(patientId, opts)
      : [];
  return mergePatientEncounterTimeline(ayahSummaries, opts?.unichartEncounters ?? []);
}
