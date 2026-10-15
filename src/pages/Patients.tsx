import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PlusIcon, UserGroupIcon, InboxIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import clsx from 'clsx';
import { useAuth } from '../hooks/useAuth';
import { usePermissions } from '../hooks/usePermissions';
import { SharingRequestsList } from '../components/patients/SharingRequestsList';
import { AddPatientModal } from '../components/patients/AddPatientModal';
import { DoctorPatientRecordsTable } from '../components/patients/DoctorPatientRecordsTable';
import { PatientsPageSkeleton } from '../components/ui';
import { PageHeader, PageShell } from '../components/page-layout';
import { Patient } from '../types';
import { getDoctorPatients, listenToDoctorPatients } from '../services/patientManagementService';
import { listPracticePatientsPage } from '../services/practicePatientService';
import { isThrottledMessage, parseRetrySeconds } from '../utils/apiThrottle';
import { listPracticeClinicians } from '../services/practiceSettingsService';
import { patientAccountStatus, type PatientAccountStatus } from '../utils/patientRosterStatus';
import {
  useApproveIncomingRequest,
  useIncomingSharingRequests,
  useRejectIncomingRequest,
} from '../hooks/useIncomingSharingRequests';

type TabType = 'assigned' | 'roster' | 'requests';
type StatusFilter = 'all' | PatientAccountStatus;

const ROSTER_PAGE_SIZE = 50;

