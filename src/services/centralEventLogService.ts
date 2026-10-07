/**
 * Central Event Log Service
 * 
 * Provides a unified logging system for tracking user and Ayah actions,
 * patient/organization changes with old/new values, outcomes, and confirmations.
 * 
 * This service integrates with the Django API for persistent storage and
 * provides a consistent interface for logging events across the application.
 */

import type {
  CentralEventAction,
  CentralEventActorType,
  CentralEventLogEntry,
} from '../types';
import { isDjangoApiEnabled } from './djangoApiService';

type Envelope<T> = { success: boolean; data: T; error?: unknown };

export type LogCentralEventInput = {
  organizationId: string;
  action: CentralEventAction;
  actorType: CentralEventActorType;
  actorUid?: string;
  actorName?: string;
  targetType: 'patient' | 'appointment' | 'practice' | 'member' | 'invoice' | 'claim' | 'document' | 'ayah' | 'other';
  targetId?: string;
  summary: string;
  oldValue?: Record<string, unknown> | string | number | boolean | null;
  newValue?: Record<string, unknown> | string | number | boolean | null;
  outcome?: 'success' | 'failed' | 'pending' | 'cancelled';
  confirmation?: string;
  metadata?: Record<string, unknown>;
};

/**
 * Log a central event to the Django API
 */
export async function logCentralEvent(input: LogCentralEventInput): Promise<void> {
  if (!isDjangoApiEnabled()) {
    console.warn('[centralEventLog] Django API not enabled, event not logged:', input);
    return;
  }

  try {
    const API_BASE = process.env.REACT_APP_ANIXI_API_URL || '';
    const token = localStorage.getItem('anixi_jwt_access');
    
    if (!token) {
      console.warn('[centralEventLog] No access token available');
      return;
    }

    const response = await fetch(`${API_BASE}/api/v1/central-events/`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'X-Client': 'doctor-web',
      },
      body: JSON.stringify({
        organizationId: input.organizationId,
        action: input.action,
        actorType: input.actorType,
        actorUid: input.actorUid,
        actorName: input.actorName,
        targetType: input.targetType,
        targetId: input.targetId,
        summary: input.summary,
        oldValue: input.oldValue,
        newValue: input.newValue,
        outcome: input.outcome || 'success',
        confirmation: input.confirmation,
        metadata: input.metadata,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      console.warn('[centralEventLog] Failed to log event:', error);
    }
  } catch (error) {
    console.warn('[centralEventLog] Error logging event:', error);
  }
}

/**
 * List central events for an organization with optional filtering
 */
export async function listCentralEvents(params: {
  organizationId: string;
  targetType?: string;
  action?: CentralEventAction;
  actorType?: CentralEventActorType;
  targetId?: string;
  outcome?: 'success' | 'failed' | 'pending' | 'cancelled';
  fromDate?: Date;
  toDate?: Date;
  limit?: number;
  offset?: number;
}): Promise<CentralEventLogEntry[]> {
  if (!isDjangoApiEnabled() || !params.organizationId) {
    return [];
  }

  try {
    const API_BASE = process.env.REACT_APP_ANIXI_API_URL || '';
    const token = localStorage.getItem('anixi_jwt_access');
    
    if (!token) {
      return [];
    }

    const queryParams = new URLSearchParams();
    queryParams.append('organizationId', params.organizationId);
    if (params.targetType) queryParams.append('targetType', params.targetType);
    if (params.action) queryParams.append('action', params.action);
    if (params.actorType) queryParams.append('actorType', params.actorType);
    if (params.targetId) queryParams.append('targetId', params.targetId);
    if (params.outcome) queryParams.append('outcome', params.outcome);
    if (params.fromDate) queryParams.append('fromDate', params.fromDate.toISOString());
    if (params.toDate) queryParams.append('toDate', params.toDate.toISOString());
    queryParams.append('limit', String(params.limit || 100));
    queryParams.append('offset', String(params.offset || 0));

    const response = await fetch(
      `${API_BASE}/api/v1/central-events/?${queryParams.toString()}`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'X-Client': 'doctor-web',
        },
      }
    );

    if (!response.ok) {
      console.warn('[centralEventLog] Failed to fetch events');
      return [];
    }

    const json = (await response.json()) as Envelope<CentralEventLogEntry[]>;
    if (!json.success || !json.data) {
      return [];
    }

    return json.data.map(mapEventRow);
  } catch (error) {
    console.warn('[centralEventLog] Error fetching events:', error);
    return [];
  }
}

