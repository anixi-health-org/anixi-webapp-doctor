import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { usePermissions } from '../hooks/usePermissions';
import { getDoctorAppointments } from '../services/appointmentService';
import { Appointment } from '../types';
import { AppointmentList } from '../components/appointments/AppointmentList';
import { AppointmentDetails } from '../components/appointments/AppointmentDetails';
import { CreateAppointmentModal } from '../components/appointments/CreateAppointmentModal';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { DashboardStatsCard } from '../components/dashboard/DashboardStatsCard';
import { Toast } from '../components/ui';
import { customColors } from '../lib/customColors';
type FilterType = Appointment['status'] | 'All' | 'Today';
export const AppointmentsPage: React.FC = () => {
  const { user } = useAuth();
  const { can } = usePermissions();
  const navigate = useNavigate();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
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
  const handleStatusChange = (appointmentId: string, newStatus: Appointment['status']) => {
    setAppointments(prev =>
      prev.map(apt =>
        apt.id === appointmentId
          ? { ...apt, status: newStatus, updatedAt: new Date() }
          : apt
      )
    );
    const msg =
      newStatus === 'confirmed'
        ? 'Appointment accepted successfully.'
        : newStatus === 'cancelled'
        ? 'Appointment cancelled successfully.'
        : newStatus === 'no_show'
        ? 'Appointment marked as no-show.'
        : `Appointment updated to ${newStatus}.`;
    setToast({ visible: true, message: msg, type: 'success' });
  };

  const handleReschedule = async (appointmentId: string, newDate: Date, newTime: string) => {
    setAppointments(prev =>
      prev.map(apt =>
        apt.id === appointmentId
          ? { ...apt, date: newDate, time: newTime, status: 'confirmed', updatedAt: new Date() }
          : apt
      )
    );
    
    await fetchAppointments();
    setToast({ visible: true, message: 'Appointment rescheduled successfully.', type: 'success' });
  };

  /** Spec §10: Anixi appointment → Patient Profile; Manual → AppointmentDetails */
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
  };

  const stats = {
    // Exclude cancelled and completed appointments from the default "total"/overview counts
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
  // By default hide cancelled and completed appointments. Only show them when user selects their respective cards.
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
  return (
    <div
      className="min-h-screen max-w-7xl mx-auto px-3 py-4 sm:px-4 sm:py-6 lg:px-6"
      style={{ backgroundColor: customColors.backgroundLight }}
    >
      {toast.visible && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast({ visible: false, message: '', type: 'success' })}
        />
      )}
      {}
      <div className="mb-6 sm:mb-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900">Appointments</h1>
            <p className="mt-2 text-gray-600">Manage and view all patient appointments</p>
          </div>
          <div className="flex items-center gap-3 sm:gap-4">
            {can('manageAppointments') && (
              <button
                onClick={() => {
                  setShowCreateModal(true);
                }}
                className="w-full sm:w-auto px-4 py-2 rounded-lg text-white transition-colors flex items-center justify-center gap-2 shadow-sm"
                style={{
                  backgroundColor: customColors.primary,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = customColors.primaryDark;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = customColors.primary;
                }}
              >
                ➕ New Appointment
              </button>
            )}
          </div>
        </div>
      </div>
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
      {/* Booking Requests Inbox — §7 Path 1: pending patient-requested appointments */}
      {!isLoading && (() => {
        const requests = appointments.filter((a) => a.status === 'pending' && !a.isManual);
        if (requests.length === 0) return null;
        return (
          <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-lg">📬</span>
              <h2 className="text-base font-semibold text-amber-800">Booking Requests ({requests.length})</h2>
              <span className="text-xs text-amber-600 font-normal ml-1">Awaiting confirmation</span>
            </div>
            <div className="space-y-2">
              {requests.map((req) => (
                <div
                  key={req.id}
                  className="flex items-center justify-between gap-3 bg-white rounded-lg border border-amber-100 px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{req.patientName}</p>
                    <p className="text-xs text-gray-500 truncate">
                      {new Date(req.date).toLocaleDateString('en-ZA', { weekday: 'short', month: 'short', day: 'numeric' })}
                      {' · '}{req.time}
                      {req.consultType && ` · ${req.consultType}`}
                    </p>
                  </div>
                  <button
                    onClick={() => setSelectedAppointment(req)}
                    className="shrink-0 px-3 py-1.5 text-xs font-semibold rounded-lg bg-amber-100 text-amber-800 hover:bg-amber-200 transition-colors"
                  >
                    Review
                  </button>
                </div>
              ))}
            </div>
          </div>
        );
      })()}
      {}
      {!isLoading && !error && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-6 gap-3 mb-6">
          <DashboardStatsCard label="Total" value={stats.total} icon={'📋'} color="blue" onClick={() => handleCardClick('All')} isActive={selectedCard === 'All'} />
          <DashboardStatsCard label="Confirmed" value={stats.confirmed} icon={'✅'} color="green" onClick={() => handleCardClick('confirmed')} isActive={selectedCard === 'confirmed'} />
          <DashboardStatsCard label="Pending" value={stats.pending} icon={'⏳'} color="orange" onClick={() => handleCardClick('pending')} isActive={selectedCard === 'pending'} />
          <DashboardStatsCard label="Completed" value={stats.completed} icon={'✓'} color="blue" onClick={() => handleCardClick('completed')} isActive={selectedCard === 'completed'} />
          <DashboardStatsCard label="Cancelled" value={stats.cancelled} icon={'✗'} color="red" onClick={() => handleCardClick('cancelled')} isActive={selectedCard === 'cancelled'} />
          <DashboardStatsCard label="Today" value={stats.today} icon={'📅'} color="blue" onClick={() => handleCardClick('Today')} isActive={selectedCard === 'Today'} />
        </div>
      )}
      {}
      <Card className="transition-all duration-300">
        {selectedCard && (
          <CardHeader>
            <CardTitle>
              {selectedCard === 'Today' && '📅 Today\'s Appointments'}
              {selectedCard === 'confirmed' && '✅ Confirmed Appointments'}
              {selectedCard === 'pending' && '⏳ Pending Appointments'}
              {selectedCard === 'completed' && '✓ Completed Appointments'}
              {selectedCard === 'cancelled' && '✗ Cancelled Appointments'}
              {/* No-Show filter removed */}
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
      {selectedAppointment && (
        <AppointmentDetails
          appointment={selectedAppointment}
          onClose={() => setSelectedAppointment(null)}
          onStatusChange={handleStatusChange}
          onReschedule={handleReschedule}
        />
      )}

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
    </div>
  );
};
export default AppointmentsPage;
