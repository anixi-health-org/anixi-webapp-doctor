import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { EllipsisVerticalIcon, EnvelopeIcon, PhoneIcon, PlusIcon } from '@heroicons/react/24/outline';
import clsx from 'clsx';
import { useAuth } from '../hooks/useAuth';
import { SharingRequestsList } from '../components/patients/SharingRequestsList';
import { AddPatientModal } from '../components/patients/AddPatientModal';
import { PatientsPageSkeleton } from '../components/ui';
import { PageHeader, PageShell } from '../components/page-layout';
import { Patient } from '../types';
import { derivePatientRosterStatus, listenToDoctorPatients } from '../services/patientManagementService';
import { syncDoctorPatientRoster } from '../services/patientRosterSync';
import {
  useApproveIncomingRequest,
  useIncomingSharingRequests,
  useRejectIncomingRequest,
} from '../hooks/useIncomingSharingRequests';

type TabType = 'patients' | 'requests';
type StatusFilter = 'all' | 'stable' | 'critical' | 'recovering' | 'inactive';

function ageFromDob(dob?: Date) {
  if (!dob) return null;
  const d = dob instanceof Date ? dob : new Date(dob);
  if (Number.isNaN(d.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - d.getFullYear();
  const m = today.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < d.getDate())) age -= 1;
  return age;
}

function deriveStatus(patient: Patient): Exclude<StatusFilter, 'all'> {
  return derivePatientRosterStatus(patient);
}