/**
 * Get a single central event by ID
 */
export async function getCentralEvent(eventId: string): Promise<CentralEventLogEntry | null> {
  if (!isDjangoApiEnabled() || !eventId) {
    return null;
  }

  try {
    const API_BASE = process.env.REACT_APP_ANIXI_API_URL || '';
    const token = localStorage.getItem('anixi_jwt_access');
    
    if (!token) {
      return null;
    }

    const response = await fetch(`${API_BASE}/api/v1/central-events/${eventId}/`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'X-Client': 'doctor-web',
      },
    });

    if (!response.ok) {
      return null;
    }

    const json = (await response.json()) as Envelope<CentralEventLogEntry>;
    if (!json.success || !json.data) {
      return null;
    }

    return mapEventRow(json.data);
  } catch (error) {
    console.warn('[centralEventLog] Error fetching event:', error);
    return null;
  }
}

function mapEventRow(row: Record<string, unknown> | CentralEventLogEntry): CentralEventLogEntry {
  if ('id' in row && 'organizationId' in row && 'action' in row) {
    return row as CentralEventLogEntry;
  }
  
  const data = row as Record<string, unknown>;
  return {
    id: String(data.id ?? ''),
    organizationId: String(data.organizationId ?? ''),
    action: data.action as CentralEventAction,
    actorType: data.actorType as CentralEventActorType,
    actorUid: typeof data.actorUid === 'string' ? data.actorUid : undefined,
    actorName: typeof data.actorName === 'string' ? data.actorName : undefined,
    targetType: data.targetType as CentralEventLogEntry['targetType'],
    targetId: typeof data.targetId === 'string' ? data.targetId : undefined,
    summary: String(data.summary ?? ''),
    oldValue: data.oldValue as CentralEventLogEntry['oldValue'],
    newValue: data.newValue as CentralEventLogEntry['newValue'],
    outcome: (data.outcome as CentralEventLogEntry['outcome']) || 'success',
    confirmation: typeof data.confirmation === 'string' ? data.confirmation : undefined,
    metadata:
      data.metadata && typeof data.metadata === 'object'
        ? (data.metadata as Record<string, unknown>)
        : undefined,
    createdAt: data.createdAt ? new Date(String(data.createdAt)) : new Date(),
  };
}

/**
 * Helper function to log patient-related events
 */
