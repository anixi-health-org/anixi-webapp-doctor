/**
 * Unified clinical metrics at patient / doctor / practice scope:
 * vitals, adherence, appointments, labs, symptoms, treatment, needing attention.
 */
import type { Appointment, Patient } from '../types';
import {
  classifyDoseEvent,
  labelFromAdherenceRate,
  outcomeToLegacyBucket,
  type AdherenceRateBand,
} from '../lib/adherenceEventModel';
import {
  evaluateVitalsReading,
  worstSeverity,
  type VitalSeverity,
} from '../lib/vitalMetricRules';
import { getActiveAdherenceRules } from './adherenceRulesService';
import { loadVitalRules } from './vitalRulesService';
import {
  djangoListAdherence,
  djangoListMedicalFiles,
  djangoListMood,
  type DjangoAdherenceRecord,
} from './djangoApiService';
import { getDoctorAppointments } from './appointmentService';
import { getDoctorPatients, getPatientStatus } from './patientManagementService';
import { listPracticePatients } from './practicePatientService';
import { listPracticeClinicians } from './practiceSettingsService';
import { convertTimestamp } from '../utils/dateFormatter';

export type ClinicalAttentionReason =
  | 'adherence_low'
  | 'adherence_moderate'
  | 'vitals_urgent'
  | 'vitals_warning'
  | 'pending_appointment'
  | 'inactive_status'
  | 'chronic_complex';

export type PatientClinicalMetrics = {
  patientId: string;
  displayName: string;
  daysBack: number;
  adherence: {
    rate: number;
    band: AdherenceRateBand;
    taken: number;
    missed: number;
    pending: number;
  };
  vitals: {
    readings: number;
    urgent: number;
    warning: number;
    normal: number;
    worst: VitalSeverity;
  };
  appointments: {
    total: number;
    completed: number;
    cancelled: number;
    pending: number;
    upcoming: number;
  };
  labs: {
    documentCount: number;
  };
  symptoms: {
    checkIns: number;
  };
  treatment: {
    activeTreatments: number;
    chronicConditions: number;
  };
  needsAttention: boolean;
  attentionReasons: ClinicalAttentionReason[];
};

export type RosterClinicalMetrics = {
  scope: 'doctor' | 'practice';
  scopeId: string;
  daysBack: number;
  patientCount: number;
  needingAttention: number;
  avgAdherence: number | null;
  vitalsUrgentPatients: number;
  vitalsWarningPatients: number;
  appointments: {
    total: number;
    completed: number;
    pending: number;
    cancelled: number;
    completionRate: number;
  };
  labsDocuments: number;
  symptomCheckIns: number;
  activeTreatments: number;
  chronicPatients: number;
  patients: PatientClinicalMetrics[];
};

function daysAgo(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(0, 0, 0, 0);
  return d;
}

function isLabDocument(name: string, type?: string): boolean {
  const hay = `${name} ${type || ''}`.toLowerCase();
  return /lab|patholog|blood.?work|haemat|hemat|chemistry|panel|result/.test(hay);
}

function parseVitalFromRecord(record: DjangoAdherenceRecord): {
  heartRate?: number;
  bloodPressure?: { systolic: number; diastolic: number };
  temperature?: number;
  bloodSugar?: number;
  spo2?: number;
} {
  const name = (record.medicationName || '').toLowerCase();
  const raw = record.recordedValue;
  const value = raw == null ? '' : String(raw);
  if (name.includes('blood pressure') || name.includes('bp') || value.includes('/')) {
    const [s, d] = value.split(/[/-]/).map((p) => Number(p.trim()));
    if (Number.isFinite(s) && Number.isFinite(d)) {
      return { bloodPressure: { systolic: s, diastolic: d } };
    }
  }
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return {};
  if (name.includes('heart') || name.includes('pulse') || name.includes('hr')) {
    return { heartRate: numeric };
  }
  if (name.includes('temp')) return { temperature: numeric };
  if (name.includes('glucose') || name.includes('sugar')) return { bloodSugar: numeric };
  if (name.includes('spo2') || name.includes('oxygen') || name.includes('o2')) {
    return { spo2: numeric };
  }
  return {};
}

function appointmentBuckets(apts: Appointment[], now = new Date()) {
  let completed = 0;
  let cancelled = 0;
  let pending = 0;
  let upcoming = 0;
  apts.forEach((a) => {
    if (a.status === 'completed') completed += 1;
    else if (a.status === 'cancelled') cancelled += 1;
    else if (a.status === 'pending') pending += 1;
    if (
      a.date >= now &&
      a.status !== 'cancelled' &&
      a.status !== 'completed' &&
      a.status !== 'no_show'
    ) {
      upcoming += 1;
    }
  });
  return { total: apts.length, completed, cancelled, pending, upcoming };
}

