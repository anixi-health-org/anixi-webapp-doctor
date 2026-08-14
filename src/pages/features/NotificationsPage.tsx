import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BellAlertIcon,
  CalendarDaysIcon,
  CheckCircleIcon,
  UserPlusIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline';
import { PageHeader, PageShell } from '../../components/page-layout';
import { ListRowsSkeleton, PageHeaderSkeleton } from '../../components/ui/Skeleton';
import { useAuth } from '../../hooks/useAuth';
import {
  useApproveIncomingRequest,
  useIncomingSharingRequests,
  useRejectIncomingRequest,
} from '../../hooks/useIncomingSharingRequests';
import { getDoctorAppointments } from '../../services/appointmentService';
import {
  listDoctorNotifications,
  DoctorNotification,
} from '../../services/doctorNotificationService';
import { Appointment } from '../../types';
import { convertTimestamp } from '../../utils/dateFormatter';

type NotificationItem = {
  id: string;
  category: 'appointment' | 'sharing' | 'system';
  title: string;
  body: string;
  time: Date;
  tone: 'info' | 'warning' | 'success' | 'danger';
  actionLabel?: string;
  onAction?: () => void;
};

const isSameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

const withinDays = (date: Date, days: number) => {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  return date >= cutoff;
};

const getSafeTimeLabel = (value: unknown): string => {
  if (typeof value === 'string') return value;
  const converted = convertTimestamp(value);
  if (converted) {
    return converted.toLocaleTimeString('en-ZA', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  }
  return 'Time unavailable';
};

const NotificationsSkeleton: React.FC = () => (
  <>
    <PageHeaderSkeleton />
    <div className="mb-4 flex gap-2">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="h-9 w-24 animate-pulse rounded-full bg-gray-200/80" />
      ))}
    </div>
    <div className="rounded-[12px] border border-[#e1e7ef] bg-white p-4 shadow-sm">
      <ListRowsSkeleton rows={7} />
    </div>
  </>
);

