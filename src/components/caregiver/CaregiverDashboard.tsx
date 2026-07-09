import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  BellOff,
  CheckCircle2,
  Smartphone,
  Users,
} from 'lucide-react';
import { PageHeader, PageShell } from '../page-layout';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { DashboardStatsCard } from '../dashboard/DashboardStatsCard';
import { CaregiverPatientList } from './CaregiverPatientList';
import { useAuth } from '../../hooks/useAuth';
import { useCaregiverPatients } from '../../hooks/useCaregiverPatients';
import { getCaregiverPatientSummaries } from '../../services/caregiverService';
import { DashboardPageSkeleton } from '../ui/Skeleton';

const IOS_APP_LINK = 'https://apps.apple.com/app/anixi-health';
const ANDROID_APP_LINK = 'https://play.google.com/store/apps/details?id=com.anixi.health';

export const CaregiverDashboard: React.FC = () => {
  const { user } = useAuth();
  const { patients, loading, error } = useCaregiverPatients(user?.id);
  const [summariesLoading, setSummariesLoading] = useState(false);
  const [attentionCount, setAttentionCount] = useState(0);
  const [stableCount, setStableCount] = useState(0);
  const [inactiveCount, setInactiveCount] = useState(0);
  const [adherenceMap, setAdherenceMap] = useState<Map<string, number>>(new Map());
  const [filter, setFilter] = useState<'all' | 'attention' | 'stable' | 'inactive'>('all');

  useEffect(() => {
    if (patients.length === 0) {
      setAttentionCount(0);
      setStableCount(0);
      setInactiveCount(0);
      setAdherenceMap(new Map());
      return;
    }

    const load = async () => {
      setSummariesLoading(true);
      try {
        const summaries = await getCaregiverPatientSummaries(patients);
        const map = new Map<string, number>();
        let attention = 0;
        let stable = 0;
        let inactive = 0;

        summaries.forEach((s) => {
          map.set(s.patient.id, s.adherenceRate);
          if (s.status === 'inactive') inactive += 1;
          else if (s.needsAttention) attention += 1;
          else stable += 1;
        });

        setAdherenceMap(map);
        setAttentionCount(attention);
        setStableCount(stable);
        setInactiveCount(inactive);
      } finally {
        setSummariesLoading(false);
      }
    };

    void load();
  }, [patients]);

  const filteredPatients = useMemo(() => {
    if (filter === 'all') return patients;
    return patients.filter((patient) => {
      const status = patient.chronicDiseases?.length ? 'warning' : 'stable';
      const adherence = adherenceMap.get(patient.id) ?? 100;
      if (filter === 'attention') {
        return status === 'warning' || adherence < 70;
      }
      if (filter === 'inactive') {
        const fiveDaysAgo = Date.now() - 5 * 24 * 60 * 60 * 1000;
        const last = patient.updatedAt ? new Date(patient.updatedAt).getTime() : 0;
        return last < fiveDaysAgo;
      }
      if (filter === 'stable') {
        return status !== 'warning' && adherence >= 70;
      }
      return true;
    });
  }, [patients, filter, adherenceMap]);

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
              {filter === 'all' ? 'Your patients' : `${filter} patients`}
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

        <div className="space-y-6">
          <Card className="border-anixi-green/20 bg-gradient-to-br from-white to-anixi-green/5">
            <CardContent className="space-y-4 p-6">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-anixi-green/10">
                  <Smartphone className="h-5 w-5 text-anixi-green" />
                </div>
                <div>
                  <h3 className="font-heading font-semibold text-gray-900">Anixi mobile app</h3>
                  <p className="text-xs text-gray-500">On-the-go monitoring</p>
                </div>
              </div>
              <p className="text-sm leading-relaxed text-gray-600">
                Get real-time alerts, log care notes, and coordinate with clinical teams from your
                phone.
              </p>
              <div className="flex flex-col gap-2">
                <a
                  href={IOS_APP_LINK}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-lg bg-anixi-green px-4 py-2 text-center text-sm font-semibold text-white hover:opacity-90"
                >
                  iOS app
                </a>
                <a
                  href={ANDROID_APP_LINK}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-lg border border-anixi-green px-4 py-2 text-center text-sm font-semibold text-anixi-green hover:bg-anixi-green/5"
                >
                  Android app
                </a>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Getting linked to a patient</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-gray-600">
              <p>
                Ask the patient (or their family) to add your email as their caregiver in the Anixi
                mobile app under <strong>Medical Profile</strong>.
              </p>
              <p>
                Once linked, their medications, mood, and vitals will appear here automatically.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </PageShell>
  );
};
