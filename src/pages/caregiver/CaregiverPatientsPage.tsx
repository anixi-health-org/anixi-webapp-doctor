import React, { useEffect, useMemo, useState } from 'react';
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { PageHeader, PageShell } from '../../components/page-layout';
import { Card, CardContent } from '../../components/ui/Card';
import { CaregiverPatientList } from '../../components/caregiver/CaregiverPatientList';
import { useAuth } from '../../hooks/useAuth';
import { useCaregiverPatients } from '../../hooks/useCaregiverPatients';
import { getCaregiverPatientSummaries } from '../../services/caregiverService';

export const CaregiverPatientsPage: React.FC = () => {
  const { user } = useAuth();
  const { patients, loading, error } = useCaregiverPatients(user?.id);
  const [search, setSearch] = useState('');
  const [adherenceMap, setAdherenceMap] = useState<Map<string, number>>(new Map());

  useEffect(() => {
    if (patients.length === 0) return;
    void getCaregiverPatientSummaries(patients).then((summaries) => {
      const map = new Map<string, number>();
      summaries.forEach((s) => map.set(s.patient.id, s.adherenceRate));
      setAdherenceMap(map);
    });
  }, [patients]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return patients;
    return patients.filter(
      (p) =>
        p.displayName?.toLowerCase().includes(q) ||
        p.email?.toLowerCase().includes(q)
    );
  }, [patients, search]);

  return (
    <PageShell>
      <PageHeader
        title="My Patients"
        description="People who have designated you as their caregiver in Anixi Health."
      />

      {error && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <Card>
        <div className="border-b border-gray-100 px-5 py-4">
          <div className="relative max-w-md">
            <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or email…"
              className="w-full rounded-lg border border-gray-200 py-2.5 pl-10 pr-4 text-sm focus:border-anixi-green focus:outline-none focus:ring-1 focus:ring-anixi-green"
            />
          </div>
        </div>
        <CardContent className="p-0">
          <CaregiverPatientList
            patients={filtered}
            loading={loading}
            adherenceByPatient={adherenceMap}
          />
        </CardContent>
      </Card>
    </PageShell>
  );
};
