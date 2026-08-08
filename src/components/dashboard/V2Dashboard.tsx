import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  CalendarDaysIcon,
  ChartBarIcon,
  ClockIcon,
  PlusIcon,
  UsersIcon,
} from '@heroicons/react/24/outline';
import { Activity, HeartPulse } from 'lucide-react';
import clsx from 'clsx';
import { Patient, Appointment } from '../../types';
import { useAuth } from '../../hooks/useAuth';
import { getDoctorAppointments } from '../../services/appointmentService';
import {
  getPracticeDashboardStats,
  type PracticeDashboardStats,
} from '../../services/practiceDashboardService';
import { DashboardPageSkeleton } from '../ui/Skeleton';
import { PageHeader } from '../page-layout/PageHeader';

type DateRangeKey = 'today' | 'yesterday' | 'week' | '7days' | 'month';

const DATE_RANGE_OPTIONS: { key: DateRangeKey; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'yesterday', label: 'Yesterday' },
  { key: 'week', label: 'This week' },
  { key: '7days', label: 'Last 7 days' },
  { key: 'month', label: 'This month' },
];

function startOfLocalDay(d: Date) {
  const out = new Date(d);
  out.setHours(0, 0, 0, 0);
  return out;
}

function endOfLocalDay(d: Date) {
  const out = new Date(d);
  out.setHours(23, 59, 59, 999);
  return out;
}

function getRangeBounds(key: DateRangeKey): { start: Date; end: Date } {
  const now = new Date();
  const todayStart = startOfLocalDay(now);
  const todayEnd = endOfLocalDay(now);

  if (key === 'today') {
    return { start: todayStart, end: todayEnd };
  }

  if (key === 'yesterday') {
    const y = new Date(todayStart);
    y.setDate(y.getDate() - 1);
    return { start: startOfLocalDay(y), end: endOfLocalDay(y) };
  }

  if (key === 'week') {
    const day = todayStart.getDay();
    const mondayOffset = day === 0 ? -6 : 1 - day;
    const start = new Date(todayStart);
    start.setDate(start.getDate() + mondayOffset);
    return { start: startOfLocalDay(start), end: todayEnd };
  }

  if (key === '7days') {
    const start = new Date(todayStart);
    start.setDate(start.getDate() - 6);
    return { start: startOfLocalDay(start), end: todayEnd };
  }

  const start = new Date(todayStart.getFullYear(), todayStart.getMonth(), 1);
  return { start: startOfLocalDay(start), end: todayEnd };
}

function appointmentInRange(apt: Appointment, start: Date, end: Date) {
  const raw = apt.startAt ?? apt.date;
  const d = raw instanceof Date ? raw : new Date(raw);
  if (Number.isNaN(d.getTime())) return false;
  return d >= start && d <= end;
}

interface V2DashboardProps {
  patients: Patient[];
  patientsLoading: boolean;
  patientsError?: string | null;
  actionRequiredCount?: number;
  stableCount?: number;
  inactiveCount?: number;
  onAddPatient?: () => void;
}

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

function statusBadge(status: string) {
  const s = status.toLowerCase();
  if (s === 'active' || s === 'stable' || s === 'confirmed' || s === 'completed') {
    return 'bg-[rgba(33,196,93,0.1)] text-[#21c45d]';
  }
  if (s === 'follow-up' || s === 'pending' || s === 'recovering') {
    return 'bg-[rgba(245,158,11,0.12)] text-[#d97706]';
  }
  if (s === 'cancelled' || s === 'critical' || s === 'inactive' || s === 'discharged') {
    return 'bg-[rgba(239,68,68,0.1)] text-[#ef4343]';
  }
  return 'bg-slate-100 text-slate-600';
}

function patientStatus(patient: Patient, inactiveIds: Set<string>) {
  if (inactiveIds.has(patient.id)) return 'inactive';
  if (patient.chronicDiseases && patient.chronicDiseases.length > 0) return 'follow-up';
  return 'active';
}