export async function logPatientEvent(params: {
  organizationId: string;
  action: 'patient.created' | 'patient.updated' | 'patient.deleted' | 'patient.assigned' | 'patient.unassigned';
  actorUid: string;
  actorName: string;
  patientId: string;
  patientName: string;
  oldValue?: Record<string, unknown>;
  newValue?: Record<string, unknown>;
  outcome?: 'success' | 'failed' | 'pending' | 'cancelled';
  confirmation?: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const summary = getPatientEventSummary(params.action, params.patientName);
  await logCentralEvent({
    organizationId: params.organizationId,
    action: params.action,
    actorType: 'user',
    actorUid: params.actorUid,
    actorName: params.actorName,
    targetType: 'patient',
    targetId: params.patientId,
    summary,
    oldValue: params.oldValue,
    newValue: params.newValue,
    outcome: params.outcome,
    confirmation: params.confirmation,
    metadata: { ...params.metadata, patientName: params.patientName },
  });
}

/**
 * Helper function to log appointment-related events
 */
export async function logAppointmentEvent(params: {
  organizationId: string;
  action: 'appointment.created' | 'appointment.updated' | 'appointment.cancelled' | 'appointment.completed' | 'appointment.rescheduled' | 'appointment.confirmed';
  actorUid: string;
  actorName: string;
  appointmentId: string;
  patientId: string;
  patientName: string;
  oldValue?: Record<string, unknown>;
  newValue?: Record<string, unknown>;
  outcome?: 'success' | 'failed' | 'pending' | 'cancelled';
  confirmation?: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const summary = getAppointmentEventSummary(params.action, params.patientName);
  await logCentralEvent({
    organizationId: params.organizationId,
    action: params.action,
    actorType: 'user',
    actorUid: params.actorUid,
    actorName: params.actorName,
    targetType: 'appointment',
    targetId: params.appointmentId,
    summary,
    oldValue: params.oldValue,
    newValue: params.newValue,
    outcome: params.outcome,
    confirmation: params.confirmation,
    metadata: { ...params.metadata, patientId: params.patientId, patientName: params.patientName },
  });
}

/**
 * Helper function to log Ayah-related events
 */
export async function logAyahEvent(params: {
  organizationId: string;
  action: 'ayah.suggestion_applied' | 'ayah.suggestion_rejected' | 'ayah.chart_generated' | 'ayah.summary_created' | 'ayah.command_executed';
  actorUid: string;
  actorName: string;
  targetId?: string;
  summary: string;
  oldValue?: Record<string, unknown> | string | number | boolean | null;
  newValue?: Record<string, unknown> | string | number | boolean | null;
  outcome?: 'success' | 'failed' | 'pending' | 'cancelled';
  confirmation?: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  await logCentralEvent({
    organizationId: params.organizationId,
    action: params.action,
    actorType: 'ayah',
    actorUid: params.actorUid,
    actorName: params.actorName,
    targetType: 'ayah',
    targetId: params.targetId,
    summary: params.summary,
    oldValue: params.oldValue,
    newValue: params.newValue,
    outcome: params.outcome,
    confirmation: params.confirmation,
    metadata: params.metadata,
  });
}

function getPatientEventSummary(action: string, patientName: string): string {
  switch (action) {
    case 'patient.created':
      return `Patient ${patientName} created`;
    case 'patient.updated':
      return `Patient ${patientName} updated`;
    case 'patient.deleted':
      return `Patient ${patientName} deleted`;
    case 'patient.assigned':
      return `Patient ${patientName} assigned`;
    case 'patient.unassigned':
      return `Patient ${patientName} unassigned`;
    default:
      return `Patient ${patientName} - ${action}`;
  }
}

function getAppointmentEventSummary(action: string, patientName: string): string {
  switch (action) {
    case 'appointment.created':
      return `Appointment created for ${patientName}`;
    case 'appointment.updated':
      return `Appointment updated for ${patientName}`;
    case 'appointment.cancelled':
      return `Appointment cancelled for ${patientName}`;
    case 'appointment.completed':
      return `Appointment completed for ${patientName}`;
    case 'appointment.rescheduled':
      return `Appointment rescheduled for ${patientName}`;
    case 'appointment.confirmed':
      return `Appointment confirmed for ${patientName}`;
    default:
      return `Appointment for ${patientName} - ${action}`;
  }
}

/**
 * Get a human-readable label for an event action
 */
export function centralEventActionLabel(action: CentralEventAction): string {
  const labels: Record<CentralEventAction, string> = {
    'patient.created': 'Patient created',
    'patient.updated': 'Patient updated',
    'patient.deleted': 'Patient deleted',
    'patient.assigned': 'Patient assigned',
    'patient.unassigned': 'Patient unassigned',
    'appointment.created': 'Appointment created',
    'appointment.updated': 'Appointment updated',
    'appointment.cancelled': 'Appointment cancelled',
    'appointment.completed': 'Appointment completed',
    'appointment.rescheduled': 'Appointment rescheduled',
    'appointment.confirmed': 'Appointment confirmed',
    'medication.prescribed': 'Medication prescribed',
    'medication.updated': 'Medication updated',
    'diagnosis.added': 'Diagnosis added',
    'vitals.recorded': 'Vitals recorded',
    'document.uploaded': 'Document uploaded',
    'document.deleted': 'Document deleted',
    'message.sent': 'Message sent',
    'ayah.suggestion_applied': 'Ayah suggestion applied',
    'ayah.suggestion_rejected': 'Ayah suggestion rejected',
    'ayah.chart_generated': 'Ayah chart generated',
    'ayah.summary_created': 'Ayah summary created',
    'ayah.command_executed': 'Ayah command executed',
    'practice.created': 'Practice created',
    'practice.updated': 'Practice updated',
    'member.invited': 'Member invited',
    'member.role_changed': 'Member role changed',
    'member.removed': 'Member removed',
    'settings.updated': 'Settings updated',
    'invoice.created': 'Invoice created',
    'invoice.paid': 'Invoice paid',
    'claim.submitted': 'Claim submitted',
    'data.exported': 'Data exported',
    'data.imported': 'Data imported',
  };
  return labels[action] || action;
}
