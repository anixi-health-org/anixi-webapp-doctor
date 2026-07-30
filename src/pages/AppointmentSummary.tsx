import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getAppointmentById, getDoctorAppointments, updateAppointment } from '../services/appointmentService';
import { useAuth } from '../hooks/useAuth';
import { Appointment } from '../types';
import ManageAppointmentModal from '../components/appointments/ManageAppointmentModal';
import { DetailPageSkeleton } from '../components/ui';
import { PageShell } from '../components/page-layout';
import {
  formatAppointmentTypeLabel,
  isWhatsAppComingSoon,
} from '../utils/teleconsult';

const statusClass = (status: Appointment['status']) => {
  switch (status) {
    case 'confirmed':
      return 'bg-emerald-50 text-emerald-800 border-emerald-200';
    case 'pending':
      return 'bg-amber-50 text-amber-800 border-amber-200';
    case 'completed':
      return 'bg-slate-100 text-slate-700 border-slate-200';
    case 'cancelled':
      return 'bg-red-50 text-red-700 border-red-200';
    case 'no_show':
      return 'bg-orange-50 text-orange-800 border-orange-200';
    default:
      return 'bg-slate-50 text-slate-700 border-slate-200';
  }
};

export const AppointmentSummary: React.FC = () => {
  const { appointmentId } = useParams<{ appointmentId: string }>();
  const { user } = useAuth();
  const [appointment, setAppointment] = useState<Appointment | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showManage, setShowManage] = useState(false);
  const [loadingComplete, setLoadingComplete] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const load = async () => {
      if (!user?.id || !appointmentId) {
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      try {
        const direct = await getAppointmentById(user.id, appointmentId);
        if (direct) {
          setAppointment(direct);
        } else {
          const all = await getDoctorAppointments(user.id);
          const found = all.find((a) => a.id === appointmentId) || null;
          setAppointment(found);
        }
      } catch (err) {
        setError('Failed to load appointment');
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [appointmentId, user?.id]);

  if (isLoading) {
    return (
      <PageShell>
        <DetailPageSkeleton />
      </PageShell>
    );
  }
  if (error) {
    return (
      <PageShell>
        <div className="rounded-[12px] border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      </PageShell>
    );
  }
  if (!appointment) {
    return (
      <PageShell>
        <p className="text-sm text-[#65758b]">Appointment not found.</p>
      </PageShell>
    );
  }

  const onUpdated = (u: Partial<Appointment>) => {
    setAppointment((prev) => (prev ? { ...prev, ...u } : prev));
  };

  const markCompleted = async () => {
    if (!user?.id || !appointment) return;
    try {
      setLoadingComplete(true);
      await updateAppointment(user.id, appointment.id, { status: 'completed' });
      setAppointment({ ...appointment, status: 'completed' });
    } catch (err) {
      setError('Failed to mark appointment completed');
    } finally {
      setLoadingComplete(false);
    }
  };

  const dateLabel = appointment.date.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <PageShell>
      <div className="mb-5 flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate('/appointments')}
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#e1e7ef] bg-white text-lg text-[#344256] transition hover:border-anixi-green/40 hover:text-anixi-green"
          aria-label="Back"
        >
          ←
        </button>
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-[#0E2340]">Appointment details</h1>
          <p className="mt-0.5 truncate text-sm text-[#65758b]">
            {appointment.patientName} · Review this visit before you begin
          </p>
        </div>
      </div>

      <div className="overflow-hidden rounded-[14px] border border-[#e1e7ef] bg-white shadow-sm">
        <div className="grid gap-0 sm:grid-cols-2">
          <div className="border-b border-[#eef2f6] p-5 sm:border-b-0 sm:border-r">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[#8FA0B6]">
              Patient
            </p>
            <p className="mt-2 text-base font-semibold text-[#0E2340]">{appointment.patientName}</p>
            <p className="mt-1 text-sm text-[#65758b]">
              {appointment.patientEmail || 'No email provided'}
            </p>
          </div>

          <div className="p-5">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[#8FA0B6]">
              Appointment
            </p>
            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
              <div>
                <dt className="text-[#8FA0B6]">Date</dt>
                <dd className="mt-0.5 font-medium text-[#344256]">{dateLabel}</dd>
              </div>
              <div>
                <dt className="text-[#8FA0B6]">Time</dt>
                <dd className="mt-0.5 font-medium text-[#344256]">{appointment.time}</dd>
              </div>
              <div>
                <dt className="text-[#8FA0B6]">Type</dt>
                <dd className="mt-0.5 font-medium text-[#344256]">
                  {formatAppointmentTypeLabel(appointment)}
                </dd>
              </div>
              <div>
                <dt className="text-[#8FA0B6]">Status</dt>
                <dd className="mt-1">
                  <span
                    className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold capitalize ${statusClass(
                      appointment.status
                    )}`}
                  >
                    {appointment.status.replace('_', ' ')}
                  </span>
                </dd>
              </div>
            </dl>
          </div>
        </div>

        <div className="flex flex-col gap-2 border-t border-[#eef2f6] bg-[#f8fafc] p-4 sm:flex-row sm:flex-wrap">
          {isWhatsAppComingSoon(appointment) ? (
            <div className="inline-flex h-10 items-center rounded-[10px] border border-amber-200 bg-amber-50 px-4 text-sm font-medium text-amber-900">
              WhatsApp — Coming soon
            </div>
          ) : (
            <button
              type="button"
              onClick={() =>
                navigate(`/appointments/${appointment.id}/post-consult`, { state: { appointment } })
              }
              disabled={['cancelled', 'no_show', 'completed'].includes(appointment.status)}
              className="inline-flex h-10 items-center justify-center rounded-[10px] bg-anixi-green px-4 text-sm font-semibold text-white hover:bg-[#365c4f] disabled:opacity-50"
            >
              Start Consultation
            </button>
          )}
          <button
            type="button"
            onClick={() => setShowManage(true)}
            className="inline-flex h-10 items-center justify-center rounded-[10px] border border-[#e1e7ef] bg-white px-4 text-sm font-semibold text-[#344256] hover:border-anixi-green/40 hover:text-anixi-green"
          >
            Reschedule / cancel
          </button>
          <button
            type="button"
            onClick={markCompleted}
            disabled={loadingComplete || appointment.status === 'completed'}
            className="inline-flex h-10 items-center justify-center rounded-[10px] border border-[#e1e7ef] bg-white px-4 text-sm font-semibold text-[#344256] hover:border-anixi-green/40 disabled:opacity-50"
          >
            {loadingComplete ? 'Saving…' : appointment.status === 'completed' ? 'Visit completed' : 'Mark visit completed'}
          </button>
        </div>
      </div>

      {showManage && (
        <ManageAppointmentModal
          appointment={appointment}
          onClose={() => setShowManage(false)}
          onUpdated={onUpdated}
        />
      )}
    </PageShell>
  );
};

export default AppointmentSummary;
