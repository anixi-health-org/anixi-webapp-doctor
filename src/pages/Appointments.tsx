import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { useAuth } from '../hooks/useAuth';
import { getDoctorAppointments } from '../services/appointmentService';
import { Appointment, getAppointmentUniqueKey } from '../types';

export const Appointments: React.FC = () => {
  const { user } = useAuth();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);

  React.useEffect(() => {
    const fetchAppointments = async () => {
      if (!user) return;
      
      setIsLoading(true);
      try {
        const appointmentsData = await getDoctorAppointments(user.id);
        setAppointments(appointmentsData);
      } catch (error) {
        console.error('Failed to fetch appointments:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAppointments();
  }, [user]);

  const todayAppointments = useMemo(() => {
    return appointments.filter(a => 
      new Date(a.startTime).toDateString() === new Date().toDateString()
    );
  }, [appointments]);

  const upcomingAppointments = useMemo(() => {
    return appointments.filter(a => 
      new Date(a.startTime) > new Date()
    );
  }, [appointments]);

  return (
    <div className="p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Appointments</h1>
        <p className="mt-2 text-gray-600">Manage your patient appointments</p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Today's Appointments</CardTitle>
              </CardHeader>
              <CardContent>
                {todayAppointments.length === 0 ? (
                  <p className="text-gray-500">No appointments today</p>
                ) : (
                  <div className="space-y-3">
                    {todayAppointments.map((appointment) => (
                      <div key={getAppointmentUniqueKey(appointment.patientId, appointment.id)} className="border-l-4 border-blue-500 pl-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="font-medium">{appointment.title}</h4>
                            <p className="text-sm text-gray-600">{appointment.patientId}</p>
                          </div>
                          <span className={`px-2 py-1 text-xs rounded-full ${
                            appointment.status === 'confirmed' ? 'bg-green-100 text-green-800' :
                            appointment.status === 'scheduled' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {appointment.status}
                          </span>
                        </div>
                        <p className="text-sm text-gray-500">
                          {new Date(appointment.startTime).toLocaleTimeString()} - {new Date(appointment.endTime).toLocaleTimeString()}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Upcoming Appointments</CardTitle>
              </CardHeader>
              <CardContent>
                {upcomingAppointments.length === 0 ? (
                  <p className="text-gray-500">No upcoming appointments</p>
                ) : (
                  <div className="space-y-3">
                    {upcomingAppointments.slice(0, 5).map((appointment) => (
                      <div key={appointment.id} className="border-l-4 border-blue-500 pl-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="font-medium">{appointment.title}</h4>
                            <p className="text-sm text-gray-600">{appointment.patientId}</p>
                          </div>
                          <span className={`px-2 py-1 text-xs rounded-full ${
                            appointment.status === 'confirmed' ? 'bg-green-100 text-green-800' :
                            appointment.status === 'scheduled' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {appointment.status}
                          </span>
                        </div>
                        <p className="text-sm text-gray-500">
                          {new Date(appointment.startTime).toLocaleDateString()} at {new Date(appointment.startTime).toLocaleTimeString()}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Quick Actions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <button 
                    onClick={() => setShowCreateForm(!showCreateForm)}
                    className="w-full bg-anixi-green text-white font-medium rounded-md hover:bg-anixi-green hover:opacity-90 px-4 py-2"
                  >
                    {showCreateForm ? 'Cancel' : 'New Appointment'}
                  </button>
                  <button className="w-full bg-gray-200 text-gray-800 font-medium rounded-md hover:bg-gray-300 px-4 py-2">
                    View Calendar
                  </button>
                  <button className="w-full bg-gray-200 text-gray-800 font-medium rounded-md hover:bg-gray-300 px-4 py-2">
                    Appointment History
                  </button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Total Today</span>
                    <span className="text-sm font-medium">{appointments.filter(a => 
                      new Date(a.startTime).toDateString() === new Date().toDateString()
                    ).length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">This Week</span>
                    <span className="text-sm font-medium">{appointments.filter(a => {
                      const appointmentDate = new Date(a.startTime);
                      const today = new Date();
                      const weekStart = new Date(today.setDate(today.getDate() - today.getDay()));
                      const weekEnd = new Date(today.setDate(today.getDate() - today.getDay() + 6));
                      return appointmentDate >= weekStart && appointmentDate <= weekEnd;
                    }).length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Pending</span>
                    <span className="text-sm font-medium">{appointments.filter(a => 
                      a.status === 'scheduled'
                    ).length}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {showCreateForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-medium mb-4">Create New Appointment</h3>
            <form className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                <input type="text" className="w-full px-3 py-2 border border-gray-300 rounded-md" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Patient</label>
                <select className="w-full px-3 py-2 border border-gray-300 rounded-md">
                  <option value="">Select patient</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                <input type="date" className="w-full px-3 py-2 border border-gray-300 rounded-md" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Time</label>
                <input type="time" className="w-full px-3 py-2 border border-gray-300 rounded-md" />
              </div>
              <div className="flex space-x-3">
                <button type="submit" className="flex-1 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 px-4 py-2">
                  Create
                </button>
                <button 
                  type="button" 
                  onClick={() => setShowCreateForm(false)}
                  className="flex-1 bg-gray-200 text-gray-800 font-medium rounded-md hover:bg-gray-300 px-4 py-2"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
