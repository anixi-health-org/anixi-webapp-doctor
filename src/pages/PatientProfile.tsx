import React, { useEffect, useState } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { AppointmentContextBanner } from '../components/patients/AppointmentContextBanner';
import { recordPatientVisit } from '../services/recentPatientsService';
import { logPatientActivity } from '../services/patientActivityService';
import { getPatientAppointments } from '../services/appointmentService';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { AppointmentDetails } from '../components/appointments/AppointmentDetails';
import { AppointmentList } from '../components/appointments/AppointmentList';
import { useAuth } from '../hooks/useAuth';
import { getDoctorPatients } from '../services/doctorService';
import { Appointment, Patient } from '../types';
import { CreateAppointmentModal } from '../components/appointments/CreateAppointmentModal';
import {
  calculateAge,
  formatDate,
  formatName,
  formatGender,
  formatPhone,
  formatAddress,
  formatEmail,
  isEmpty,
} from '../utils/dataFormatter';

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

  const renderField = (label: string, value: string | null | undefined): React.ReactNode => {
    if (isEmpty(value)) return null;
    return (
      <div className="mb-3">
        <p className="text-sm text-gray-900">
          <span className="font-semibold">{label}</span> : {value}
        </p>
      </div>
    );
  };

  const renderListField = (label: string, items?: string[]): React.ReactNode => {
    if (!items || items.length === 0) return null;
    const filteredItems = items.filter((item) => !isEmpty(item));
    if (filteredItems.length === 0) return null;

    return (
      <div className="mb-4">
        <label className="text-sm font-semibold text-gray-700">{label}</label>
        <ul className="mt-2 list-disc list-inside space-y-1 text-sm text-gray-900">
          {filteredItems.map((item, idx) => (
            <li key={idx}>{item}</li>
          ))}
        </ul>
      </div>
    );
  };

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
          onClick={() => navigate(-1)}
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

  const hasMedicalAid =
    patient.medicalAid &&
    Object.keys(patient.medicalAid).some(
      (key) => patient.medicalAid?.[key as keyof typeof patient.medicalAid]
    );
  const hasChronicDiseases =
    patient.chronicDiseases &&
    patient.chronicDiseases.length > 0 &&
    patient.chronicDiseases.some((d) => !isEmpty(d));
  const hasAllergies =
    patient.allergies && patient.allergies.length > 0 && patient.allergies.some((a) => !isEmpty(a));
  const hasTreatments =
    patient.currentTreatments &&
    patient.currentTreatments.length > 0 &&
    patient.currentTreatments.some((t) => t.name && !isEmpty(t.name));
  const hasMedicalData = hasMedicalAid || hasChronicDiseases || hasAllergies || hasTreatments;

  const age = calculateAge(patient.dateOfBirth);
  const formattedName = formatName(patient.displayName);
  const formattedGender = formatGender(patient.gender);
  const formattedPhone = formatPhone(patient.phoneNumber);
  const formattedAddress = formatAddress(patient.address);
  const formattedEmail = formatEmail(patient.email);

  return (
    <div className="px-3 py-4 sm:px-4 sm:py-6 lg:px-6 bg-anixi-beige min-h-screen">
      <AppointmentContextBanner />
      <div className="mb-6 sm:mb-8">
        <button
          onClick={() => navigate(-1)}
          className="mb-4 px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg transition-colors"
        >
          ← Back
        </button>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 break-words">
          {formattedName || 'Patient Profile'}
        </h1>
        {age !== null && (
          <p className="mt-2 text-gray-600">
            {age} {age === 1 ? 'year' : 'years'} old
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Personal Information</CardTitle>
          </CardHeader>
          <CardContent>
            {renderField('Full Name', formattedName)}
            {age !== null && renderField('Age', `${age} ${age === 1 ? 'year' : 'years'}`)}
            {renderField('Date of Birth', patient.dateOfBirth ? formatDate(patient.dateOfBirth, 'short') : null)}
            {renderField('Gender', formattedGender)}
            {renderField('Marital Status', patient.maritalStatus || null)}
            {renderField('Language', patient.language || null)}
            {!formattedName && age === null && !patient.dateOfBirth && !formattedGender && (
              <p className="text-gray-500 text-sm">No personal information available</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Contact Information</CardTitle>
          </CardHeader>
          <CardContent>
            {renderField('Phone Number', formattedPhone)}
            {renderField('Email', formattedEmail)}
            {renderField('Address', formattedAddress)}
            {patient.emergencyContact && (
              <>
                {renderField('Emergency Contact Name', patient.emergencyContact.name || null)}
                {renderField(
                  'Emergency Contact Phone',
                  formatPhone(patient.emergencyContact.phone) || patient.emergencyContact.phone || null
                )}
                {renderField('Relationship', patient.emergencyContact.relationship || null)}
              </>
            )}
            {!formattedPhone && !formattedEmail && !formattedAddress && !patient.emergencyContact && (
              <p className="text-gray-500 text-sm">No contact information available</p>
            )}
          </CardContent>
        </Card>

        {hasMedicalData ? (
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Medical Information</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {hasMedicalAid && (
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-3">Medical Aid Information</h4>
                    <div className="space-y-2 text-sm text-gray-900">
                      {renderField('Provider', patient.medicalAid?.provider || null)}
                      {renderField('Member Number', patient.medicalAid?.memberNumber || null)}
                      {renderField('Group Number', patient.medicalAid?.groupNumber || null)}
                    </div>
                  </div>
                )}

                {hasChronicDiseases && renderListField('Chronic Diseases', patient.chronicDiseases)}
                {hasAllergies && renderListField('Allergies', patient.allergies)}

                {hasTreatments && (
                  <div className="md:col-span-2">
                    <h4 className="font-semibold text-gray-900 mb-3">Current Treatments</h4>
                    <div className="space-y-2">
                      {patient.currentTreatments
                        ?.filter((treatment) => treatment.name && !isEmpty(treatment.name))
                        .map((treatment, idx) => (
                          <div key={idx} className="border-l-2 border-blue-300 pl-3 py-2">
                            <p className="font-medium text-gray-900">{treatment.name}</p>
                            <p className="text-xs text-gray-600 mt-1">
                              {[treatment.dosage, treatment.frequency]
                                .filter((v) => !isEmpty(v))
                                .join(' • ')}
                            </p>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Medical Information</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-center py-12">
                <div className="text-center">
                  <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  <p className="mt-2 text-gray-600 font-medium">No medical history available</p>
                  <p className="mt-1 text-sm text-gray-500">
                    Medical information will appear here when added to the patient's profile
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <CardTitle>Appointment Management</CardTitle>
            <button
              onClick={() => {
                logActivity('open_follow_up_modal', 'Opened follow-up booking from patient profile.');
                setShowFollowUpModal(true);
              }}
              className="px-3 py-2 text-sm bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors"
            >
              + New Appointment
            </button>
          </CardHeader>
          <CardContent>
            {appointmentsError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
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

        <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
          <button
            onClick={() => {
              logActivity('open_mood_checker', 'Opened mood checker from patient profile.');
              navigate(`/patient-profile/${patient.id}/mood-checker`);
            }}
            className="p-4 sm:p-6 bg-gradient-to-br from-purple-50 to-pink-50 border border-purple-200 rounded-lg hover:shadow-lg transition-all text-left group"
          >
            <p className="text-3xl mb-2">🎭</p>
            <h3 className="text-lg font-semibold text-gray-900 group-hover:text-purple-700">Mood Checker</h3>
            <p className="text-sm text-gray-600 mt-1">Track patient's emotional well-being</p>
            <p className="text-xs text-purple-600 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">View Details →</p>
          </button>

          <button
            onClick={() => {
              logActivity('open_adherence_calendar', 'Opened adherence calendar from patient profile.');
              navigate(`/patient-profile/${patient.id}/adherence-calendar`);
            }}
            className="p-4 sm:p-6 bg-gradient-to-br from-blue-50 to-cyan-50 border border-blue-200 rounded-lg hover:shadow-lg transition-all text-left group"
          >
            <p className="text-3xl mb-2">📅</p>
            <h3 className="text-lg font-semibold text-gray-900 group-hover:text-blue-700">Adherence Calendar</h3>
            <p className="text-sm text-gray-600 mt-1">View medication adherence by date</p>
            <p className="text-xs text-blue-600 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">View Details →</p>
          </button>

          <button
            onClick={() => {
              logActivity('open_adherence_logs', 'Opened adherence logs from patient profile.');
              navigate(`/patient-profile/${patient.id}/adherence-logs`);
            }}
            className="p-4 sm:p-6 bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200 rounded-lg hover:shadow-lg transition-all text-left group"
          >
            <p className="text-3xl mb-2">📋</p>
            <h3 className="text-lg font-semibold text-gray-900 group-hover:text-green-700">Adherence Logs</h3>
            <p className="text-sm text-gray-600 mt-1">View medication adherence history</p>
            <p className="text-xs text-green-600 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">View Details →</p>
          </button>

          <button
            onClick={() => {
              logActivity('open_vitals_history', 'Opened vitals history from patient profile.');
              navigate(`/patient-profile/${patient.id}/vitals-history`);
            }}
            className="p-4 sm:p-6 bg-gradient-to-br from-red-50 to-orange-50 border border-red-200 rounded-lg hover:shadow-lg transition-all text-left group"
          >
            <p className="text-3xl mb-2">❤️</p>
            <h3 className="text-lg font-semibold text-gray-900 group-hover:text-red-700">Vitals History</h3>
            <p className="text-sm text-gray-600 mt-1">View vital signs and measurements</p>
            <p className="text-xs text-red-600 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">View Details →</p>
          </button>

          <button
            onClick={() => {
              logActivity('open_schedule_follow_up', 'Opened schedule follow-up action from patient profile.');
              setShowFollowUpModal(true);
            }}
            className="p-4 sm:p-6 bg-gradient-to-br from-indigo-50 to-blue-50 border border-indigo-200 rounded-lg hover:shadow-lg transition-all text-left group"
          >
            <p className="text-3xl mb-2">🔄</p>
            <h3 className="text-lg font-semibold text-gray-900 group-hover:text-indigo-700">Schedule Follow-Up</h3>
            <p className="text-sm text-gray-600 mt-1">Book a follow-up appointment</p>
            <p className="text-xs text-indigo-600 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">Book Now →</p>
          </button>
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
