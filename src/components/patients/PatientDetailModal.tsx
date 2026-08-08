import React from 'react';
import { Patient } from '../../types';
import { calculateAge } from '../../services/patientManagementService';
import { formatTimestamp } from '../../utils/dateFormatter';

interface PatientDetailModalProps {
  patient: Patient | null;
  isOpen: boolean;
  onClose: () => void;
  onPatientUpdated?: (patient: Patient) => void;
}

export const PatientDetailModal: React.FC<PatientDetailModalProps> = ({
  patient,
  isOpen,
  onClose,
}) => {
  if (!isOpen || !patient) return null;

  const displayPatient = patient;
  
  const age = calculateAge(displayPatient.dateOfBirth);

  const formatDate = (date: any): string => {
    if (!date) return 'Not available';
    return formatTimestamp(date, 'long');
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-end sm:items-center justify-center p-2 sm:p-4">
      <div className="bg-white rounded-t-[28px] sm:rounded-[28px] shadow-2xl max-w-2xl w-full max-h-[95vh] sm:max-h-[90vh] overflow-y-auto border border-[#E4EAF2]">
        <div className="sticky top-0 bg-[#425950] px-5 sm:px-6 py-4 sm:py-5 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-white break-words">{displayPatient.displayName}</h2>
            <p className="text-white/75 text-sm mt-1">Patient Profile</p>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:bg-[#344842] rounded-xl p-2.5 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-4 sm:p-6 space-y-6 bg-[#FAFBFC]">
          
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Personal Information
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-white rounded-2xl p-4 border border-[#E7EDF4] shadow-sm">
                <p className="text-xs font-semibold text-gray-500 mb-1">EMAIL</p>
                <p className="text-gray-900 font-medium break-all">{displayPatient.email}</p>
              </div>
              {age !== undefined && (
                <div className="bg-white rounded-2xl p-4 border border-[#E7EDF4] shadow-sm">
                  <p className="text-xs font-semibold text-gray-500 mb-1">AGE</p>
                  <p className="text-gray-900 font-medium">{age} years</p>
                </div>
              )}
              {displayPatient.dateOfBirth && (
                <div className="bg-white rounded-2xl p-4 border border-[#E7EDF4] shadow-sm">
                  <p className="text-xs font-semibold text-gray-500 mb-1">DATE OF BIRTH</p>
                  <p className="text-gray-900 font-medium">{formatDate(displayPatient.dateOfBirth)}</p>
                </div>
              )}
              {displayPatient.gender && (
                <div className="bg-white rounded-2xl p-4 border border-[#E7EDF4] shadow-sm">
                  <p className="text-xs font-semibold text-gray-500 mb-1">GENDER</p>
                  <p className="text-gray-900 font-medium">
                    {displayPatient.gender.charAt(0).toUpperCase() + displayPatient.gender.slice(1)}
                  </p>
                </div>
              )}
              {displayPatient.maritalStatus && (
                <div className="bg-white rounded-2xl p-4 border border-[#E7EDF4] shadow-sm">
                  <p className="text-xs font-semibold text-gray-500 mb-1">MARITAL STATUS</p>
                  <p className="text-gray-900 font-medium">
                    {displayPatient.maritalStatus.charAt(0).toUpperCase() + displayPatient.maritalStatus.slice(1)}
                  </p>
                </div>
              )}
              {displayPatient.language && (
                <div className="bg-white rounded-2xl p-4 border border-[#E7EDF4] shadow-sm">
                  <p className="text-xs font-semibold text-gray-500 mb-1">LANGUAGE</p>
                  <p className="text-gray-900 font-medium">{displayPatient.language}</p>
                </div>
              )}
              {displayPatient.phoneNumber && (
                <div className="bg-white rounded-2xl p-4 border border-[#E7EDF4] shadow-sm">
                  <p className="text-xs font-semibold text-gray-500 mb-1">PHONE NUMBER</p>
                  <p className="text-gray-900 font-medium">{displayPatient.phoneNumber}</p>
                </div>
              )}
              {displayPatient.address && (
                <div className="bg-white rounded-2xl p-4 border border-[#E7EDF4] shadow-sm sm:col-span-2">
                  <p className="text-xs font-semibold text-gray-500 mb-1">ADDRESS</p>
                  <p className="text-gray-900 font-medium">{displayPatient.address}</p>
                </div>
              )}
            </div>
          </div>

          
          <div>
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Medical Information
              </h3>
              <p className="mt-1 text-xs text-gray-500">View only — patient manages this data in the app.</p>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white rounded-2xl p-4 border border-[#E7EDF4] shadow-sm">
                  <p className="text-xs font-semibold text-gray-500 mb-1">BLOOD GROUP</p>
                  <p className="text-gray-900 font-medium">{displayPatient.bloodGroup || 'Not recorded'}</p>
                </div>
                <div className="bg-white rounded-2xl p-4 border border-[#E7EDF4] shadow-sm">
                  <p className="text-xs font-semibold text-gray-500 mb-1">WEIGHT</p>
                  <p className="text-gray-900 font-medium">
                    {displayPatient.weight
                      ? /kg|lb/i.test(displayPatient.weight)
                        ? displayPatient.weight
                        : `${displayPatient.weight} kg`
                      : 'Not recorded'}
                  </p>
                </div>
              </div>
              {displayPatient.medicalAid ? (
                <div className="bg-[#F3F7F5] rounded-2xl p-4 border border-[#D7E0DC] shadow-sm">
                  <p className="text-xs font-semibold text-[#425950] mb-2">MEDICAL AID</p>
                  <div className="space-y-1 text-gray-900">
                    <p className="font-medium">Provider: {displayPatient.medicalAid.provider}</p>
                    <p className="text-sm">Member #: {displayPatient.medicalAid.memberNumber}</p>
                    {displayPatient.medicalAid.groupNumber && (
                      <p className="text-sm">Group #: {displayPatient.medicalAid.groupNumber}</p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="bg-white rounded-2xl p-4 border border-[#E7EDF4] shadow-sm">
                  <p className="text-xs font-semibold text-gray-500 mb-1">MEDICAL AID</p>
                  <p className="text-gray-600">No medical aid information available</p>
                </div>
              )}
              <div>
                <p className="text-xs font-semibold text-gray-500 mb-2">MEDICAL HISTORY</p>
                {displayPatient.chronicDiseases && displayPatient.chronicDiseases.length > 0 ? (
                  <div className="bg-[#FFF8E7] rounded-2xl p-4 border border-[#F3D9A5] shadow-sm">
                    <ul className="space-y-1">
                      {displayPatient.chronicDiseases.map((disease, idx) => (
                        <li key={idx} className="text-gray-900 font-medium">• {disease}</li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <div className="bg-white rounded-2xl p-4 border border-[#E7EDF4] shadow-sm">
                    <p className="text-gray-600">No medical history available</p>
                  </div>
                )}
              </div>
              {displayPatient.allergies && displayPatient.allergies.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 mb-2">ALLERGIES</p>
                  <div className="bg-[#FFF5F5] rounded-2xl p-4 border border-[#F1C9CE] shadow-sm">
                    <ul className="space-y-1">
                      {displayPatient.allergies.map((allergy, idx) => (
                        <li key={idx} className="text-gray-900 font-medium">⚠️ {allergy}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
              {displayPatient.currentTreatments && displayPatient.currentTreatments.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 mb-2">CURRENT TREATMENTS</p>
                  <div className="bg-[#F2FBF6] rounded-2xl p-4 border border-[#CDEBD9] shadow-sm space-y-3">
                    {displayPatient.currentTreatments.map((treatment, idx) => (
                      <div key={idx} className="text-gray-900">
                        <p className="font-medium">💊 {treatment.name}</p>
                        <p className="text-sm text-gray-600">Dosage: {treatment.dosage}</p>
                        <p className="text-sm text-gray-600">Frequency: {treatment.frequency}</p>
                        {treatment.startDate && (
                          <p className="text-xs text-gray-500">
                            Started: {(treatment.startDate instanceof Date ? treatment.startDate : new Date(treatment.startDate)).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="bg-white border-t border-[#E4EAF2] px-4 sm:px-6 py-3 sm:py-4 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-3 rounded-2xl font-semibold shadow-sm"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
