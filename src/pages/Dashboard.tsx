import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { ImprovedDashboard } from '../components/dashboard';
import { AddPatientModal } from '../components/patients/AddPatientModal';
import { PageShell } from '../components/page-layout';
import {
  listenToDoctorPatients,
} from '../services/patientManagementService';
import { useIncomingSharingRequests } from '../hooks/useIncomingSharingRequests';
import { Patient } from '../types';

export const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const { requests: sharingRequests } = useIncomingSharingRequests(user?.id);

  const [patients, setPatients] = useState<Patient[]>([]);
  const [patientsLoading, setIsLoading] = useState(true);
  const [patientsError, setPatientsError] = useState<string | null>(null);
  const [showAddPatient, setShowAddPatient] = useState(false);

  const pendingPatientIds = new Set(
    sharingRequests
      .filter((request) => request.status === 'pending')
      .map((request) => request.patientId)
  );

  const actionRequiredCount = patients.filter(
    (patient) =>
      pendingPatientIds.has(patient.id) ||
      (patient.chronicDiseases && patient.chronicDiseases.length > 0)
  ).length;

  const [stableCount, setStableCount] = useState(0);
  const [inactiveCount, setInactiveCount] = useState(0);

  useEffect(() => {
    const calculateCounts = async () => {
      let inactive = 0;
      let stable = 0;

      for (const patient of patients) {
        const hasChronicDiseases = patient.chronicDiseases && patient.chronicDiseases.length > 0;

        if (hasChronicDiseases) {
          continue;
        }

        let isInactive = false;
        try {
          const thirtyDaysAgo = new Date();
          thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
          const today = new Date();

          const { getAdherenceStats } = await import('../services/adherenceService');
          const stats = await getAdherenceStats(
            patient.id,
            thirtyDaysAgo.toISOString().split('T')[0],
            today.toISOString().split('T')[0]
          );

          isInactive = stats.averageAdherence < 5;
        } catch (err) {
          const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
          const lastUpdate = patient.updatedAt ? new Date(patient.updatedAt) : new Date(patient.createdAt);
          isInactive = lastUpdate < fiveDaysAgo;
        }

        if (isInactive) {
          inactive++;
        } else {
          stable++;
        }
      }

      setStableCount(stable);
      setInactiveCount(inactive);
    };

    if (patients.length > 0) {
      calculateCounts();
    } else {
      setStableCount(0);
      setInactiveCount(0);
    }
  }, [patients]);

  useEffect(() => {
    if (!user?.id) {
      return;
    }

    
    setIsLoading(true);

    const unsubscribePatients = listenToDoctorPatients(
      user.id,
      (updatedPatients) => {
        setPatients(updatedPatients);
        setPatientsError(null);
        setIsLoading(false);
      },
      (error) => {
        ;
        setPatientsError(error.message || 'Failed to load patients');
        setIsLoading(false);
      }
    );

    return () => {
      unsubscribePatients();
    };
  }, [user?.id, user]);

  return (
    <PageShell>
      <ImprovedDashboard
        patients={patients}
        patientsLoading={patientsLoading}
        patientsError={patientsError}
        actionRequiredCount={actionRequiredCount}
        stableCount={stableCount}
        inactiveCount={inactiveCount}
        onAddPatient={() => setShowAddPatient(true)}
      />
      <AddPatientModal
        isOpen={showAddPatient}
        onClose={() => setShowAddPatient(false)}
      />
    </PageShell>
  );
};

export default Dashboard;
