import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  BellOff,
  CheckCircle2,
  Link2,
  Users,
} from 'lucide-react';
import { PageHeader, PageShell } from '../page-layout';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { DashboardStatsCard } from '../dashboard/DashboardStatsCard';
import { CaregiverPatientList } from './CaregiverPatientList';
import { useAuth } from '../../hooks/useAuth';
import { useCaregiverPatients } from '../../hooks/useCaregiverPatients';
import {
  getCaregiverPatientSummaries,
  type CaregiverPatientCategory,
} from '../../services/caregiverService';
import { DashboardPageSkeleton } from '../ui/Skeleton';


const FILTER_TITLES: Record<'all' | CaregiverPatientCategory, string> = {
  all: 'Your patients',
  attention: 'Needs attention',
  stable: 'Stable',
  inactive: 'No medication logs in 30 days',
};

export const CaregiverDashboard: React.FC = () => {
  const { user } = useAuth();
  const { patients, loading, error } = useCaregiverPatients(user?.id);
  const [summariesLoading, setSummariesLoading] = useState(false);
  const [attentionCount, setAttentionCount] = useState(0);
  const [stableCount, setStableCount] = useState(0);
  const [inactiveCount, setInactiveCount] = useState(0);
  const [adherenceMap, setAdherenceMap] = useState<Map<string, number>>(new Map());
  const [categoryMap, setCategoryMap] = useState<Map<string, CaregiverPatientCategory>>(new Map());
  const [filter, setFilter] = useState<'all' | CaregiverPatientCategory>('all');

  useEffect(() => {
    if (patients.length === 0) {
      setAttentionCount(0);
      setStableCount(0);
      setInactiveCount(0);
      setAdherenceMap(new Map());
      setCategoryMap(new Map());
      return;
    }

    let cancelled = false;
    const load = async () => {
      setSummariesLoading(true);
      try {
        const summaries = await getCaregiverPatientSummaries(patients);
        if (cancelled) return;
        const adherence = new Map<string, number>();
        const categories = new Map<string, CaregiverPatientCategory>();
        summaries.forEach((s) => {
          if (s.hasAdherenceData) adherence.set(s.patient.id, s.adherenceRate);
          categories.set(s.patient.id, s.category);
        });
        const count = (c: CaregiverPatientCategory) => summaries.filter((s) => s.category === c).length;
        setAdherenceMap(adherence);
        setCategoryMap(categories);
        setAttentionCount(count('attention'));
        setStableCount(count('stable'));
        setInactiveCount(count('inactive'));
      } finally {
        if (!cancelled) setSummariesLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [patients]);

  const filteredPatients = useMemo(
    () => (filter === 'all' ? patients : patients.filter((p) => categoryMap.get(p.id) === filter)),
    [patients, filter, categoryMap],
  );

  const firstName = user?.displayName?.split(' ')[0] || 'Caregiver';

  if (loading && patients.length === 0) {
    return (
      <PageShell>
        <DashboardPageSkeleton />
      </PageShell>
    );
  }

  return (
    <PageShell>
      <PageHeader
        title="Care Dashboard"
        description={`Welcome back, ${firstName}. Monitor the people in your care and spot issues early.`}
        actions={
          <Link
            to="/caregiver/patients"
            className="inline-flex items-center rounded-lg bg-anixi-green px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
          >
            View all patients
          </Link>
        }
      />

      {error && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <DashboardStatsCard
          label="People in care"
          value={patients.length}
          icon={<Users className="h-5 w-5" />}
          color="blue"
          onClick={() => setFilter('all')}
          isActive={filter === 'all'}
        />
        <DashboardStatsCard
          label="Needs attention"
          value={attentionCount}
          icon={<AlertTriangle className="h-5 w-5" />}
          color="orange"
          onClick={() => setFilter('attention')}
          isActive={filter === 'attention'}
        />
        <DashboardStatsCard
          label="Stable"
          value={stableCount}
          icon={<CheckCircle2 className="h-5 w-5" />}
          color="green"
          onClick={() => setFilter('stable')}
          isActive={filter === 'stable'}
        />
        <DashboardStatsCard
          label="Inactive"
          value={inactiveCount}
          icon={<BellOff className="h-5 w-5" />}
          color="red"
          onClick={() => setFilter('inactive')}
          isActive={filter === 'inactive'}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>
              {FILTER_TITLES[filter]}
            </CardTitle>
            {summariesLoading && (
              <span className="text-xs text-gray-400">Updating metrics…</span>
            )}
          </CardHeader>
          <CardContent className="p-0">
            <CaregiverPatientList
              patients={filteredPatients}
              loading={loading}
              adherenceByPatient={adherenceMap}
              compact
            />
          </CardContent>
        </Card>

        <Card className="h-fit border-anixi-green/15 bg-gradient-to-br from-white to-anixi-green/[0.04]">
          <CardHeader className="pb-2">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-anixi-green/10">
                <Link2 className="h-5 w-5 text-anixi-green" />
              </div>
              <div>
                <CardTitle className="text-base">Linking patients</CardTitle>
                <p className="mt-1 text-xs leading-relaxed text-gray-500">
                  Use this portal or the Anixi mobile app (Caregiver sign-up) once a patient links
                  you.
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-relaxed text-gray-600">
            <p>
              Ask your patient to open the <strong>Anixi mobile app</strong>, go to{' '}
              <strong>Medical Profile → Caregivers</strong>, and add{' '}
              <strong className="text-gray-900">{user?.email || 'your sign-in email'}</strong>.
            </p>
            <p>After they save, linked warriors show up here with meds, mood, and vitals.</p>
            <Link
              to="/caregiver/support"
              className="inline-flex text-sm font-semibold text-anixi-green hover:underline"
            >
              Step-by-step linking guide
            </Link>
          </CardContent>
        </Card>
      </div>
    </PageShell>
  );
};
