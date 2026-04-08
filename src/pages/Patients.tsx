import React, { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { Patient } from '../types';
import { getDoctorPatients } from '../services/doctorService';
import {
  getDoctorPatientRequests,
  acceptPatientRequest,
  rejectPatientRequest,
  PatientRequest,
  debugListAllPatientRequests,
} from '../services/patientManagementService';
import { PatientList } from '../components/patients/PatientList';
import { PatientRequestList } from '../components/patients/PatientRequestList';
import { PatientDetailModal } from '../components/patients/PatientDetailModal';

type TabType = 'patients' | 'requests';

export const Patients: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('patients');

  const [patients, setPatients] = useState<Patient[]>([]);
  const [patientsLoading, setPatientsLoading] = useState(false);
  const [patientsError, setPatientersError] = useState<string | null>(null);

  const [requests, setRequests] = useState<PatientRequest[]>([]);
  const [requestsLoading, setRequestsLoading] = useState(false);
  const [requestsError, setRequestsError] = useState<string | null>(null);

  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [showModal, setShowModal] = useState(false);

  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const doctorId = user?.id;

  const fetchPatients = async () => {
    console.log(`[Patients.fetchPatients] 📋 Fetching patients... doctorId=${doctorId}`);

    if (!doctorId) {
      console.error(
        `[Patients.fetchPatients] ❌ Cannot fetch: doctorId is undefined/empty`
      );
      setPatientersError('Doctor ID not found. Please log in again.');
      return;
    }

    try {
      setPatientsLoading(true);
      setPatientersError(null);
      console.log(`[Patients.fetchPatients] ⏳ Calling getDoctorPatients(${doctorId})`);

      const data = await getDoctorPatients(doctorId);

      console.log(`[Patients.fetchPatients] ✅ Received ${data.length} patients`);
      setPatients(data);
    } catch (error) {
      const errorMsg =
        error instanceof Error ? error.message : 'Failed to fetch patients';
      console.error(`[Patients.fetchPatients] ❌ Error:`, errorMsg);
      setPatientersError(errorMsg);
    } finally {
      setPatientsLoading(false);
    }
  };

  const fetchRequests = async () => {
    console.log(`\n[Patients.fetchRequests] 📋 Starting fetch... doctorId=${doctorId}`);

    if (!doctorId) {
      console.error('[Patients.fetchRequests] ❌ Cannot fetch: doctorId is undefined');
      return;
    }

    try {
      setRequestsLoading(true);
      setRequestsError(null);

      console.log('[Patients.fetchRequests] 🔍 Calling debug function...');
      await debugListAllPatientRequests(doctorId);

      console.log('[Patients.fetchRequests] ⏳ Fetching pending requests...');
      const data = await getDoctorPatientRequests(doctorId);
      
      console.log(`[Patients.fetchRequests] ✅ Got ${data.length} requests`);
      console.log(`[Patients.fetchRequests] 📊 Request IDs: ${data.map(r => r.id).join(', ') || 'NONE'}`);
      
      setRequests(data);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Failed to fetch requests';
      console.error(`[Patients.fetchRequests] ❌ Error:`, errorMsg);
      setRequestsError(errorMsg);
    } finally {
      setRequestsLoading(false);
    }
  };

  useEffect(() => {
    console.log(`[Patients.useEffect] 🔄 Effect triggered - doctorId: ${doctorId}`);

    if (!doctorId) {
      console.warn(`[Patients.useEffect] ⚠️  Skipping: doctorId is not set yet`);
      return;
    }

    console.log(`[Patients.useEffect] ✅ Starting data load for doctor: ${doctorId}`);
    fetchPatients();
    fetchRequests();

    const interval = setInterval(() => {
      console.log(`[Patients.useEffect] 🔄 Auto-refresh triggered for doctor: ${doctorId}`);
      fetchPatients();
      fetchRequests();
    }, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, [doctorId]);

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

  const handleAcceptRequest = async (requestId: string, patientId: string) => {
    if (!doctorId) return;

    try {
      await acceptPatientRequest(doctorId, requestId, patientId);
      setSuccessMessage('Patient request accepted successfully!');

      await fetchPatients();
      await fetchRequests();
    } catch (error) {
      setRequestsError(
        error instanceof Error ? error.message : 'Failed to accept request'
      );
    }
  };

  const handleRejectRequest = async (requestId: string) => {
    if (!doctorId) return;

    try {
      await rejectPatientRequest(doctorId, requestId);
      setSuccessMessage('Patient request rejected successfully!');

      await fetchRequests();
    } catch (error) {
      setRequestsError(
        error instanceof Error ? error.message : 'Failed to reject request'
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
              setRequestsError(null);
            }}
            className={`px-4 py-4 font-medium border-b-2 transition-colors ${
              activeTab === 'requests'
                ? 'border-anixi-green text-anixi-green'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            📬 Requests ({requests.length})
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {patientsError && activeTab === 'patients' && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 mb-4">
            {patientsError}
          </div>
        )}

        {requestsError && activeTab === 'requests' && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 mb-4">
            {requestsError}
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
          <div>
            <PatientRequestList
              requests={requests}
              loading={requestsLoading}
              onAccept={handleAcceptRequest}
              onReject={handleRejectRequest}
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
      />
    </div>
  );
};