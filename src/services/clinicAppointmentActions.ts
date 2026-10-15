import {
  syncAppointmentStatus,
  updateAppointment,
} from './appointmentService';
import { createInvoiceRecord, invoiceOptionsFromPracticeContext } from './invoiceService';
import { sendPatientNotification } from './notificationService';
import { updateScheduledAppointmentStatus, validateSlot } from './schedulingService';
import type { Appointment, ConsultType, Doctor, InvoiceLineItem, Practice } from '../types';

const formatWhen = (when: Date, timeLabel: string) =>
  `${when.toLocaleDateString('en-ZA', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })} at ${timeLabel}`;

async function persistStatus(
  appointment: Appointment,
  status: Appointment['status'],
  practiceId?: string,
) {
  await updateAppointment(appointment.doctorId, appointment.id, { status });
  await syncAppointmentStatus(appointment.id);
  if (practiceId) {
    await updateScheduledAppointmentStatus(practiceId, appointment.id, status, {
      doctorId: appointment.doctorId,
      patientId: appointment.patientId,
      startAt: appointment.startAt ?? appointment.scheduledAt ?? appointment.date,
    });
  }
}

export async function confirmClinicAppointment(
  appointment: Appointment,
  practiceId: string | undefined,
  timeLabel: string,
) {
  const confirmedScheduledAt =
    appointment.startAt ?? appointment.scheduledAt ?? appointment.date;
  await updateAppointment(appointment.doctorId, appointment.id, {
    status: 'confirmed',
    requiresConfirmation: false,
    confirmedScheduledAt,
  });
  await syncAppointmentStatus(appointment.id);
  if (practiceId) {
    await updateScheduledAppointmentStatus(practiceId, appointment.id, 'confirmed', {
      doctorId: appointment.doctorId,
      patientId: appointment.patientId,
      startAt: confirmedScheduledAt,
    });
  }
  if (!appointment.isManual) {
    sendPatientNotification(appointment.patientId, {
      type: 'booking_confirmed',
      title: 'Appointment confirmed',
      body: `Your appointment on ${formatWhen(
        confirmedScheduledAt instanceof Date ? confirmedScheduledAt : new Date(confirmedScheduledAt),
        timeLabel,
      )} has been confirmed.`,
      appointmentId: appointment.id,
      doctorId: appointment.doctorId,
    }).catch(() => undefined);
  }
}

export async function cancelClinicAppointment(
  appointment: Appointment,
  practiceId: string | undefined,
  timeLabel: string,
) {
  await persistStatus(appointment, 'cancelled', practiceId);
  if (!appointment.isManual) {
    const when = appointment.startAt ?? appointment.scheduledAt ?? appointment.date;
    sendPatientNotification(appointment.patientId, {
      type: 'booking_cancelled',
      title: 'Appointment cancelled',
      body: `Your appointment on ${formatWhen(
        when instanceof Date ? when : new Date(when),
        timeLabel,
      )} has been cancelled.`,
      appointmentId: appointment.id,
      doctorId: appointment.doctorId,
    }).catch(() => undefined);
  }
}

export async function markClinicAppointmentMissed(
  appointment: Appointment,
  practiceId: string | undefined,
) {
  await persistStatus(appointment, 'no_show', practiceId);
}

export async function completeClinicAppointment(
  appointment: Appointment,
  practiceId: string | undefined,
) {
  await persistStatus(appointment, 'completed', practiceId);
}

export async function rescheduleClinicAppointment(input: {
  appointment: Appointment;
  practiceId: string;
  startAt: Date;
  endAt: Date;
  timeLabel: string;
  consultType: ConsultType;
  canOverride: boolean;
}) {
  const { appointment, practiceId, startAt, endAt, timeLabel, consultType, canOverride } = input;
  const validation = await validateSlot(
    practiceId,
    appointment.doctorId,
    startAt,
    endAt,
    consultType,
    appointment.id,
  );
  let overrideApplied = false;
  let conflictMeta: Appointment['conflictMeta'];
  if (!validation.valid) {
    if (validation.reason === 'soft_block_conflict' && canOverride) {
      overrideApplied = true;
      conflictMeta = {
        softBlockId: validation.softBlock?.id,
        reason: `Soft block override: ${validation.softBlock?.title ?? 'blocked time'}`,
      };
    } else if (validation.reason === 'outside_bookable_block') {
      overrideApplied = true;
      conflictMeta = { reason: 'Moved outside published hours by clinic admin' };
    } else {
      const reasonMessage =
        validation.reason === 'appointment_conflict'
          ? 'That time conflicts with another appointment.'
          : validation.reason === 'consult_type_not_allowed'
            ? 'This visit type is not allowed in that clinic session.'
            : validation.reason === 'soft_block_conflict'
              ? 'That time overlaps blocked time.'
              : 'That time is not available.';
      throw new Error(reasonMessage);
    }
  }

  await updateAppointment(appointment.doctorId, appointment.id, {
    date: startAt,
    time: timeLabel,
    startAt,
    endAt,
    status: 'confirmed',
    overrideApplied,
    conflictMeta,
  });
  await syncAppointmentStatus(appointment.id);

  if (!appointment.isManual) {
    sendPatientNotification(appointment.patientId, {
      type: 'booking_rescheduled',
      title: 'Appointment moved',
      body: `Your appointment has been moved to ${formatWhen(startAt, timeLabel)}.`,
      appointmentId: appointment.id,
      doctorId: appointment.doctorId,
    }).catch(() => undefined);
  }
}

export async function createClinicVisitInvoice(input: {
  appointment: Appointment;
  actor: Doctor | null;
  practice?: Practice | null;
  lineItems: InvoiceLineItem[];
  notes?: string;
}) {
  await createInvoiceRecord(
    input.appointment.doctorId,
    input.appointment.patientId,
    input.appointment.id,
    input.lineItems,
    input.notes,
    input.actor?.currency || 'ZAR',
    invoiceOptionsFromPracticeContext(
      input.actor,
      input.practice ?? undefined,
      input.appointment.id,
      input.appointment.practiceId ?? input.practice?.id,
    ),
  );
}
