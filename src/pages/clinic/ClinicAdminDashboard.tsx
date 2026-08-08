import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  CalendarDaysIcon,
  UserGroupIcon,
  UsersIcon,
  ArrowRightIcon,
  ClockIcon,
  UserPlusIcon,
} from '@heroicons/react/24/outline';
import { PageShell } from '../../components/page-layout';
import { ClinicAdminSetupBanner } from '../../components/clinic/ClinicAdminSetupBanner';
import { useAuth } from '../../hooks/AuthContext';
import { useClinicSetupStatus } from '../../hooks/useClinicSetupStatus';
import { listPracticeInvites } from '../../services/practiceInviteService';
import { listPracticeMembers } from '../../services/practiceSettingsService';
import { listPracticePatients } from '../../services/practicePatientService';
import {
  getPracticeDashboardStats,
  type PracticeDashboardStats,
} from '../../services/practiceDashboardService';

export const ClinicAdminDashboard: React.FC = () => {
  const { user, practiceSession } = useAuth();
  const practice = practiceSession?.practice;
  const practiceId = practice?.id;
  const setup = useClinicSetupStatus(practiceId);

  const [stats, setStats] = useState<PracticeDashboardStats | null>(null);
  const [teamCount, setTeamCount] = useState(0);
  const [pendingInvites, setPendingInvites] = useState(0);
  const [patientCount, setPatientCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!practiceId) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const [apptStats, members, invites, patients] = await Promise.all([
          getPracticeDashboardStats(practiceId),
          listPracticeMembers(practiceId),
          listPracticeInvites(practiceId, 'pending'),
          listPracticePatients(practiceId),
        ]);
        if (cancelled) return;
        setStats(apptStats);
        setTeamCount(members.filter((m: { status: string }) => m.status === 'active').length);
        setPendingInvites(invites.length);
        setPatientCount(patients.length);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [practiceId]);

  const firstName = user?.displayName?.split(' ')[0] || 'there';

  const statCards = [
    {
      label: 'Team members',
      value: loading ? '—' : teamCount,
      hint: 'Active staff',
      icon: UserGroupIcon,
    },
    {
      label: 'Pending invites',
      value: loading ? '—' : pendingInvites,
      hint: 'Awaiting signup',
      icon: UserPlusIcon,
    },
    {
      label: 'Patients',
      value: loading ? '—' : patientCount,
      hint: 'On clinic roster',
      icon: UsersIcon,
    },
    {
      label: 'Today',
      value: loading ? '—' : stats?.appointmentsToday ?? 0,
      hint: 'Appointments',
      icon: ClockIcon,
    },
  ];

  return (
    <PageShell maxWidth="wide" className="py-6 sm:py-8">
      <p className="text-sm text-[#65758b]">
        Welcome back, <span className="font-medium text-[#344256]">{firstName}</span>.
        {!loading && (
          <span className="hidden sm:inline">
            {' '}
            Here&apos;s what&apos;s happening at your clinic today.
          </span>
        )}
      </p>

      {!setup.loading && !setup.isReady && (
        <ClinicAdminSetupBanner steps={setup.steps} className="mt-6" />
      )}

      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {statCards.map(({ label, value, hint, icon: Icon }) => (
          <div
            key={label}
            className="flex items-start gap-4 rounded-2xl border border-[#e1e7ef] bg-white p-5 shadow-sm"
          >
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#eef4f1]">
              <Icon className="h-5 w-5 text-anixi-green" strokeWidth={1.75} />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-[#65758b]">{label}</p>
              <p className="mt-0.5 font-heading text-2xl font-bold tabular-nums text-[#344256]">
                {value}
              </p>
              <p className="mt-0.5 text-xs text-[#94a3b8]">{hint}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 grid gap-4 lg:grid-cols-3">
        {[
          {
            to: '/clinic/team',
            icon: UserGroupIcon,
            title: 'Team & doctors',
            description: 'Invite clinicians and manage roles.',
            cta: 'Manage team',
          },
          {
            to: '/clinic/patients',
            icon: UsersIcon,
            title: 'Patient roster',
            description: 'Import patients and send app invites.',
            cta: 'Manage patients',
          },
          {
            to: '/clinic/schedule',
            icon: CalendarDaysIcon,
            title: 'Schedule',
            description: 'Book and view appointments across doctors.',
            cta: 'Open schedule',
          },
        ].map(({ to, icon: Icon, title, description, cta }) => (
          <Link
            key={to}
            to={to}
            className="group flex flex-col rounded-2xl border border-[#e1e7ef] bg-white p-5 shadow-sm transition hover:border-anixi-green/30 hover:shadow-md"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#eef4f1]">
              <Icon className="h-5 w-5 text-anixi-green" strokeWidth={1.75} />
            </div>
            <h2 className="mt-4 font-semibold text-[#344256]">{title}</h2>
            <p className="mt-1 flex-1 text-sm leading-relaxed text-[#65758b]">{description}</p>
            <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-anixi-green">
              {cta}
              <ArrowRightIcon className="h-4 w-4 transition group-hover:translate-x-0.5" />
            </span>
          </Link>
        ))}
      </div>

      {!loading && pendingInvites > 0 && (
        <div className="mt-6 rounded-2xl border border-[#e1e7ef] bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-[#344256]">
                {pendingInvites} pending invite{pendingInvites === 1 ? '' : 's'}
              </p>
              <p className="mt-0.5 text-sm text-[#65758b]">
                Staff who haven&apos;t accepted their invitation yet.
              </p>
            </div>
            <Link
              to="/clinic/team"
              className="inline-flex h-10 items-center rounded-xl bg-[#eef4f1] px-4 text-sm font-semibold text-anixi-green transition hover:bg-anixi-green/10"
            >
              View invites
            </Link>
          </div>
        </div>
      )}

      {!loading && stats && (
        <div className="mt-6 rounded-2xl border border-[#e1e7ef] bg-white px-5 py-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#94a3b8]">
            This week
          </p>
          <div className="mt-2 flex flex-wrap gap-x-8 gap-y-2 text-sm text-[#65758b]">
            <span>
              <strong className="font-semibold text-[#344256]">{stats.appointmentsThisWeek}</strong>{' '}
              appointments
            </span>
            <span>
              <strong className="font-semibold text-[#344256]">{stats.pendingAppointments}</strong>{' '}
              pending
            </span>
            <span>
              <strong className="font-semibold text-[#344256]">{stats.completedThisMonth}</strong>{' '}
              completed this month
            </span>
          </div>
        </div>
      )}
    </PageShell>
  );
};

export default ClinicAdminDashboard;
