import React, { useEffect, useMemo, useState } from 'react';
import { BulkPatientImportPanel } from '../../components/onboarding/BulkPatientImportPanel';
import { PageHeader, PageShell } from '../../components/page-layout';
import { useAuth } from '../../hooks/AuthContext';
import { usePermissions } from '../../hooks/usePermissions';
import { listPracticePatients } from '../../services/practicePatientService';
import type { Patient } from '../../types';

export const ClinicAdminPatientsPage: React.FC = () => {
  const { user, practiceSession } = useAuth();
  const { can } = usePermissions();
  const practice = practiceSession?.practice;
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const canManagePatients = can('managePatients');

  const loadPatients = async () => {
    if (!practice?.id) return;
    setLoading(true);
    try {
      const rows = await listPracticePatients(practice.id);
      setPatients(rows);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadPatients();
  }, [practice?.id]);

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
        description="Import patients in bulk. They receive app download links and temporary login details."
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
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#eef2f6]">
                  {filteredPatients.map((patient) => (
                    <tr key={patient.id} className="text-[#344256]">
                      <td className="px-4 py-3">{patient.displayName || '—'}</td>
                      <td className="px-4 py-3 font-mono text-xs">{patient.email || '—'}</td>
                      <td className="px-4 py-3 text-[#65758b]">{patient.phoneNumber || '—'}</td>
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