export const Patients: React.FC = () => {
  const { user, practiceSession } = useAuth();
  const { isClinicEmployedClinician } = usePermissions();
  const navigate = useNavigate();
  const doctorId = user?.id;
  const practice = practiceSession?.practice;
  const showClinicRoster = practice?.orgType === 'clinic' && Boolean(practice.id);

  const [activeTab, setActiveTab] = useState<TabType>('assigned');
  const [patients, setPatients] = useState<Patient[]>([]);
  const [patientsLoading, setPatientsLoading] = useState(true);
  const [patientsError, setPatientsError] = useState<string | null>(null);
  const [showAddPatient, setShowAddPatient] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const [rosterPatients, setRosterPatients] = useState<Patient[]>([]);
  const [rosterTotal, setRosterTotal] = useState(0);
  const [rosterPage, setRosterPage] = useState(1);
  const [rosterQuery, setRosterQuery] = useState('');
  const [debouncedRosterQuery, setDebouncedRosterQuery] = useState('');
  const [rosterLoading, setRosterLoading] = useState(false);
  const [rosterError, setRosterError] = useState<string | null>(null);
  const [clinicianNameById, setClinicianNameById] = useState<Map<string, string>>(new Map());

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

  useEffect(() => {
    const handle = window.setTimeout(() => setDebouncedRosterQuery(rosterQuery.trim()), 300);
    return () => window.clearTimeout(handle);
  }, [rosterQuery]);

  useEffect(() => {
    setRosterPage(1);
  }, [debouncedRosterQuery]);

  useEffect(() => {
    if (!showClinicRoster || !practice?.id) return;
    void listPracticeClinicians(practice.id)
      .then((members) => {
        const map = new Map<string, string>();
        members.forEach((member) => {
          map.set(member.uid, member.displayName || member.email || 'Doctor');
        });
        setClinicianNameById(map);
      })
      .catch(() => {
        setClinicianNameById(new Map());
      });
  }, [showClinicRoster, practice?.id]);

  const loadRoster = useCallback(async () => {
    if (!showClinicRoster || !practice?.id) return;
    setRosterLoading(true);
    setRosterError(null);
    try {
      const result = await listPracticePatientsPage(practice.id, {
        q: debouncedRosterQuery,
        page: rosterPage,
        limit: ROSTER_PAGE_SIZE,
      });
      setRosterPatients(result.patients);
      setRosterTotal(result.total);
    } catch (err) {
      setRosterError(err instanceof Error ? err.message : 'Could not load the clinic roster');
      setRosterPatients([]);
      setRosterTotal(0);
    } finally {
      setRosterLoading(false);
    }
  }, [showClinicRoster, practice?.id, debouncedRosterQuery, rosterPage]);

  useEffect(() => {
    if (!showClinicRoster || activeTab !== 'roster') return;
    void loadRoster();
  }, [showClinicRoster, activeTab, loadRoster]);

  useEffect(() => {
    if (!rosterError || activeTab !== 'roster' || !isThrottledMessage(rosterError)) return;
    const retrySeconds = parseRetrySeconds(rosterError) ?? 12;
    const timer = window.setTimeout(() => {
      void loadRoster();
    }, retrySeconds * 1000);
    return () => window.clearTimeout(timer);
  }, [rosterError, activeTab, loadRoster]);

  const refreshAssignedPatients = useCallback(async () => {
    if (!doctorId) return;
    setPatientsLoading(true);
    setPatientsError(null);
    try {
      const nextPatients = await getDoctorPatients(doctorId);
      setPatients(nextPatients);
    } catch (err) {
      setPatientsError(err instanceof Error ? err.message : 'Could not load assigned patients');
    } finally {
      setPatientsLoading(false);
    }
  }, [doctorId]);

  useEffect(() => {
    if (!patientsError || activeTab !== 'assigned' || !isThrottledMessage(patientsError)) return;
    const retrySeconds = parseRetrySeconds(patientsError) ?? 12;
    const timer = window.setTimeout(() => {
      void refreshAssignedPatients();
    }, retrySeconds * 1000);
    return () => window.clearTimeout(timer);
  }, [patientsError, activeTab, refreshAssignedPatients]);

  const pendingCount = sharingRequests.filter((r) => r.status === 'pending').length;

  const statusCounts = useMemo(() => {
    const counts = { total: patients.length, pending: 0, active: 0, unknown: 0 };
    patients.forEach((patient) => {
      counts[patientAccountStatus(patient)] += 1;
    });
    return counts;
  }, [patients]);

  const filteredPatients = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return patients.filter((patient) => {
      const status = patientAccountStatus(patient);
      if (statusFilter !== 'all' && status !== statusFilter) return false;
      if (!needle) return true;
      return (
        (patient.displayName || '').toLowerCase().includes(needle) ||
        (patient.email || '').toLowerCase().includes(needle) ||
        (patient.phoneNumber || '').toLowerCase().includes(needle)
      );
    });
  }, [patients, query, statusFilter]);

  const rosterPageCount = Math.max(1, Math.ceil(rosterTotal / ROSTER_PAGE_SIZE));
  const rosterFrom = rosterTotal === 0 ? 0 : (rosterPage - 1) * ROSTER_PAGE_SIZE + 1;
  const rosterTo = Math.min(rosterPage * ROSTER_PAGE_SIZE, rosterTotal);

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

  const openPatient = (patientId: string) => {
    navigate(`/patient-profile/${patientId}`);
  };

  const renderErrorBanner = (
    message: string,
    onRetry?: () => void,
  ) => (
    <div className="mb-4 flex flex-col gap-3 rounded-[12px] border border-red-200 bg-red-50 p-4 text-red-700 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="font-medium">{message}</p>
        {isThrottledMessage(message) ? (
          <p className="mt-1 text-sm text-red-600/90">
            {(() => {
              const retrySeconds = parseRetrySeconds(message);
              return retrySeconds
                ? `Retrying automatically in ${retrySeconds} seconds…`
                : 'Retrying automatically in a moment…';
            })()}
          </p>
        ) : null}
      </div>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex items-center gap-2 self-start rounded-lg border border-red-200 bg-white px-3 py-1.5 text-sm font-semibold text-red-700 sm:self-center"
        >
          <ArrowPathIcon className="h-4 w-4" />
          Retry now
        </button>
      ) : null}
    </div>
  );

  if (patientsLoading && activeTab === 'assigned') {
    return (
      <PageShell>
        <PatientsPageSkeleton />
      </PageShell>
    );
  }

  const assignedDoctorName = (patient: Patient) => {
    if (!patient.assignedDoctorId) return 'Unassigned';
    if (patient.assignedDoctorId === doctorId) return 'You';
    return clinicianNameById.get(patient.assignedDoctorId) || 'Assigned';
  };

  return (
    <PageShell>
      <PageHeader
        title="Patients"
        description={
          showClinicRoster
            ? 'Patients assigned to you, and the full clinic roster'
            : 'Patients assigned to you'
        }
        actions={
          isClinicEmployedClinician ? undefined : (
            <button
              type="button"
              onClick={() => setShowAddPatient(true)}
              className="btn-primary h-10 px-4"
            >
              <PlusIcon className="h-4 w-4" />
              Add New Patient
            </button>
          )
        }
      />

      {successMessage && (
        <div className="mb-4 rounded-[12px] border border-green-200 bg-green-50 p-4 text-sm text-green-700">
          {successMessage}
        </div>
      )}

      {activeTab === 'assigned' ? (
        <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
          {[
            ['Assigned to you', statusCounts.total],
            ['Pending activation', statusCounts.pending],
            ['Activated', statusCounts.active],
            ['Not recorded', statusCounts.unknown],
          ].map(([label, value]) => (
            <div key={label as string} className="rounded-[12px] border border-[#e1e7ef] bg-white p-5 shadow-sm">
              <p className="text-3xl font-bold text-[#344256]">{value}</p>
              <p className="mt-1 text-sm text-[#65758b]">{label}</p>
            </div>
          ))}
        </div>
      ) : null}

      {activeTab === 'roster' ? (
        <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="rounded-[12px] border border-[#e1e7ef] bg-white p-5 shadow-sm">
            <p className="text-3xl font-bold text-[#344256]">{rosterTotal}</p>
            <p className="mt-1 text-sm text-[#65758b]">Clinic roster</p>
          </div>
        </div>
      ) : null}

      <div className="mb-4 inline-flex rounded-[10px] bg-[#f1f5f9] p-1">
        <button
          type="button"
          onClick={() => setActiveTab('assigned')}
          className={clsx(
            'rounded-[8px] px-3 py-1.5 text-sm font-medium transition-all duration-200',
            activeTab === 'assigned'
              ? 'bg-[#427160] text-white shadow-sm'
              : 'text-[#65758b] hover:bg-white hover:text-[#427160] hover:shadow-sm'
          )}
        >
          Assigned to me ({patients.length})
        </button>
        {showClinicRoster ? (
          <button
            type="button"
            onClick={() => setActiveTab('roster')}
            className={clsx(
              'rounded-[8px] px-3 py-1.5 text-sm font-medium transition-all duration-200',
              activeTab === 'roster'
                ? 'bg-[#427160] text-white shadow-sm'
                : 'text-[#65758b] hover:bg-white hover:text-[#427160] hover:shadow-sm'
            )}
          >
            Clinic roster {rosterTotal ? `(${rosterTotal})` : ''}
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => setActiveTab('requests')}
          className={clsx(
            'rounded-[8px] px-3 py-1.5 text-sm font-medium transition-all duration-200',
            activeTab === 'requests'
              ? 'bg-[#427160] text-white shadow-sm'
              : 'text-[#65758b] hover:bg-white hover:text-[#427160] hover:shadow-sm'
          )}
        >
          Pending Requests ({pendingCount})
        </button>
      </div>

      {patientsError && activeTab === 'assigned'
        ? renderErrorBanner(patientsError, () => {
            void refreshAssignedPatients();
          })
        : null}
      {rosterError && activeTab === 'roster'
        ? renderErrorBanner(rosterError, () => {
            void loadRoster();
          })
        : null}
      {sharingRequestsError && activeTab === 'requests' ? (
        <div className="mb-4 rounded-[12px] border border-red-200 bg-red-50 p-4 text-red-700">
          {sharingRequestsError.message}
        </div>
      ) : null}

      {activeTab === 'assigned' ? (
        <div className="overflow-hidden rounded-[12px] border border-[#e1e7ef] bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-[#e1e7ef] px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <h3 className="text-base font-semibold text-[#344256]">Assigned to you</h3>
            <div className="flex flex-wrap items-center gap-2">
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search assigned patients..."
                className="h-10 rounded-[10px] border border-[#e1e7ef] bg-[#f8fafc] px-3 text-sm text-[#344256] outline-none focus:border-[#427160]"
              />
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
                className="h-10 rounded-[10px] border border-[#e1e7ef] bg-[#f8fafc] px-3 text-sm text-[#344256]"
              >
                <option value="all">All accounts</option>
                <option value="pending">Pending activation</option>
                <option value="active">Activated</option>
                <option value="unknown">Not recorded</option>
              </select>
            </div>
          </div>
          {filteredPatients.length === 0 && !query && statusFilter === 'all' ? (
            <div className="flex flex-col items-center px-6 py-14 text-center">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#eef4f0] text-[#427160]">
                <UserGroupIcon className="h-7 w-7" />
              </div>
              <p className="text-base font-semibold text-[#344256]">No patients assigned yet</p>
              <p className="mt-2 max-w-md text-sm text-[#65758b]">
                Patients linked to you through sharing requests, appointments, or clinic roster assignment will appear here.
              </p>
              {!isClinicEmployedClinician ? (
                <button
                  type="button"
                  onClick={() => setShowAddPatient(true)}
                  className="btn-primary mt-5 h-10 px-4"
                >
                  <PlusIcon className="h-4 w-4" />
                  Add patient
                </button>
              ) : null}
            </div>
          ) : (
            <DoctorPatientRecordsTable
              patients={filteredPatients}
              emptyMessage="No assigned patients match your filters."
              onOpen={openPatient}
            />
          )}
        </div>
      ) : null}

      {activeTab === 'roster' ? (
        <div className="overflow-hidden rounded-[12px] border border-[#e1e7ef] bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-[#e1e7ef] px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <h3 className="text-base font-semibold text-[#344256]">Clinic roster</h3>
            <input
              value={rosterQuery}
              onChange={(event) => setRosterQuery(event.target.value)}
              placeholder="Search the clinic roster..."
              className="h-10 w-full rounded-[10px] border border-[#e1e7ef] bg-[#f8fafc] px-3 text-sm text-[#344256] outline-none focus:border-[#427160] sm:w-72"
            />
          </div>
          {rosterLoading && rosterPatients.length === 0 ? (
            <p className="px-4 py-12 text-center text-sm text-[#65758b]">Loading clinic roster...</p>
          ) : (
            <>
              <div className={rosterLoading ? 'opacity-60' : undefined}>
                {rosterPatients.length === 0 && !debouncedRosterQuery ? (
                  <div className="flex flex-col items-center px-6 py-14 text-center">
                    <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#eef4f0] text-[#427160]">
                      <UserGroupIcon className="h-7 w-7" />
                    </div>
                    <p className="text-base font-semibold text-[#344256]">Clinic roster is empty</p>
                    <p className="mt-2 max-w-md text-sm text-[#65758b]">
                      Bulk-imported patients from your clinic admin will show up here once they are linked to this practice.
                    </p>
                  </div>
                ) : (
                  <DoctorPatientRecordsTable
                    patients={rosterPatients}
                    emptyMessage={
                      debouncedRosterQuery
                        ? 'No clinic patients match your search.'
                        : 'No patients on the clinic roster yet.'
                    }
                    onOpen={openPatient}
                    assignedDoctorName={assignedDoctorName}
                  />
                )}
              </div>
              <div className="flex flex-col gap-3 border-t border-[#eef2f6] px-4 py-3 text-sm text-[#65758b] sm:flex-row sm:items-center sm:justify-between">
                <p>
                  Showing {rosterFrom}-{rosterTo} of {rosterTotal}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={rosterPage <= 1 || rosterLoading}
                    onClick={() => setRosterPage((current) => Math.max(1, current - 1))}
                    className="rounded-lg border border-[#e1e7ef] px-3 py-1.5 text-sm font-semibold text-[#344256] disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <span className="tabular-nums">
                    Page {rosterPage} of {rosterPageCount}
                  </span>
                  <button
                    type="button"
                    disabled={rosterPage >= rosterPageCount || rosterLoading}
                    onClick={() => setRosterPage((current) => current + 1)}
                    className="rounded-lg border border-[#e1e7ef] px-3 py-1.5 text-sm font-semibold text-[#344256] disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      ) : null}

      {activeTab === 'requests' ? (
        <div className="overflow-hidden rounded-[12px] border border-[#e1e7ef] bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-[#e1e7ef] px-4 py-4 sm:px-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#eef4f0] text-[#427160]">
                <InboxIcon className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-[#344256]">Pending Requests</h3>
                <p className="text-sm text-[#65758b]">Approve or decline patient access requests</p>
              </div>
            </div>
          </div>
          <div className="p-4 sm:p-6">
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
        </div>
      ) : null}

      <AddPatientModal
        isOpen={showAddPatient}
        onClose={() => setShowAddPatient(false)}
        onAdded={(result) => {
          setSuccessMessage(result.inviteWarning || 'Patient added successfully');
          setShowAddPatient(false);
        }}
      />
    </PageShell>
  );
};
