import { getDoctorPatientAppointments } from './appointmentService';
import { getDoctorPatientAdherenceSummary } from './adherenceService';
import { getMoodEntriesForMonth, getPatientMedications, getVitalsLogs } from './logsService';
import { getPatientUploadedFiles } from './patientDocumentService';
import { getPatientForDoctorView } from './patientManagementService';

export type AyahPatientChartSnapshot = {
  patientId: string;
  displayName: string;
  chronicConditions: string[];
  allergies: string[];
  medications: Array<{ name: string; dosage?: string }>;
  appointments: Array<{
    id: string;
    doctorName: string;
    doctorId?: string;
    status: string;
    startAt?: string;
    notes?: string;
  }>;
  vitals: Array<{
    id?: string;
    type: string;
    value?: string;
    unit?: string;
    recordedAt?: string;
  }>;
  documents: Array<{
    id: string;
    title: string;
    category: string;
    uploadedAt?: string;
  }>;
  mood: Array<{
    mood?: string;
    note?: string;
    createdAt?: string;
  }>;
  adherenceRate: number | null;
};

function asIso(value: unknown): string | undefined {
  if (!value) return undefined;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString();
  if (typeof value === 'string' && value) {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? value : parsed.toISOString();
  }
  return undefined;
}

function vitalRows(
  logs: Awaited<ReturnType<typeof getVitalsLogs>>,
): AyahPatientChartSnapshot['vitals'] {
  return logs.slice(0, 12).flatMap((log) => {
    const recordedAt = asIso(log.timestamp);
    const rows: AyahPatientChartSnapshot['vitals'] = [];
    if (log.heartRate != null) {
      rows.push({ type: 'heart_rate', value: String(log.heartRate), unit: 'bpm', recordedAt });
    }
    if (log.bloodPressure?.systolic != null) {
      rows.push({
        type: 'blood_pressure',
        value: `${log.bloodPressure.systolic}/${log.bloodPressure.diastolic ?? ''}`,
        unit: 'mmHg',
        recordedAt,
      });
    }
    if (log.temperature != null) {
      rows.push({ type: 'temperature', value: String(log.temperature), recordedAt });
    }
    if (log.bloodSugar != null) {
      rows.push({ type: 'blood_sugar', value: String(log.bloodSugar), recordedAt });
    }
    if (!rows.length && log.notes) {
      rows.push({ type: 'vital', value: log.notes, recordedAt });
    }
    return rows;
  });
}

export async function loadAyahPatientChart(
  doctorId: string,
  patientId: string,
): Promise<AyahPatientChartSnapshot | undefined> {
  if (!doctorId || !patientId) return undefined;

  const now = new Date();
  const [profile, medications, appointments, files, vitals, mood, adherence] =
    await Promise.all([
      getPatientForDoctorView(doctorId, patientId).catch(() => null),
      getPatientMedications(patientId).catch(() => []),
      getDoctorPatientAppointments(doctorId, patientId).catch(() => []),
      getPatientUploadedFiles([patientId]).catch(() => []),
      getVitalsLogs(patientId, now.getFullYear(), now.getMonth()).catch(() => []),
      getMoodEntriesForMonth(patientId, now.getFullYear(), now.getMonth() + 1).catch(() => []),
      getDoctorPatientAdherenceSummary(doctorId, patientId, 30).catch(() => null),
    ]);

  const treatments = (profile?.currentTreatments ?? []).map((item) => ({
    name: item.name,
    dosage: item.dosage,
  }));
  const meds = (
    (medications ?? []) as Array<{ name?: string; medicationName?: string; dosage?: string }>
  )
    .map((med) => ({
      name: String(med.name ?? med.medicationName ?? '').trim(),
      dosage: typeof med.dosage === 'string' ? med.dosage : undefined,
    }))
    .filter((med) => med.name);

  return {
    patientId,
    displayName: profile?.displayName || 'Patient',
    chronicConditions: profile?.chronicDiseases ?? [],
    allergies: profile?.allergies ?? [],
    medications: meds.length ? meds : treatments,
    appointments: appointments.slice(0, 10).map((apt) => ({
      id: apt.id,
      doctorName: 'You',
      doctorId: apt.doctorId,
      status: apt.status,
      startAt: asIso(apt.startAt ?? apt.scheduledAt ?? apt.date),
      notes: apt.notes,
    })),
    vitals: vitalRows(vitals),
    documents: files.slice(0, 20).map((file) => ({
      id: file.id,
      title: file.name,
      category: file.category,
      uploadedAt: asIso(file.uploadedAt),
    })),
    mood: (mood ?? []).slice(0, 8).map((entry: { mood?: unknown; notes?: string; createdAt?: unknown }) => ({
      mood: entry.mood != null ? String(entry.mood) : undefined,
      note: typeof entry.notes === 'string' ? entry.notes : undefined,
      createdAt: asIso(entry.createdAt),
    })),
    adherenceRate:
      adherence && adherence.statusLabel !== 'no-data' ? adherence.adherenceRate : null,
  };
}
