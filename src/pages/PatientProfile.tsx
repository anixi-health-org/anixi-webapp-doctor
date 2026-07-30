import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeftIcon, CalendarDaysIcon, PlusIcon } from '@heroicons/react/24/outline';
import { AppointmentContextBanner } from '../components/patients/AppointmentContextBanner';
import { PatientCareQuickLinks } from '../components/patients/PatientCareQuickLinks';
import { PatientProfileIdentityCard, usePatientHealthSnapshot } from '../components/patients/PatientProfileIdentityCard';
import { recordPatientVisit } from '../services/recentPatientsService';
import { logPatientActivity } from '../services/patientActivityService';
import { getPatientAppointments } from '../services/appointmentService';
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
import { PatientProfileSkeleton } from '../components/ui';

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
    return <PatientProfileSkeleton />;
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
    <div className="min-h-screen bg-[#f5f7fa] px-4 py-6 sm:px-6 lg:px-8">
      <AppointmentContextBanner />

      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate('/patients')}
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#e1e7ef] bg-white text-[#65758b] shadow-sm transition hover:border-[#c5cdd8] hover:text-[#0E2340]"
              aria-label="Back to patients"
            >
              <ArrowLeftIcon className="h-4 w-4" />
            </button>
            <div>
              <h1 className="text-[22px] font-bold tracking-tight text-[#0E2340]">Patient details</h1>
              <p className="mt-0.5 text-[13px] text-[#65758b]">
                Clinical overview, appointments, and care tools
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => navigate(`/patient-profile/${patient.id}/details`)}
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-[#e1e7ef] bg-white px-3.5 text-sm font-medium text-[#344256] shadow-sm transition hover:border-[#c5cdd8] hover:text-[#0E2340]"
            >
              Full record
            </button>
            <button
              type="button"
              onClick={() => setShowEditPatientModal(true)}
              className="inline-flex h-9 items-center gap-2 rounded-lg bg-anixi-green px-3.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#365c4f]"
            >
              Edit
            </button>
          </div>
        </div>

        {actionSuccess && (
          <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
            {actionSuccess}
          </div>
        )}
        {actionError && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {actionError}
          </div>
        )}

        <div className="mb-5 rounded-xl border border-[#e1e7ef] bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-anixi-green text-lg font-bold text-white">
                {(formattedName || patient.email || '?')
                  .split(' ')
                  .map((p) => p[0])
                  .join('')
                  .slice(0, 2)
                  .toUpperCase()}
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-lg font-bold text-[#0E2340]">{formattedName || 'Unnamed Patient'}</h2>
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                      patient.chronicDiseases?.length
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-emerald-50 text-emerald-700'
                    }`}
                  >
                    <span
                      className={`inline-block h-1.5 w-1.5 rounded-full ${
                        patient.chronicDiseases?.length ? 'bg-amber-500' : 'bg-emerald-500'
                      }`}
                    />
                    {patient.chronicDiseases?.length ? 'Follow-up' : 'Stable'}
                  </span>
                </div>
                <p className="mt-1 text-[13px] text-[#65758b]">
                  {patient.id.slice(0, 8).toUpperCase()}
                  {patient.gender ? ` · ${patient.gender}` : ''}
                  {patient.email ? ` · ${patient.email}` : ''}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 rounded-lg bg-[#f8fafc] px-4 py-3 text-sm sm:grid-cols-3">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wider text-[#8FA0B6]">Phone</p>
                <p className="mt-0.5 font-medium text-[#0E2340]">{patient.phoneNumber || '—'}</p>
              </div>
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wider text-[#8FA0B6]">Email</p>
                <p className="mt-0.5 truncate font-medium text-[#0E2340]">{patient.email || '—'}</p>
              </div>
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wider text-[#8FA0B6]">Address</p>
                <p className="mt-0.5 font-medium text-[#0E2340]">{patient.address || '—'}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            ['Allergies', patient.allergies?.length ? patient.allergies.join(', ') : 'None'],
            ['Conditions', patient.chronicDiseases?.length ? patient.chronicDiseases.join(', ') : 'None'],
            ['Upcoming', String(appointmentStats.upcoming)],
            [
              'Next visit',
              appointmentStats.nextAppointment
                ? (convertTimestamp(appointmentStats.nextAppointment.date) ?? new Date()).toLocaleDateString()
                : '—',
            ],
          ].map(([label, value]) => (
            <div key={label} className="rounded-xl border border-[#e1e7ef] bg-white px-4 py-3.5 shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[#8FA0B6]">{label}</p>
              <p className="mt-1.5 truncate text-base font-semibold text-[#0E2340]">{value}</p>
            </div>
          ))}
        </div>

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
            <div className="overflow-hidden rounded-xl border border-[#e1e7ef] bg-white shadow-sm">
              <div className="flex flex-col gap-4 border-b border-[#e1e7ef] px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                <div>
                  <h3 className="flex items-center gap-2 text-[15px] font-semibold text-[#0E2340]">
                    <CalendarDaysIcon className="h-5 w-5 text-anixi-green" />
                    Appointment management
                  </h3>
                  <p className="mt-1 text-[13px] text-[#65758b]">
                    Schedule and review visits for {formattedName || 'this patient'}.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={openFollowUp}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-anixi-green px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#365c4f]"
                >
                  <PlusIcon className="h-4 w-4" />
                  New appointment
                </button>
              </div>

              <div className="space-y-4 p-4 sm:p-6">
                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2.5 text-center">
                    <p className="text-lg font-bold text-sky-900">{appointmentStats.upcoming}</p>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-sky-700">
                      Upcoming
                    </p>
                  </div>
                  <div className="rounded-lg border border-[#e1e7ef] bg-[#f8fafc] px-3 py-2.5 text-center">
                    <p className="text-lg font-bold text-[#0E2340]">{appointmentStats.completed}</p>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-[#65758b]">
                      Completed
                    </p>
                  </div>
                  <div className="rounded-lg border border-anixi-green/20 bg-[#eef4f1] px-3 py-2.5 text-center">
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
                    className="w-full rounded-[12px] border border-[#427160]/25 bg-gradient-to-r from-[#eef4f1] to-white p-4 text-left transition-shadow hover:shadow-md"
                  >
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-[#427160]">
                      Next appointment
                    </p>
                    <p className="mt-1 font-semibold text-[#344256]">
                      {(convertTimestamp(appointmentStats.nextAppointment.date) ?? new Date()).toLocaleDateString(
                        'en-US',
                        { weekday: 'long', month: 'long', day: 'numeric' }
                      )}{' '}
                      · {appointmentStats.nextAppointment.time}
                    </p>
                    <p className="mt-0.5 text-sm capitalize text-[#65758b]">
                      {appointmentStats.nextAppointment.type} · {appointmentStats.nextAppointment.status}
                    </p>
                  </button>
                )}

                {appointmentsError && (
                  <div className="rounded-[10px] border border-red-200 bg-red-50 p-3 text-sm text-red-700">
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
              </div>
            </div>

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
