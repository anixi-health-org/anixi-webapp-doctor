import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { PatientCard } from '../components/PatientCard';
import { useAuth } from '../hooks/useAuth';
import { Patient, PatientStatus } from '../types';
import { getDoctorPatients, removePatientFromDoctor, updatePatient } from '../services/patientManagementService';
import { getDashboardStats } from '../services/doctorService';
import { DashboardStats } from '../types';
import {
  getDoctorPatientsAdherenceSummary,
  type PatientAdherenceListSummary,
} from '../services/adherenceService';
import { EditPatientModal } from '../components/patients/EditPatientModal';
export const PatientList: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const filterParam = (searchParams.get('filter') || 'total') as PatientStatus | 'total' | 'all';
  const [filteredPatients, setFilteredPatients] = useState<Patient[]>([]);
  const [adherenceByPatient, setAdherenceByPatient] = useState<Map<string, PatientAdherenceListSummary>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [showEditPatientModal, setShowEditPatientModal] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const loadPatients = async () => {
    if (!user) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      const [patientsData, statsData] = await Promise.all([
        getDoctorPatients(user.id),
        getDashboardStats(user.id),
      ]);

      const adherenceSummary = await getDoctorPatientsAdherenceSummary(
        user.id,
        patientsData.map((patient) => patient.id)
      );

      setAdherenceByPatient(adherenceSummary);
      applyFilter(patientsData, filterParam, statsData);
    } catch (err) {
      setError('Failed to load patients. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadPatients();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, filterParam]);
  const applyFilter = (allPatients: Patient[], filter: PatientStatus | 'total' | 'all', dashboardStats: DashboardStats) => {
    let filtered: Patient[] = [];
    const now = new Date();
    const fiveDaysAgo = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000);
    switch (filter) {
      case 'stable':
        filtered = allPatients.filter((patient) => {
          const lastActive = patient.updatedAt ? new Date(patient.updatedAt) : new Date(patient.createdAt);
          return lastActive >= fiveDaysAgo;
        });
        break;
      case 'warning':
        filtered = allPatients.filter((patient) => {
          const lastActive = patient.updatedAt ? new Date(patient.updatedAt) : new Date(patient.createdAt);
          return lastActive >= fiveDaysAgo && lastActive < new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
        });
        break;
      case 'inactive':
        filtered = allPatients.filter((patient) => {
          const lastActive = patient.updatedAt ? new Date(patient.updatedAt) : new Date(patient.createdAt);
          return lastActive < fiveDaysAgo;
        });
        break;
      case 'total':
      case 'all':
      default:
        filtered = allPatients;
        break;
    }
    setFilteredPatients(filtered);
  };
  const getPatientStatus = (patient: Patient): PatientStatus => {
    const now = new Date();
    const fiveDaysAgo = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000);
    const lastActive = patient.updatedAt ? new Date(patient.updatedAt) : new Date(patient.createdAt);
    if (lastActive < fiveDaysAgo) {
      return 'inactive';
    }
    return 'stable';
  };
  const getFilterLabel = () => {
    switch (filterParam) {
      case 'stable':
        return 'Stable Patients';
      case 'warning':
        return 'Patients Requiring Attention';
      case 'inactive':
        return 'Inactive Patients';
      case 'total':
      case 'all':
      default:
        return 'All Patients';
    }
  };

  const handleEditClick = (patient: Patient) => {
    setSelectedPatient(patient);
    setActionError(null);
    setActionMessage(null);
    setShowEditPatientModal(true);
  };

  const handleRemoveClick = async (patient: Patient) => {
    if (!user) return;
    const confirmed = window.confirm(
      `Remove ${patient.displayName || patient.email || 'this patient'} from your practice?`
    );
    if (!confirmed) return;

    setActionError(null);
    setActionMessage(null);

    try {
      await removePatientFromDoctor(user.id, patient.id);
      setActionMessage('Patient removed successfully.');
      await loadPatients();
    } catch (err: any) {
      setActionError(err?.message || 'Failed to remove patient');
    }
  };

  const handleSavePatient = async (updates: Partial<Patient>) => {
    if (!selectedPatient) return;
    setActionError(null);
    setActionMessage(null);

    try {
      await updatePatient(selectedPatient.id, updates);
      setActionMessage('Patient updated successfully.');
      setShowEditPatientModal(false);
      setSelectedPatient(null);
      await loadPatients();
    } catch (err: any) {
      setActionError(err?.message || 'Failed to update patient');
      throw err;
    }
  };
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="text-lg text-gray-600">Loading patients...</div>
          <div className="mt-2 text-sm text-gray-500">Please wait</div>
        </div>
      </div>
    );
  }
  if (error) {
    return (
      <div className="p-6 bg-anixi-beige min-h-screen">
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <h3 className="text-lg font-semibold text-red-900">Error</h3>
          <p className="text-red-700 mt-1">{error}</p>
        </div>
      </div>
    );
  }
  return (
    <div className="p-6 bg-anixi-beige min-h-screen">
      <div className="mb-8">
        <button
          onClick={() => navigate('/dashboard')}
          className="mb-4 px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg transition-colors"
        >
          ← Back to Dashboard
        </button>
        <h1 className="text-3xl font-bold text-gray-900">{getFilterLabel()}</h1>
        <p className="mt-2 text-gray-600">
          Showing <span className="font-semibold">{filteredPatients.length}</span> {filteredPatients.length === 1 ? 'patient' : 'patients'}
        </p>
      </div>
      {filteredPatients.length === 0 ? (
        <div className="p-8 bg-white border border-gray-200 rounded-lg text-center">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No patients found</h3>
          <p className="text-gray-600">
            You currently have no {filterParam !== 'total' && filterParam !== 'all' ? filterParam : ''} patients.
          </p>
        </div>
      ) : (
        <>
          {(actionMessage || actionError) && (
            <div className="mb-4 space-y-2">
              {actionMessage && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-700">
                  {actionMessage}
                </div>
              )}
              {actionError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700">
                  {actionError}
                </div>
              )}
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredPatients.map((patient) => (
              <PatientCard
                key={patient.id}
                patient={patient}
                status={getPatientStatus(patient)}
                adherenceRate={adherenceByPatient.get(patient.id)?.adherenceRate}
                adherenceLabel={adherenceByPatient.get(patient.id)?.statusLabel}
                onOpenAdherenceCalendar={() =>
                  navigate(`/patient-profile/${patient.id}/adherence-calendar`)
                }
                onOpenAdherenceLogs={() =>
                  navigate(`/patient-profile/${patient.id}/adherence-logs`)
                }
                onEdit={() => handleEditClick(patient)}
                onRemove={() => handleRemoveClick(patient)}
                onClick={() => navigate(`/patient-profile/${patient.id}`)}
              />
            ))}
          </div>
        </>
      )}

      <EditPatientModal
        isOpen={showEditPatientModal}
        patient={selectedPatient || ({} as Patient)}
        onClose={() => {
          setShowEditPatientModal(false);
          setSelectedPatient(null);
        }}
        onSave={handleSavePatient}
      />
    </div>
  );
};