export const V2Dashboard: React.FC<V2DashboardProps> = ({
  patients,
  patientsLoading,
  patientsError,
  actionRequiredCount = 0,
  stableCount = 0,
  inactiveCount = 0,
  onAddPatient,
}) => {
  const navigate = useNavigate();
  const { user, practiceSession } = useAuth();
  const firstName = user?.displayName?.split(' ')[0] || 'Doctor';
  const isClinic = practiceSession?.practice?.orgType === 'clinic';

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [appointmentsLoading, setAppointmentsLoading] = useState(true);
  const [practiceStats, setPracticeStats] = useState<PracticeDashboardStats | null>(null);
  const [recordsTab, setRecordsTab] = useState<'patients' | 'appointments'>('patients');
  const [dateRange, setDateRange] = useState<DateRangeKey>('today');
  const [rangeOpen, setRangeOpen] = useState(false);
  const rangeMenuRef = useRef<HTMLDivElement>(null);

  const rangeLabel =
    DATE_RANGE_OPTIONS.find((option) => option.key === dateRange)?.label ?? 'Today';

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    setAppointmentsLoading(true);
    getDoctorAppointments(user.id)
      .then((data) => {
        if (!cancelled) setAppointments(data);
      })
      .catch(() => {
        if (!cancelled) setAppointments([]);
      })
      .finally(() => {
        if (!cancelled) setAppointmentsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  useEffect(() => {
    if (!isClinic || !practiceSession?.practice?.id) {
      setPracticeStats(null);
      return;
    }
    let cancelled = false;
    getPracticeDashboardStats(practiceSession.practice.id)
      .then((stats) => {
        if (!cancelled) setPracticeStats(stats);
      })
      .catch(() => {
        if (!cancelled) setPracticeStats(null);
      });
    return () => {
      cancelled = true;
    };
  }, [isClinic, practiceSession?.practice?.id]);

  useEffect(() => {
    if (!rangeOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!rangeMenuRef.current?.contains(event.target as Node)) {
        setRangeOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setRangeOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [rangeOpen]);

  const inactiveIds = useMemo(() => {
    const set = new Set<string>();
    // Approximate inactive from inactiveCount-backed list later; for badges use chronic + recency
    patients.forEach((p) => {
      const last = p.updatedAt ? new Date(p.updatedAt) : p.createdAt ? new Date(p.createdAt) : null;
      if (last) {
        const fiveDaysAgo = Date.now() - 5 * 24 * 60 * 60 * 1000;
        if (last.getTime() < fiveDaysAgo && (!p.chronicDiseases || p.chronicDiseases.length === 0)) {
          set.add(p.id);
        }
      }
    });
    return set;
  }, [patients]);

  const rangeBounds = useMemo(() => getRangeBounds(dateRange), [dateRange]);

  const rangedAppointments = useMemo(
    () =>
      appointments
        .filter((apt) => appointmentInRange(apt, rangeBounds.start, rangeBounds.end))
        .sort((a, b) => {
          const aTime = (a.startAt ?? a.date)?.getTime?.() ?? new Date(a.date).getTime();
          const bTime = (b.startAt ?? b.date)?.getTime?.() ?? new Date(b.date).getTime();
          return aTime - bTime;
        }),
    [appointments, rangeBounds]
  );

  const scheduleBuckets = useMemo(() => {
    let morning = 0;
    let afternoon = 0;
    let evening = 0;
    rangedAppointments.forEach((apt) => {
      const hour = Number(String(apt.time || '').split(':')[0]);
      if (Number.isNaN(hour)) {
        afternoon += 1;
        return;
      }
      if (hour < 12) morning += 1;
      else if (hour < 17) afternoon += 1;
      else evening += 1;
    });
    return { morning, afternoon, evening };
  }, [rangedAppointments]);

  const growthPct =
    patients.length > 0 ? Math.min(100, Math.round((stableCount / Math.max(patients.length, 1)) * 100)) : 0;
  const attendanceRate =
    rangedAppointments.length > 0
      ? Math.round(
          (rangedAppointments.filter((a) => a.status === 'completed' || a.status === 'confirmed').length /
            rangedAppointments.length) *
            100
        )
      : 0;

  const recentActivity = useMemo(() => {
    const items: { label: string; time: string; tone: string }[] = [];
    rangedAppointments.slice(0, 2).forEach((apt) => {
      items.push({
        label: `Appointment ${apt.status}: ${apt.patientName}`,
        time: apt.time || rangeLabel,
        tone:
          apt.status === 'confirmed'
            ? 'bg-[#21c45d]'
            : apt.status === 'pending'
              ? 'bg-amber-400'
              : 'bg-[#007af5]',
      });
    });
    patients.slice(0, 3 - items.length).forEach((p) => {
      items.push({
        label: `Patient on file: ${p.displayName || p.email || 'Unknown'}`,
        time: 'Recently',
        tone: 'bg-[#007af5]',
      });
    });
    if (items.length === 0) {
      items.push({
        label: 'No recent activity yet',
        time: '-',
        tone: 'bg-slate-300',
      });
    }
    return items;
  }, [patients, rangedAppointments, rangeLabel]);

  const scheduleTitle =
    dateRange === 'today'
      ? "Today's Schedule"
      : dateRange === 'yesterday'
        ? "Yesterday's Schedule"
        : 'Schedule';
  const appointmentsListTitle =
    dateRange === 'today' ? "Today's Appointments" : `Appointments · ${rangeLabel}`;
  const appointmentsStatLabel =
    dateRange === 'today' ? "Today's Appointments" : 'Appointments';

  if (patientsLoading && patients.length === 0) {
    return <DashboardPageSkeleton />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard Overview"
        description={
          isClinic
            ? `Welcome back, Dr. ${firstName}. Here's ${practiceSession?.practice?.name || 'your clinic'} at a glance.`
            : `Welcome back, Dr. ${firstName}. Here's your practice summary.`
        }
        className="mb-0"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {isClinic && (
              <Link
                to="/practice-settings?tab=team"
                className="btn-secondary h-10 px-4 text-sm font-semibold"
              >
                Manage team
              </Link>
            )}
            <div className="relative" ref={rangeMenuRef}>
              <button
                type="button"
                onClick={() => setRangeOpen((open) => !open)}
                className="btn-secondary h-10 min-w-[8.5rem] justify-between"
                aria-haspopup="listbox"
                aria-expanded={rangeOpen}
              >
                {rangeLabel}
                <span className="text-[#65758b]">▾</span>
              </button>
              {rangeOpen && (
                <div
                  role="listbox"
                  className="absolute right-0 z-20 mt-1.5 min-w-[10.5rem] overflow-hidden rounded-[10px] border border-[#e1e7ef] bg-white py-1 shadow-lg"
                >
                  {DATE_RANGE_OPTIONS.map((option) => (
                    <button
                      key={option.key}
                      type="button"
                      role="option"
                      aria-selected={dateRange === option.key}
                      onClick={() => {
                        setDateRange(option.key);
                        setRangeOpen(false);
                      }}
                      className={clsx(
                        'flex w-full px-3.5 py-2 text-left text-sm transition',
                        dateRange === option.key
                          ? 'bg-[#eef4f1] font-semibold text-[#427160]'
                          : 'text-[#344256] hover:bg-[#f8fafc]'
                      )}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => (onAddPatient ? onAddPatient() : navigate('/patients'))}
              className="btn-primary h-9"
            >
              <PlusIcon className="h-4 w-4" />
              Add Patient
            </button>
          </div>
        }
      />

      {isClinic && practiceStats && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: 'Today', value: practiceStats.appointmentsToday },
            { label: 'This week', value: practiceStats.appointmentsThisWeek },
            { label: 'Pending', value: practiceStats.pendingAppointments },
            { label: 'Completed (month)', value: practiceStats.completedThisMonth },
          ].map((stat) => (
            <div
              key={stat.label}
              className="rounded-[12px] border border-[#e1e7ef] bg-white px-4 py-3 shadow-sm"
            >
              <p className="text-xs font-medium uppercase tracking-wide text-[#65758b]">
                {stat.label}
              </p>
              <p className="mt-1 text-2xl font-bold text-[#344256]">{stat.value}</p>
            </div>
          ))}
        </div>
      )}

      {patientsError && (
        <div className="rounded-[12px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {patientsError}
        </div>
      )}

      {/* Monthly analytics */}
      <section className="rounded-[12px] border border-[rgba(0,122,245,0.1)] bg-white p-6 shadow-sm">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <ChartBarIcon className="h-5 w-5 text-[#007af5]" />
              <h2 className="text-xl font-semibold tracking-tight text-[#344256]">
                Monthly Analytics Overview
              </h2>
            </div>
            <p className="mt-1 text-sm text-[#65758b]">
              Comprehensive insights for {new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' })}
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/patients')}
            className="btn-ghost"
          >
            View Details
          </button>
        </div>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <MetricProgress
            label="Patient Growth"
            value={`${growthPct}%`}
            valueClass="text-[#21c45d]"
            hint={`${stableCount} stable · ${actionRequiredCount} need attention`}
            progress={growthPct}
            barClass="bg-[#21c45d]"
            icon={<UsersIcon className="h-4 w-4 text-[#21c45d]" />}
            iconBg="bg-[#e9f9ef]"
          />
          <MetricProgress
            label="Appointment Rate"
            value={`${attendanceRate}%`}
            valueClass="text-[#007af5]"
            hint="Confirmed + completed share"
            progress={attendanceRate}
            barClass="bg-[#007af5]"
            icon={<CalendarDaysIcon className="h-4 w-4 text-[#007af5]" />}
            iconBg="bg-[#e8f3ff]"
          />
          <MetricProgress
            label="Active Caseload"
            value={`${Math.max(patients.length - inactiveCount, 0)}`}
            valueClass="text-[#427160]"
            hint={`${inactiveCount} inactive patients`}
            progress={patients.length ? Math.round(((patients.length - inactiveCount) / patients.length) * 100) : 0}
            barClass="bg-[#427160]"
            icon={<HeartPulse className="h-4 w-4 text-[#427160]" />}
            iconBg="bg-[#eef4f1]"
          />
        </div>
      </section>

      {/* Stat cards */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total Patients"
          value={patients.length.toLocaleString()}
          delta={`${actionRequiredCount} action required`}
          icon={<UsersIcon className="h-6 w-6 text-[#007af5]" />}
          iconBg="bg-[#e8f3ff]"
          onClick={() => navigate('/patients')}
        />
        <StatCard
          label={appointmentsStatLabel}
          value={String(rangedAppointments.length)}
          delta={
            appointmentsLoading
              ? 'Loading…'
              : `${appointments.length} total scheduled`
          }
          icon={<CalendarDaysIcon className="h-6 w-6 text-[#21c45d]" />}
          iconBg="bg-[#e9f9ef]"
          onClick={() => navigate('/appointments')}
        />
        <StatCard
          label="Active Cases"
          value={String(Math.max(patients.length - inactiveCount, 0))}
          delta={`${inactiveCount} inactive`}
          icon={<Activity className="h-6 w-6 text-[#f59e0b]" />}
          iconBg="bg-[#fff7e8]"
        />
        <StatCard
          label="Stable Patients"
          value={String(stableCount)}
          delta="vs current roster"
          icon={<HeartPulse className="h-6 w-6 text-[#427160]" />}
          iconBg="bg-[#eef4f1]"
        />
      </section>

      {/* Schedule / Activity / Performance */}
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-[12px] border border-[#e1e7ef] bg-white shadow-sm">
          <div className="border-b border-[#e1e7ef] px-6 py-5">
            <div className="flex items-center gap-2">
              <CalendarDaysIcon className="h-5 w-5 text-[#427160]" />
              <h3 className="text-base font-semibold text-[#344256]">{scheduleTitle}</h3>
            </div>
            <p className="mt-1 text-sm text-[#65758b]">
              Appointments for {rangeLabel.toLowerCase()}
            </p>
          </div>
          <div className="space-y-4 px-6 py-5">
            {[
              ['Morning', scheduleBuckets.morning],
              ['Afternoon', scheduleBuckets.afternoon],
              ['Evening', scheduleBuckets.evening],
            ].map(([label, count]) => (
              <div key={label as string} className="flex items-center justify-between text-sm">
                <span className="text-[#344256]">{label}</span>
                <span className="font-medium text-[#65758b]">{count} patients</span>
              </div>
            ))}
            <button
              type="button"
              onClick={() => navigate('/appointments')}
              className="btn-outline mt-2"
            >
              View Full Schedule
            </button>
          </div>
        </div>

        <div className="rounded-[12px] border border-[#e1e7ef] bg-white shadow-sm">
          <div className="border-b border-[#e1e7ef] px-6 py-5">
            <div className="flex items-center gap-2">
              <ClockIcon className="h-5 w-5 text-[#007af5]" />
              <h3 className="text-base font-semibold text-[#344256]">Recent Activity</h3>
            </div>
            <p className="mt-1 text-sm text-[#65758b]">Latest patient updates</p>
          </div>
          <div className="space-y-5 px-6 py-5">
            {recentActivity.map((item) => (
              <div key={`${item.label}-${item.time}`} className="flex gap-3">
                <span className={clsx('mt-1.5 h-2 w-2 shrink-0 rounded-full', item.tone)} />
                <div>
                  <p className="text-sm font-medium text-[#344256]">{item.label}</p>
                  <p className="text-xs text-[#65758b]">{item.time}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[12px] border border-[#e1e7ef] bg-white shadow-sm">
          <div className="border-b border-[#e1e7ef] px-6 py-5">
            <div className="flex items-center gap-2">
              <ChartBarIcon className="h-5 w-5 text-[#21c45d]" />
              <h3 className="text-base font-semibold text-[#344256]">Performance</h3>
            </div>
            <p className="mt-1 text-sm text-[#65758b]">Metrics for {rangeLabel.toLowerCase()}</p>
          </div>
          <div className="space-y-4 px-6 py-5">
            {[
              ['Stable patients', String(stableCount)],
              ['Attendance rate', `${attendanceRate}%`],
              ['Action required', String(actionRequiredCount)],
            ].map(([label, value]) => (
              <div key={label} className="flex items-center justify-between text-sm">
                <span className="text-[#344256]">{label}</span>
                <span className="font-semibold text-[#344256]">{value}</span>
              </div>
            ))}
            <button
              type="button"
              onClick={() => navigate('/patients')}
              className="btn-outline mt-2"
            >
              View Analytics
            </button>
          </div>
        </div>
      </section>

      {/* Records table */}
      <section className="rounded-[12px] border border-[#e1e7ef] bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e1e7ef] px-4 py-3 sm:px-6">
          <div className="inline-flex rounded-[10px] bg-[#f1f5f9] p-1">
            <button
              type="button"
              onClick={() => setRecordsTab('patients')}
              className={clsx(
                'rounded-[8px] px-3 py-1.5 text-sm font-medium transition-all duration-200',
                recordsTab === 'patients'
                  ? 'bg-[#427160] text-white shadow-sm'
                  : 'text-[#65758b] hover:bg-white hover:text-[#427160] hover:shadow-sm'
              )}
            >
              Patients
            </button>
            <button
              type="button"
              onClick={() => setRecordsTab('appointments')}
              className={clsx(
                'rounded-[8px] px-3 py-1.5 text-sm font-medium transition-all duration-200',
                recordsTab === 'appointments'
                  ? 'bg-[#427160] text-white shadow-sm'
                  : 'text-[#65758b] hover:bg-white hover:text-[#427160] hover:shadow-sm'
              )}
            >
              Appointments
            </button>
          </div>
          <button
            type="button"
            onClick={() => navigate(recordsTab === 'patients' ? '/patients' : '/appointments')}
            className="btn-secondary"
          >
            Advanced Filters
          </button>
        </div>

        <div className="px-4 py-4 sm:px-6">
          <h3 className="mb-4 text-base font-semibold text-[#344256]">
            {recordsTab === 'patients' ? 'Patient Records' : appointmentsListTitle}
          </h3>

          {recordsTab === 'patients' ? (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-[#e1e7ef] text-[#65758b]">
                    <th className="px-3 py-3 font-medium">Patient</th>
                    <th className="px-3 py-3 font-medium">ID</th>
                    <th className="px-3 py-3 font-medium">Age/Gender</th>
                    <th className="px-3 py-3 font-medium">Condition</th>
                    <th className="px-3 py-3 font-medium">Status</th>
                    <th className="px-3 py-3 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {patients.slice(0, 8).map((patient) => {
                    const age = ageFromDob(patient.dateOfBirth);
                    const status = patientStatus(patient, inactiveIds);
                    const condition = patient.chronicDiseases?.[0] || '-';
                    const initials = (patient.displayName || patient.email || '?')
                      .split(' ')
                      .map((p) => p[0])
                      .join('')
                      .slice(0, 2)
                      .toUpperCase();
                    return (
                      <tr key={patient.id} className="border-b border-[#e1e7ef]/70 last:border-0">
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#eef4f1] text-xs font-semibold text-[#427160]">
                              {initials}
                            </div>
                            <span className="font-medium text-[#344256]">
                              {patient.displayName || patient.email || 'Unnamed'}
                            </span>
                          </div>
                        </td>
                        <td className="px-3 py-3 text-[#65758b]">{patient.id.slice(0, 8).toUpperCase()}</td>
                        <td className="px-3 py-3 text-[#65758b]">
                          {age != null ? `${age}` : '-'}
                          {patient.gender ? ` / ${patient.gender}` : ''}
                        </td>
                        <td className="px-3 py-3 text-[#344256]">{condition}</td>
                        <td className="px-3 py-3">
                          <span className={clsx('rounded-full px-2.5 py-0.5 text-xs font-semibold', statusBadge(status))}>
                            {status}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => navigate(`/patient-profile/${patient.id}`)}
                            className="rounded-[8px] px-2.5 py-1.5 text-sm font-medium text-[#427160] transition-all duration-200 hover:bg-[#eef4f1] hover:shadow-sm"
                          >
                            View
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {patients.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-3 py-10 text-center text-[#65758b]">
                        No patients yet. Add a patient to get started.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="space-y-3">
              {rangedAppointments.slice(0, 6).map((apt) => (
                <div
                  key={apt.id}
                  className="flex flex-col gap-3 rounded-[12px] border border-[#e1e7ef] px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="font-semibold text-[#344256]">{apt.patientName}</p>
                    <p className="text-sm text-[#65758b]">
                      {apt.patientId?.slice(0, 8).toUpperCase() || 'MANUAL'} · {apt.time} ·{' '}
                      {apt.consultType || apt.type}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={clsx('rounded-full px-2.5 py-0.5 text-xs font-semibold', statusBadge(apt.status))}>
                      {apt.status}
                    </span>
                    <button
                      type="button"
                      onClick={() => navigate('/appointments')}
                      className="btn-secondary"
                    >
                      Reschedule
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (apt.patientId && apt.patientId !== 'manual') {
                          navigate(`/patient-profile/${apt.patientId}`);
                        } else {
                          navigate('/appointments');
                        }
                      }}
                      className="btn-primary"
                    >
                      View Details
                    </button>
                  </div>
                </div>
              ))}
              {!appointmentsLoading && rangedAppointments.length === 0 && (
                <p className="py-8 text-center text-sm text-[#65758b]">
                  No appointments in this date range.
                </p>
              )}
            </div>
          )}
        </div>
      </section>
    </div>
  );
};

function MetricProgress({
  label,
  value,
  valueClass,
  hint,
  progress,
  barClass,
  icon,
  iconBg,
}: {
  label: string;
  value: string;
  valueClass: string;
  hint: string;
  progress: number;
  barClass: string;
  icon: React.ReactNode;
  iconBg: string;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className={clsx('inline-flex h-7 w-7 items-center justify-center rounded-lg', iconBg)}>
            {icon}
          </span>
          <p className="text-sm font-medium text-[#65758b]">{label}</p>
        </div>
      </div>
      <p className={clsx('text-3xl font-bold', valueClass)}>{value}</p>
      <p className="mt-1 text-xs text-[#65758b]">{hint}</p>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#f1f5f9]">
        <div className={clsx('h-full rounded-full', barClass)} style={{ width: `${Math.min(100, Math.max(0, progress))}%` }} />
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  delta,
  icon,
  iconBg,
  onClick,
}: {
  label: string;
  value: string;
  delta: string;
  icon: React.ReactNode;
  iconBg: string;
  onClick?: () => void;
}) {
  const Comp = onClick ? 'button' : 'div';
  return (
    <Comp
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className="rounded-[12px] border border-[#e1e7ef] bg-white p-5 text-left shadow-sm transition-all duration-200 hover:border-[#427160]/40 hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-[#65758b]">{label}</p>
          <p className="mt-2 text-3xl font-bold text-[#344256]">{value}</p>
          <p className="mt-2 text-xs text-[#65758b]">{delta}</p>
        </div>
        <div className={clsx('flex h-12 w-12 items-center justify-center rounded-[12px]', iconBg)}>{icon}</div>
      </div>
    </Comp>
  );
}
