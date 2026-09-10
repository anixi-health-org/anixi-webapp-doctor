import { djangoListSharingRequests } from '../../services/djangoApiService';
import { IncomingSharingRequest, PatientSharingRequest } from './types';

export type Unsubscribe = () => void;

export const getPatientSharingRequests = async (
  patientId: string,
): Promise<PatientSharingRequest[]> => {
  if (!patientId) return [];
  const rows = await djangoListSharingRequests('patient');
  return rows.map((row) => ({
    id: String(row.id),
    doctorId: String(row.clinicianId ?? row.doctorId ?? ''),
    doctorName: String(row.clinicianName ?? row.doctorName ?? 'Doctor'),
    doctorSpecialty: row.doctorSpecialty as string | undefined,
    doctorCity: row.doctorCity as string | undefined,
    doctorYearsInPractice: row.doctorYearsInPractice as number | undefined,
    status: (row.status as PatientSharingRequest['status']) || 'pending',
    createdAt: row.createdAt ? new Date(String(row.createdAt)) : new Date(),
    approvedAt: row.approvedAt ? new Date(String(row.approvedAt)) : undefined,
  }));
};

export const getIncomingSharingRequests = async (
  doctorId: string,
): Promise<IncomingSharingRequest[]> => {
  if (!doctorId) return [];
  const rows = await djangoListSharingRequests('clinician');
  return rows.map((row) => ({
    id: String(row.id),
    patientId: String(row.patientId ?? ''),
    patientName: String(row.patientName ?? 'Patient'),
    status: (row.status as IncomingSharingRequest['status']) || 'pending',
    createdAt: row.createdAt ? new Date(String(row.createdAt)) : new Date(),
    approvedAt: row.approvedAt ? new Date(String(row.approvedAt)) : undefined,
  }));
};

function pollSharingRequests<T>(
  load: () => Promise<T[]>,
  onUpdate: (rows: T[]) => void,
  onError: (error: Error) => void,
  intervalMs = 30_000,
): Unsubscribe {
  let cancelled = false;
  const poll = async () => {
    try {
      const rows = await load();
      if (!cancelled) onUpdate(rows);
    } catch (err) {
      if (!cancelled) {
        onError(err instanceof Error ? err : new Error('Failed to load requests'));
      }
    }
  };
  void poll();
  const timer = setInterval(poll, intervalMs);
  return () => {
    cancelled = true;
    clearInterval(timer);
  };
}

export const listenToIncomingSharingRequests = (
  doctorId: string,
  onUpdate: (requests: IncomingSharingRequest[]) => void,
  onError: (error: Error) => void,
): Unsubscribe => {
  if (!doctorId) {
    onError(new Error('Doctor ID is required'));
    return () => {};
  }
  return pollSharingRequests(
    () => getIncomingSharingRequests(doctorId),
    onUpdate,
    onError,
  );
};

export const listenToPatientSharingRequests = (
  patientId: string,
  onUpdate: (requests: PatientSharingRequest[]) => void,
  onError: (error: Error) => void,
): Unsubscribe => {
  if (!patientId) {
    onError(new Error('Patient ID is required'));
    return () => {};
  }
  return pollSharingRequests(
    () => getPatientSharingRequests(patientId),
    onUpdate,
    onError,
  );
};
