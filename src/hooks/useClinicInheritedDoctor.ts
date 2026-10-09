import { useMemo } from 'react';
import type { BookingPolicy, Doctor, Practice } from '../types';
import { useAuth } from './AuthContext';
import { usePermissions } from './usePermissions';
import {
  mergeDoctorWithClinicPractice,
  shouldInheritClinicPracticeSettings,
} from '../lib/doctorAccess';

export type ClinicInheritedPhysicianContext = {
  doctor: Doctor | null;
  practice: Practice | null;
  bookingPolicy: BookingPolicy | null;
  inheritsFromClinic: boolean;
};

/** Physician workspace: personal credentials plus clinic-owned settings when employed. */
export function useClinicInheritedDoctor(): ClinicInheritedPhysicianContext {
  const { user, practiceSession } = useAuth();
  const { isClinicEmployedClinician } = usePermissions();

  return useMemo(() => {
    const baseDoctor = user?.role === 'doctor' ? (user as Doctor) : null;
    const practice = practiceSession?.practice ?? null;
    const bookingPolicy = practiceSession?.bookingPolicy ?? null;
    const inheritsFromClinic = shouldInheritClinicPracticeSettings(
      practiceSession,
      isClinicEmployedClinician,
    );

    const doctor =
      baseDoctor && inheritsFromClinic && practice
        ? mergeDoctorWithClinicPractice(baseDoctor, practice)
        : baseDoctor;

    return {
      doctor,
      practice,
      bookingPolicy,
      inheritsFromClinic,
    };
  }, [user, practiceSession, isClinicEmployedClinician]);
}