export const NotificationsPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [durable, setDurable] = useState<DoctorNotification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'appointment' | 'sharing' | 'system'>('all');

  const { requests, isLoading: sharingLoading } = useIncomingSharingRequests(user?.id);
  const approveMutation = useApproveIncomingRequest(user?.id);
  const rejectMutation = useRejectIncomingRequest(user?.id);

  const load = useCallback(async () => {
    if (!user?.id) return;
    setIsLoading(true);
    setError(null);
    try {
      const [data, stored] = await Promise.all([
        getDoctorAppointments(user.id),
        listDoctorNotifications(user.id),
      ]);
      setAppointments(data);
      setDurable(stored);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load notifications');
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const items = useMemo(() => {
    const today = new Date();
    const list: NotificationItem[] = [];

    durable.forEach((n) => {
      const tone: NotificationItem['tone'] =
        n.type === 'invoice_paid'
          ? 'success'
          : n.type === 'booking_cancelled'
            ? 'danger'
            : n.type === 'booking_request'
              ? 'warning'
              : 'info';
      list.push({
        id: `durable-${n.id}`,
        category: n.type === 'invoice_paid' ? 'system' : n.type.startsWith('booking') ? 'appointment' : 'system',
        title: n.title,
        body: n.body,
        time: n.createdAt,
        tone,
        actionLabel: n.appointmentId ? 'Open' : n.invoiceId ? 'Invoices' : undefined,
        onAction: n.appointmentId
          ? () => navigate(`/appointments/${n.appointmentId}`)
          : n.invoiceId
            ? () => navigate('/invoices')
            : undefined,
      });
    });

    appointments
      .filter((a) => a.status === 'pending')
      .forEach((a) => {
        list.push({
          id: `pending-${a.id}`,
          category: 'appointment',
          title: 'Pending appointment',
          body: `${a.patientName} requested ${a.type} on ${a.date.toLocaleDateString('en-ZA')} at ${getSafeTimeLabel(a.time)}.`,
          time: a.updatedAt || a.createdAt || a.date,
          tone: 'warning',
          actionLabel: 'Review',
          onAction: () => navigate('/appointments'),
        });
      });

    appointments
      .filter((a) => a.status === 'cancelled' && withinDays(a.updatedAt || a.date, 7))
      .forEach((a) => {
        list.push({
          id: `cancel-${a.id}`,
          category: 'appointment',
          title: 'Appointment cancelled',
          body: `${a.patientName}'s ${a.type} appointment was cancelled.`,
          time: a.updatedAt || a.date,
          tone: 'danger',
          actionLabel: 'View schedule',
          onAction: () => navigate('/appointments'),
        });
      });

    appointments
      .filter((a) => isSameDay(a.date, today) && a.status !== 'cancelled')
      .forEach((a) => {
        list.push({
          id: `today-${a.id}`,
          category: 'appointment',
          title: "Today's appointment",
          body: `${a.patientName} · ${getSafeTimeLabel(a.time)} · ${a.status}`,
          time: a.date,
          tone: 'info',
          actionLabel: 'Open calendar',
          onAction: () => navigate('/practice-calendar'),
        });
      });

    requests
      .filter((req) => req.status === 'pending')
      .forEach((req) => {
        list.push({
          id: `share-${req.id}`,
          category: 'sharing',
          title: 'Sharing request',
          body: `${req.patientName || 'A patient'} wants to share their health data with you.`,
          time: req.createdAt instanceof Date ? req.createdAt : new Date(),
          tone: 'info',
          actionLabel: 'Manage',
          onAction: () => navigate('/patients'),
        });
      });

    if (list.length === 0) {
      list.push({
        id: 'system-empty',
        category: 'system',
        title: 'You are all caught up',
        body: 'New appointment alerts and sharing requests will appear here.',
        time: new Date(),
        tone: 'success',
      });
    }

    list.sort((a, b) => b.time.getTime() - a.time.getTime());
    return list;
  }, [appointments, durable, requests, navigate]);

  const filtered = useMemo(() => {
    if (filter === 'all') return items.filter((i) => i.id !== 'system-empty' || items.length === 1);
    return items.filter((i) => i.category === filter);
  }, [items, filter]);

  const toneStyles: Record<NotificationItem['tone'], string> = {
    info: 'bg-[#eef4f1] text-[#427160]',
    warning: 'bg-amber-50 text-amber-700',
    success: 'bg-emerald-50 text-emerald-700',
    danger: 'bg-rose-50 text-rose-700',
  };

  if (isLoading || sharingLoading) {
    return (
      <PageShell>
        <NotificationsSkeleton />
      </PageShell>
    );
  }

  return (
    <PageShell>
      <PageHeader
        title="Notifications"
        description="Appointment alerts, sharing requests, and system updates."
        actions={
          <button
            type="button"
            onClick={() => void load()}
            className="inline-flex h-10 items-center rounded-[10px] border border-[#e1e7ef] bg-white px-3.5 text-sm font-medium text-[#344256] hover:border-[#427160]/40 hover:text-[#427160]"
          >
            Refresh
          </button>
        }
      />

      {error && (
        <div className="mb-4 rounded-[12px] border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="mb-4 flex flex-wrap gap-2">
        {(['all', 'appointment', 'sharing', 'system'] as const).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setFilter(key)}
            className={`h-9 rounded-full px-3.5 text-sm font-medium capitalize transition-colors ${
              filter === key
                ? 'bg-[#427160] text-white'
                : 'border border-[#e1e7ef] bg-white text-[#65758b] hover:border-[#427160]/40 hover:text-[#427160]'
            }`}
          >
            {key}
          </button>
        ))}
      </div>

      {requests.filter((r) => r.status === 'pending').length > 0 && (
        <div className="mb-4 rounded-[12px] border border-[#e1e7ef] bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold text-[#344256]">Incoming sharing requests</h2>
          <ul className="space-y-3">
            {requests
              .filter((r) => r.status === 'pending')
              .map((req) => (
              <li
                key={req.id}
                className="flex flex-col gap-3 rounded-[10px] border border-[#eef2f6] p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#eef4f1] text-[#427160]">
                    <UserPlusIcon className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-[#344256]">
                      {req.patientName || 'Patient'}
                    </p>
                    <p className="text-xs text-[#65758b]">Wants to share health data with you</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={approveMutation.isPending}
                    onClick={() =>
                      approveMutation.mutate({ requestId: req.id, patientId: req.patientId })
                    }
                    className="inline-flex h-9 items-center gap-1 rounded-[10px] bg-[#427160] px-3 text-sm font-medium text-white hover:bg-[#365c4f] disabled:opacity-50"
                  >
                    <CheckCircleIcon className="h-4 w-4" />
                    Approve
                  </button>
                  <button
                    type="button"
                    disabled={rejectMutation.isPending}
                    onClick={() =>
                      rejectMutation.mutate({ requestId: req.id, patientId: req.patientId })
                    }
                    className="inline-flex h-9 items-center gap-1 rounded-[10px] border border-[#e1e7ef] px-3 text-sm font-medium text-[#344256] hover:border-rose-300 hover:text-rose-600 disabled:opacity-50"
                  >
                    <XCircleIcon className="h-4 w-4" />
                    Decline
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="overflow-hidden rounded-[12px] border border-[#e1e7ef] bg-white shadow-sm">
        {filtered.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <BellAlertIcon className="mx-auto h-10 w-10 text-[#c5ced9]" />
            <p className="mt-3 text-sm font-medium text-[#344256]">No notifications in this filter</p>
          </div>
        ) : (
          <ul className="divide-y divide-[#eef2f6]">
            {filtered.map((item) => (
              <li key={item.id} className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                <div className="flex items-start gap-3">
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${toneStyles[item.tone]}`}
                  >
                    {item.category === 'appointment' ? (
                      <CalendarDaysIcon className="h-5 w-5" />
                    ) : item.category === 'sharing' ? (
                      <UserPlusIcon className="h-5 w-5" />
                    ) : (
                      <BellAlertIcon className="h-5 w-5" />
                    )}
                  </div>
                  <div>
                    <p className="font-medium text-[#344256]">{item.title}</p>
                    <p className="mt-0.5 text-sm text-[#65758b]">{item.body}</p>
                    <p className="mt-1 text-xs text-[#94a3b8]">
                      {item.time.toLocaleString('en-GB', {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                </div>
                {item.actionLabel && item.onAction && (
                  <button
                    type="button"
                    onClick={item.onAction}
                    className="inline-flex h-9 shrink-0 items-center rounded-[10px] border border-[#e1e7ef] px-3 text-sm font-medium text-[#344256] hover:border-[#427160]/40 hover:text-[#427160]"
                  >
                    {item.actionLabel}
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </PageShell>
  );
};
