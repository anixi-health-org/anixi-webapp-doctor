import React, { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { Patient, SharingRequest } from '../types';
import { PatientRequest } from '../services/patientManagementService';
import {
  acceptSharingRequest,
  getDoctorSharingRequests,
  rejectSharingRequest,
  listenToDoctorPatients,
  listenToDoctorSharingRequests,
  listenToDoctorPatientRequests,
  acceptPatientRequest,
  rejectPatientRequest,
} from '../services/patientManagementService';
import { PatientList } from '../components/patients/PatientList';
import { SharingRequestsList } from '../components/patients/SharingRequestsList';
import { PatientDetailModal } from '../components/patients/PatientDetailModal';
import { AddPatientModal } from '../components/patients/AddPatientModal';
import { TabPill } from '../components/ui/TabPill';
type TabType = 'patients' | 'requests';
export const Patients: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('patients');
  const [patients, setPatients] = useState<Patient[]>([]);
  const [patientsLoading, setPatientsLoading] = useState(false);
  const [patientsError, setPatientersError] = useState<string | null>(null);
  const [sharingRequests, setSharingRequests] = useState<SharingRequest[]>([]);
  const [patientRequests, setPatientRequests] = useState<PatientRequest[]>([]);
  const [sharingRequestsLoading, setSharingRequestsLoading] = useState(false);
  const [patientRequestsLoading, setPatientRequestsLoading] = useState(false);
  const [sharingRequestsRefreshing, setSharingRequestsRefreshing] = useState(false);
  const [sharingRequestsError, setSharingRequestsError] = useState<string | null>(null);
  const [patientRequestsError, setPatientRequestsError] = useState<string | null>(null);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [showAddPatient, setShowAddPatient] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const doctorId = user?.id;
  useEffect(() => {
    
    if (!doctorId) {
      ;
      return;
    }

    
    const unsubscribePatients = listenToDoctorPatients(
      doctorId,
      (patients) => {
        setPatients(patients);
        setPatientsLoading(false);
      },
      (error) => {
        ;
        setPatientersError(error.message);
        setPatientsLoading(false);
      }
    );

    const unsubscribeSharingRequests = listenToDoctorSharingRequests(
      doctorId,
      (requests) => {
        setSharingRequests(requests);
        setSharingRequestsLoading(false);

      },
      (error) => {
        ;
        setSharingRequestsError(error.message);
        setSharingRequestsLoading(false);
      }
    );

    const unsubscribePatientRequests = listenToDoctorPatientRequests(
      doctorId,
      (requests) => {
        setPatientRequests(requests);
        setPatientRequestsLoading(false);
      },
      (error) => {
        ;
        setPatientRequestsError(error.message);
        setPatientRequestsLoading(false);
      }
    );

    return () => {
      unsubscribePatients();
      unsubscribeSharingRequests();
      unsubscribePatientRequests();
    };
  }, [doctorId, user]);
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);
  const handlePatientClick = (patient: Patient) => {
    setSelectedPatient(patient);
    setShowModal(true);
  };

  const handleAcceptSharingRequest = async (patientId: string, doctorId: string, requestId: string) => {
    try {
      await acceptSharingRequest(patientId, doctorId, requestId);
      setSuccessMessage('Sharing request accepted successfully!');
    } catch (error) {
      setSharingRequestsError(
        error instanceof Error ? error.message : 'Failed to accept sharing request'
      );
    }
  };

  const handleRejectSharingRequest = async (patientId: string, doctorId: string, requestId: string) => {
    try {
      await rejectSharingRequest(patientId, doctorId, requestId);
      setSuccessMessage('Sharing request rejected successfully!');
    } catch (error) {
      setSharingRequestsError(
        error instanceof Error ? error.message : 'Failed to reject sharing request'
      );
    }
  };

  const handleAcceptPatientRequest = async (patientId: string, requestId: string) => {
    if (!doctorId) return;
    try {
      await acceptPatientRequest(doctorId, requestId, patientId);
      setSuccessMessage('Patient request accepted successfully!');
    } catch (error) {
      setPatientRequestsError(
        error instanceof Error ? error.message : 'Failed to accept patient request'
      );
    }
  };

  const handleRejectPatientRequest = async (requestId: string) => {
    if (!doctorId) return;
    try {
      await rejectPatientRequest(doctorId, requestId);
      setSuccessMessage('Patient request rejected successfully!');
    } catch (error) {
      setPatientRequestsError(
        error instanceof Error ? error.message : 'Failed to reject patient request'
      );
    }
  };

  const handleRefreshSharingRequests = async () => {
    if (!doctorId) return;
    try {
      setSharingRequestsError(null);
      setSharingRequestsRefreshing(true);
      const refreshed = await getDoctorSharingRequests(doctorId);
      setSharingRequests(refreshed.filter((req) => req.status === 'pending'));
    } catch (error) {
      setSharingRequestsError(
        error instanceof Error ? error.message : 'Failed to refresh sharing requests'
      );
    } finally {
      setSharingRequestsRefreshing(false);
    }
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
        <div className="mt-4">
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-green-700 flex items-center gap-2">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clipRule="evenodd"
              />
            </svg>
            {successMessage}
          </div>
        </div>
      )}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-2">
        <div className="flex gap-3 rounded-3xl border border-[#E4EAF2] bg-white p-2 shadow-sm overflow-x-auto">
          <TabPill
            onClick={() => {
              setActiveTab('patients');
              setPatientersError(null);
            }}
            active={activeTab === 'patients'}
          >
            All Patients ({patients.length})
          </TabPill>
          <TabPill
            onClick={() => {
              setActiveTab('requests');
            }}
            active={activeTab === 'requests'}
          >
            Requests ({sharingRequests.filter(r => r.status === 'pending').length})
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
            {sharingRequestsError}
          </div>
        )}
        {activeTab === 'patients' && (
          <div className="rounded-[28px] border border-[#E4EAF2] bg-white shadow-sm overflow-hidden">
            <PatientList
              patients={patients}
              loading={patientsLoading}
              onPatientClick={handlePatientClick}
            />
          </div>
        )}
        {activeTab === 'requests' && (
          <div className="rounded-[28px] border border-[#E4EAF2] bg-white shadow-sm overflow-hidden p-4 sm:p-6">
            {(sharingRequestsLoading || patientRequestsLoading) && (
              <div className="flex justify-center items-center h-40">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#425950]"></div>
              </div>
            )}
            {!sharingRequestsLoading && !patientRequestsLoading && (
              <>
                <div className="mb-6">
                  <h3 className="text-lg font-semibold mb-4 text-[#0E2340]">Share Requests</h3>
                  <SharingRequestsList
                    requests={sharingRequests}
                    loading={sharingRequestsLoading}
                    doctorId={doctorId || ''}
                    onAccept={handleAcceptSharingRequest}
                    onReject={handleRejectSharingRequest}
                    onRefresh={handleRefreshSharingRequests}
                    refreshing={sharingRequestsRefreshing}
                  />
                </div>
                
                {patientRequests.length > 0 && (
                  <div className="border-t pt-6 mt-6">
                    <h3 className="text-lg font-semibold mb-4 text-[#0E2340]">Patient Requests</h3>
                    <div className="space-y-3">
                      {patientRequests.map((request) => (
                        <div
                          key={request.id}
                          className="flex items-center justify-between p-4 border border-[#E4EAF2] rounded-lg hover:bg-[#F8FAFB] transition-colors"
                        >
                          <div className="flex-1">
                            <p className="font-semibold text-[#0E2340]">
                              {request.patientInfo?.displayName || 'Unknown Patient'}
                            </p>
                            <p className="text-sm text-[#72829B]">
                              {request.patientInfo?.email || 'No email'}
                            </p>
                            <p className="text-xs text-[#72829B] mt-1">
                              Requested: {request.requestedAt ? new Date(request.requestedAt).toLocaleDateString() : 'N/A'}
                            </p>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleAcceptPatientRequest(request.patientId, request.id)}
                              className="px-4 py-2 bg-[#32A887] text-white rounded-lg text-sm font-medium hover:bg-[#2a9878] transition-colors"
                            >
                              Accept
                            </button>
                            <button
                              onClick={() => handleRejectPatientRequest(request.id)}
                              className="px-4 py-2 border border-[#E4EAF2] text-[#0E2340] rounded-lg text-sm font-medium hover:bg-[#F8FAFB] transition-colors"
                            >
                              Decline
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {patientRequests.length === 0 && sharingRequests.length === 0 && (
                  <p className="text-center text-[#72829B] py-8">No pending requests</p>
                )}
              </>
            )}
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
          setPatients((prev) =>
            prev.map((p) => (p.id === updated.id ? { ...p, ...updated } : p))
          );
        }}
      />
      <AddPatientModal
        isOpen={showAddPatient}
        onClose={() => setShowAddPatient(false)}
        onAdded={(id) => {
          setSuccessMessage('Patient added successfully');
          setShowAddPatient(false);
        }}
      />
    </div>
  );
};