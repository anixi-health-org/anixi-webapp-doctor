import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { usePermissions } from '../hooks/usePermissions';
import { listenToDoctorAppointments } from '../services/appointmentService';
import { userFacingLoadError } from '../services/djangoApiService';
import { Appointment } from '../types';
import { AppointmentList } from '../components/appointments/AppointmentList';
import { CreateAppointmentModal } from '../components/appointments/CreateAppointmentModal';
import {
  Calendar,
  CheckCircle2,
  ClipboardList,
  Clock,
  XCircle,
} from 'lucide-react';
import { Toast, AppointmentsPageSkeleton } from '../components/ui';
import { PageHeader, PageShell } from '../components/page-layout';
import { calendarDateKeyInTimeZone } from '../lib/timezones';

type FilterType = Appointment['status'] | 'All' | 'Today';

const DEFAULT_PRACTICE_TZ = 'Africa/Johannesburg';

function isAppointmentOnClinicDay(appointment: Appointment, day: Date = new Date()): boolean {
  const instant = appointment.scheduledAt || appointment.date;
  if (!instant) return false;
  const tz = appointment.timezone || DEFAULT_PRACTICE_TZ;
  return (
    calendarDateKeyInTimeZone(new Date(instant), tz) ===
    calendarDateKeyInTimeZone(day, tz)
  );
}

export const AppointmentsPage: React.FC = () => {
  const { user } = useAuth();
  const { can } = usePermissions();
  const navigate = useNavigate();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [, setSelectedAppointment] = useState<Appointment | null>(null);
  const [filterStatus, setFilterStatus] = useState<Appointment['status'] | 'All'>('All');
  const [selectedCard, setSelectedCard] = useState<FilterType | null>(null);
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

  // Live, so bookings and cancellations made in the patient app land here
  // without the doctor reloading the page.
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

  const stats = {
    total: appointments.length,
    confirmed: appointments.filter((a) => a.status === 'confirmed').length,
    pending: appointments.filter((a) => isPendingStatus(a.status)).length,
    completed: appointments.filter((a) => a.status === 'completed').length,
    cancelled: appointments.filter((a) => isCancelledStatus(a.status)).length,
    noShow: appointments.filter((a) => a.status === 'no_show').length,
    today: appointments.filter((a) => isAppointmentOnClinicDay(a)).length,
  };

  const handleCardClick = (card: FilterType) => {
    setSelectedCard(card);
    if (card === 'All' || card === 'Today') {
      setFilterStatus('All');
    } else {
      setFilterStatus(card as Appointment['status']);
    }
  };

  const activeFilter: FilterType = selectedCard ?? filterStatus;

  let filteredAppointments: Appointment[] = appointments;
  if (activeFilter === 'Today') {
    filteredAppointments = appointments.filter((a) => isAppointmentOnClinicDay(a));
  } else if (activeFilter === 'pending') {
    filteredAppointments = appointments.filter((a) => isPendingStatus(a.status));
  } else if (activeFilter === 'cancelled') {
    filteredAppointments = appointments.filter((a) => isCancelledStatus(a.status));
  } else if (activeFilter !== 'All') {
    filteredAppointments = appointments.filter((a) => a.status === activeFilter);
  }

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
        description="Manage and view all patient appointments"
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
        <div className="mb-4 grid grid-cols-3 gap-2 sm:grid-cols-6">
          {[
            { label: 'Total', value: stats.total, card: 'All' as FilterType, icon: <ClipboardList className="h-3.5 w-3.5" /> },
            { label: 'Confirmed', value: stats.confirmed, card: 'confirmed' as FilterType, icon: <CheckCircle2 className="h-3.5 w-3.5" /> },
            { label: 'Pending', value: stats.pending, card: 'pending' as FilterType, icon: <Clock className="h-3.5 w-3.5" /> },
            { label: 'Completed', value: stats.completed, card: 'completed' as FilterType, icon: <CheckCircle2 className="h-3.5 w-3.5" /> },
            { label: 'Cancelled', value: stats.cancelled, card: 'cancelled' as FilterType, icon: <XCircle className="h-3.5 w-3.5" /> },
            { label: 'Today', value: stats.today, card: 'Today' as FilterType, icon: <Calendar className="h-3.5 w-3.5" /> },
          ].map((item) => (
            <button
              key={item.label}
              type="button"
              onClick={() => handleCardClick(item.card)}
              className={`rounded-[10px] border bg-white px-2.5 py-2 text-left transition-all duration-200 ${
                activeFilter === item.card
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
      )}

      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-[10px] bg-[#f1f5f9] p-1">
          {(['All', 'confirmed', 'pending', 'completed'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => handleCardClick(tab === 'All' ? 'All' : tab)}
              className={`rounded-[8px] px-3 py-1.5 text-sm font-medium capitalize transition-all duration-200 ${
                activeFilter === tab
                  ? 'bg-anixi-green text-white shadow-sm'
                  : 'text-[#65758b] hover:bg-white hover:text-anixi-green hover:shadow-sm'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
        <p className="text-sm font-medium text-[#344256]">
          {activeFilter === 'Today' && "Today's appointments"}
          {activeFilter === 'confirmed' && 'Confirmed'}
          {activeFilter === 'pending' && 'Pending'}
          {activeFilter === 'completed' && 'Completed'}
          {activeFilter === 'cancelled' && 'Cancelled'}
          {activeFilter === 'no_show' && 'Missed'}
          {activeFilter === 'All' && 'All appointments'}
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
          // The live listener refreshes the list itself.
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