function statusClass(status: string) {
  if (status === 'stable') return 'bg-[rgba(33,196,93,0.1)] text-[#21c45d]';
  if (status === 'recovering') return 'bg-[rgba(245,158,11,0.12)] text-[#d97706]';
  if (status === 'critical') return 'bg-[rgba(239,68,68,0.1)] text-[#ef4343]';
  return 'bg-slate-100 text-slate-600';
}

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
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

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
    void syncDoctorPatientRoster(doctorId);
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

  const statusCounts = useMemo(() => {
    const counts = { total: patients.length, stable: 0, critical: 0, recovering: 0, inactive: 0 };
    patients.forEach((p) => {
      counts[deriveStatus(p)] += 1;
    });
    return counts;
  }, [patients]);

  const filteredPatients = useMemo(() => {
    const q = query.trim().toLowerCase();
    return patients.filter((p) => {
      const status = deriveStatus(p);
      if (statusFilter !== 'all' && status !== statusFilter) return false;
      if (!q) return true;
      return (
        (p.displayName || '').toLowerCase().includes(q) ||
        (p.email || '').toLowerCase().includes(q) ||
        (p.phoneNumber || '').toLowerCase().includes(q) ||
        p.id.toLowerCase().includes(q)
      );
    });
  }, [patients, query, statusFilter]);

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

  if (patientsLoading && activeTab === 'patients') {
    return (
      <PageShell>
        <PatientsPageSkeleton />
      </PageShell>
    );
  }

  return (
    <PageShell>
      <PageHeader
        title="Patients"
        description="Manage and view all patient records"
        actions={
          <button
            type="button"
            onClick={() => setShowAddPatient(true)}
            className="btn-primary h-10 px-4"
          >
            <PlusIcon className="h-4 w-4" />
            Add New Patient
          </button>
        }
      />

      {successMessage && (
        <div className="mb-4 rounded-[12px] border border-green-200 bg-green-50 p-4 text-sm text-green-700">
          {successMessage}
        </div>
      )}

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          ['Total Patients', statusCounts.total],
          ['Stable', statusCounts.stable],
          ['Critical', statusCounts.critical],
          ['Recovering', statusCounts.recovering],
        ].map(([label, value]) => (
          <div key={label as string} className="rounded-[12px] border border-[#e1e7ef] bg-white p-5 shadow-sm">
            <p className="text-3xl font-bold text-[#344256]">{value}</p>
            <p className="mt-1 text-sm text-[#65758b]">{label}</p>
          </div>
        ))}
      </div>

      <div className="mb-4 inline-flex rounded-[10px] bg-[#f1f5f9] p-1">
        <button
          type="button"
          onClick={() => setActiveTab('patients')}
          className={clsx(
            'rounded-[8px] px-3 py-1.5 text-sm font-medium transition-all duration-200',
            activeTab === 'patients'
              ? 'bg-[#427160] text-white shadow-sm'
              : 'text-[#65758b] hover:bg-white hover:text-[#427160] hover:shadow-sm'
          )}
        >
          Patient Records ({patients.length})
        </button>
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

      {patientsError && activeTab === 'patients' && (
        <div className="mb-4 rounded-[12px] border border-red-200 bg-red-50 p-4 text-red-700">{patientsError}</div>
      )}
      {sharingRequestsError && activeTab === 'requests' && (
        <div className="mb-4 rounded-[12px] border border-red-200 bg-red-50 p-4 text-red-700">
          {sharingRequestsError.message}
        </div>
      )}

      {activeTab === 'patients' && (
        <div className="overflow-hidden rounded-[12px] border border-[#e1e7ef] bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-[#e1e7ef] px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <h3 className="text-base font-semibold text-[#344256]">Patient Records</h3>
            <div className="flex flex-wrap items-center gap-2">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search patients..."
                className="h-10 rounded-[10px] border border-[#e1e7ef] bg-[#f8fafc] px-3 text-sm text-[#344256] outline-none focus:border-[#427160]"
              />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
                className="h-10 rounded-[10px] border border-[#e1e7ef] bg-[#f8fafc] px-3 text-sm text-[#344256]"
              >
                <option value="all">All Status</option>
                <option value="stable">Stable</option>
                <option value="recovering">Recovering</option>
                <option value="critical">Critical</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-[#e1e7ef] text-[#65758b]">
                  <th className="px-4 py-3 font-medium sm:px-6">Patient</th>
                  <th className="px-4 py-3 font-medium">Contact</th>
                  <th className="px-4 py-3 font-medium">Condition</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium text-right sm:px-6">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredPatients.map((patient) => {
                  const status = deriveStatus(patient);
                  const age = ageFromDob(patient.dateOfBirth);
                  const initials = (patient.displayName || patient.email || '?')
                    .split(' ')
                    .map((p) => p[0])
                    .join('')
                    .slice(0, 2)
                    .toUpperCase();
                  return (
                    <tr
                      key={patient.id}
                      className="cursor-pointer border-b border-[#e1e7ef]/70 last:border-0 hover:bg-[#f8fafc]"
                      onClick={() => navigate(`/patient-profile/${patient.id}`)}
                    >
                      <td className="px-4 py-4 sm:px-6">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#eef4f1] text-xs font-semibold text-[#427160]">
                            {initials}
                          </div>
                          <div>
                            <p className="font-semibold text-[#344256]">
                              {patient.displayName || 'Unnamed Patient'}
                            </p>
                            <p className="text-xs text-[#65758b]">
                              {patient.id.slice(0, 8).toUpperCase()}
                              {age != null ? ` · ${age}y` : ''}
                              {patient.gender ? ` · ${patient.gender}` : ''}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="space-y-1 text-[#65758b]">
                          {patient.phoneNumber && (
                            <p className="flex items-center gap-1.5">
                              <PhoneIcon className="h-3.5 w-3.5" />
                              {patient.phoneNumber}
                            </p>
                          )}
                          {patient.email && (
                            <p className="flex items-center gap-1.5">
                              <EnvelopeIcon className="h-3.5 w-3.5" />
                              <span className="truncate">{patient.email}</span>
                            </p>
                          )}
                          {!patient.phoneNumber && !patient.email && '-'}
                        </div>
                      </td>
                      <td className="px-4 py-4 text-[#344256]">
                        {patient.chronicDiseases?.[0] || '-'}
                      </td>
                      <td className="px-4 py-4">
                        <span className={clsx('rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize', statusClass(status))}>
                          {status}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-right sm:px-6">
                        <button
                          type="button"
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[#65758b] hover:bg-[#f1f5f9]"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/patient-profile/${patient.id}`);
                          }}
                          aria-label="Open patient"
                        >
                          <EllipsisVerticalIcon className="h-5 w-5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {filteredPatients.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-12 text-center text-[#65758b]">
                      No patients match your filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'requests' && (
        <div className="rounded-[12px] border border-[#e1e7ef] bg-white p-6 shadow-sm">
          <h3 className="mb-4 text-base font-semibold text-[#344256]">Pending Requests</h3>
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
