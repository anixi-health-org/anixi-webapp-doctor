import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Patient } from '../../types';
import { DashboardStatsCard } from './DashboardStatsCard';
import { PatientListPanel } from './PatientListPanel';
import { PatientDetailsPanel } from './PatientDetailsPanel';
import { MedicationAdherenceCalendar } from './MedicationAdherenceCalendar';
import { MedicationAdherenceDailyDetails } from './MedicationAdherenceDailyDetails';
import { MedicationAdherenceLogs } from './MedicationAdherenceLogs';
import { isPatientInactive } from '../../utils/patientStatusUtils';
import { RecentPatientsList } from '../patients/RecentPatientsList';
import { PageHeader } from '../page-layout/PageHeader';
import { PrimaryButton } from '../ui/PrimaryButton';
import { DashboardPageSkeleton } from '../ui/Skeleton';
import { useAuth } from '../../hooks/useAuth';
import { useIncomingSharingRequests } from '../../hooks/useIncomingSharingRequests';
import {
  AlertTriangle,
  BellOff,
  CheckCircle2,
  Users,
} from 'lucide-react';

interface ImprovedDashboardProps {
  patients: Patient[];
  patientsLoading: boolean;
  patientsError?: string | null;
  actionRequiredCount?: number;
  stableCount?: number;
  inactiveCount?: number;
  onAddPatient?: () => void;
}

