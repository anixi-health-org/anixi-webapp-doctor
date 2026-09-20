import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { usePermissions } from '../hooks/usePermissions';
import { listenToDoctorAppointments } from '../services/appointmentService';
import { userFacingLoadError } from '../services/djangoApiService';
import { Appointment } from '../types';
import { AppointmentList } from '../components/appointments/AppointmentList';
import { CreateAppointmentModal } from '../components/appointments/CreateAppointmentModal';
import {
  CheckCircle2,
  ClipboardList,
  Clock,
  XCircle,
} from 'lucide-react';
import { Toast, AppointmentsPageSkeleton } from '../components/ui';
import { PageHeader, PageShell } from '../components/page-layout';
import {
  APPOINTMENT_DATE_RANGES,
  dateRangeSummaryLabel,
  filterAppointmentsByDateRange,
  sortAppointmentsByStart,
  type AppointmentDateRange,
} from '../lib/appointmentDateFilters';

type StatusFilter = Appointment['status'] | 'All';

export const AppointmentsPage: React.FC = () => {
  const { user } = useAuth();
  const { can } = usePermissions();
  const navigate = useNavigate();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [, setSelectedAppointment] = useState<Appointment | null>(null);
  const [dateRange, setDateRange] = useState<AppointmentDateRange>('today');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('All');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [toast, setToast] = useState<{ visible: boolean; message: string; type: 'success' | 'error' }>({
    visible: false,
    message: '',
    type: 'success',
  });

  useEffect(() => {
    if (!toast.visible) return;
    const timer = setTimeout(() => {
      setToast({ visible: false, message: '', type: 'success' });
    }, 4500);
    return () => clearTimeout(timer);
  }, [toast.visible]);

  useEffect(() => {
    if (!user?.id) return;
    setIsLoading(true);
    setError(null);

    const unsubscribe = listenToDoctorAppointments(
      user.id,
      (data) => {
        setAppointments(data);
        setError(null);
        setIsLoading(false);
      },
      (err) => {
        setError(userFacingLoadError(err, 'Failed to load appointments'));
        setIsLoading(false);
      }
    );

    return unsubscribe;
  }, [user?.id]);

  const handleAppointmentClick = (apt: Appointment) => {
    if (apt.id) {
      navigate(`/appointments/${apt.id}`, { state: { appointment: apt } });
      return;
    }
    setSelectedAppointment(apt);
  };

  const isPendingStatus = (status: Appointment['status']) =>
    status === 'pending' || status === 'rescheduled';

  const isCancelledStatus = (status: Appointment['status']) =>
    status === 'cancelled' || status === 'auto_cancelled';

  const dateScopedAppointments = useMemo(
    () => sortAppointmentsByStart(filterAppointmentsByDateRange(appointments, dateRange)),
    [appointments, dateRange],
  );

  const stats = useMemo(
    () => ({
      total: dateScopedAppointments.length,
      confirmed: dateScopedAppointments.filter((a) => a.status === 'confirmed').length,
      pending: dateScopedAppointments.filter((a) => isPendingStatus(a.status)).length,
      completed: dateScopedAppointments.filter((a) => a.status === 'completed').length,
      cancelled: dateScopedAppointments.filter((a) => isCancelledStatus(a.status)).length,
      noShow: dateScopedAppointments.filter((a) => a.status === 'no_show').length,
    }),
    [dateScopedAppointments],
  );

  const filteredAppointments = useMemo(() => {
    if (statusFilter === 'All') return dateScopedAppointments;
    if (statusFilter === 'pending') {
      return dateScopedAppointments.filter((a) => isPendingStatus(a.status));
    }
    if (statusFilter === 'cancelled') {
      return dateScopedAppointments.filter((a) => isCancelledStatus(a.status));
    }
    return dateScopedAppointments.filter((a) => a.status === statusFilter);
  }, [dateScopedAppointments, statusFilter]);

  const statusSummaryLabel = useMemo(() => {
    if (statusFilter === 'All') return dateRangeSummaryLabel(dateRange);
    if (statusFilter === 'pending') return 'Pending';
    if (statusFilter === 'cancelled') return 'Cancelled';
    if (statusFilter === 'no_show') return 'Missed';
    return statusFilter.charAt(0).toUpperCase() + statusFilter.slice(1);
  }, [dateRange, statusFilter]);

  if (isLoading) {
    return (
      <PageShell>
        <AppointmentsPageSkeleton />
      </PageShell>
    );
  }

  return (
    <PageShell>
      {toast.visible && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast({ visible: false, message: '', type: 'success' })}
        />
      )}

      <PageHeader
        title="Appointments"
        description="Today's schedule and recent patient visits"
        actions={
          can('manageAppointments') ? (
            <button
              type="button"
              onClick={() => setShowCreateModal(true)}
              className="btn-primary h-10 px-4"
            >
              <span className="text-lg leading-none">+</span>
              New Appointment
            </button>
          ) : undefined
        }
      />

      {error && (
        <div className="mb-6 rounded-[12px] border border-red-200 bg-red-50 p-4">
          <p className="font-medium text-red-800">{error}</p>
          <button
            type="button"
            onClick={() => setError(null)}
            className="mt-2 text-sm text-red-600 underline hover:text-red-700"
          >
            Dismiss
          </button>
        </div>
      )}

      {!isLoading && !error && (
        <>
          <div className="mb-4 flex flex-wrap gap-2">
            {APPOINTMENT_DATE_RANGES.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setDateRange(item.key)}
                className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-all duration-200 ${
                  dateRange === item.key
                    ? 'border-anixi-green bg-anixi-green text-white shadow-sm'
                    : 'border-[#e1e7ef] bg-white text-[#65758b] hover:border-anixi-green/40 hover:text-anixi-green'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="mb-4 grid grid-cols-3 gap-2 sm:grid-cols-5">
            {[
              { label: 'Total', value: stats.total, status: 'All' as StatusFilter, icon: <ClipboardList className="h-3.5 w-3.5" /> },
              { label: 'Confirmed', value: stats.confirmed, status: 'confirmed' as StatusFilter, icon: <CheckCircle2 className="h-3.5 w-3.5" /> },
              { label: 'Pending', value: stats.pending, status: 'pending' as StatusFilter, icon: <Clock className="h-3.5 w-3.5" /> },
              { label: 'Completed', value: stats.completed, status: 'completed' as StatusFilter, icon: <CheckCircle2 className="h-3.5 w-3.5" /> },
              { label: 'Cancelled', value: stats.cancelled, status: 'cancelled' as StatusFilter, icon: <XCircle className="h-3.5 w-3.5" /> },
            ].map((item) => (
              <button
                key={item.label}
                type="button"
                onClick={() => setStatusFilter(item.status)}
                className={`rounded-[10px] border bg-white px-2.5 py-2 text-left transition-all duration-200 ${
                  statusFilter === item.status
                    ? 'border-anixi-green ring-1 ring-anixi-green/30'
                    : 'border-[#e1e7ef] hover:border-anixi-green/40'
                }`}
              >
                <div className="mb-1 flex items-center gap-1 text-anixi-green">{item.icon}</div>
                <p className="text-lg font-bold leading-none text-[#344256]">{item.value}</p>
                <p className="mt-1 truncate text-[11px] text-[#65758b]">{item.label}</p>
              </button>
            ))}
          </div>
        </>
      )}

      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-[10px] bg-[#f1f5f9] p-1">
          {(['All', 'confirmed', 'pending', 'completed'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setStatusFilter(tab === 'All' ? 'All' : tab)}
              className={`rounded-[8px] px-3 py-1.5 text-sm font-medium capitalize transition-all duration-200 ${
                statusFilter === tab
                  ? 'bg-anixi-green text-white shadow-sm'
                  : 'text-[#65758b] hover:bg-white hover:text-anixi-green hover:shadow-sm'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
        <p className="text-sm font-medium text-[#344256]">
          {statusSummaryLabel}
          {filteredAppointments.length > 0 ? ` · ${filteredAppointments.length}` : ''}
        </p>
      </div>

      <AppointmentList
        appointments={filteredAppointments}
        pageSize={10}
        onSelectAppointment={handleAppointmentClick}
        isLoading={isLoading}
      />

      <CreateAppointmentModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onAppointmentCreated={(message?: string) => {
          setToast({
            visible: true,
            message: message ?? 'Appointment created successfully.',
            type: 'success',
          });
        }}
      />
    </PageShell>
  );
};
export default AppointmentsPage;
