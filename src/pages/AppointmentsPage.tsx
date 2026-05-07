import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../hooks/useAuth';
import { usePermissions } from '../hooks/usePermissions';
import { getDoctorAppointments } from '../services/appointmentService';
import { Appointment } from '../types';
import { AppointmentList } from '../components/appointments/AppointmentList';
import { AppointmentDetails } from '../components/appointments/AppointmentDetails';
import { CreateAppointmentModal } from '../components/appointments/CreateAppointmentModal';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { customColors } from '../lib/customColors';
type FilterType = Appointment['status'] | 'All' | 'Today';
export const AppointmentsPage: React.FC = () => {
  const { user } = useAuth();
  const { can } = usePermissions();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [filterStatus, setFilterStatus] = useState<Appointment['status'] | 'All'>('All');
  const [selectedCard, setSelectedCard] = useState<FilterType | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

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
  };

  const handleReschedule = async (appointmentId: string, newDate: Date, newTime: string) => {
    setAppointments(prev =>
      prev.map(apt =>
        apt.id === appointmentId
          ? { ...apt, date: newDate, time: newTime, status: 'confirmed', updatedAt: new Date() }
          : apt
      )
    );
    // Reload appointments to ensure data is synced with database
    await fetchAppointments();
  };

  const stats = {
    total: appointments.length,
    confirmed: appointments.filter((a) => a.status === 'confirmed').length,
    pending: appointments.filter((a) => a.status === 'pending').length,
    completed: appointments.filter((a) => a.status === 'completed').length,
    cancelled: appointments.filter((a) => a.status === 'cancelled').length,
    today: appointments.filter((a) => {
      const today = new Date();
      const appointmentDate = new Date(a.date);
      return (
        appointmentDate.getFullYear() === today.getFullYear() &&
        appointmentDate.getMonth() === today.getMonth() &&
        appointmentDate.getDate() === today.getDate()
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
  let filteredAppointments: Appointment[] = [];
  if (selectedCard === 'Today') {
    const today = new Date();
    filteredAppointments = appointments.filter((a) => {
      const appointmentDate = new Date(a.date);
      return (
        appointmentDate.getFullYear() === today.getFullYear() &&
        appointmentDate.getMonth() === today.getMonth() &&
        appointmentDate.getDate() === today.getDate()
      );
    });
  } else if (selectedCard && selectedCard !== 'All') {
    filteredAppointments = appointments.filter((a) => a.status === selectedCard);
  } else if (selectedCard === 'All') {
    filteredAppointments = appointments;
  } else if ((filterStatus as string) === 'All') {
    filteredAppointments = appointments;
  } else {
    filteredAppointments = appointments.filter((a) => a.status === filterStatus);
  }
  return (
    <div className={`min-h-screen bg-[${customColors.backgroundLight}] p-6 max-w-7xl mx-auto`}>
      {}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-gray-900">Appointments</h1>
            <p className="mt-2 text-gray-600">Manage and view all patient appointments</p>
          </div>
          <div className="flex items-center gap-4">
            {can('manageAppointments') && (
              <button
                onClick={() => {
                  setShowCreateModal(true);
                }}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
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
      {}
      {!isLoading && !error && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
          {}
          <button
            onClick={() => handleCardClick('All')}
            className={`transition-all duration-300 transform hover:scale-105 ${
              selectedCard === 'All' ? 'ring-2 ring-blue-500 ring-offset-2' : ''
            }`}
          >
            <Card
              className={`cursor-pointer transition-all duration-300 ${
                selectedCard === 'All'
                  ? 'bg-blue-50 border-blue-300'
                  : 'hover:shadow-lg hover:border-gray-300'
              }`}
            >
              <CardContent className="pt-6">
                <p className={`text-xs font-medium ${
                  selectedCard === 'All' ? 'text-blue-700' : 'text-gray-600'
                }`}>
                  Total
                </p>
                <p className={`text-2xl font-bold mt-1 ${
                  selectedCard === 'All' ? 'text-blue-700' : 'text-gray-900'
                }`}>
                  {stats.total}
                </p>
              </CardContent>
            </Card>
          </button>
          {}
          <button
            onClick={() => handleCardClick('confirmed')}
            className={`transition-all duration-300 transform hover:scale-105 ${
              selectedCard === 'confirmed' ? 'ring-2 ring-green-500 ring-offset-2' : ''
            }`}
          >
            <Card
              className={`cursor-pointer transition-all duration-300 ${
                selectedCard === 'confirmed'
                  ? 'bg-green-50 border-green-300'
                  : 'hover:shadow-lg hover:border-gray-300'
              }`}
            >
              <CardContent className="pt-6">
                <p className={`text-xs font-medium ${
                  selectedCard === 'confirmed' ? 'text-green-700' : 'text-gray-600'
                }`}>
                  Confirmed
                </p>
                <p className={`text-2xl font-bold mt-1 ${
                  selectedCard === 'confirmed' ? 'text-green-700' : 'text-green-600'
                }`}>
                  {stats.confirmed}
                </p>
              </CardContent>
            </Card>
          </button>
          {}
          <button
            onClick={() => handleCardClick('pending')}
            className={`transition-all duration-300 transform hover:scale-105 ${
              selectedCard === 'pending' ? 'ring-2 ring-yellow-500 ring-offset-2' : ''
            }`}
          >
            <Card
              className={`cursor-pointer transition-all duration-300 ${
                selectedCard === 'pending'
                  ? 'bg-yellow-50 border-yellow-300'
                  : 'hover:shadow-lg hover:border-gray-300'
              }`}
            >
              <CardContent className="pt-6">
                <p className={`text-xs font-medium ${
                  selectedCard === 'pending' ? 'text-yellow-700' : 'text-gray-600'
                }`}>
                  Pending
                </p>
                <p className={`text-2xl font-bold mt-1 ${
                  selectedCard === 'pending' ? 'text-yellow-700' : 'text-yellow-600'
                }`}>
                  {stats.pending}
                </p>
              </CardContent>
            </Card>
          </button>
          {}
          <button
            onClick={() => handleCardClick('completed')}
            className={`transition-all duration-300 transform hover:scale-105 ${
              selectedCard === 'completed' ? 'ring-2 ring-blue-500 ring-offset-2' : ''
            }`}
          >
            <Card
              className={`cursor-pointer transition-all duration-300 ${
                selectedCard === 'completed'
                  ? 'bg-blue-50 border-blue-300'
                  : 'hover:shadow-lg hover:border-gray-300'
              }`}
            >
              <CardContent className="pt-6">
                <p className={`text-xs font-medium ${
                  selectedCard === 'completed' ? 'text-blue-700' : 'text-gray-600'
                }`}>
                  Completed
                </p>
                <p className={`text-2xl font-bold mt-1 ${
                  selectedCard === 'completed' ? 'text-blue-700' : 'text-blue-600'
                }`}>
                  {stats.completed}
                </p>
              </CardContent>
            </Card>
          </button>
          {}
          <button
            onClick={() => handleCardClick('cancelled')}
            className={`transition-all duration-300 transform hover:scale-105 ${
              selectedCard === 'cancelled' ? 'ring-2 ring-red-500 ring-offset-2' : ''
            }`}
          >
            <Card
              className={`cursor-pointer transition-all duration-300 ${
                selectedCard === 'cancelled'
                  ? 'bg-red-50 border-red-300'
                  : 'hover:shadow-lg hover:border-gray-300'
              }`}
            >
              <CardContent className="pt-6">
                <p className={`text-xs font-medium ${
                  selectedCard === 'cancelled' ? 'text-red-700' : 'text-gray-600'
                }`}>
                  Cancelled
                </p>
                <p className={`text-2xl font-bold mt-1 ${
                  selectedCard === 'cancelled' ? 'text-red-700' : 'text-red-600'
                }`}>
                  {stats.cancelled}
                </p>
              </CardContent>
            </Card>
          </button>
          {}
          <button
            onClick={() => handleCardClick('Today')}
            className={`transition-all duration-300 transform hover:scale-105 ${
              selectedCard === 'Today' ? 'ring-2 ring-purple-500 ring-offset-2' : ''
            }`}
          >
            <Card
              className={`cursor-pointer transition-all duration-300 ${
                selectedCard === 'Today'
                  ? 'bg-purple-50 border-purple-300'
                  : 'hover:shadow-lg hover:border-gray-300'
              }`}
            >
              <CardContent className="pt-6">
                <p className={`text-xs font-medium ${
                  selectedCard === 'Today' ? 'text-purple-700' : 'text-gray-600'
                }`}>
                  Today
                </p>
                <p className={`text-2xl font-bold mt-1 ${
                  selectedCard === 'Today' ? 'text-purple-700' : 'text-blue-600'
                }`}>
                  {stats.today}
                </p>
              </CardContent>
            </Card>
          </button>
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
              {selectedCard === 'All' && 'All Appointments'}
            </CardTitle>
          </CardHeader>
        )}
        <CardContent>
          {}
          <div className="animate-fade-in">
            <AppointmentList
              appointments={filteredAppointments}
              onSelectAppointment={setSelectedAppointment}
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
          onEdit={() => {
          }}
          onStatusChange={handleStatusChange}
          onReschedule={handleReschedule}
        />
      )}

      <CreateAppointmentModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onAppointmentCreated={fetchAppointments}
      />
    </div>
  );
};
export default AppointmentsPage;
