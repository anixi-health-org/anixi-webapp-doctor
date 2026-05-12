import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Patient } from '../../types';
import { DashboardStatsCard } from './DashboardStatsCard';
import { PatientListPanel } from './PatientListPanel';
import { PatientDetailsPanel } from './PatientDetailsPanel';
import { MedicationAdherenceCalendar } from './MedicationAdherenceCalendar';
import { MedicationAdherenceDailyDetails } from './MedicationAdherenceDailyDetails';
import { MedicationAdherenceLogs } from './MedicationAdherenceLogs';
import { isPatientInactive } from '../../utils/patientStatusUtils';
import { customColors } from '../../lib/customColors';

interface ImprovedDashboardProps {
  patients: Patient[];
  patientsLoading: boolean;
  patientsError?: string | null;
  actionRequiredCount?: number;
  stableCount?: number;
  inactiveCount?: number;
}

export const ImprovedDashboard: React.FC<ImprovedDashboardProps> = ({
  patients,
  patientsLoading,
  patientsError,
  actionRequiredCount = 0,
  stableCount = 0,
  inactiveCount = 0,
}) => {
  const navigate = useNavigate();

  const colors = {
    primary: '#425950',
    primaryHover: '#344842',
    secondaryLight: '#8a9c97',
    gradientStart: '#425950',
    gradientEnd: '#2a3d38',
  };

  const [showPatientList, setShowPatientList] = useState<boolean>(true);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [filterCategory, setFilterCategory] = useState<
    'all' | 'action' | 'stable' | 'inactive'
  >('all');

  const [selectedAdherenceDate, setSelectedAdherenceDate] = useState<string | null>(null);
  const [inactivePatients, setInactivePatients] = useState<Set<string>>(new Set());

  const totalPatients = patients.length;

  useEffect(() => {
    const calculateInactivePatients = async () => {
      const inactiveSet = new Set<string>();

      for (const patient of patients) {
        try {
          const isInactive = await isPatientInactive(patient);

          if (isInactive) {
            inactiveSet.add(patient.id);
          }
        } catch (err) {
          const fiveDaysAgo = new Date(
            Date.now() - 5 * 24 * 60 * 60 * 1000
          );

          const lastUpdate = patient.updatedAt
            ? new Date(patient.updatedAt)
            : new Date(patient.createdAt);

          if (lastUpdate < fiveDaysAgo) {
            inactiveSet.add(patient.id);
          }
        }
      }

      setInactivePatients(inactiveSet);
    };

    if (patients.length > 0) {
      calculateInactivePatients();
    }
  }, [patients]);

  const getFilteredPatients = () => {
    switch (filterCategory) {
      case 'action':
        return patients.filter(
          (p) => p.chronicDiseases && p.chronicDiseases.length > 0
        );

      case 'stable':
        return patients.filter(
          (p) =>
            (!p.chronicDiseases || p.chronicDiseases.length === 0) &&
            !inactivePatients.has(p.id)
        );

      case 'inactive':
        return patients.filter((p) => inactivePatients.has(p.id));

      case 'all':
      default:
        return patients;
    }
  };

  const filteredPatients = getFilteredPatients();

  const getCategoryTitle = () => {
    switch (filterCategory) {
      case 'action':
        return 'Patients Requiring Action';

      case 'stable':
        return 'Stable Patients';

      case 'inactive':
        return 'Inactive Patients';

      case 'all':
      default:
        return 'All Patients';
    }
  };

  return (
    <div className={`bg-[${customColors.backgroundMedium}] min-h-screen`}>
      {/* Header */}
      <div
        className={`sticky top-0 z-40 bg-[${customColors.backgroundLight}] border-b border-gray-200 shadow-sm`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-6">
            📊 Medical Dashboard
          </h1>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <DashboardStatsCard
              label="Total Patients"
              value={totalPatients}
              icon="👥"
              color="blue"
              onClick={() => {
                setFilterCategory('all');
                setShowPatientList(true);
                setSelectedPatient(null);
              }}
              isActive={showPatientList && filterCategory === 'all'}
              description="Click to view all"
            />

            <DashboardStatsCard
              label="Action Required"
              value={actionRequiredCount}
              icon="⚠️"
              color="orange"
              onClick={() => {
                setFilterCategory('action');
                setShowPatientList(true);
                setSelectedPatient(null);
              }}
              isActive={showPatientList && filterCategory === 'action'}
              description="Need attention"
            />

            <DashboardStatsCard
              label="Stable Status"
              value={stableCount}
              icon="✅"
              color="green"
              onClick={() => {
                setFilterCategory('stable');
                setShowPatientList(true);
                setSelectedPatient(null);
              }}
              isActive={showPatientList && filterCategory === 'stable'}
              description="All good"
            />

            <DashboardStatsCard
              label="Inactive"
              value={inactiveCount}
              icon="🔔"
              color="red"
              onClick={() => {
                setFilterCategory('inactive');
                setShowPatientList(true);
                setSelectedPatient(null);
              }}
              isActive={showPatientList && filterCategory === 'inactive'}
              description="Not engaged"
            />
          </div>

          {selectedPatient && (
            <button
              onClick={() => setSelectedPatient(null)}
              className="mt-6 px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg transition-colors"
            >
              ← Back
            </button>
          )}
        </div>
      </div>

      {/* Daily Adherence Details */}
      {selectedPatient && selectedAdherenceDate && (
        <div
          className={`bg-[${customColors.backgroundLight}] border-t border-gray-200 py-6`}
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div
              className="text-white p-4 rounded-lg mb-6"
              style={{
                background: `linear-gradient(to right, ${colors.gradientStart}, ${colors.gradientEnd})`,
              }}
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="text-lg font-bold">
                    {selectedPatient.displayName || selectedPatient.email}
                  </h3>
                </div>
              </div>
            </div>

            <div className="mb-6 pb-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">
                    Daily Adherence Details
                  </h2>

                  <p className="text-gray-600 mt-1">
                    Detailed view for selected date
                  </p>
                </div>

                <button
                  onClick={() => setSelectedAdherenceDate(null)}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  ✕ Close Details
                </button>
              </div>
            </div>

            <MedicationAdherenceDailyDetails
              patientId={selectedPatient.id}
              selectedDate={selectedAdherenceDate}
              onBack={() => setSelectedAdherenceDate(null)}
            />
          </div>
        </div>
      )}

      {/* Patient List */}
      {showPatientList && !selectedPatient && (
        <div
          className={`bg-[${customColors.backgroundLight}] border-t border-gray-200 py-6`}
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <PatientListPanel
              patients={filteredPatients}
              loading={patientsLoading}
              error={patientsError}
              selectedPatientId={undefined}
              onSelectPatient={(patient) => {
                setSelectedPatient(patient);
              }}
              isVisible={showPatientList}
            />
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {selectedPatient ? (
          <div
            className={`grid grid-cols-1 ${
              selectedAdherenceDate ? 'lg:grid-cols-1' : 'lg:grid-cols-3'
            } gap-6`}
          >
            <div className={selectedAdherenceDate ? 'w-full' : 'space-y-6'}>
              {!selectedAdherenceDate && (
                <div
                  className="text-white p-4 rounded-lg"
                  style={{
                    background: `linear-gradient(to right, ${colors.gradientStart}, ${colors.gradientEnd})`,
                  }}
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h3 className="text-lg font-bold">
                        {selectedPatient.displayName || selectedPatient.email}
                      </h3>
                    </div>

                    <p
                      className="text-sm"
                      style={{ color: colors.secondaryLight }}
                    >
                      {getCategoryTitle()}
                    </p>
                  </div>
                </div>
              )}

              {!selectedAdherenceDate && (
                <MedicationAdherenceCalendar
                  patientId={selectedPatient.id}
                  onSelectDate={(date) => setSelectedAdherenceDate(date)}
                  onViewDetails={() =>
                    navigate(
                      `/patient-profile/${selectedPatient.id}/adherence-calendar`
                    )
                  }
                />
              )}

              {!selectedAdherenceDate && (
                <MedicationAdherenceLogs
                  patientId={selectedPatient.id}
                  onViewDetails={() =>
                    navigate(
                      `/patient-profile/${selectedPatient.id}/adherence-logs`
                    )
                  }
                />
              )}
            </div>

            {!selectedAdherenceDate && (
              <div className="lg:col-span-2">
                <div className="bg-white rounded-xl shadow-lg overflow-hidden border border-gray-200">
                  <PatientDetailsPanel patient={selectedPatient} />
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-gray-500 text-lg mb-4">
              {patients.length === 0
                ? '👥 No patients yet'
                : showPatientList
                ? '👆 Select a patient to view details'
                : '👆 Click a card above to view patients'}
            </p>

            {patients.length > 0 && !showPatientList && (
              <button
                onClick={() => {
                  setFilterCategory('all');
                  setShowPatientList(true);
                }}
                className="font-medium py-2 px-6 rounded-lg transition-colors"
                style={{
                  backgroundColor: colors.primary,
                  color: 'white',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor =
                    colors.primaryHover;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = colors.primary;
                }}
              >
                View All Patients
              </button>
            )}

            {patients.length === 0 && (
              <div className="text-center py-8">
                <div className="text-gray-400 mb-4">
                  <svg
                    className="mx-auto h-12 w-12"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1}
                      d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                    />
                  </svg>
                </div>

                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  No patients yet
                </h3>

                <p className="text-gray-500 text-sm">
                  Patients will appear here once they connect with your
                  practice.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};