import { useCallback, useEffect, useState } from 'react';
import { getPracticeDashboardStats } from '../services/practiceDashboardService';
import {
  getBookableBlocks,
  listPracticeClinicians,
} from '../services/practiceSettingsService';
import type { SetupStep } from '../components/clinic/ClinicAdminSetupBanner';

export type ClinicSetupStatus = {
  loading: boolean;
  doctorCount: number;
  patientCount: number;
  pendingInvites: number;
  hasDoctorHours: boolean;
  appointmentCount: number;
  steps: SetupStep[];
  isReady: boolean;
  reload: () => Promise<void>;
};

export function useClinicSetupStatus(practiceId: string | undefined): ClinicSetupStatus {
  const [loading, setLoading] = useState(true);
  const [doctorCount, setDoctorCount] = useState(0);
  const [patientCount, setPatientCount] = useState(0);
  const [pendingInvites, setPendingInvites] = useState(0);
  const [hasDoctorHours, setHasDoctorHours] = useState(false);
  const [appointmentCount, setAppointmentCount] = useState(0);

  const reload = useCallback(async () => {
    if (!practiceId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [stats, clinicians, blocks] = await Promise.all([
        getPracticeDashboardStats(practiceId),
        listPracticeClinicians(practiceId),
        getBookableBlocks(practiceId),
      ]);
      setDoctorCount(clinicians.length);
      setPatientCount(stats.rosterPatients ?? 0);
      setPendingInvites(stats.pendingInvites ?? 0);
      setAppointmentCount(stats.appointmentCount ?? 0);
      const clinicianIds = new Set(clinicians.map((c) => c.uid));
      setHasDoctorHours(
        blocks.some((b) => b.active !== false && clinicianIds.has(b.doctorId))
      );
    } catch (error) {
      console.warn('[useClinicSetupStatus] failed to load clinic setup', error);
    } finally {
      setLoading(false);
    }
  }, [practiceId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const hasDoctors = doctorCount > 0;
  const hasPatients = patientCount > 0;

  const steps: SetupStep[] = [
    {
      id: 'doctors',
      label: 'Invite your doctors',
      description: 'Doctors receive an email to join and manage their own clinical portal.',
      href: '/clinic/team',
      done: hasDoctors,
    },
    {
      id: 'hours',
      label: 'Set doctor clinic hours',
      description: 'Define when each doctor is available so the front desk can book slots.',
      href: '/clinic/settings?tab=schedules',
      done: hasDoctorHours,
    },
    {
      id: 'patients',
      label: 'Import your patient roster',
      description: 'Upload a CSV so patients get app access and login credentials.',
      href: '/clinic/patients',
      done: hasPatients,
    },
    {
      id: 'appointment',
      label: 'Book your first appointment',
      description: 'Schedule a patient visit on the clinic calendar.',
      href: '/clinic/schedule',
      done: appointmentCount > 0,
    },
  ];

  return {
    loading,
    doctorCount,
    patientCount,
    pendingInvites,
    hasDoctorHours,
    appointmentCount,
    steps,
    isReady: steps.every((s) => s.done),
    reload,
  };
}
