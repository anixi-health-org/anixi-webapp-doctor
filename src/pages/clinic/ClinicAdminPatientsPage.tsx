import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { BulkPatientImportPanel } from '../../components/onboarding/BulkPatientImportPanel';
import { ClinicAddPatientPanel, type ClinicAddPatientResult } from '../../components/clinic/ClinicAddPatientPanel';
import { ClinicSecondaryAction } from '../../components/clinic/ClinicSecondaryAction';
import { PageHeader, PageShell } from '../../components/page-layout';
import { useAuth } from '../../hooks/AuthContext';
import { usePermissions } from '../../hooks/usePermissions';
import {
  bulkAssignPracticePatients,
  listPracticePatientsPage,
  updatePracticePatientAssignedDoctor,
} from '../../services/practicePatientService';
import { listPracticeClinicians } from '../../services/practiceSettingsService';
import type { Patient, PracticeMember } from '../../types';

const PAGE_SIZE = 50;

export const ClinicAdminPatientsPage: React.FC = () => {
  const { user, practiceSession } = useAuth();
  const { can } = usePermissions();
  const practice = practiceSession?.practice;
  const [patients, setPatients] = useState<Patient[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [clinicians, setClinicians] = useState<PracticeMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [assigningPatientId, setAssigningPatientId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectAllMatching, setSelectAllMatching] = useState(false);
  const [bulkDoctorId, setBulkDoctorId] = useState('');
  const [bulkBusy, setBulkBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [copiedClinicCode, setCopiedClinicCode] = useState(false);

  const canManagePatients = can('managePatients');
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const from = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page * PAGE_SIZE, total);

  useEffect(() => {
    const handle = window.setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => window.clearTimeout(handle);
  }, [search]);

  useEffect(() => {
    setPage(1);
    setSelectedIds(new Set());
    setSelectAllMatching(false);
  }, [debouncedSearch]);

  const loadClinicians = useCallback(async () => {
    if (!practice?.id) return;
    const clinicianRows = await listPracticeClinicians(practice.id);
    setClinicians(clinicianRows);
  }, [practice?.id]);

  const loadPatients = useCallback(async () => {
    if (!practice?.id) return;
    setError(null);
    setRefreshing(true);
    try {
      const result = await listPracticePatientsPage(practice.id, {
        q: debouncedSearch,
        page,
        limit: PAGE_SIZE,
      });
      setPatients(result.patients);
      setTotal(result.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load the patient roster.');
      setPatients([]);
      setTotal(0);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [practice?.id, debouncedSearch, page]);

  useEffect(() => {
    void loadClinicians();
  }, [loadClinicians]);

  useEffect(() => {
    void loadPatients();
  }, [loadPatients]);

  const copyClinicCode = async () => {
    if (!practice?.clinicCode) return;
    try {
      await navigator.clipboard.writeText(practice.clinicCode);
      setCopiedClinicCode(true);
      window.setTimeout(() => setCopiedClinicCode(false), 2000);
    } catch {
      setError('Could not copy the clinic code.');
    }
  };

  const clinicianNameById = useMemo(() => {
    const map = new Map<string, string>();
    clinicians.forEach((member) => {
      map.set(member.uid, member.displayName || member.email || 'Doctor');
    });
    return map;
  }, [clinicians]);

  const pageIds = useMemo(() => patients.map((patient) => patient.id), [patients]);
  const allPageSelected =
    pageIds.length > 0 && (selectAllMatching || pageIds.every((id) => selectedIds.has(id)));
  const selectedCount = selectAllMatching ? total : selectedIds.size;

  const toggleRow = (patientId: string) => {
    if (selectAllMatching) {
      setSelectAllMatching(false);
      setSelectedIds(new Set(pageIds.filter((id) => id !== patientId)));
      return;
    }
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(patientId)) next.delete(patientId);
      else next.add(patientId);
      return next;
    });
  };

  const togglePage = () => {
    if (selectAllMatching || allPageSelected) {
      setSelectAllMatching(false);
      setSelectedIds((current) => {
        const next = new Set(current);
        pageIds.forEach((id) => next.delete(id));
        return next;
      });
      return;
    }
    setSelectedIds((current) => {
      const next = new Set(current);
      pageIds.forEach((id) => next.add(id));
      return next;
    });
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
    setSelectAllMatching(false);
  };

  const handleBulkAssign = async (assignedDoctorId: string | null) => {
    if (!canManagePatients || !practice?.id || selectedCount === 0) return;
    const doctorLabel =
      assignedDoctorId == null
        ? 'unassigned'
        : clinicianNameById.get(assignedDoctorId) || 'this doctor';
    const confirmLarge =
      selectAllMatching && total > pageIds.length
        ? assignedDoctorId == null
          ? `Unassign all ${total} patients matching this search?`
          : `Assign all ${total} patients matching this search to ${doctorLabel}?`
        : selectedCount > 20
          ? assignedDoctorId == null
            ? `Unassign ${selectedCount} selected patients?`
            : `Assign ${selectedCount} selected patients to ${doctorLabel}?`
          : null;
    if (confirmLarge && !window.confirm(confirmLarge)) return;
    setBulkBusy(true);
    setError(null);
    try {
      const result = await bulkAssignPracticePatients(practice.id, {
        assignedDoctorId,
        patientIds: selectAllMatching ? [] : Array.from(selectedIds),
        allMatching: selectAllMatching,
        q: selectAllMatching ? debouncedSearch : '',
      });
      setSuccess(
        assignedDoctorId
          ? `${result.assigned} patient${result.assigned === 1 ? '' : 's'} assigned to ${doctorLabel}.`
          : `${result.assigned} patient${result.assigned === 1 ? '' : 's'} unassigned.`,
      );
      clearSelection();
      await loadPatients();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not assign these patients.');
    } finally {
      setBulkBusy(false);
    }
  };

  const handleAssignDoctor = async (patientId: string, doctorId: string) => {
    if (!canManagePatients || !practice?.id) return;
    setAssigningPatientId(patientId);
    try {
      await updatePracticePatientAssignedDoctor(
        practice.id,
        patientId,
        doctorId || null,
      );
      setPatients((current) =>
        current.map((patient) =>
          patient.id === patientId
            ? { ...patient, assignedDoctorId: doctorId || undefined }
            : patient,
        ),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not assign this doctor.');
    } finally {
      setAssigningPatientId(null);
    }
  };

  const handleAdded = (result: ClinicAddPatientResult) => {
    const parts = [`${result.displayName} was added to the roster.`];
    if (practice?.clinicCode) {
      parts.push(`They activate with clinic code ${practice.clinicCode}.`);
    }
    if (result.inviteQueued) {
      parts.push('Activation instructions were emailed.');
    }
    setSuccess(result.inviteWarning ? `${parts.join(' ')} ${result.inviteWarning}` : parts.join(' '));
    setError(null);
    setAddOpen(false);
    setSearch(result.displayName);
    setPage(1);
  };

  if (!user || !practice) {
    return null;
  }

  const hasRoster = total > 0;
  const showImport = canManagePatients && !loading && (!hasRoster || importOpen);
  const importPanel = canManagePatients ? (
    <BulkPatientImportPanel
      doctorId={user.id}
      practiceId={practice.id}
      practiceName={practice.name}
      clinicCode={practice.clinicCode}
      onComplete={() => {
        setPage(1);
        setImportOpen(false);
        void loadPatients();
      }}
    />
  ) : null;

  return (
    <PageShell maxWidth="wide" className="py-6 sm:py-8">
      <PageHeader
        title="Patient roster"
        description={
          hasRoster
            ? 'Search the clinic roster, assign doctors, and add or import patients.'
            : 'Add one person at a time, or import a CSV. Patients activate in the Anixi app with your clinic code.'
        }
      />

      {!canManagePatients ? (
        <div className="mt-2 rounded-2xl border border-[#e1e7ef] bg-white p-5 text-sm text-[#65758b]">
          You can view the clinic roster but don&apos;t have permission to import patients.
        </div>
      ) : null}

      {practice.clinicCode ? (
        <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-[#e1e7ef] bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[#8FA0B6]">
              Clinic activation code
            </p>
            <p className="mt-1 text-sm text-[#65758b]">
              Every patient uses this same code in the Anixi app, then confirms their name and details against the roster.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-lg bg-[#f4f7f6] px-4 py-2 font-mono text-lg font-bold tracking-widest text-[#1e3a5f]">
              {practice.clinicCode}
            </span>
            <button
              type="button"
              onClick={() => void copyClinicCode()}
              className="rounded-full border border-[#e1e7ef] px-4 py-2 text-sm font-semibold text-[#344256] hover:bg-[#f8fafc]"
            >
              {copiedClinicCode ? 'Copied' : 'Copy code'}
            </button>
          </div>
        </div>
      ) : null}

      {showImport && !hasRoster ? <div className="mt-2">{importPanel}</div> : null}

      <div className={hasRoster || loading ? 'mt-2' : 'mt-10'}>
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-semibold text-[#344256]">
            Imported patients {loading ? '' : `(${total})`}
          </h2>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, email, or phone"
              className="w-full max-w-xs rounded-lg border border-[#e1e7ef] px-3 py-2 text-sm sm:w-auto"
            />
            {canManagePatients ? (
              <div className="flex flex-wrap items-center gap-2">
                {hasRoster ? (
                  <ClinicSecondaryAction
                    open={importOpen}
                    onToggle={() => setImportOpen((open) => !open)}
                    revealLabel="Import from CSV"
                    hideLabel="Hide import"
                  />
                ) : null}
                <button
                  type="button"
                  onClick={() => setAddOpen(true)}
                  className="rounded-full bg-anixi-green px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90"
                >
                  Add one patient
                </button>
              </div>
            ) : null}
          </div>
        </div>
        {error ? (
          <p className="mb-3 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </p>
        ) : null}
        {success ? (
          <p className="mb-3 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            {success}
          </p>
        ) : null}
        {canManagePatients && addOpen ? (
          <div className="mb-4">
            <ClinicAddPatientPanel
              open={addOpen}
              onCancel={() => setAddOpen(false)}
              onAdded={handleAdded}
            />
          </div>
        ) : null}
        {canManagePatients && selectedCount > 0 ? (
          <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-anixi-green/20 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-[#344256]">
                {selectAllMatching
                  ? `All ${selectedCount} matching patients selected`
                  : `${selectedCount} selected`}
              </p>
              {!selectAllMatching && total > pageIds.length && selectedCount > 0 ? (
                <button
                  type="button"
                  onClick={() => {
                    setSelectAllMatching(true);
                    setSelectedIds(new Set(pageIds));
                  }}
                  className="mt-1 text-sm font-semibold text-anixi-green hover:underline"
                >
                  Select all {total} matching this search
                </button>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={bulkDoctorId}
                onChange={(event) => setBulkDoctorId(event.target.value)}
                className="min-w-[180px] rounded-lg border border-[#e1e7ef] px-2 py-1.5 text-sm"
              >
                <option value="">Choose a doctor</option>
                {clinicians.map((clinician) => (
                  <option key={clinician.uid} value={clinician.uid}>
                    {clinician.displayName || clinician.email || clinician.uid}
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={bulkBusy || !bulkDoctorId}
                onClick={() => void handleBulkAssign(bulkDoctorId)}
                className="rounded-full bg-anixi-green px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {bulkBusy ? 'Assigning…' : 'Assign selected'}
              </button>
              <button
                type="button"
                disabled={bulkBusy}
                onClick={() => void handleBulkAssign(null)}
                className="rounded-full border border-[#e1e7ef] px-4 py-2 text-sm font-semibold text-[#344256] disabled:opacity-50"
              >
                Unassign
              </button>
              <button
                type="button"
                disabled={bulkBusy}
                onClick={clearSelection}
                className="rounded-full px-3 py-2 text-sm font-semibold text-[#65758b]"
              >
                Clear
              </button>
            </div>
          </div>
        ) : null}
        <div className="overflow-hidden rounded-2xl border border-[#e1e7ef] bg-white shadow-sm">
          {loading ? (
            <p className="p-6 text-sm text-[#65758b]">Loading roster...</p>
          ) : patients.length === 0 ? (
            <p className="p-6 text-sm text-[#65758b]">
              {debouncedSearch
                ? 'No patients match your search.'
                : 'No patients yet. Add one person or import a CSV.'}
            </p>
          ) : (
            <>
              <div className={`overflow-x-auto ${refreshing ? 'opacity-60' : ''}`}>
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-[#fafcfb] text-xs font-semibold uppercase tracking-wide text-[#65758b]">
                    <tr>
                      {canManagePatients ? (
                        <th className="w-10 px-4 py-3">
                          <input
                            type="checkbox"
                            aria-label="Select patients on this page"
                            checked={allPageSelected}
                            onChange={togglePage}
                          />
                        </th>
                      ) : null}
                      <th className="px-4 py-3">Name</th>
                      <th className="px-4 py-3">Email</th>
                      <th className="px-4 py-3">Phone</th>
                      <th className="px-4 py-3">Account</th>
                      <th className="px-4 py-3">Assigned doctor</th>
                      {canManagePatients ? <th className="px-4 py-3"> </th> : null}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#eef2f6]">
                    {patients.map((patient) => (
                      <tr key={patient.id} className="text-[#344256]">
                        {canManagePatients ? (
                          <td className="px-4 py-3">
                            <input
                              type="checkbox"
                              aria-label={`Select ${patient.displayName || 'patient'}`}
                              checked={selectAllMatching || selectedIds.has(patient.id)}
                              onChange={() => toggleRow(patient.id)}
                            />
                          </td>
                        ) : null}
                        <td className="px-4 py-3">
                          <Link
                            to={`/clinic/patients/${patient.id}`}
                            className="font-medium text-anixi-green hover:underline"
                          >
                            {patient.displayName || '-'}
                          </Link>
                        </td>
                        <td className="px-4 py-3 font-mono text-xs">
                          {patient.email || '—'}
                        </td>
                        <td className="px-4 py-3 text-[#65758b]">{patient.phoneNumber || '-'}</td>
                        <td className="px-4 py-3">
                          <span
                            className={
                              patient.rosterStatus === 'active'
                                ? 'rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700'
                                : 'rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700'
                            }
                          >
                            {patient.rosterStatus === 'active' ? 'Activated' : 'Pending activation'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {canManagePatients ? (
                            <select
                              value={patient.assignedDoctorId || ''}
                              disabled={assigningPatientId === patient.id}
                              onChange={(event) =>
                                void handleAssignDoctor(patient.id, event.target.value)
                              }
                              className="w-full min-w-[180px] rounded-lg border border-[#e1e7ef] px-2 py-1.5 text-sm"
                            >
                              <option value="">Unassigned</option>
                              {clinicians.map((clinician) => (
                                <option key={clinician.uid} value={clinician.uid}>
                                  {clinician.displayName || clinician.email || clinician.uid}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <span className="text-[#65758b]">
                              {patient.assignedDoctorId
                                ? clinicianNameById.get(patient.assignedDoctorId) || 'Assigned'
                                : 'Unassigned'}
                            </span>
                          )}
                        </td>
                        {canManagePatients ? (
                          <td className="px-4 py-3 text-right">
                            <Link
                              to={`/clinic/patients/${patient.id}`}
                              className="text-sm font-semibold text-anixi-green hover:underline"
                            >
                              Manage
                            </Link>
                          </td>
                        ) : null}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex flex-col gap-3 border-t border-[#eef2f6] px-4 py-3 text-sm text-[#65758b] sm:flex-row sm:items-center sm:justify-between">
                <p>
                  Showing {from}-{to} of {total}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={page <= 1 || refreshing}
                    onClick={() => setPage((current) => Math.max(1, current - 1))}
                    className="rounded-lg border border-[#e1e7ef] px-3 py-1.5 text-sm font-semibold text-[#344256] disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <span className="tabular-nums">
                    Page {page} of {pageCount}
                  </span>
                  <button
                    type="button"
                    disabled={page >= pageCount || refreshing}
                    onClick={() => setPage((current) => current + 1)}
                    className="rounded-lg border border-[#e1e7ef] px-3 py-1.5 text-sm font-semibold text-[#344256] disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {showImport && hasRoster ? <div className="mt-8">{importPanel}</div> : null}
    </PageShell>
  );
};

export default ClinicAdminPatientsPage;
