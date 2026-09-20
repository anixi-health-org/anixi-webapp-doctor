import { useEffect, useState } from 'react';
import { useAuth } from './useAuth';
import { djangoListPatientPanel } from '../services/djangoApiService';
import { getPatientsSharingRecords } from '../services/medicalRecordShareService';
import {
  canDoctorViewPatientMedicalVault,
  patientIsOnDoctorPanel,
  patientSharedRecordsWithDoctor,
} from '../utils/patientMedicalVaultAccess';
import type { Patient } from '../types';

export function usePatientMedicalVaultAccess(
  patient: Pick<Patient, 'id' | 'rosterStatus'> | null | undefined,
) {
  const { user } = useAuth();
  const [sharedPatientIds, setSharedPatientIds] = useState<Set<string>>(() => new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!patient?.id || !user?.id) {
      setSharedPatientIds(new Set());
      setLoading(false);
      return;
    }

    if (patient.rosterStatus === 'active') {
      setSharedPatientIds(new Set());
      setLoading(false);
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const [panel, shares] = await Promise.all([
          djangoListPatientPanel().catch(() => []),
          getPatientsSharingRecords(user.id).catch(() => []),
        ]);
        if (cancelled) return;

        const ids = new Set<string>();
        if (patientIsOnDoctorPanel(patient.id, panel)) {
          ids.add(patient.id);
        }
        if (patientSharedRecordsWithDoctor(patient.id, shares)) {
          ids.add(patient.id);
        }
        setSharedPatientIds(ids);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [patient?.id, patient?.rosterStatus, user?.id]);

  const canAccess = canDoctorViewPatientMedicalVault(patient, { sharedPatientIds });

  return { canAccess, loading };
}
