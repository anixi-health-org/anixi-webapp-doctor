import { V2Dashboard } from '../components/dashboard/V2Dashboard';
import { AddPatientModal } from '../components/patients/AddPatientModal';
import { PageShell } from '../components/page-layout';
import {
  derivePatientRosterStatus,
  listenToDoctorPatients,
} from '../services/patientManagementService';
import { syncDoctorPatientRoster } from '../services/patientRosterSync';
import { useIncomingSharingRequests } from '../hooks/useIncomingSharingRequests';
import { Patient } from '../types';
import { useAuth } from '../hooks/useAuth';
import React, { useState, useEffect } from 'react';

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

  const actionRequiredCount = patients.filter((patient) => pendingPatientIds.has(patient.id)).length;

  const stableCount = patients.filter((patient) => derivePatientRosterStatus(patient) === 'stable').length;
  const inactiveCount = patients.filter((patient) => derivePatientRosterStatus(patient) === 'inactive').length;

  useEffect(() => {
    if (!user?.id) {
      return;
    }

    
    setIsLoading(true);

    // Pulls in patients whose roster entry was never written (older bookings,
    // record shares); the listener below picks them up as soon as they land.
    void syncDoctorPatientRoster(user.id);

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
      <V2Dashboard
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
