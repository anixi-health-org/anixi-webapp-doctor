import React from 'react';
import { Patient } from '../../types';
import { calculateAge, getPatientStatus } from '../../services/patientManagementService';

interface PatientListProps {
  patients: Patient[];
  loading: boolean;
  onPatientClick: (patient: Patient) => void;
}

export const PatientList: React.FC<PatientListProps> = ({
  patients,
  loading,
  onPatientClick,
}) => {
  if (loading) {
    return (
      <div className="flex justify-center items-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (patients.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-96 text-gray-500">
        <svg
          className="w-16 h-16 mb-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 4.354a4 4 0 110 5.292M15 21H3v-2a6 6 0 0112 0v2zm0 0h6v-2a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
          />
        </svg>
        <p className="text-lg font-medium">No patients connected yet</p>
        <p className="text-sm">Pending patient requests will appear here</p>
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      {patients.map((patient) => {
        const age = calculateAge(patient.dateOfBirth);
        const status = getPatientStatus(patient);
        const statusColor =
          status === 'stable'
            ? 'bg-green-100 text-green-800'
            : status === 'warning'
              ? 'bg-yellow-100 text-yellow-800'
              : 'bg-gray-100 text-gray-800';

        return (
          <div
            key={patient.id}
            onClick={() => onPatientClick(patient)}
            className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md cursor-pointer transition-all hover:border-blue-300"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="text-lg font-semibold text-gray-900">
                    {patient.displayName}
                  </h3>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColor}`}>
                    {status.charAt(0).toUpperCase() + status.slice(1)}
                  </span>
                </div>

                <div className="flex gap-6 text-sm text-gray-600">
                  {age !== undefined && (
                    <div>
                      <span className="text-gray-500">Age:</span>
                      <span className="ml-2 font-medium">{age} years</span>
                    </div>
                  )}
                  {patient.gender && (
                    <div>
                      <span className="text-gray-500">Gender:</span>
                      <span className="ml-2 font-medium">
                        {patient.gender.charAt(0).toUpperCase() + patient.gender.slice(1)}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <svg
                className="w-5 h-5 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </div>
          </div>
        );
      })}
    </div>
  );
};
