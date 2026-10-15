import { useEffect, useMemo, useState } from 'react';
import { listenToDoctorAppointments } from '../services/appointmentService';
import { listenToDoctorPatients, derivePatientRosterStatus } from '../services/patientManagementService';
import { useIncomingSharingRequests } from './useIncomingSharingRequests';
import { usePendingAppointmentsCount } from './usePendingAppointments';
import { useAuth } from './useAuth';
import type { Appointment, Patient } from '../types';
import {
  detectBrowserTimezone,
  getCalendarRangeInTimeZone,
  instantInCalendarRange,
} from '../lib/timezones';
import {
  upcomingAppointments as selectUpcomingAppointments,
  weekAppointments as selectWeekAppointments,
} from '../lib/dashboardAppointmentItems';

export type AttentionItem = {
  id: string;
  title: string;
  detail: string;
  prompt: string;
  tone: 'urgent' | 'soon' | 'routine';
  patientId?: string;
  patientName?: string;
  appointmentId?: string;
};

export type PracticeSnapshotPatient = {
  id: string;
  displayName: string;
  status: string;
  chronicConditions?: string[];
  allergies?: string[];
};

export type PracticeSnapshot = {
  practiceId?: string;
  timezone?: string;
  patients: PracticeSnapshotPatient[];
  todayAppointments: Array<{
    id: string;
    patientId?: string;
    patientName: string;
    status: string;
    startAt?: string;
    time?: string;
  }>;
  upcomingAppointments: Array<{
    id: string;
    patientName: string;
    status: string;
    startAt?: string;
    time?: string;
  }>;
  counts?: {
    today: number;
    upcoming: number;
    week: number;
    pendingAppointments: number;
    patients: number;
    attention: number;
  };
  pendingAppointments: number;
  pendingPatientRequests: number;
};

export type DoctorBriefingSnapshot = {
  totalPatients: number;
  stablePatients: number;
  todayAppointments: Appointment[];
  upcomingAppointments: Appointment[];
  weekAppointments: Appointment[];
  pendingAppointments: number;
  pendingPatientRequests: number;
  unreadMessages?: number;
  nextAppointment?: Appointment | null;
  attentionItems: AttentionItem[];
  patients: PracticeSnapshotPatient[];
};

