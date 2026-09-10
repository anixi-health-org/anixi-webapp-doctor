import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { BulkPatientImportPanel } from '../../components/onboarding/BulkPatientImportPanel';
import { PageHeader, PageShell } from '../../components/page-layout';
import { useAuth } from '../../hooks/AuthContext';
import { usePermissions } from '../../hooks/usePermissions';
import {
  listPracticePatients,
  updatePracticePatientAssignedDoctor,
} from '../../services/practicePatientService';
import { listPracticeClinicians } from '../../services/practiceSettingsService';
import type { Patient, PracticeMember } from '../../types';

export const ClinicAdminPatientsPage: React.FC = () => {
  const { user, practiceSession } = useAuth();
  const { can } = usePermissions();
  const practice = practiceSession?.practice;
  const [patients, setPatients] = useState<Patient[]>([]);
  const [clinicians, setClinicians] = useState<PracticeMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [assigningPatientId, setAssigningPatientId] = useState<string | null>(null);

  const canManagePatients = can('managePatients');

  const loadPatients = useCallback(async () => {
    if (!practice?.id) return;
    setLoading(true);
    try {
      const [rows, clinicianRows] = await Promise.all([
        listPracticePatients(practice.id),
        listPracticeClinicians(practice.id),
      ]);
      setPatients(rows);
      setClinicians(clinicianRows);
    } finally {
      setLoading(false);
    }
  }, [practice?.id]);

  useEffect(() => {
    void loadPatients();
  }, [loadPatients]);

  const clinicianNameById = useMemo(() => {
    const map = new Map<string, string>();
    clinicians.forEach((member) => {
      map.set(member.uid, member.displayName || member.email || 'Doctor');
    });
    return map;
  }, [clinicians]);

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
    } finally {
      setAssigningPatientId(null);
    }
  };

  const filteredPatients = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return patients;
    return patients.filter((p) => {
      const name = (p.displayName || '').toLowerCase();
      const email = (p.email || '').toLowerCase();
      const phone = (p.phoneNumber || '').toLowerCase();
      return name.includes(q) || email.includes(q) || phone.includes(q);
    });
  }, [patients, search]);

  if (!user || !practice) {
    return null;
  }

  return (
    <PageShell maxWidth="wide" className="py-6 sm:py-8">
      <PageHeader
        title="Patient roster"
        description="Import patients in bulk for your clinic. Each patient belongs to this practice and receives an activation code for the Anixi app."
      />

      {!canManagePatients ? (
        <div className="mt-6 rounded-2xl border border-[#e1e7ef] bg-white p-5 text-sm text-[#65758b]">
          You can view the clinic roster but don&apos;t have permission to import patients.
        </div>
      ) : (
        <div className="mt-6 max-w-4xl">
          <BulkPatientImportPanel
            doctorId={user.id}
            practiceId={practice.id}
            practiceName={practice.name}
            onComplete={() => void loadPatients()}
          />
        </div>
      )}

      <div className="mt-10">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-semibold text-[#344256]">
            Imported patients {loading ? '' : `(${filteredPatients.length}${search ? ` of ${patients.length}` : ''})`}
          </h2>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, email, or phone"
            className="w-full max-w-xs rounded-lg border border-[#e1e7ef] px-3 py-2 text-sm sm:w-auto"
          />
        </div>
        <div className="overflow-hidden rounded-2xl border border-[#e1e7ef] bg-white shadow-sm">
          {loading ? (
            <p className="p-6 text-sm text-[#65758b]">Loading roster…</p>
          ) : filteredPatients.length === 0 ? (
            <p className="p-6 text-sm text-[#65758b]">
              {search
                ? 'No patients match your search.'
                : 'No patients yet. Upload a CSV above to add your clinic roster.'}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-[#fafcfb] text-xs font-semibold uppercase tracking-wide text-[#65758b]">
                  <tr>
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3">Email</th>
                    <th className="px-4 py-3">Phone</th>
                    <th className="px-4 py-3">Account</th>
                    <th className="px-4 py-3">Activation code</th>
                    <th className="px-4 py-3">Assigned doctor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#eef2f6]">
                  {filteredPatients.map((patient) => (
                    <tr key={patient.id} className="text-[#344256]">
                      <td className="px-4 py-3">{patient.displayName || '-'}</td>
                      <td className="px-4 py-3 font-mono text-xs">{patient.email || '-'}</td>
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
                      <td className="px-4 py-3 font-mono text-xs text-[#65758b]">
                        {patient.activationCode || '-'}
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
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </PageShell>
  );
};

export default ClinicAdminPatientsPage;
