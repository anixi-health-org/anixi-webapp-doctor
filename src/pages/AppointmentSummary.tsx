import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { getAppointmentById, getDoctorAppointments, updateAppointment } from '../services/appointmentService';
import { useAuth } from '../hooks/useAuth';
import { Appointment } from '../types';
import ManageAppointmentModal from '../components/appointments/ManageAppointmentModal';

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

  if (isLoading) return <div className="p-6">Loading…</div>;
  if (error) return <div className="p-6 text-red-600">{error}</div>;
  if (!appointment) return <div className="p-6">Appointment not found.</div>;

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

  return (
    <div className="bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="relative mb-6">
          <button
            onClick={() => navigate('/appointments')}
            className="absolute left-0 inline-flex h-11 w-11 items-center justify-center rounded-full border border-border bg-card text-2xl text-foreground"
            aria-label="Back"
          >
            ←
          </button>
          <h1 className="text-3xl font-bold text-[#0E2340] text-center">Appointment Summary</h1>
        </div>

        <div className="rounded-[30px] border border-[#D8DEE5] bg-white shadow-sm p-6 space-y-6">
          <div className="grid grid-cols-1 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Patient / contact</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-semibold">{appointment.patientName}</p>
            <p className="text-sm text-gray-600 mt-1">{appointment.patientEmail || 'Not provided'}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Appointment</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-2">
              <div>
                <div className="text-sm text-gray-500">Date</div>
                <div className="font-semibold">{appointment.date.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })}</div>
              </div>
              <div>
                <div className="text-sm text-gray-500">Time</div>
                <div className="font-semibold">{appointment.time}</div>
              </div>
              <div>
                <div className="text-sm text-gray-500">Type</div>
                <div className="font-semibold">{appointment.type}</div>
              </div>
              <div>
                <div className="text-sm text-gray-500">Status</div>
                <div className="mt-1">
                  <span className="px-2 py-1 rounded-full text-xs font-medium border bg-gray-50">{appointment.status}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
          </div>

          <div className="mt-2">
            <div className="flex flex-col md:flex-row gap-3">
              <button
                onClick={() => navigate(`/appointments/${appointment.id}/post-consult`, { state: { appointment } })}
                className="w-full md:w-auto bg-[#06A66A] hover:bg-[#099760] text-white px-4 py-3 rounded-2xl font-semibold"
              >
                Start Consultation
              </button>
              <button
                onClick={() => setShowManage(true)}
                className="w-full md:w-auto border px-4 py-3 rounded-2xl font-semibold"
              >
                Manage Appointment
              </button>
              <button
                onClick={markCompleted}
                disabled={loadingComplete || appointment.status === 'completed'}
                className="w-full md:w-auto bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-3 rounded-2xl font-semibold disabled:opacity-50"
              >
                COMPLETED
              </button>
            </div>
          </div>
        </div>

        {showManage && (
          <ManageAppointmentModal
            appointment={appointment}
            onClose={() => setShowManage(false)}
            onUpdated={onUpdated}
          />
        )}
      </div>
    </div>
  );
};

export default AppointmentSummary;
