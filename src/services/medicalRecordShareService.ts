import {
  djangoListRecordShares,
  djangoResolveRecordShare,
  isDjangoApiEnabled,
} from './djangoApiService';
import {
  computeShareExpiresAt,
  type AccessDurationPreset,
  type MedicalRecordScope,
} from './medicalRecordShareAccess';

export interface SharedRecordGrant {
  shareId: string;
  patientId: string;
  patientName: string;
  scope: Partial<MedicalRecordScope> | null;
  expiresAt: Date | null;
}

function toDate(value: unknown): Date | null {
  if (value instanceof Date) return value;
  if (typeof value === 'string') return new Date(value);
  return null;
}

export const getPatientsSharingRecords = async (
  _doctorId: string,
): Promise<SharedRecordGrant[]> => {
  if (!isDjangoApiEnabled()) return [];

  const rows = await djangoListRecordShares('doctor');
  return rows
    .filter((row) => row.status === 'approved')
    .map((row) => ({
      shareId: String(row.id),
      patientId: String(row.patientId),
      patientName: String(row.patientName ?? 'Patient'),
      scope: (row.scope as Partial<MedicalRecordScope>) ?? null,
      expiresAt: toDate(row.expiresAt),
    }));
};

export interface PendingRecordShareRequest {
  shareId: string;
  patientId: string;
  patientName: string;
  scope: Partial<MedicalRecordScope> | null;
  shareAll: boolean;
  durationPreset: AccessDurationPreset;
  customDurationDays: number | null;
  patientMessage: string | null;
  requestedAt: Date | null;
}

function mapPendingShare(row: Record<string, unknown>): PendingRecordShareRequest {
  return {
    shareId: String(row.id),
    patientId: String(row.patientId),
    patientName: String(row.patientName ?? 'Patient'),
    scope: (row.scope as Partial<MedicalRecordScope>) ?? null,
    shareAll: row.shareAll === true,
    durationPreset: (row.durationPreset as AccessDurationPreset) || '30_days',
    customDurationDays:
      typeof row.customDurationDays === 'number' ? row.customDurationDays : null,
    patientMessage:
      typeof row.patientMessage === 'string' ? row.patientMessage : null,
    requestedAt: toDate(row.requestedAt),
  };
}

export const listenToPendingRecordShares = (
  _doctorId: string,
  onChange: (requests: PendingRecordShareRequest[]) => void,
  onError?: (error: Error) => void,
): (() => void) => {
  if (!isDjangoApiEnabled()) {
    onChange([]);
    return () => {};
  }

  let cancelled = false;

  const refresh = async () => {
    try {
      const rows = await djangoListRecordShares('doctor');
      if (cancelled) return;
      onChange(
        rows
          .filter((row) => row.status === 'pending')
          .map(mapPendingShare),
      );
    } catch (error) {
      if (!cancelled) {
        onError?.(error instanceof Error ? error : new Error(String(error)));
      }
    }
  };

  void refresh();
  const timer = window.setInterval(() => {
    void refresh();
  }, 30_000);

  return () => {
    cancelled = true;
    window.clearInterval(timer);
  };
};

export const approveRecordShareRequest = async (params: {
  shareId: string;
  doctorId: string;
}): Promise<void> => {
  void params.doctorId;
  if (isDjangoApiEnabled()) {
    await djangoResolveRecordShare(params.shareId, 'approved');
    return;
  }

  const approvedAt = new Date();
  computeShareExpiresAt('30_days', approvedAt, null);
};

export const declineRecordShareRequest = async (params: {
  shareId: string;
  doctorId: string;
  reason?: string;
}): Promise<void> => {
  void params.doctorId;
  if (isDjangoApiEnabled()) {
    await djangoResolveRecordShare(params.shareId, 'declined', params.reason);
  }
};
