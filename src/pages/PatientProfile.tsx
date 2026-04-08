import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { useAuth } from '../hooks/useAuth';
import { getDoctorPatients } from '../services/doctorService';
import { Patient } from '../types';
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
  const { patientId } = useParams<{ patientId: string }>();
  const { user } = useAuth();

  const [patient, setPatient] = useState<Patient | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
      } catch (err) {
        console.error('Error fetching patient:', err);
        setError('Failed to load patient profile');
      } finally {
        setIsLoading(false);
      }
    };

    fetchPatient();
  }, [user, patientId]);

  const renderField = (label: string, value: string | null | undefined): React.ReactNode => {
    if (isEmpty(value)) return null;
    return (
      <div className="mb-3">
        <p className="text-sm text-gray-900"><span className="font-semibold">{label}</span> : {value}</p>
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
      <div className="p-6 bg-anixi-beige min-h-screen">
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

  const hasMedicalAid = patient.medicalAid && Object.keys(patient.medicalAid).some(key => patient.medicalAid?.[key as keyof typeof patient.medicalAid]);
  const hasChronicDiseases = patient.chronicDiseases && patient.chronicDiseases.length > 0 && patient.chronicDiseases.some(d => !isEmpty(d));
  const hasAllergies = patient.allergies && patient.allergies.length > 0 && patient.allergies.some(a => !isEmpty(a));
  const hasTreatments = patient.currentTreatments && patient.currentTreatments.length > 0 && patient.currentTreatments.some(t => t.name && !isEmpty(t.name));
  const hasMedicalData = hasMedicalAid || hasChronicDiseases || hasAllergies || hasTreatments;

  const age = calculateAge(patient.dateOfBirth);
  const formattedName = formatName(patient.displayName);
  const formattedGender = formatGender(patient.gender);
  const formattedPhone = formatPhone(patient.phoneNumber);
  const formattedAddress = formatAddress(patient.address);
  const formattedEmail = formatEmail(patient.email);

  return (
    <div className="p-6 bg-anixi-beige min-h-screen">
      <div className="mb-8">
        <button
          onClick={() => navigate(-1)}
          className="mb-4 px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg transition-colors"
        >
          ← Back
        </button>
        <h1 className="text-3xl font-bold text-gray-900">{formattedName || 'Patient Profile'}</h1>
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
                {renderField('Emergency Contact Phone', formatPhone(patient.emergencyContact.phone) || patient.emergencyContact.phone || null)}
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
                        ?.filter(
                          (treatment) =>
                            treatment.name && !isEmpty(treatment.name)
                        )
                        .map((treatment, idx) => (
                          <div key={idx} className="border-l-2 border-blue-300 pl-3 py-2">
                            <p className="font-medium text-gray-900">{treatment.name}</p>
                            <p className="text-xs text-gray-600 mt-1">
                              {[treatment.dosage, treatment.frequency].filter((v) => !isEmpty(v)).join(' • ')}
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
                  <svg 
                    className="mx-auto h-12 w-12 text-gray-400" 
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path 
                      strokeLinecap="round" 
                      strokeLinejoin="round" 
                      strokeWidth={2} 
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" 
                    />
                  </svg>
                  <p className="mt-2 text-gray-600 font-medium">No medical history available</p>
                  <p className="mt-1 text-sm text-gray-500">Medical information will appear here when added to the patient's profile</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
          <button
            onClick={() => navigate(`/patient-profile/${patient.id}/mood-checker`)}
            className="p-6 bg-gradient-to-br from-purple-50 to-pink-50 border border-purple-200 rounded-lg hover:shadow-lg transition-all text-left group"
          >
            <p className="text-3xl mb-2">🎭</p>
            <h3 className="text-lg font-semibold text-gray-900 group-hover:text-purple-700">Mood Checker</h3>
            <p className="text-sm text-gray-600 mt-1">Track patient's emotional well-being</p>
            <p className="text-xs text-purple-600 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">View Details →</p>
          </button>

          <button
            onClick={() => navigate(`/patient-profile/${patient.id}/adherence-calendar`)}
            className="p-6 bg-gradient-to-br from-blue-50 to-cyan-50 border border-blue-200 rounded-lg hover:shadow-lg transition-all text-left group"
          >
            <p className="text-3xl mb-2">📅</p>
            <h3 className="text-lg font-semibold text-gray-900 group-hover:text-blue-700">Adherence Calendar</h3>
            <p className="text-sm text-gray-600 mt-1">View medication adherence by date</p>
            <p className="text-xs text-blue-600 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">View Details →</p>
          </button>

          <button
            onClick={() => navigate(`/patient-profile/${patient.id}/adherence-logs`)}
            className="p-6 bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200 rounded-lg hover:shadow-lg transition-all text-left group"
          >
            <p className="text-3xl mb-2">📋</p>
            <h3 className="text-lg font-semibold text-gray-900 group-hover:text-green-700">Adherence Logs</h3>
            <p className="text-sm text-gray-600 mt-1">View medication adherence history</p>
            <p className="text-xs text-green-600 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">View Details →</p>
          </button>

          <button
            onClick={() => navigate(`/patient-profile/${patient.id}/vitals-history`)}
            className="p-6 bg-gradient-to-br from-red-50 to-orange-50 border border-red-200 rounded-lg hover:shadow-lg transition-all text-left group"
          >
            <p className="text-3xl mb-2">❤️</p>
            <h3 className="text-lg font-semibold text-gray-900 group-hover:text-red-700">Vitals History</h3>
            <p className="text-sm text-gray-600 mt-1">View vital signs and measurements</p>
            <p className="text-xs text-red-600 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">View Details →</p>
          </button>
        </div>
      </div>
    </div>
  );
};
