import type { ClinicAuditAction, ClinicAuditLogEntry } from '../types';
import {
  djangoCreateClinicAuditLog,
  djangoListClinicAuditLogs,
  isDjangoApiEnabled,
} from './djangoApiService';

export type LogClinicAuditInput = {
  practiceId: string;
  action: ClinicAuditAction;
  actorUid: string;
  actorName?: string;
  targetType?: string;
  targetId?: string;
  summary: string;
  metadata?: Record<string, unknown>;
};

function mapAuditRow(row: Record<string, unknown>): ClinicAuditLogEntry {
  return {
    id: String(row.id),
    practiceId: String(row.practiceId),
    action: row.action as ClinicAuditAction,
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
  };
}

export async function logClinicAuditEvent(input: LogClinicAuditInput): Promise<void> {
  if (!isDjangoApiEnabled()) return;

  try {
    await djangoCreateClinicAuditLog(input.practiceId, {
      action: input.action,
      actorUid: input.actorUid,
      actorName: input.actorName,
      targetType: input.targetType,
      targetId: input.targetId,
      summary: input.summary,
      metadata: input.metadata,
    });
  } catch (error) {
    console.warn('[clinicAuditService] Failed to persist audit event', error);
  }
}

export async function listClinicAuditLogs(
  practiceId: string,
  max = 100,
): Promise<ClinicAuditLogEntry[]> {
  if (!isDjangoApiEnabled() || !practiceId) return [];

  const rows = await djangoListClinicAuditLogs(practiceId, max);
  return rows.map(mapAuditRow);
}

export function auditActionLabel(action: ClinicAuditAction): string {
  switch (action) {
    case 'member.invited':
      return 'Invite sent';
    case 'member.role_changed':
      return 'Role changed';
    case 'member.removed':
      return 'Member removed';
    case 'queue.arrival_updated':
      return 'Arrival updated';
    case 'queue.room_assigned':
      return 'Room assigned';
    case 'settings.updated':
      return 'Settings updated';
    case 'claim.submitted':
      return 'Claim submitted';
    case 'invoice.paid':
      return 'Invoice paid';
    default:
      return action;
  }
}
