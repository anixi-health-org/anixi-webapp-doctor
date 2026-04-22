import React from 'react';
import { Patient } from '../../types';

interface PatientDetailsPanelProps {
  patient: Patient | null;
}

export const PatientDetailsPanel: React.FC<PatientDetailsPanelProps> = ({ patient }) => {
  if (!patient) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        <p>Select a patient to view details</p>
      </div>
    );
  }

  const today = new Date();
  const birthDate = patient.dateOfBirth ? new Date(patient.dateOfBirth) : null;
  const age = birthDate
    ? Math.floor((today.getTime() - birthDate.getTime()) / (1000 * 60 * 60 * 24 * 365.25))
    : undefined;

  return (
    <div className="bg-white h-full overflow-y-auto">
      {}
      <div className="sticky top-0 bg-[#425950] text-white p-6 shadow-lg">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-white flex items-center justify-center text-2xl font-bold text-[#425950]">
            {(patient.displayName || patient.email)?.charAt(0).toUpperCase()}
          </div>
          <div>
            <h2 className="text-2xl font-bold">{patient.displayName || patient.email}</h2>
            <p className="text-gray-200">{patient.email}</p>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {}
        <div>
          <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
            <span>👤</span> Personal Information
          </h3>
          <div className="grid grid-cols-2 gap-4">
            {age !== undefined && (
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600">Age</p>
                <p className="text-xl font-bold text-gray-900">{age} years</p>
              </div>
            )}
            {patient.gender && (
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600">Gender</p>
                <p className="text-xl font-bold text-gray-900">
                  {patient.gender.charAt(0).toUpperCase() + patient.gender.slice(1)}
                </p>
              </div>
            )}
            {patient.maritalStatus && (
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600">Marital Status</p>
                <p className="text-xl font-bold text-gray-900">
                  {patient.maritalStatus.charAt(0).toUpperCase() + patient.maritalStatus.slice(1)}
                </p>
              </div>
            )}
            {patient.phoneNumber && (
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600">Phone</p>
                <p className="text-xl font-bold text-gray-900">{patient.phoneNumber}</p>
              </div>
            )}
          </div>
        </div>

        {}
        <div>
          <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
            <span>🏥</span> Medical Information
          </h3>
          <div className="space-y-4">
            {}
            <div className="bg-orange-50 border-l-4 border-orange-400 p-4 rounded">
              <p className="text-sm font-medium text-orange-800 mb-2">Chronic Diseases</p>
              {patient.chronicDiseases && patient.chronicDiseases.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {patient.chronicDiseases.map((disease, idx) => (
                    <span
                      key={idx}
                      className="bg-orange-200 text-orange-900 px-3 py-1 rounded-full text-sm"
                    >
                      {disease}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-orange-700">No chronic diseases recorded</p>
              )}
            </div>

            {}
            <div className="bg-red-50 border-l-4 border-red-400 p-4 rounded">
              <p className="text-sm font-medium text-red-800 mb-2">Allergies</p>
              {patient.allergies && patient.allergies.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {patient.allergies.map((allergy, idx) => (
                    <span key={idx} className="bg-red-200 text-red-900 px-3 py-1 rounded-full text-sm">
                      ⚠️ {allergy}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-red-700">No allergies recorded</p>
              )}
            </div>

            {}
            <div className="bg-[#f0f2f1] border-l-4 border-[#425950] p-4 rounded">
              <p className="text-sm font-medium text-[#425950] mb-2">Current Treatments</p>
              {patient.currentTreatments && patient.currentTreatments.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {patient.currentTreatments.map((treatment, idx) => (
                    <span key={idx} className="bg-[#e8eceb] text-[#425950] px-3 py-1 rounded-full text-sm">
                      💊 {typeof treatment === 'string' ? treatment : treatment.name}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-[#5a6f6a]">No treatments recorded</p>
              )}
            </div>
          </div>
        </div>

        {}
        <div>
          <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
            <span>🆘</span> Emergency Contact
          </h3>
          {patient.emergencyContact ? (
            <div className="bg-gray-50 p-4 rounded-lg">
              <p className="text-sm text-gray-600">Name</p>
              <p className="font-medium text-gray-900">{patient.emergencyContact.name || 'Not provided'}</p>
              <p className="text-sm text-gray-600 mt-2">Phone</p>
              <p className="font-medium text-gray-900">{patient.emergencyContact.phone || 'Not provided'}</p>
              <p className="text-sm text-gray-600 mt-2">Relationship</p>
              <p className="font-medium text-gray-900">{patient.emergencyContact.relationship || 'Not provided'}</p>
            </div>
          ) : (
            <p className="text-gray-500">No emergency contact recorded</p>
          )}
        </div>

        {}
        {patient.medicalAid && (
          <div>
            <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <span>💳</span> Medical Aid
            </h3>
            <div className="bg-green-50 p-4 rounded-lg">
              <p className="text-sm text-gray-600">Provider</p>
              <p className="font-medium text-gray-900">{patient.medicalAid.provider || 'Not provided'}</p>
              <p className="text-sm text-gray-600 mt-2">Member Number</p>
              <p className="font-medium text-gray-900">{patient.medicalAid.memberNumber || 'Not provided'}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
