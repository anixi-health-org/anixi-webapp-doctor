import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { usePermissions } from '../hooks/usePermissions';
import { getDoctorAppointments } from '../services/appointmentService';
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
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { DashboardStatsCard } from '../components/dashboard/DashboardStatsCard';
import { Toast, AppointmentsPageSkeleton } from '../components/ui';
import { PageHeader, PageShell } from '../components/page-layout';
import { PrimaryButton } from '../components/ui/PrimaryButton';
type FilterType = Appointment['status'] | 'All' | 'Today';
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

  const fetchAppointments = useCallback(async () => {
    if (!user?.id) return;
    try {
      setIsLoading(true);
      setError(null);
      const data = await getDoctorAppointments(user.id);
      setAppointments(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load appointments';
      ;
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchAppointments();
  }, [fetchAppointments]);

  const handleAppointmentClick = (apt: Appointment) => {
    const isAnixiPatient = !apt.isManual && apt.patientId && apt.patientId !== 'manual' && apt.patientId !== 'unknown';
    if (isAnixiPatient) {
      navigate(`/patient-profile/${apt.patientId}`, {
        state: {
          appointmentId: apt.id,
          appointmentTime: apt.time,
          appointmentDate: apt.date ? new Date(apt.date).toLocaleDateString() : undefined,
          consultType: apt.consultType,
          status: apt.status,
        },
      });
    } else {
      setSelectedAppointment(apt);
    }

    navigate(`/appointments/${apt.id}`, { state: { appointment: apt } });
  };

  const stats = {

    total: appointments.filter((a) => a.status !== 'cancelled' && a.status !== 'completed').length,
    confirmed: appointments.filter((a) => a.status === 'confirmed').length,
    pending: appointments.filter((a) => a.status === 'pending').length,
    completed: appointments.filter((a) => a.status === 'completed').length,
    cancelled: appointments.filter((a) => a.status === 'cancelled').length,
    noShow: appointments.filter((a) => a.status === 'no_show').length,
    today: appointments.filter((a) => {
      const today = new Date();
      const appointmentDate = new Date(a.date);
      return (
        appointmentDate.getFullYear() === today.getFullYear() &&
        appointmentDate.getMonth() === today.getMonth() &&
        appointmentDate.getDate() === today.getDate() &&
        a.status !== 'cancelled' &&
        a.status !== 'completed'
      );
    }).length,
  };
  const handleCardClick = (card: FilterType) => {
    setSelectedCard(card);
    if (card === 'All') {
      setFilterStatus('All');
    } else if (card === 'Today') {
      setFilterStatus('All');
    } else {
      setFilterStatus(card as Appointment['status']);
    }
  };

  const baseAppointments =
    selectedCard === 'cancelled' || selectedCard === 'completed'
      ? appointments
      : appointments.filter((a) => a.status !== 'cancelled' && a.status !== 'completed');
  let filteredAppointments: Appointment[] = [];
  if (selectedCard === 'Today') {
    const today = new Date();
    filteredAppointments = baseAppointments.filter((a) => {
      const appointmentDate = new Date(a.date);
      return (
        appointmentDate.getFullYear() === today.getFullYear() &&
        appointmentDate.getMonth() === today.getMonth() &&
        appointmentDate.getDate() === today.getDate()
      );
    });
  } else if (selectedCard && selectedCard !== 'All') {
    filteredAppointments = baseAppointments.filter((a) => a.status === selectedCard);
  } else if (selectedCard === 'All') {
    filteredAppointments = baseAppointments;
  } else if ((filterStatus as string) === 'All') {
    filteredAppointments = baseAppointments;
  } else {
    filteredAppointments = baseAppointments.filter((a) => a.status === filterStatus);
  }

  if (isLoading && appointments.length === 0) {
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
            <PrimaryButton onClick={() => setShowCreateModal(true)} icon={<span className="text-lg leading-none">+</span>}>
              New Appointment
            </PrimaryButton>
          ) : undefined
        }
      />
      {}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-800 font-medium">⚠️ {error}</p>
          <button
            onClick={() => setError(null)}
            className="mt-2 text-sm text-red-600 hover:text-red-700 underline"
          >
            Dismiss
          </button>
        </div>
      )}
      {!isLoading && !error && (
        <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
          <DashboardStatsCard label="Total" value={stats.total} icon={<ClipboardList />} color="blue" onClick={() => handleCardClick('All')} isActive={selectedCard === 'All'} />
          <DashboardStatsCard label="Confirmed" value={stats.confirmed} icon={<CheckCircle2 />} color="green" onClick={() => handleCardClick('confirmed')} isActive={selectedCard === 'confirmed'} />
          <DashboardStatsCard label="Pending" value={stats.pending} icon={<Clock />} color="orange" onClick={() => handleCardClick('pending')} isActive={selectedCard === 'pending'} />
          <DashboardStatsCard label="Completed" value={stats.completed} icon={<CheckCircle2 />} color="blue" onClick={() => handleCardClick('completed')} isActive={selectedCard === 'completed'} />
          <DashboardStatsCard label="Cancelled" value={stats.cancelled} icon={<XCircle />} color="red" onClick={() => handleCardClick('cancelled')} isActive={selectedCard === 'cancelled'} />
          <DashboardStatsCard label="Today" value={stats.today} icon={<Calendar />} color="blue" onClick={() => handleCardClick('Today')} isActive={selectedCard === 'Today'} />
        </div>
      )}
      {}
      <Card className="transition-all duration-300">
        {selectedCard && (
          <CardHeader>
            <CardTitle>
              {selectedCard === 'Today' && "Today's Appointments"}
              {selectedCard === 'confirmed' && 'Confirmed Appointments'}
              {selectedCard === 'pending' && 'Pending Appointments'}
              {selectedCard === 'completed' && 'Completed Appointments'}
              {selectedCard === 'cancelled' && 'Cancelled Appointments'}
              {selectedCard === 'All' && 'All Appointments'}
            </CardTitle>
          </CardHeader>
        )}
        <CardContent>
          {}
          <div className="animate-fade-in">
            <AppointmentList
              appointments={filteredAppointments}
              onSelectAppointment={handleAppointmentClick}
              isLoading={isLoading}
            />
          </div>
        </CardContent>
      </Card>
      {}
      

      <CreateAppointmentModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onAppointmentCreated={async (message?: string) => {
          await fetchAppointments();
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
