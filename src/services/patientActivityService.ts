import { logClinicAuditEvent } from './clinicAuditService';
import { djangoListClinicAuditLogs, isDjangoApiEnabled } from './djangoApiService';
import type { ClinicAuditLogEntry } from '../types';

export interface PatientActivityEntry {
  id: string;
  patientId: string;
  appointmentId: string | null;
  actionType: string;
  description: string;
  createdAt: Date | null;
}

type Unsubscribe = () => void;

interface LogPatientActivityInput {
  doctorId: string;
  patientId: string;
  practiceId?: string;
  appointmentId?: string;
  actionType: string;
  description: string;
  metadata?: Record<string, string | number | boolean | null | undefined>;
}

function mapAuditToActivity(entry: ClinicAuditLogEntry, patientId: string): PatientActivityEntry {
  const metadata = entry.metadata ?? {};
  return {
    id: entry.id,
    patientId,
    appointmentId:
      typeof metadata.appointmentId === 'string' ? metadata.appointmentId : null,
    actionType: entry.action,
    description: entry.summary,
    createdAt: entry.createdAt,
  };
}

export const logPatientActivity = async ({
  doctorId,
  patientId,
  practiceId,
  appointmentId,
  actionType,
  description,
  metadata,
}: LogPatientActivityInput): Promise<void> => {
  if (!doctorId || !patientId || !actionType || !description) return;

  if (!isDjangoApiEnabled() || !practiceId) return;

  try {
    await logClinicAuditEvent({
      practiceId,
      action: 'patient.activity',
      actorUid: doctorId,
      targetType: 'patient',
      targetId: patientId,
      summary: description,
      metadata: {
        actionType,
        appointmentId: appointmentId ?? null,
        ...(metadata ?? {}),
      },
    });
  } catch (error) {
    console.warn('Failed to log patient activity', error);
  }
};

export const listenToRecentPatientActivity = (
  _doctorId: string,
  entryLimit: number,
  onUpdate: (entries: PatientActivityEntry[]) => void,
  onError?: (error: Error) => void,
  practiceId?: string,
  patientId?: string,
): Unsubscribe => {
  if (!isDjangoApiEnabled() || !practiceId) {
    onUpdate([]);
    return () => {};
  }

  let cancelled = false;

  void (async () => {
    try {
      const rows = await djangoListClinicAuditLogs(practiceId, Math.min(entryLimit * 3, 100));
      if (cancelled) return;
      const filtered = rows
        .filter((row) => row.action === 'patient.activity')
        .filter((row) => !patientId || row.targetId === patientId)
        .slice(0, entryLimit)
        .map((row) =>
          mapAuditToActivity(
            {
              id: String(row.id),
              practiceId,
              action: row.action as ClinicAuditLogEntry['action'],
              actorUid: String(row.actorUid ?? ''),
              actorName: typeof row.actorName === 'string' ? row.actorName : undefined,
              targetType: typeof row.targetType === 'string' ? row.targetType : undefined,
              targetId: typeof row.targetId === 'string' ? row.targetId : undefined,
              summary: String(row.summary ?? ''),
              metadata:
                row.metadata && typeof row.metadata === 'object'
                  ? (row.metadata as Record<string, unknown>)
                  : undefined,
              createdAt: row.createdAt ? new Date(String(row.createdAt)) : new Date(),
            },
            patientId ?? String(row.targetId ?? ''),
          ),
        );
      onUpdate(filtered);
    } catch (error) {
      onError?.(error instanceof Error ? error : new Error('Failed to load patient activity'));
      onUpdate([]);
    }
  })();

  return () => {
    cancelled = true;
  };
};