export function buildAttentionReasons(
  metrics: Omit<PatientClinicalMetrics, 'needsAttention' | 'attentionReasons'>,
  patient?: Patient | null
): ClinicalAttentionReason[] {
  const reasons: ClinicalAttentionReason[] = [];
  if (metrics.adherence.band === 'low') reasons.push('adherence_low');
  if (metrics.adherence.band === 'moderate') reasons.push('adherence_moderate');
  if (metrics.vitals.urgent > 0) reasons.push('vitals_urgent');
  else if (metrics.vitals.warning > 0) reasons.push('vitals_warning');
  if (metrics.appointments.pending > 0) reasons.push('pending_appointment');
  if (patient && getPatientStatus(patient) === 'inactive') {
    reasons.push('inactive_status');
  }
  if ((patient?.chronicDiseases?.length ?? 0) >= 2) reasons.push('chronic_complex');
  return reasons;
}

export async function getPatientClinicalMetrics(
  patient: Patient,
  options?: {
    daysBack?: number;
    appointments?: Appointment[];
    practiceId?: string | null;
    includeLabsAndSymptoms?: boolean;
  }
): Promise<PatientClinicalMetrics> {
  const daysBack = options?.daysBack ?? 30;
  const since = daysAgo(daysBack);
  const now = new Date();
  const fromDate = since.toISOString();
  const toDate = now.toISOString();
  const adherenceRules = getActiveAdherenceRules();
  const vitalRules = loadVitalRules(options?.practiceId ?? null);

  const patientApts =
    options?.appointments?.filter((a) => a.patientId === patient.id) ?? [];

  const [medDocs, vitalDocs, moodEntries, files] = await Promise.all([
    djangoListAdherence(patient.id, {
      fromDate,
      toDate,
      type: 'medication',
      limit: 400,
    }).catch(() => [] as DjangoAdherenceRecord[]),
    djangoListAdherence(patient.id, {
      fromDate,
      toDate,
      type: 'vital',
      limit: 200,
    }).catch(() => [] as DjangoAdherenceRecord[]),
    options?.includeLabsAndSymptoms === false
      ? Promise.resolve([])
      : djangoListMood(patient.id, { fromDate, toDate, limit: 100 }).catch(() => []),
    options?.includeLabsAndSymptoms === false
      ? Promise.resolve([])
      : djangoListMedicalFiles(patient.id).catch(() => []),
  ]);

  let taken = 0;
  let missed = 0;
  let pending = 0;
  medDocs.forEach((row) => {
    const scheduled = convertTimestamp(row.scheduledTime ?? row.scheduledFor);
    const takenTime = convertTimestamp(row.takenTime ?? row.recordedAt);
    const outcome = classifyDoseEvent(
      { apiStatus: row.status, scheduledTime: scheduled, takenTime, now },
      adherenceRules
    );
    const status = outcomeToLegacyBucket(outcome, adherenceRules);
    if (status === 'taken') taken += 1;
    else if (status === 'missed') missed += 1;
    else pending += 1;
  });
  const denom = taken + missed + pending;
  const rate = denom > 0 ? Math.round((taken / denom) * 100) : 0;
  const band = labelFromAdherenceRate(rate, denom > 0, adherenceRules);

  let urgent = 0;
  let warning = 0;
  let normal = 0;
  const severities: VitalSeverity[] = [];
  vitalDocs.forEach((row) => {
    const reading = parseVitalFromRecord(row);
    const evaluated = evaluateVitalsReading(reading, vitalRules).filter(
      (e) => e.value != null
    );
    if (evaluated.length === 0) return;
    const worst = worstSeverity(evaluated.map((e) => e.severity));
    severities.push(worst);
    if (worst === 'urgent') urgent += 1;
    else if (worst === 'warning') warning += 1;
    else if (worst === 'normal') normal += 1;
  });

  const labDocs = (files as Array<Record<string, unknown>>).filter((f) =>
    isLabDocument(String(f.fileName ?? f.name ?? ''), String(f.fileType ?? f.type ?? ''))
  );

  const base: Omit<PatientClinicalMetrics, 'needsAttention' | 'attentionReasons'> = {
    patientId: patient.id,
    displayName: patient.displayName || patient.email || 'Patient',
    daysBack,
    adherence: { rate, band, taken, missed, pending },
    vitals: {
      readings: vitalDocs.length,
      urgent,
      warning,
      normal,
      worst: worstSeverity(severities),
    },
    appointments: appointmentBuckets(patientApts, now),
    labs: { documentCount: labDocs.length },
    symptoms: { checkIns: moodEntries.length },
    treatment: {
      activeTreatments: patient.currentTreatments?.length ?? 0,
      chronicConditions: patient.chronicDiseases?.length ?? 0,
    },
  };

  const attentionReasons = buildAttentionReasons(base, patient);
  return {
    ...base,
    needsAttention: attentionReasons.length > 0,
    attentionReasons,
  };
}

