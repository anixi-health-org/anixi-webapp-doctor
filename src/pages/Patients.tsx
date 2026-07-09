import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { PatientList } from '../components/patients/PatientList';
import { SharingRequestsList } from '../components/patients/SharingRequestsList';
import { AddPatientModal } from '../components/patients/AddPatientModal';
import { TabPill } from '../components/ui/TabPill';
import { Card, CardContent } from '../components/ui/Card';
import { PatientsPageSkeleton } from '../components/ui';
import { PageHeader, PageShell } from '../components/page-layout';
import { PrimaryButton } from '../components/ui/PrimaryButton';
import { Patient } from '../types';
import { listenToDoctorPatients } from '../services/patientManagementService';
import {
  useApproveIncomingRequest,
  useIncomingSharingRequests,
  useRejectIncomingRequest,
} from '../hooks/useIncomingSharingRequests';
import { useEffect } from 'react';

type TabType = 'patients' | 'requests';

export const Patients: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const doctorId = user?.id;

  const [activeTab, setActiveTab] = useState<TabType>('patients');
  const [patients, setPatients] = useState<Patient[]>([]);
  const [patientsLoading, setPatientsLoading] = useState(true);
  const [patientsError, setPatientsError] = useState<string | null>(null);
  const [showAddPatient, setShowAddPatient] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const {
    requests: sharingRequests,
    isLoading: sharingRequestsLoading,
    error: sharingRequestsError,
    refetch: refetchSharingRequests,
  } = useIncomingSharingRequests(doctorId);

  const approveMutation = useApproveIncomingRequest(doctorId);
  const rejectMutation = useRejectIncomingRequest(doctorId);

  useEffect(() => {
    if (!doctorId) return;
    const unsubscribe = listenToDoctorPatients(
      doctorId,
      (nextPatients) => {
        setPatients(nextPatients);
        setPatientsLoading(false);
      },
      (error) => {
        setPatientsError(error.message);
        setPatientsLoading(false);
      }
    );
    return unsubscribe;
  }, [doctorId]);

  useEffect(() => {
    if (!successMessage) return;
    const timer = setTimeout(() => setSuccessMessage(null), 3000);
    return () => clearTimeout(timer);
  }, [successMessage]);

  const pendingCount = sharingRequests.filter((r) => r.status === 'pending').length;

  const handleAcceptSharingRequest = async (
    patientId: string,
    _doctorId: string,
    requestId: string
  ) => {
    await approveMutation.mutateAsync({ requestId, patientId });
    setSuccessMessage('Request approved successfully!');
  };

  const handleRejectSharingRequest = async (
    patientId: string,
    _doctorId: string,
    requestId: string
  ) => {
    await rejectMutation.mutateAsync({ requestId, patientId });
    setSuccessMessage('Request rejected.');
  };

  if (patientsLoading && patients.length === 0 && activeTab === 'patients') {
    return (
      <PageShell>
        <PatientsPageSkeleton />
      </PageShell>
    );
  }

  return (
    <PageShell>
      <PageHeader
        title="Patient Directory"
        description="Manage connected patients and review incoming requests."
        actions={
          <PrimaryButton onClick={() => setShowAddPatient(true)} icon={<span className="text-lg leading-none">+</span>}>
            New Patient Record
          </PrimaryButton>
        }
      />

      {successMessage && (
        <div className="mb-4 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-700">
          {successMessage}
        </div>
      )}

      <div className="mb-6 flex gap-2 overflow-x-auto rounded-2xl border border-gray-100 bg-white p-1.5 shadow-soft">
        <TabPill onClick={() => setActiveTab('patients')} active={activeTab === 'patients'}>
          All Patients ({patients.length})
        </TabPill>
        <TabPill onClick={() => setActiveTab('requests')} active={activeTab === 'requests'}>
          Pending Requests ({pendingCount})
        </TabPill>
      </div>

      <div>
        {patientsError && activeTab === 'patients' && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 mb-4">
            {patientsError}
          </div>
        )}
        {sharingRequestsError && activeTab === 'requests' && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 mb-4">
            {sharingRequestsError.message}
            {sharingRequestsError.message.includes('permission') && (
              <p className="mt-2 text-sm">
                If this persists, ask your admin to deploy the latest Firestore rules.
              </p>
            )}
          </div>
        )}

        {activeTab === 'patients' && (
          <Card className="overflow-hidden">
            <PatientList
              patients={patients}
              loading={patientsLoading}
              onPatientClick={(patient) => navigate(`/patient-profile/${patient.id}`)}
            />
          </Card>
        )}

        {activeTab === 'requests' && (
          <Card>
            <CardContent>
            <h3 className="font-heading mb-4 text-lg font-semibold text-gray-900">Pending Requests</h3>
            <SharingRequestsList
              requests={sharingRequests}
              loading={sharingRequestsLoading}
              doctorId={doctorId || ''}
              onAccept={handleAcceptSharingRequest}
              onReject={handleRejectSharingRequest}
              onRefresh={async () => {
                await refetchSharingRequests();
              }}
              refreshing={approveMutation.isPending || rejectMutation.isPending}
            />
            </CardContent>
          </Card>
        )}
      </div>

      <AddPatientModal
        isOpen={showAddPatient}
        onClose={() => setShowAddPatient(false)}
        onAdded={(result) => {
          setSuccessMessage(
            result.inviteWarning || 'Patient added successfully'
          );
          setShowAddPatient(false);
        }}
      />
    </PageShell>
  );
};
