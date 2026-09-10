import {
  CheckIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline';
import React from 'react';
import { Link } from 'react-router-dom';
import type { AttentionItem, DoctorBriefingSnapshot } from '../../hooks/useDoctorBriefingData';
import type { DoctorAgentDraft } from '../../services/askAnixiService';
import { AyahAvatar } from './AyahAvatar';

type Props = {
  greeting: string;
  firstName: string;
  snapshot: DoctorBriefingSnapshot;
  pendingDrafts: DoctorAgentDraft[];
  briefingLoading: boolean;
  onPrepareNext: () => void;
  onAttention: (item: AttentionItem) => void;
  onAskPanel: () => void;
  onResolveDraft: (draft: DoctorAgentDraft, decision: 'approved' | 'rejected') => void;
};

function minutesUntil(date?: Date | string | null): string | null {
  if (!date) return null;
  const instant = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(instant.getTime())) return null;
  const diff = Math.round((instant.getTime() - Date.now()) / 60000);
  if (diff < -5) return null;
  if (diff <= 0) return 'Now';
  if (diff < 60) return `In ${diff} min`;
  const hours = Math.floor(diff / 60);
  return `In ${hours}h ${diff % 60}m`;
}

export function AyahCommandBoard({
  greeting,
  firstName,
  snapshot,
  pendingDrafts,
  briefingLoading,
  onPrepareNext,
  onAttention,
  onAskPanel,
  onResolveDraft,
}: Props) {
  const next = snapshot.nextAppointment;
  const nextWhen = minutesUntil(next?.startAt ?? next?.scheduledAt ?? next?.date);
  const unstableCount = snapshot.totalPatients - snapshot.stablePatients;
  const hasQueue = snapshot.attentionItems.length > 0 || pendingDrafts.length > 0;

  return (
    <aside className="flex h-full w-full flex-col overflow-y-auto border-r border-[#e1e7ef] bg-white lg:w-[340px] xl:w-[360px]">
      <header className="px-5 pb-4 pt-5">
        <div className="flex items-center gap-3">
          <AyahAvatar size="md" />
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#65758b]">
              Clinical copilot
            </p>
            <h1 className="truncate text-[17px] font-semibold tracking-tight text-[#1b2b2b]">
              {greeting}, Dr. {firstName}
            </h1>
          </div>
        </div>
      </header>

      <div className="mx-5 grid grid-cols-3 overflow-hidden rounded-xl border border-[#e1e7ef] bg-[#f8fafc]">
        <Metric
          value={snapshot.todayAppointments.length}
          label="On today"
          loading={briefingLoading}
          to="/appointments"
        />
        <Metric
          value={snapshot.pendingAppointments}
          label="To confirm"
          loading={briefingLoading}
          to="/appointments"
          emphasize={snapshot.pendingAppointments > 0}
        />
        <Metric
          value={snapshot.pendingPatientRequests}
          label="To approve"
          loading={briefingLoading}
          to="/patients"
          emphasize={snapshot.pendingPatientRequests > 0}
        />
      </div>

      <div className="mx-5 mt-3 flex items-center justify-between gap-3 px-1 py-1">
        <button type="button" onClick={onAskPanel} className="min-w-0 text-left">
          <p className="text-sm font-semibold text-[#1b2b2b]">
            {briefingLoading ? '…' : snapshot.totalPatients} patients in your care
          </p>
          <p className="mt-0.5 text-xs text-[#65758b]">
            {unstableCount > 0
              ? `${unstableCount} not marked stable`
              : 'Your full panel, not only today’s list'}
          </p>
        </button>
        <Link
          to="/patients"
          className="shrink-0 text-xs font-semibold text-[#427160] hover:underline"
        >
          Open list
        </Link>
      </div>

      <section className="mt-2 border-t border-[#e1e7ef] px-5 py-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#65758b]">
          Next
        </p>
        {next ? (
          <div className="mt-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-[15px] font-semibold text-[#1b2b2b]">
                  {next.patientName || 'Patient'}
                </p>
                <p className="mt-0.5 text-sm text-[#65758b]">
                  {next.time || 'Scheduled'}
                  {next.consultType ? ` · ${next.consultType}` : ''}
                </p>
              </div>
              {nextWhen ? (
                <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#eef4f1] px-2 py-0.5 text-[11px] font-semibold text-[#427160]">
                  <ClockIcon className="h-3.5 w-3.5" />
                  {nextWhen}
                </span>
              ) : null}
            </div>
            <button
              type="button"
              onClick={onPrepareNext}
              className="mt-3 w-full rounded-xl bg-[#427160] px-3 py-2 text-sm font-semibold text-white hover:bg-[#365c4e]"
            >
              Prepare this visit
            </button>
          </div>
        ) : (
          <p className="mt-2 text-sm text-[#65758b]">
            {briefingLoading ? 'Checking the diary…' : 'No one else is booked today.'}
          </p>
        )}
      </section>

      <section className="flex-1 border-t border-[#e1e7ef] px-5 py-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#65758b]">
          Needs you
        </p>
        <div className="mt-3 space-y-1">
          {!hasQueue ? (
            <p className="text-sm text-[#65758b]">Nothing waiting on you right now.</p>
          ) : null}

          {pendingDrafts.slice(0, 3).map((draft) => (
            <div key={draft.id} className="rounded-xl bg-amber-50 px-3 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-900">
                {draft.type.replace(/_/g, ' ')}
              </p>
              <p className="mt-1 line-clamp-2 text-sm text-[#5b4a2a]">{draft.preview}</p>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  className="inline-flex items-center gap-1 rounded-lg bg-[#427160] px-2.5 py-1 text-xs font-semibold text-white"
                  onClick={() => onResolveDraft(draft, 'approved')}
                >
                  <CheckIcon className="h-3.5 w-3.5" />
                  Approve
                </button>
                <button
                  type="button"
                  className="inline-flex items-center gap-1 rounded-lg bg-white px-2.5 py-1 text-xs font-semibold text-[#65758b] ring-1 ring-[#e1e7ef]"
                  onClick={() => onResolveDraft(draft, 'rejected')}
                >
                  <XCircleIcon className="h-3.5 w-3.5" />
                  Reject
                </button>
              </div>
            </div>
          ))}

          {snapshot.attentionItems.slice(0, 6).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onAttention(item)}
              className="flex w-full items-start gap-3 rounded-xl px-1 py-2.5 text-left hover:bg-[#f8fafc]"
            >
              {item.tone !== 'routine' ? (
                <ExclamationTriangleIcon className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              ) : (
                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[#427160]" />
              )}
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-[#1b2b2b]">{item.title}</span>
                <span className="mt-0.5 block text-xs leading-relaxed text-[#65758b]">
                  {item.detail}
                </span>
              </span>
            </button>
          ))}
        </div>
      </section>

      <p className="border-t border-[#e1e7ef] px-5 py-3 text-[11px] leading-relaxed text-[#9aa8a2]">
        Ayah ONLY monitors & proposes. All Clinical Decisions are made by you.
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
}: {
  value: number;
  label: string;
  loading: boolean;
  to: string;
  emphasize?: boolean;
}) {
  return (
    <Link
      to={to}
      className={`px-2 py-3 text-center hover:bg-white ${emphasize ? 'bg-amber-50' : ''}`}
    >
      <p className="text-xl font-semibold tabular-nums text-[#1b2b2b]">{loading ? '…' : value}</p>
      <p className="mt-0.5 text-[11px] text-[#65758b]">{label}</p>
    </Link>
  );
}