async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let index = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (index < items.length) {
      const i = index;
      index += 1;
      results[i] = await mapper(items[i]);
    }
  });
  await Promise.all(workers);
  return results;
}

function rollupPatients(
  scope: 'doctor' | 'practice',
  scopeId: string,
  daysBack: number,
  patients: PatientClinicalMetrics[],
  allAppointments: Appointment[]
): RosterClinicalMetrics {
  const withAdherence = patients.filter((p) => p.adherence.band !== 'no-data');
  const avgAdherence =
    withAdherence.length > 0
      ? Math.round(
          withAdherence.reduce((sum, p) => sum + p.adherence.rate, 0) / withAdherence.length
        )
      : null;
  const appt = appointmentBuckets(allAppointments);
  return {
    scope,
    scopeId,
    daysBack,
    patientCount: patients.length,
    needingAttention: patients.filter((p) => p.needsAttention).length,
    avgAdherence,
    vitalsUrgentPatients: patients.filter((p) => p.vitals.urgent > 0).length,
    vitalsWarningPatients: patients.filter(
      (p) => p.vitals.urgent === 0 && p.vitals.warning > 0
    ).length,
    appointments: {
      total: appt.total,
      completed: appt.completed,
      pending: appt.pending,
      cancelled: appt.cancelled,
      completionRate:
        appt.total > 0 ? Math.round((appt.completed / appt.total) * 100) : 0,
    },
    labsDocuments: patients.reduce((sum, p) => sum + p.labs.documentCount, 0),
    symptomCheckIns: patients.reduce((sum, p) => sum + p.symptoms.checkIns, 0),
    activeTreatments: patients.reduce((sum, p) => sum + p.treatment.activeTreatments, 0),
    chronicPatients: patients.filter((p) => p.treatment.chronicConditions > 0).length,
    patients,
  };
}

/** Doctor-scoped clinical metrics across the roster. */
export async function getDoctorClinicalMetrics(
  doctorId: string,
  options?: { daysBack?: number; practiceId?: string | null }
): Promise<RosterClinicalMetrics> {
  const daysBack = options?.daysBack ?? 30;
  const [patients, appointments] = await Promise.all([
    getDoctorPatients(doctorId),
    getDoctorAppointments(doctorId),
  ]);

  const metrics = await mapPool(patients, 4, (patient) =>
    getPatientClinicalMetrics(patient, {
      daysBack,
      appointments,
      practiceId: options?.practiceId,
      includeLabsAndSymptoms: true,
    })
  );

  return rollupPatients('doctor', doctorId, daysBack, metrics, appointments);
}

/** Practice-scoped clinical metrics (all practice patients). */
export async function getPracticeClinicalMetrics(
  practiceId: string,
  options?: { daysBack?: number }
): Promise<RosterClinicalMetrics> {
  const daysBack = options?.daysBack ?? 30;
  const [patients, clinicians] = await Promise.all([
    listPracticePatients(practiceId),
    listPracticeClinicians(practiceId).catch(() => []),
  ]);

  const doctorIds = clinicians.map((c) => c.uid);
  const appointmentLists = await Promise.all(
    doctorIds.map((id) => getDoctorAppointments(id).catch(() => [] as Appointment[]))
  );
  const appointments = appointmentLists.flat();

  const metrics = await mapPool(patients, 4, (patient) =>
    getPatientClinicalMetrics(patient, {
      daysBack,
      appointments,
      practiceId,
      includeLabsAndSymptoms: true,
    })
  );

  return rollupPatients('practice', practiceId, daysBack, metrics, appointments);
}

export function attentionReasonLabel(reason: ClinicalAttentionReason): string {
  switch (reason) {
    case 'adherence_low':
      return 'Low adherence';
    case 'adherence_moderate':
      return 'Moderate adherence';
    case 'vitals_urgent':
      return 'Urgent vitals';
    case 'vitals_warning':
      return 'Warning vitals';
    case 'pending_appointment':
      return 'Pending appointment';
    case 'inactive_status':
      return 'Inactive';
    case 'chronic_complex':
      return 'Multiple conditions';
    default:
      return reason;
  }
}