function appointmentInstant(apt: Appointment): Date | null {
  const raw = apt.startAt ?? apt.scheduledAt ?? apt.date;
  const d = raw instanceof Date ? raw : new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatPatientLine(patient: PracticeSnapshotPatient): string {
  const conditions = patient.chronicConditions?.length
    ? `, ${patient.chronicConditions.slice(0, 4).join(', ')}`
    : '';
  return `${patient.displayName} [${patient.id}] (${patient.status})${conditions}`;
}

export function buildBriefingPrompt(snapshot: DoctorBriefingSnapshot): string {
  const todayList =
    snapshot.todayAppointments.length > 0
      ? snapshot.todayAppointments
          .slice(0, 12)
          .map(
            (apt) =>
              `${apt.patientName || 'Patient'}${apt.time ? ` at ${apt.time}` : ''} (${apt.status})`,
          )
          .join('; ')
      : 'none scheduled';

  const namedPanel = snapshot.patients
    .slice(0, 40)
    .map((patient) => formatPatientLine(patient))
    .join('\n');
  const pendingActivation = snapshot.patients.filter((patient) => patient.status === 'pending');

  return [
    'What do I need to know today? Give me my practice briefing.',
    'Use short section titles: TODAY, ATTENTION, UPCOMING, ONE THING TO DO.',
    'Plain text only. No markdown, no asterisks, no hashtags, no em-dashes.',
    'Name patients from the panel below. Do not invent patients, results, medications, findings, or clinical status.',
    'If a count is zero, say so plainly. If clinical status is not recorded, say it is not recorded.',
    '',
    `Total patients: ${snapshot.totalPatients}`,
    `Patients pending activation: ${pendingActivation.length}`,
    `Appointments today: ${snapshot.todayAppointments.length} (${todayList})`,
    `Pending appointment requests: ${snapshot.pendingAppointments}`,
    `Patients awaiting my approval: ${snapshot.pendingPatientRequests}`,
    snapshot.nextAppointment
      ? `Next appointment: ${snapshot.nextAppointment.patientName || 'Unnamed'}${
          snapshot.nextAppointment.time ? ` at ${snapshot.nextAppointment.time}` : ''
        }`
      : 'Next appointment: none remaining today',
    '',
    'Practice panel:',
    namedPanel || 'none',
    '',
    'Pending activation:',
    pendingActivation.length
      ? pendingActivation.map((patient) => formatPatientLine(patient)).join('\n')
      : 'none',
  ].join('\n');
}

export function buildPracticeSnapshot(
  snapshot: DoctorBriefingSnapshot,
  options?: { practiceId?: string; timezone?: string },
): PracticeSnapshot {
  return {
    practiceId: options?.practiceId,
    timezone: options?.timezone,
    patients: snapshot.patients,
    todayAppointments: snapshot.todayAppointments.map((apt) => ({
      id: apt.id,
      patientId: apt.patientId,
      patientName: apt.patientName,
      status: apt.status,
      startAt: (apt.startAt ?? apt.scheduledAt)?.toISOString?.() ?? undefined,
      time: apt.time,
    })),
    upcomingAppointments: snapshot.upcomingAppointments.slice(0, 12).map((apt) => ({
      id: apt.id,
      patientName: apt.patientName,
      status: apt.status,
      startAt: (apt.startAt ?? apt.scheduledAt)?.toISOString?.() ?? undefined,
      time: apt.time,
    })),
    counts: {
      today: snapshot.todayAppointments.length,
      upcoming: snapshot.upcomingAppointments.length,
      week: snapshot.weekAppointments.length,
      pendingAppointments: snapshot.pendingAppointments,
      patients: snapshot.totalPatients,
      attention: snapshot.attentionItems.length,
    },
    pendingAppointments: snapshot.pendingAppointments,
    pendingPatientRequests: snapshot.pendingPatientRequests,
  };
}

export function useDoctorBriefingData() {
  const { user, practiceSession } = useAuth();
  const pendingAppointments = usePendingAppointmentsCount(user?.id);
  const { requests: sharingRequests } = useIncomingSharingRequests(user?.id);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);

  const timeZone =
    practiceSession?.practice?.timezone?.trim() || detectBrowserTimezone();

  useEffect(() => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    setLoading(true);
    let patientsReady = false;
    let appointmentsReady = false;

    const maybeDone = () => {
      if (patientsReady && appointmentsReady) setLoading(false);
    };

    const unsubPatients = listenToDoctorPatients(
      user.id,
      (list) => {
        setPatients(list);
        patientsReady = true;
        maybeDone();
      },
      () => {
        patientsReady = true;
        maybeDone();
      },
    );

    const unsubAppointments = listenToDoctorAppointments(
      user.id,
      (list) => {
        setAppointments(list);
        appointmentsReady = true;
        maybeDone();
      },
      () => {
        appointmentsReady = true;
        maybeDone();
      },
    );

    return () => {
      unsubPatients();
      unsubAppointments();
    };
  }, [user?.id]);

  const snapshot = useMemo((): DoctorBriefingSnapshot => {
    const { startKey, endKey } = getCalendarRangeInTimeZone('today', timeZone);
    const todayAppointments = appointments.filter((apt) =>
      appointmentInstant(apt)
        ? instantInCalendarRange(appointmentInstant(apt)!, startKey, endKey, timeZone)
        : false,
    );
    const upcomingAppointments = selectUpcomingAppointments(appointments);
    const weekAppointments = selectWeekAppointments(appointments, timeZone);

    const pendingPatientRequests = sharingRequests.filter(
      (r) => r.status === 'pending',
    ).length;

    const now = Date.now();
    const remaining = todayAppointments
      .filter((apt) => {
        if (apt.status === 'cancelled' || apt.status === 'completed' || apt.status === 'no_show') {
          return false;
        }
        const instant = appointmentInstant(apt);
        return !instant || instant.getTime() >= now - 15 * 60 * 1000;
      })
      .sort((a, b) => {
        const aTime = appointmentInstant(a)?.getTime() ?? 0;
        const bTime = appointmentInstant(b)?.getTime() ?? 0;
        return aTime - bTime;
      });
    const nextAppointment = remaining[0] ?? null;

    const rosterPatients: PracticeSnapshotPatient[] = patients.map((patient) => ({
      id: patient.id,
      displayName: patient.displayName || '',
      status: derivePatientRosterStatus(patient),
      chronicConditions: patient.chronicDiseases ?? [],
      allergies: patient.allergies ?? [],
    }));

    const attentionItems: AttentionItem[] = [];
    if (pendingAppointments > 0) {
      attentionItems.push({
        id: 'pending-appointments',
        title: `${pendingAppointments} appointment request${pendingAppointments === 1 ? '' : 's'}`,
        detail: 'Waiting for your confirmation.',
        prompt:
          'Review my pending appointment requests and tell me what needs confirmation. Do not invent patients.',
        tone: 'soon',
      });
    }
    if (pendingPatientRequests > 0) {
      attentionItems.push({
        id: 'patient-approvals',
        title: `${pendingPatientRequests} patient approval${pendingPatientRequests === 1 ? '' : 's'}`,
        detail: 'Patients waiting to join your panel.',
        prompt:
          'I have patients awaiting approval. Summarize what I should review. Do not invent clinical findings.',
        tone: 'soon',
      });
    }
    for (const apt of todayAppointments.slice(0, 6)) {
      if (apt.status === 'cancelled') continue;
      attentionItems.push({
        id: `prep-${apt.id}`,
        title: apt.patientName || 'Patient',
        detail: apt.time
          ? `Scheduled at ${apt.time}${apt.consultType ? ` · ${apt.consultType}` : ''}`
          : 'On today’s panel',
        prompt: `Prepare me for ${apt.patientName || 'this patient'}. Use the patient overview and a pre-visit brief. Cite sources.`,
        tone: apt.status === 'pending' ? 'soon' : 'routine',
        patientId: apt.patientId,
        patientName: apt.patientName,
        appointmentId: apt.id,
      });
    }

    const pendingActivation = rosterPatients.filter((patient) => patient.status === 'pending').length;
    if (pendingActivation > 0) {
      attentionItems.push({
        id: 'pending-activation',
        title: `${pendingActivation} patient${pendingActivation === 1 ? '' : 's'} pending activation`,
        detail: 'Clinic roster accounts that have not been claimed yet.',
        prompt:
          'Which of my patients are pending activation? Use the practice panel. Do not invent clinical status.',
        tone: 'routine',
      });
    }

    return {
      totalPatients: patients.length,
      stablePatients: 0,
      todayAppointments,
      upcomingAppointments,
      weekAppointments,
      pendingAppointments,
      pendingPatientRequests,
      nextAppointment,
      attentionItems,
      patients: rosterPatients,
    };
  }, [appointments, patients, pendingAppointments, sharingRequests, timeZone]);

  const briefingPrompt = useMemo(
    () => buildBriefingPrompt(snapshot),
    [snapshot],
  );

  const practiceSnapshot = useMemo(
    () =>
      buildPracticeSnapshot(snapshot, {
        practiceId: practiceSession?.practice?.id,
        timezone: timeZone,
      }),
    [snapshot, practiceSession?.practice?.id, timeZone],
  );

  return { loading, snapshot, briefingPrompt, practiceSnapshot };
}