export const ImprovedDashboard: React.FC<ImprovedDashboardProps> = ({
  patients,
  patientsLoading,
  patientsError,
  actionRequiredCount = 0,
  stableCount = 0,
  inactiveCount = 0,
  onAddPatient,
}) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { requests: sharingRequests } = useIncomingSharingRequests(user?.id);

  const pendingPatientIds = useMemo(
    () =>
      new Set(
        sharingRequests
          .filter((request) => request.status === 'pending')
          .map((request) => request.patientId)
      ),
    [sharingRequests]
  );

  const computedActionRequiredCount = patients.filter(
    (patient) =>
      pendingPatientIds.has(patient.id) ||
      (patient.chronicDiseases && patient.chronicDiseases.length > 0)
  ).length;

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
          (p) =>
            pendingPatientIds.has(p.id) ||
            (p.chronicDiseases && p.chronicDiseases.length > 0)
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
    <div>
      {patientsLoading && patients.length === 0 ? (
        <DashboardPageSkeleton />
      ) : (
        <>
      <PageHeader
        title="Medical Dashboard"
        description="Overview of your patients, adherence, and clinical activity."
        actions={
          <PrimaryButton
            size="lg"
            onClick={() => {
              if (onAddPatient) {
                onAddPatient();
                return;
              }
              navigate('/patients');
            }}
            icon={<span className="text-xl leading-none">+</span>}
          >
            New Patient Record
          </PrimaryButton>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <DashboardStatsCard
              label="Total Patients"
              value={totalPatients}
              icon={<Users />}
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
              value={computedActionRequiredCount}
              icon={<AlertTriangle />}
              color="orange"
              onClick={() => {
                setFilterCategory('action');
                setShowPatientList(true);
                setSelectedPatient(null);
              }}
              isActive={showPatientList && filterCategory === 'action'}
              description="Pending requests"
            />

            <DashboardStatsCard
              label="Stable Status"
              value={stableCount}
              icon={<CheckCircle2 />}
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
              icon={<BellOff />}
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
        <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-2xl border border-[#D8DEE5] bg-white p-4 shadow-sm">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() => setSelectedPatient(null)}
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-gray-200 text-gray-600 transition-colors hover:bg-gray-50"
              aria-label="Back to patient list"
            >
              ←
            </button>
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-anixi-green text-base font-semibold text-white">
              {(selectedPatient.displayName || selectedPatient.email)?.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <h2 className="truncate text-base font-semibold text-gray-900 sm:text-lg">
                {selectedPatient.displayName || selectedPatient.email}
              </h2>
              <p className="truncate text-sm text-gray-500">{selectedPatient.email}</p>
            </div>
          </div>
          <span className="self-start rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600 sm:self-center">
            {getCategoryTitle()}
          </span>
        </div>
      )}

      
      {selectedPatient && selectedAdherenceDate && (
        <div className="mt-4 rounded-2xl border border-[#D8DEE5] bg-white p-4 sm:p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between border-b border-gray-100 pb-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Daily adherence details</h2>
              <p className="mt-0.5 text-sm text-gray-500">Detailed view for selected date</p>
            </div>
            <button
              type="button"
              onClick={() => setSelectedAdherenceDate(null)}
              className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-700 transition-colors hover:bg-gray-50"
            >
              Close
            </button>
          </div>
          <MedicationAdherenceDailyDetails
            patientId={selectedPatient.id}
            selectedDate={selectedAdherenceDate}
            onBack={() => setSelectedAdherenceDate(null)}
          />
        </div>
      )}

      
      {showPatientList && !selectedPatient && (
        <div className="mt-4 rounded-2xl border border-[#D8DEE5] bg-white shadow-sm overflow-hidden">
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
      )}

      {!selectedPatient && (
        <div className="mt-4 rounded-2xl border border-[#D8DEE5] bg-white shadow-sm p-4 sm:p-5">
          <h2 className="text-base font-semibold text-gray-700 mb-3">Recently Viewed Patients</h2>
          <RecentPatientsList limit={5} />
        </div>
      )}

      
      <div className={selectedPatient ? 'mt-4' : undefined}>
        {selectedPatient ? (
          <div
            className={`grid grid-cols-1 ${
              selectedAdherenceDate ? 'lg:grid-cols-1' : 'lg:grid-cols-5'
            } gap-4`}
          >
            <div className={`space-y-4 ${selectedAdherenceDate ? 'w-full' : 'lg:col-span-2'}`}>
              {!selectedAdherenceDate && (
                <div className="rounded-2xl border border-[#D8DEE5] bg-white p-4 shadow-sm">
                  <MedicationAdherenceCalendar
                    patientId={selectedPatient.id}
                    onSelectDate={(date) => setSelectedAdherenceDate(date)}
                    onViewDetails={() =>
                      navigate(
                        `/patient-profile/${selectedPatient.id}/adherence-calendar`
                      )
                    }
                  />
                </div>
              )}

              {!selectedAdherenceDate && (
                <div className="rounded-2xl border border-[#D8DEE5] bg-white p-4 shadow-sm">
                  <MedicationAdherenceLogs
                    patientId={selectedPatient.id}
                    onViewDetails={() =>
                      navigate(
                        `/patient-profile/${selectedPatient.id}/adherence-logs`
                      )
                    }
                  />
                </div>
              )}
            </div>

            {!selectedAdherenceDate && (
              <div className="lg:col-span-3">
                <div className="overflow-hidden rounded-2xl border border-[#D8DEE5] bg-white shadow-sm">
                  <PatientDetailsPanel patient={selectedPatient} />
                </div>
              </div>
            )}
          </div>
        ) : patients.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-dashed border-gray-200 bg-white px-6 py-10 text-center">
            <h3 className="text-base font-medium text-gray-900 mb-1">No patients yet</h3>
            <p className="text-sm text-gray-500">
              Patients will appear here once they connect with your practice.
            </p>
          </div>
        ) : !showPatientList ? (
          <div className="mt-4 text-center py-8">
            <p className="text-gray-500 text-sm mb-4">Click a card above to view patients</p>
            <button
              onClick={() => {
                setFilterCategory('all');
                setShowPatientList(true);
              }}
              className="font-medium py-2 px-6 rounded-lg transition-colors text-white"
              style={{ backgroundColor: colors.primary }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = colors.primaryHover;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = colors.primary;
              }}
            >
              View All Patients
            </button>
          </div>
        ) : null}
      </div>
        </>
      )}
    </div>
  );
};