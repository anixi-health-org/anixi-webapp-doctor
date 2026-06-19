import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { PatientList } from '../components/patients/PatientList';
import { SharingRequestsList } from '../components/patients/SharingRequestsList';
import { PatientDetailModal } from '../components/patients/PatientDetailModal';
import { AddPatientModal } from '../components/patients/AddPatientModal';
import { TabPill } from '../components/ui/TabPill';
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
  const doctorId = user?.id;

  const [activeTab, setActiveTab] = useState<TabType>('patients');
  const [patients, setPatients] = useState<Patient[]>([]);
  const [patientsLoading, setPatientsLoading] = useState(true);
  const [patientsError, setPatientsError] = useState<string | null>(null);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [showModal, setShowModal] = useState(false);
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

  return (
    <div className="min-h-screen bg-anixi-beige">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-[#0E2340]">Patient Directory</h1>
            <p className="mt-2 text-sm sm:text-base text-[#72829B]">
              Manage connected patients and review incoming requests.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowAddPatient(true)}
            className="inline-flex items-center justify-center gap-3 rounded-2xl bg-anixi-green text-white px-6 py-4 text-base font-semibold shadow-lg shadow-[#425950]/15 hover:bg-anixi-green/90"
          >
            <span className="text-2xl leading-none">+</span>
            <span>New Patient Record</span>
          </button>
        </div>
      </div>

      {successMessage && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-4">
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-green-700">
            {successMessage}
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-2">
        <div className="flex gap-3 rounded-3xl border border-[#E4EAF2] bg-white p-2 shadow-sm overflow-x-auto">
          <TabPill onClick={() => setActiveTab('patients')} active={activeTab === 'patients'}>
            All Patients ({patients.length})
          </TabPill>
          <TabPill onClick={() => setActiveTab('requests')} active={activeTab === 'requests'}>
            Pending Requests ({pendingCount})
          </TabPill>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
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
          <div className="rounded-[28px] border border-[#E4EAF2] bg-white shadow-sm overflow-hidden">
            <PatientList
              patients={patients}
              loading={patientsLoading}
              onPatientClick={(patient) => {
                setSelectedPatient(patient);
                setShowModal(true);
              }}
            />
          </div>
        )}

        {activeTab === 'requests' && (
          <div className="rounded-[28px] border border-[#E4EAF2] bg-white shadow-sm overflow-hidden p-4 sm:p-6">
            <h3 className="text-lg font-semibold mb-4 text-[#0E2340]">Pending Requests</h3>
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
          </div>
        )}
      </div>

      <PatientDetailModal
        patient={selectedPatient}
        isOpen={showModal}
        onClose={() => {
          setShowModal(false);
          setSelectedPatient(null);
        }}
        onPatientUpdated={(updated) => {
          setSelectedPatient(updated);
          setPatients((prev) => prev.map((p) => (p.id === updated.id ? { ...p, ...updated } : p)));
        }}
      />
      <AddPatientModal
        isOpen={showAddPatient}
        onClose={() => setShowAddPatient(false)}
        onAdded={() => {
          setSuccessMessage('Patient added successfully');
          setShowAddPatient(false);
        }}
      />
    </div>
  );
};
