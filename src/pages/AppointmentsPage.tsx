import React, { useMemo, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { getDoctorAppointments, updateAppointmentStatus, createAppointment } from '../services/appointmentService';
import { Appointment } from '../types';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { AppointmentList } from '../components/appointments/AppointmentList';
import { AppointmentDetailModal } from '../components/appointments/AppointmentDetailModal';
import { FilterBar, FilterOptions } from '../components/appointments/FilterBar';
import { getDailyAppointmentStats } from '../utils/appointmentHelpers';


export const AppointmentsPage: React.FC = () => {
  const { user } = useAuth();
  const [allAppointments, setAllAppointments] = useState<Appointment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [filters, setFilters] = useState<FilterOptions>({
    status: 'all',
    dateRange: 'all',
    searchTerm: '',
  });
  const [showCreateForm, setShowCreateForm] = useState(false);

  React.useEffect(() => {
    if (!user) return;

    const fetchAppointments = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const appointmentsData = await getDoctorAppointments(user.id);
        console.log(`[AppointmentsPage] ✓ Successfully loaded ${appointmentsData.length} unique appointments`);

        setAllAppointments(appointmentsData);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to load appointments';
        console.error('[AppointmentsPage] Error fetching appointments:', err);
        setError(errorMessage);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAppointments();
    const interval = setInterval(fetchAppointments, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [user]);

  const filteredAppointments = useMemo(() => {
    let result = [...allAppointments];

    console.log(`[AppointmentsPage] Filtering: ${allAppointments.length} total appointments`);

    if (filters.status !== 'all') {
      result = result.filter((a) => a.status === filters.status);
    }

    if (filters.dateRange !== 'all') {
      const now = new Date();
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      switch (filters.dateRange) {
        case 'today':
          result = result.filter((a) => {
            const appointmentDate = new Date(a.startTime);
            return appointmentDate >= startOfToday && appointmentDate < new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000);
          });
          break;

        case 'week':
          const weekEnd = new Date(startOfToday.getTime() + 7 * 24 * 60 * 60 * 1000);
          result = result.filter((a) => {
            const appointmentDate = new Date(a.startTime);
            return appointmentDate >= startOfToday && appointmentDate < weekEnd;
          });
          break;

        case 'month':
          const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
          result = result.filter((a) => {
            const appointmentDate = new Date(a.startTime);
            return appointmentDate >= startOfToday && appointmentDate <= monthEnd;
          });
          break;
      }
    }

    if (filters.searchTerm) {
      const searchLower = filters.searchTerm.toLowerCase();
      result = result.filter(
        (a) =>
          a.title.toLowerCase().includes(searchLower) ||
          a.patientId.toLowerCase().includes(searchLower) ||
          a.description?.toLowerCase().includes(searchLower)
      );
    }

    const uniqueKeys = new Set(result.map((a) => `${a.patientId}:${a.id}`));
    if (uniqueKeys.size !== result.length) {
      console.warn(
        `[AppointmentsPage] WARNING: Duplicate appointments detected! Total: ${result.length}, Unique: ${uniqueKeys.size}`
      );
      result.forEach((apt) => {
        const key = `${apt.patientId}:${apt.id}`;
        const count = result.filter((a) => `${a.patientId}:${a.id}` === key).length;
        if (count > 1) {
          console.warn(`  - Duplicate: ${key} appears ${count} times`);
        }
      });
    }
    console.log(`[AppointmentsPage] Filtered result: ${result.length} appointments`);

    return result;
  }, [allAppointments, filters]);

  const stats = useMemo(() => {
    return {
      total: allAppointments.length,
      filtered: filteredAppointments.length,
      pending: allAppointments.filter((a) => a.status === 'scheduled' || a.status === 'confirmed').length,
      completed: allAppointments.filter((a) => a.status === 'completed').length,
      cancelled: allAppointments.filter((a) => a.status === 'cancelled').length,
      ...getDailyAppointmentStats(allAppointments),
    };
  }, [allAppointments, filteredAppointments]);

  const handleStatusUpdate = async (patientId: string, appointmentId: string, newStatus: Appointment['status']) => {
    try {
      setIsUpdatingStatus(true);

      const appointmentIndex = allAppointments.findIndex((a) => a.id === appointmentId);
      if (appointmentIndex === -1) throw new Error('Appointment not found');

      await updateAppointmentStatus(patientId, appointmentId, newStatus);

      const updatedAppointments = [...allAppointments];
      updatedAppointments[appointmentIndex] = {
        ...updatedAppointments[appointmentIndex],
        status: newStatus,
        updatedAt: new Date(),
      };
      setAllAppointments(updatedAppointments);

      if (selectedAppointment?.id === appointmentId) {
        setSelectedAppointment({
          ...selectedAppointment,
          status: newStatus,
          updatedAt: new Date(),
        });
      }

      console.log(`✓ Status updated to ${newStatus}`);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update appointment status';
      console.error('Error updating appointment:', err);
      throw new Error(errorMessage);
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const today = new Date();
  const todayDateString = today.toDateString();

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-gray-900">Appointments</h1>
        <p className="mt-2 text-gray-600">Manage and monitor all patient appointments</p>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-800 font-medium">✕ {error}</p>
          <button
            onClick={() => setError(null)}
            className="mt-2 text-sm text-red-600 hover:text-red-700 underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {!isLoading && !error && (
        <FilterBar
          onFilterChange={setFilters}
          appointmentCount={stats.total}
          filteredCount={stats.filtered}
        />
      )}

      {!isLoading && !error && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
          <Card>
            <CardContent className="pt-6">
              <p className="text-gray-600 text-sm font-medium">Total</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">{stats.total}</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <p className="text-gray-600 text-sm font-medium">Pending</p>
              <p className="text-3xl font-bold text-yellow-600 mt-2">{stats.pending}</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <p className="text-gray-600 text-sm font-medium">Completed</p>
              <p className="text-3xl font-bold text-green-600 mt-2">{stats.completed}</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <p className="text-gray-600 text-sm font-medium">Cancelled</p>
              <p className="text-3xl font-bold text-red-600 mt-2">{stats.cancelled}</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <p className="text-gray-600 text-sm font-medium">Today</p>
              <p className="text-3xl font-bold text-blue-600 mt-2">{stats.todayCount}</p>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>
                {filters.dateRange === 'today'
                  ? "Today's Appointments"
                  : 'All Appointments'}
              </CardTitle>
              <p className="text-sm text-gray-600 mt-1">
                {stats.filtered} of {stats.total} appointments
              </p>
            </CardHeader>
            <CardContent>
              <AppointmentList
                appointments={filteredAppointments}
                onAppointmentClick={setSelectedAppointment}
                isLoading={isLoading}
                emptyMessage={
                  stats.total === 0
                    ? 'No appointments scheduled'
                    : 'No appointments match your filters'
                }
              />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <button
                onClick={() => setShowCreateForm(!showCreateForm)}
                className="w-full px-4 py-2 bg-anixi-green text-white font-medium rounded-lg hover:bg-anixi-green hover:opacity-90 transition-colors"
              >
                {showCreateForm ? '✕ Cancel' : '+ New Appointment'}
              </button>
              <button
                onClick={() => setFilters({ ...filters, dateRange: 'today' })}
                className="w-full px-4 py-2 bg-gray-100 text-gray-900 font-medium rounded-lg hover:bg-gray-200 transition-colors"
              >
                Today's Appointments
              </button>
              <button
                onClick={() => setFilters({ ...filters, dateRange: 'week' })}
                className="w-full px-4 py-2 bg-gray-100 text-gray-900 font-medium rounded-lg hover:bg-gray-200 transition-colors"
              >
                This Week
              </button>
              <button
                onClick={() => setFilters({ status: 'completed', dateRange: 'all', searchTerm: '' })}
                className="w-full px-4 py-2 bg-gray-100 text-gray-900 font-medium rounded-lg hover:bg-gray-200 transition-colors"
              >
                Completed Appointments
              </button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between">
                <span className="text-gray-600 text-sm">Total Appointments</span>
                <span className="font-semibold text-gray-900">{stats.total}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 text-sm">This Month</span>
                <span className="font-semibold text-gray-900">{stats.monthCount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 text-sm">This Week</span>
                <span className="font-semibold text-gray-900">{stats.weekCount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 text-sm">Today</span>
                <span className="font-semibold text-gray-900">{stats.todayCount}</span>
              </div>
              <hr className="my-2" />
              <div className="flex justify-between">
                <span className="text-yellow-600 text-sm font-medium">Pending</span>
                <span className="font-semibold text-yellow-600">{stats.pending}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-green-600 text-sm font-medium">Completed</span>
                <span className="font-semibold text-green-600">{stats.completed}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-red-600 text-sm font-medium">Cancelled</span>
                <span className="font-semibold text-red-600">{stats.cancelled}</span>
              </div>
            </CardContent>
          </Card>

          {stats.todayCount > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">🔔 Upcoming Today</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  {allAppointments
                    .filter((a) => new Date(a.startTime).toDateString() === todayDateString)
                    .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
                    .slice(0, 3)
                    .map((a) => (
                      <button
                        key={a.id}
                        onClick={() => setSelectedAppointment(a)}
                        className="w-full text-left p-2 bg-gray-50 hover:bg-blue-50 rounded border border-gray-200 hover:border-blue-300 transition-colors"
                      >
                        <p className="font-medium text-gray-900">{a.title}</p>
                        <p className="text-xs text-gray-600">
                          🕐 {new Date(a.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </button>
                    ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {selectedAppointment && (
        <AppointmentDetailModal
          appointment={selectedAppointment}
          onClose={() => setSelectedAppointment(null)}
          onStatusUpdate={handleStatusUpdate}
          isUpdating={isUpdatingStatus}
        />
      )}

      {showCreateForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Create New Appointment</h3>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
              <p className="text-sm text-blue-900">
                ℹ️ Create appointment functionality can be extended to include form fields and validation.
              </p>
            </div>
            <button
              onClick={() => setShowCreateForm(false)}
              className="w-full px-4 py-2 bg-gray-300 text-gray-800 rounded-lg font-medium hover:bg-gray-400 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AppointmentsPage;
