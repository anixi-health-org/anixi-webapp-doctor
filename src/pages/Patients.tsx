import React, { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { Patient, SharingRequest } from '../types';
import {
  acceptSharingRequest,
  rejectSharingRequest,
  listenToDoctorPatients,
  listenToDoctorSharingRequests,
} from '../services/patientManagementService';
import { PatientList } from '../components/patients/PatientList';
import { SharingRequestsList } from '../components/patients/SharingRequestsList';
import { PatientDetailModal } from '../components/patients/PatientDetailModal';
type TabType = 'patients' | 'requests';
export const Patients: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('patients');
  const [patients, setPatients] = useState<Patient[]>([]);
  const [patientsLoading, setPatientsLoading] = useState(false);
  const [patientsError, setPatientersError] = useState<string | null>(null);
  const [sharingRequests, setSharingRequests] = useState<SharingRequest[]>([]);
  const [sharingRequestsLoading, setSharingRequestsLoading] = useState(false);
  const [sharingRequestsError, setSharingRequestsError] = useState<string | null>(null);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [showModal, setShowModal] = useState(false);
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

    return () => {
      unsubscribePatients();
      unsubscribeSharingRequests();
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
  return (
    <div className="min-h-screen bg-anixi-beige">
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Patient Management</h1>
            <p className="text-gray-600 mt-1">Manage your connected patients and review requests</p>
          </div>
        </div>
      </div>
      {successMessage && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-4">
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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
        <div className="flex gap-4 border-b border-gray-200">
          <button
            onClick={() => {
              setActiveTab('patients');
              setPatientersError(null);
            }}
            className={`px-4 py-4 font-medium border-b-2 transition-colors ${
              activeTab === 'patients'
                ? 'border-anixi-green text-anixi-green'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            👥 Patients ({patients.length})
          </button>
          <button
            onClick={() => {
              setActiveTab('requests');
            }}
            className={`px-4 py-4 font-medium border-b-2 transition-colors ${
              activeTab === 'requests'
                ? 'border-anixi-green text-anixi-green'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            📬 Requests ({sharingRequests.filter(r => r.status === 'pending').length})
          </button>
        </div>
      </div>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
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
          <div>
            <PatientList
              patients={patients}
              loading={patientsLoading}
              onPatientClick={handlePatientClick}
            />
          </div>
        )}
        {activeTab === 'requests' && (
          <div className="space-y-6">
            <div>
              {}
              <div className="mb-6">

                {sharingRequestsLoading && (
                  <div className="flex justify-center items-center h-40">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                  </div>
                )}
                {!sharingRequestsLoading && (
                  <SharingRequestsList
                    requests={sharingRequests}
                    loading={sharingRequestsLoading}
                    doctorId={doctorId || ''}
                    onAccept={handleAcceptSharingRequest}
                    onReject={handleRejectSharingRequest}
                  />
                )}
              </div>
            </div>
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
      />
    </div>
  );
};