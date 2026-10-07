import { ClockIcon, UserGroupIcon, UserPlusIcon, UsersIcon } from '@heroicons/react/24/outline';
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AyahAvatar } from '../ayah/AyahAvatar';
import {
  getPracticeDashboardStats,
  type PracticeDashboardStats,
} from '../../services/practiceDashboardService';

type Props = {
  greeting: string;
  firstName: string;
  practiceId?: string;
  onAskSetup: () => void;
  onAskRoster: () => void;
};

export function ClinicAyahCommandBoard({
  greeting,
  firstName,
  practiceId,
  onAskSetup,
  onAskRoster,
}: Props) {
  const [stats, setStats] = useState<PracticeDashboardStats | null>(null);
  const [loading, setLoading] = useState(Boolean(practiceId));

  useEffect(() => {
    if (!practiceId) {
      setStats(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      setLoading(true);
      try {
        const next = await getPracticeDashboardStats(practiceId);
        if (!cancelled) setStats(next);
      } catch {
        if (!cancelled) setStats(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [practiceId]);

  const pendingInvites = stats?.pendingInvites ?? 0;
  const pendingAppts = stats?.pendingAppointments ?? 0;
  const todayAppts = stats?.appointmentsToday ?? 0;

  return (
    <aside className="flex max-h-[42vh] w-full shrink-0 flex-col overflow-y-auto border-b border-[#e1e7ef] bg-white lg:max-h-none lg:w-[340px] lg:border-b-0 lg:border-r xl:w-[360px]">
      <header className="px-5 pb-4 pt-5">
        <div className="flex items-center gap-3">
          <AyahAvatar size="md" />
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#65758b]">
              Clinic copilot
            </p>
            <h1 className="truncate text-[17px] font-semibold tracking-tight text-[#1b2b2b]">
              {greeting}, {firstName}
            </h1>
          </div>
        </div>
      </header>

      <div className="mx-5 grid grid-cols-3 overflow-hidden rounded-xl border border-[#e1e7ef] bg-[#f8fafc]">
        <Metric
          value={todayAppts}
          label="Today"
          loading={loading}
          to="/clinic/schedule"
          icon={ClockIcon}
        />
        <Metric
          value={pendingAppts}
          label="To confirm"
          loading={loading}
          to="/clinic/schedule"
          emphasize={pendingAppts > 0}
        />
        <Metric
          value={pendingInvites}
          label="Invites"
          loading={loading}
          to="/clinic/team"
          emphasize={pendingInvites > 0}
          icon={UserPlusIcon}
        />
      </div>

      <div className="mx-5 mt-3 flex items-center justify-between gap-3 px-1 py-1">
        <button type="button" onClick={onAskRoster} className="min-w-0 text-left">
          <p className="text-sm font-semibold text-[#1b2b2b]">
            {loading ? '…' : `${stats?.rosterPatients ?? 0} patients on roster`}
          </p>
          <p className="mt-0.5 text-xs text-[#65758b]">Import charts or bulk CSV from chat</p>
        </button>
        <Link
          to="/clinic/patients"
          className="shrink-0 text-xs font-semibold text-[#427160] hover:underline"
        >
          Open list
        </Link>
      </div>

      <section className="mt-2 border-t border-[#e1e7ef] px-5 py-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#65758b]">
          Quick actions
        </p>
        <div className="mt-3 space-y-2">
          <QuickAction
            title="Clinic setup gaps"
            detail="Team, hours, rooms, and listing"
            onClick={onAskSetup}
          />
          <QuickAction
            title="Team & roles"
            detail="Who is active and pending invite"
            to="/clinic/team"
            icon={UserGroupIcon}
          />
          <QuickAction
            title="Front desk queue"
            detail="Check-ins and waiting room"
            to="/clinic/queue"
            icon={UsersIcon}
          />
        </div>
      </section>

      <p className="border-t border-[#e1e7ef] px-5 py-3 text-[11px] leading-relaxed text-[#9aa8a2]">
        Ayah proposes admin actions. You confirm chart imports and any clinical writes.
      </p>
    </aside>
  );
}

function Metric({
  value,
  label,
  loading,
  to,
  emphasize,
  icon: Icon,
}: {
  value: number;
  label: string;
  loading: boolean;
  to: string;
  emphasize?: boolean;
  icon?: React.ComponentType<React.SVGProps<SVGSVGElement>>;
}) {
  return (
    <Link
      to={to}
      className={`px-2 py-3 text-center hover:bg-white ${emphasize ? 'bg-amber-50' : ''}`}
    >
      {Icon ? <Icon className="mx-auto mb-0.5 h-4 w-4 text-[#65758b]" /> : null}
      <p className="text-xl font-semibold tabular-nums text-[#1b2b2b]">{loading ? '…' : value}</p>
      <p className="mt-0.5 text-[11px] text-[#65758b]">{label}</p>
    </Link>
  );
}

function QuickAction({
  title,
  detail,
  onClick,
  to,
  icon: Icon,
}: {
  title: string;
  detail: string;
  onClick?: () => void;
  to?: string;
  icon?: React.ComponentType<React.SVGProps<SVGSVGElement>>;
}) {
  const className =
    'flex w-full items-start gap-3 rounded-xl px-1 py-2.5 text-left hover:bg-[#f8fafc]';
  const body = (
    <>
      {Icon ? (
        <Icon className="mt-0.5 h-4 w-4 shrink-0 text-[#427160]" />
      ) : (
        <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[#427160]" />
      )}
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-[#1b2b2b]">{title}</span>
        <span className="mt-0.5 block text-xs leading-relaxed text-[#65758b]">{detail}</span>
      </span>
    </>
  );
  if (to) {
    return (
      <Link to={to} className={className}>
        {body}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} className={className}>
      {body}
    </button>
  );
}
