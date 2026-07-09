import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeftIcon, CalendarDaysIcon, PlusIcon } from '@heroicons/react/24/outline';
import { AppointmentContextBanner } from '../components/patients/AppointmentContextBanner';
import { PatientCareQuickLinks } from '../components/patients/PatientCareQuickLinks';
import { PatientProfileIdentityCard, usePatientHealthSnapshot } from '../components/patients/PatientProfileIdentityCard';
import { recordPatientVisit } from '../services/recentPatientsService';
import { logPatientActivity } from '../services/patientActivityService';
import { getPatientAppointments } from '../services/appointmentService';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { AppointmentDetails } from '../components/appointments/AppointmentDetails';
import { AppointmentList } from '../components/appointments/AppointmentList';
import { useAuth } from '../hooks/useAuth';
import { getDoctorPatients } from '../services/doctorService';
import { Appointment, Patient } from '../types';
import { updatePatient } from '../services/patientManagementService';
import { CreateAppointmentModal } from '../components/appointments/CreateAppointmentModal';
import { EditPatientModal } from '../components/patients/EditPatientModal';
import { convertTimestamp } from '../utils/dateFormatter';
import { formatName } from '../utils/dataFormatter';

export const PatientProfile: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { patientId } = useParams<{ patientId: string }>();
  const { user } = useAuth();

  const contextState = (location.state ?? {}) as {
    appointmentId?: string;
    appointmentTime?: string;
    appointmentDate?: string;
    consultType?: string;
    status?: string;
  };
  const appointmentContextId =
    typeof contextState.appointmentId === 'string' && contextState.appointmentId.length > 0
      ? contextState.appointmentId
      : undefined;

  const [patient, setPatient] = useState<Patient | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showFollowUpModal, setShowFollowUpModal] = useState(false);
  const [patientAppointments, setPatientAppointments] = useState<Appointment[]>([]);
  const [appointmentsLoading, setAppointmentsLoading] = useState(false);
  const [appointmentsError, setAppointmentsError] = useState<string | null>(null);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [showEditPatientModal, setShowEditPatientModal] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const logActivity = (
    actionType: string,
    description: string,
    metadata?: Record<string, string | number | boolean | null | undefined>
  ) => {
    if (!user?.id || !patient?.id) return;
    void logPatientActivity({
      doctorId: user.id,
      patientId: patient.id,
      appointmentId: appointmentContextId,
      actionType,
      description,
      metadata: {
        contextStatus: contextState.status,
        contextConsultType: contextState.consultType,
        contextAppointmentDate: contextState.appointmentDate,
        contextAppointmentTime: contextState.appointmentTime,
        ...(metadata || {}),
      },
    });
  };

  const handlePatientUpdate = async (updates: Partial<Patient>) => {
    if (!user?.id || !patient?.id) return;
    try {
      setActionError(null);
      await updatePatient(patient.id, updates);
      setPatient({ ...patient, ...updates });
      setActionSuccess('Patient details updated successfully.');
    } catch (error: any) {
      setActionError(error?.message || 'Failed to update patient');
    }
  };

  useEffect(() => {
    const fetchPatient = async () => {
      if (!user || !patientId) {
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setError(null);
        const patients = await getDoctorPatients(user.id);
        const foundPatient = patients.find((p) => p.id === patientId);
        if (!foundPatient) {
          setError('Patient not found');
          return;
        }
        setPatient(foundPatient);
        recordPatientVisit(
          foundPatient.id,
          foundPatient.displayName || foundPatient.email || foundPatient.id,
          foundPatient.email
        );
      } catch {
        setError('Failed to load patient profile');
      } finally {
        setIsLoading(false);
      }
    };

    fetchPatient();
  }, [user, patientId]);

  useEffect(() => {
    const loadAppointments = async () => {
      if (!patient?.id) {
        setPatientAppointments([]);
        return;
      }

      try {
        setAppointmentsLoading(true);
        setAppointmentsError(null);
        const appointments = await getPatientAppointments(patient.id);
        setPatientAppointments(appointments);
      } catch {
        setAppointmentsError('Failed to load appointments for this patient');
      } finally {
        setAppointmentsLoading(false);
      }
    };

    loadAppointments();
  }, [patient?.id]);

  useEffect(() => {
    if (!user?.id || !patient?.id) return;
    void logPatientActivity({
      doctorId: user.id,
      patientId: patient.id,
      appointmentId: appointmentContextId,
      actionType: 'open_patient_context',
      description: appointmentContextId
        ? 'Opened patient profile from appointment context.'
        : 'Opened patient profile without appointment context.',
      metadata: {
        contextStatus: contextState.status,
        contextConsultType: contextState.consultType,
        contextAppointmentDate: contextState.appointmentDate,
        contextAppointmentTime: contextState.appointmentTime,
      },
    });
  }, [
    user?.id,
    patient?.id,
    appointmentContextId,
    contextState.status,
    contextState.consultType,
    contextState.appointmentDate,
    contextState.appointmentTime,
  ]);

  const refreshPatientAppointments = async () => {
    if (!patient?.id) return;
    try {
      setAppointmentsLoading(true);
      setAppointmentsError(null);
      const appointments = await getPatientAppointments(patient.id);
      setPatientAppointments(appointments);
    } catch {
      setAppointmentsError('Failed to refresh appointments');
    } finally {
      setAppointmentsLoading(false);
    }
  };

  const handleAppointmentStatusChange = (appointmentId: string, newStatus: Appointment['status']) => {
    setPatientAppointments((prev) =>
      prev.map((appointment) =>
        appointment.id === appointmentId
          ? { ...appointment, status: newStatus, updatedAt: new Date() }
          : appointment
      )
    );
  };

  const handleAppointmentReschedule = async (
    appointmentId: string,
    newDate: Date,
    newTime: string
  ) => {
    setPatientAppointments((prev) =>
      prev.map((appointment) =>
        appointment.id === appointmentId
          ? { ...appointment, date: newDate, time: newTime, status: 'confirmed', updatedAt: new Date() }
          : appointment
      )
    );
    await refreshPatientAppointments();
  };

  const { snapshot: healthSnapshot, loading: snapshotLoading } = usePatientHealthSnapshot(
    patient?.id,
    user?.id
  );

  const appointmentStats = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const upcoming = patientAppointments.filter((apt) => {
      const date = convertTimestamp(apt.date) ?? new Date();
      const day = new Date(date);
      day.setHours(0, 0, 0, 0);
      return (
        day >= today &&
        (apt.status === 'confirmed' || apt.status === 'pending')
      );
    });

    const completed = patientAppointments.filter((apt) => apt.status === 'completed');

    const nextAppointment = [...upcoming].sort((a, b) => {
      const aDate = convertTimestamp(a.date)?.getTime() ?? 0;
      const bDate = convertTimestamp(b.date)?.getTime() ?? 0;
      return aDate - bDate;
    })[0];

    return {
      total: patientAppointments.length,
      upcoming: upcoming.length,
      completed: completed.length,
      nextAppointment,
    };
  }, [patientAppointments]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="text-lg text-gray-600">Loading patient profile...</div>
          <div className="mt-2 text-sm text-gray-500">Please wait</div>
        </div>
      </div>
    );
  }

  if (error || !patient) {
    return (
      <div className="px-3 py-4 sm:px-4 sm:py-6 bg-anixi-beige min-h-screen">
        <button
          onClick={() => navigate('/patients')}
          className="mb-4 px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg transition-colors"
        >
          ← Back
        </button>
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <h3 className="text-lg font-semibold text-red-900">Error</h3>
          <p className="text-red-700 mt-1">{error || 'Patient not found'}</p>
        </div>
      </div>
    );
  }

  const formattedName = formatName(patient.displayName);

  const openFollowUp = () => {
    logActivity('open_follow_up_modal', 'Opened follow-up booking from patient profile.');
    setShowFollowUpModal(true);
  };

  return (
    <div className="min-h-screen bg-anixi-beige px-4 py-6 sm:px-6 lg:px-8">
      <AppointmentContextBanner />

      <div className="mx-auto max-w-7xl">
        <button
          type="button"
          onClick={() => navigate('/patients')}
          className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-gray-600 transition-colors hover:text-anixi-green"
        >
          <ArrowLeftIcon className="h-4 w-4" />
          Back to patients
        </button>

        {actionSuccess && (
          <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
            {actionSuccess}
          </div>
        )}
        {actionError && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {actionError}
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:items-start">
          <div className="lg:col-span-5 xl:col-span-4 lg:sticky lg:top-6">
            <PatientProfileIdentityCard
              patient={patient}
              onEdit={() => setShowEditPatientModal(true)}
              onViewAllDetails={() => navigate(`/patient-profile/${patient.id}/details`)}
              upcomingAppointments={appointmentStats.upcoming}
              healthSnapshot={healthSnapshot}
              snapshotLoading={snapshotLoading}
            />
          </div>

          <div className="space-y-6 lg:col-span-7 xl:col-span-8">
            <Card className="overflow-hidden border-gray-200 shadow-sm">
              <CardHeader className="flex flex-col gap-4 border-b border-gray-100 bg-white sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2 font-heading text-xl">
                    <CalendarDaysIcon className="h-5 w-5 text-anixi-green" />
                    Appointment management
                  </CardTitle>
                  <p className="mt-1 text-sm text-gray-500">
                    Schedule and review visits for {formattedName || 'this patient'}.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={openFollowUp}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-anixi-green px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
                >
                  <PlusIcon className="h-4 w-4" />
                  New appointment
                </button>
              </CardHeader>

              <CardContent className="space-y-4 p-4 sm:p-5">
                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-center">
                    <p className="text-lg font-bold text-sky-900">{appointmentStats.upcoming}</p>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-sky-700">
                      Upcoming
                    </p>
                  </div>
                  <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-center">
                    <p className="text-lg font-bold text-gray-900">{appointmentStats.completed}</p>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                      Completed
                    </p>
                  </div>
                  <div className="rounded-lg border border-anixi-green/20 bg-anixi-green/5 px-3 py-2 text-center">
                    <p className="text-lg font-bold text-anixi-green">{appointmentStats.total}</p>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-anixi-green/80">
                      Total
                    </p>
                  </div>
                </div>

                {appointmentStats.nextAppointment && (
                  <button
                    type="button"
                    onClick={() => {
                      logActivity('open_appointment_details', 'Opened next appointment from patient profile.', {
                        selectedAppointmentId: appointmentStats.nextAppointment!.id,
                      });
                      setSelectedAppointment(appointmentStats.nextAppointment!);
                    }}
                    className="w-full rounded-xl border border-anixi-green/25 bg-gradient-to-r from-anixi-green/5 to-white p-4 text-left transition-shadow hover:shadow-md"
                  >
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-anixi-green">
                      Next appointment
                    </p>
                    <p className="mt-1 font-semibold text-gray-900">
                      {(convertTimestamp(appointmentStats.nextAppointment.date) ?? new Date()).toLocaleDateString(
                        'en-US',
                        { weekday: 'long', month: 'long', day: 'numeric' }
                      )}{' '}
                      · {appointmentStats.nextAppointment.time}
                    </p>
                    <p className="mt-0.5 text-sm capitalize text-gray-500">
                      {appointmentStats.nextAppointment.type} · {appointmentStats.nextAppointment.status}
                    </p>
                  </button>
                )}

                {appointmentsError && (
                  <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                    {appointmentsError}
                  </div>
                )}

                <AppointmentList
                  appointments={patientAppointments}
                  onSelectAppointment={(appointment) => {
                    logActivity('open_appointment_details', 'Opened appointment details from patient profile.', {
                      selectedAppointmentId: appointment.id,
                      selectedAppointmentStatus: appointment.status,
                    });
                    setSelectedAppointment(appointment);
                  }}
                  isLoading={appointmentsLoading}
                />
              </CardContent>
            </Card>

            <PatientCareQuickLinks
              onMoodChecker={() => {
                logActivity('open_mood_checker', 'Opened mood checker from patient profile.');
                navigate(`/patient-profile/${patient.id}/mood-checker`);
              }}
              onAdherenceCalendar={() => {
                logActivity('open_adherence_calendar', 'Opened adherence calendar from patient profile.');
                navigate(`/patient-profile/${patient.id}/adherence-calendar`);
              }}
              onAdherenceLogs={() => {
                logActivity('open_adherence_logs', 'Opened adherence logs from patient profile.');
                navigate(`/patient-profile/${patient.id}/adherence-logs`);
              }}
              onVitalsHistory={() => {
                logActivity('open_vitals_history', 'Opened vitals history from patient profile.');
                navigate(`/patient-profile/${patient.id}/vitals-history`);
              }}
              onScheduleFollowUp={openFollowUp}
            />
          </div>
        </div>
      </div>

      {showFollowUpModal && (
        <CreateAppointmentModal
          isOpen={showFollowUpModal}
          onClose={() => setShowFollowUpModal(false)}
          onAppointmentCreated={async () => {
            setShowFollowUpModal(false);
            await refreshPatientAppointments();
          }}
          prefillPatientId={patient.id}
          prefillPatientName={patient.displayName}
          prefillPatientEmail={patient.email}
          prefillIsManual={false}
          consultTypeDefault="follow-up"
        />
      )}

      <EditPatientModal
        isOpen={showEditPatientModal}
        patient={patient}
        onClose={() => setShowEditPatientModal(false)}
        onSave={handlePatientUpdate}
      />

      {selectedAppointment && (
        <AppointmentDetails
          appointment={selectedAppointment}
          onClose={() => setSelectedAppointment(null)}
          onStatusChange={handleAppointmentStatusChange}
          onReschedule={handleAppointmentReschedule}
        />
      )}
    </div>
  );
};
