import React from 'react';
import { customColors } from '../../lib/customColors';
import { Patient } from '../../types';
import { calculateAge } from '../../services/patientManagementService';
import { formatTimestamp } from '../../utils/dateFormatter';
interface PatientDetailModalProps {
  patient: Patient | null;
  isOpen: boolean;
  onClose: () => void;
}
export const PatientDetailModal: React.FC<PatientDetailModalProps> = ({
  patient,
  isOpen,
  onClose,
}) => {
  
  if (!isOpen || !patient) return null;
  
  const age = calculateAge(patient.dateOfBirth);
  
  const formatDate = (date: any): string => {
    if (!date) return 'Not available';
    return formatTimestamp(date, 'long');
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-end sm:items-center justify-center p-2 sm:p-4">
      <div className="bg-white rounded-t-xl sm:rounded-xl shadow-2xl max-w-2xl w-full max-h-[95vh] sm:max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-[#425950] px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-white break-words">{patient.displayName}</h2>
            <p className="text-gray-200 text-sm">Patient Profile</p>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:bg-[#344842] rounded-lg p-2 transition-colors"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
        <div className="p-4 sm:p-6 space-y-6">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <svg
                className="w-5 h-5 text-blue-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              Personal Information
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-anixi-card rounded-lg p-4 border-[${customColors.borderMedium}]">
                <p className="text-xs font-semibold text-gray-500 mb-1">EMAIL</p>
                <p className="text-gray-900 font-medium break-all">{patient.email}</p>
              </div>
              {age !== undefined && (
                 <div className="bg-anixi-card rounded-lg p-4 border-[${customColors.borderMedium}]">
                  <p className="text-xs font-semibold text-gray-500 mb-1">AGE</p>
                  <p className="text-gray-900 font-medium">{age} years</p>
                </div>
              )}
              {patient.dateOfBirth && (
                 <div className="bg-anixi-card rounded-lg p-4 border-[${customColors.borderMedium}]">
                  <p className="text-xs font-semibold text-gray-500 mb-1">DATE OF BIRTH</p>
                  <p className="text-gray-900 font-medium">{formatDate(patient.dateOfBirth)}</p>
                </div>
              )}
              {patient.gender && (
                 <div className="bg-anixi-card rounded-lg p-4 border-[${customColors.borderMedium}]">
                  <p className="text-xs font-semibold text-gray-500 mb-1">GENDER</p>
                  <p className="text-gray-900 font-medium">
                    {patient.gender.charAt(0).toUpperCase() + patient.gender.slice(1)}
                  </p>
                </div>
              )}
              {patient.maritalStatus && (
                 <div className="bg-anixi-card rounded-lg p-4 border-[${customColors.borderMedium}]">
                  <p className="text-xs font-semibold text-gray-500 mb-1">MARITAL STATUS</p>
                  <p className="text-gray-900 font-medium">
                    {patient.maritalStatus.charAt(0).toUpperCase() +
                      patient.maritalStatus.slice(1)}
                  </p>
                </div>
              )}
              {patient.language && (
                 <div className="bg-anixi-card rounded-lg p-4 border-[${customColors.borderMedium}]">
                  <p className="text-xs font-semibold text-gray-500 mb-1">LANGUAGE</p>
                  <p className="text-gray-900 font-medium">{patient.language}</p>
                </div>
              )}
              {patient.phoneNumber && (
                 <div className="bg-anixi-card rounded-lg p-4 border-[${customColors.borderMedium}]">
                  <p className="text-xs font-semibold text-gray-500 mb-1">PHONE NUMBER</p>
                  <p className="text-gray-900 font-medium">{patient.phoneNumber}</p>
                </div>
              )}
              {patient.address && (
                 <div className="bg-anixi-card rounded-lg p-4 sm:col-span-2 border-[${customColors.borderMedium}]">
                  <p className="text-xs font-semibold text-gray-500 mb-1">ADDRESS</p>
                  <p className="text-gray-900 font-medium">{patient.address}</p>
                </div>
              )}
            </div>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <svg
                className="w-5 h-5 text-red-600"
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
              Medical Information
            </h3>
            <div className="space-y-4">
              {patient.medicalAid ? (
                 <div className="bg-anixi-card rounded-lg p-4 border-[${customColors.borderMedium}]">
                  <p className="text-xs font-semibold text-[#425950] mb-2">MEDICAL AID</p>
                  <div className="space-y-1 text-gray-900">
                    <p className="font-medium">Provider: {patient.medicalAid.provider}</p>
                    <p className="text-sm">Member #: {patient.medicalAid.memberNumber}</p>
                    {patient.medicalAid.groupNumber && (
                      <p className="text-sm">Group #: {patient.medicalAid.groupNumber}</p>
                    )}
                  </div>
                </div>
              ) : (
                 <div className="bg-anixi-card rounded-lg p-4 border-[${customColors.borderMedium}]">
                  <p className="text-xs font-semibold text-gray-500 mb-1">MEDICAL AID</p>
                  <p className="text-gray-600">No medical aid information available</p>
                </div>
              )}
              <div>
                <p className="text-xs font-semibold text-gray-500 mb-2">MEDICAL HISTORY</p>
                {patient.chronicDiseases && patient.chronicDiseases.length > 0 ? (
                  <div className="bg-anixi-card rounded-lg p-4 border border-yellow-200">
                    <ul className="space-y-1">
                      {patient.chronicDiseases.map((disease, idx) => (
                        <li key={idx} className="text-gray-900 font-medium">
                          • {disease}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <div className="bg-anixi-card rounded-lg p-4 border-[${customColors.borderMedium}]">
                    <p className="text-gray-600">No medical history available</p>
                  </div>
                )}
              </div>
              {patient.allergies && patient.allergies.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 mb-2">ALLERGIES</p>
                    <div className="bg-anixi-card rounded-lg p-4 border border-red-200">
                    <ul className="space-y-1">
                      {patient.allergies.map((allergy, idx) => (
                        <li key={idx} className="text-gray-900 font-medium">
                          ⚠️ {allergy}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
              {patient.currentTreatments && patient.currentTreatments.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 mb-2">CURRENT TREATMENTS</p>
                  <div className="bg-green-50 rounded-lg p-4 border border-green-200 space-y-3">
                    {patient.currentTreatments.map((treatment, idx) => (
                      <div key={idx} className="text-gray-900">
                        <p className="font-medium">💊 {treatment.name}</p>
                        <p className="text-sm text-gray-600">
                          Dosage: {treatment.dosage}
                        </p>
                        <p className="text-sm text-gray-600">
                          Frequency: {treatment.frequency}
                        </p>
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
        <div className="bg-gray-50 border-t border-gray-200 px-4 sm:px-6 py-3 sm:py-4 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-gray-200 text-gray-900 rounded-lg font-medium hover:bg-gray-300 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
