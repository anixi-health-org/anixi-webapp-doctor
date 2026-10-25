import type {
  PracticeSnapshot,
  PracticeSnapshotPatient,
} from '../hooks/useDoctorBriefingData';

/** Max roster rows sent to Ayah; full panel uses list-practice-panel + API pagination. */
export const COMPANION_PRACTICE_SNAPSHOT_PATIENT_CAP = 48;
const PENDING_SAMPLE_CAP = 20;

function slimPatientRow(patient: PracticeSnapshotPatient): PracticeSnapshotPatient {
  return {
    id: patient.id,
    displayName: patient.displayName,
    status: patient.status,
    chronicConditions: patient.chronicConditions?.slice(0, 4),
    allergies: patient.allergies?.slice(0, 4),
  };
}

/**
 * Shrink practiceSnapshot before companion/voice requests so large clinic rosters
 * do not exceed model context limits.
 */
export function slimPracticeSnapshotForCompanion(
  snapshot: PracticeSnapshot,
): PracticeSnapshot {
  const total = snapshot.patients.length;
  if (total <= COMPANION_PRACTICE_SNAPSHOT_PATIENT_CAP) {
    return snapshot;
  }

  const todayIds = new Set(
    snapshot.todayAppointments
      .map((apt) => apt.patientId)
      .filter((id): id is string => Boolean(id)),
  );
  const pending = snapshot.patients.filter((p) => p.status === 'pending');
  const picked: PracticeSnapshotPatient[] = [];
  const seen = new Set<string>();

  const add = (patient: PracticeSnapshotPatient) => {
    if (seen.has(patient.id) || picked.length >= COMPANION_PRACTICE_SNAPSHOT_PATIENT_CAP) {
      return;
    }
    seen.add(patient.id);
    picked.push(slimPatientRow(patient));
  };

  for (const patient of snapshot.patients) {
    if (todayIds.has(patient.id)) add(patient);
  }
  for (const patient of pending.slice(0, PENDING_SAMPLE_CAP)) {
    add(patient);
  }
  for (const patient of snapshot.patients) {
    add(patient);
  }

  const baseCounts = snapshot.counts ?? {
    today: snapshot.todayAppointments.length,
    upcoming: snapshot.upcomingAppointments.length,
    week: 0,
    pendingAppointments: snapshot.pendingAppointments,
    patients: total,
    attention: 0,
  };

  return {
    ...snapshot,
    patients: picked,
    counts: {
      ...baseCounts,
      patients: total,
      pendingActivation: pending.length,
      patientsTruncated: true,
      patientsInSnapshot: picked.length,
    },
  };
}
