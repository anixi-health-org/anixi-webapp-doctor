import React, { useState } from 'react';
import { Patient } from '../../types';
import { patientContactLabel } from '../../utils/patientContact';
import { patientAccountStatus, patientAccountStatusLabel } from '../../utils/patientRosterStatus';

interface PatientListPanelProps {
  patients: Patient[];
  loading: boolean;
  error?: string | null;
  selectedPatientId?: string | null;
  onSelectPatient: (patient: Patient) => void;
  isVisible: boolean;
}

export const PatientListPanel: React.FC<PatientListPanelProps> = ({
  patients,
  loading,
  error,
  selectedPatientId,
  onSelectPatient,
  isVisible,
}) => {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredPatients = patients.filter((patient) => {
    const haystack = `${patient.displayName || ''} ${patientContactLabel(patient.email)}`.toLowerCase();
    return haystack.includes(searchTerm.toLowerCase());
  });

  if (!isVisible) {
    return null;
  }

  const getPatientStatusDisplay = (patient: Patient): string => {
    return patientAccountStatusLabel(patientAccountStatus(patient));
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'Pending activation':
        return 'bg-[#FFEAD1] text-[#D9480F]';
      case 'Activated':
        return 'bg-[#CFF2DE] text-[#0E9F6E]';
      default:
        return 'bg-[#F2F4F7] text-[#5C6775]';
    }
  };

  const getAvatarColor = (status: string): string => {
    switch (status) {
      case 'Pending activation':
        return 'bg-[#FF6A00]';
      case 'Activated':
        return 'bg-[#10B981]';
      default:
        return 'bg-[#5C6775]';
    }
  };

  return (
    <div className="p-4">
      <div className="mb-4 rounded-xl bg-[#F2F4F7] border border-[#E6EAF0] px-3 py-2.5">
        <input
          type="text"
          placeholder="Search patients by name or email..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full bg-transparent text-sm text-[#5C6775] placeholder:text-[#8FA0B6] focus:outline-none"
        />
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700 mb-3">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center items-center py-6">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#425950]"></div>
          <span className="ml-2 text-sm text-gray-600">Loading patients...</span>
        </div>
      ) : filteredPatients.length === 0 ? (
        <div className="flex justify-center items-center py-6 text-sm text-gray-500">
          <p>No patients found</p>
        </div>
      ) : (
        <div className="divide-y divide-[#E6EAF0]">
          {filteredPatients.map((patient) => {
            const status = getPatientStatusDisplay(patient);
            return (
              <div
                key={patient.id}
                onClick={() => onSelectPatient(patient)}
                className={`
                  px-1 py-3 cursor-pointer transition-colors duration-150
                  ${
                    selectedPatientId === patient.id
                      ? 'bg-[#F8FAFC]'
                      : 'bg-white hover:bg-[#FBFCFD]'
                  }
                `}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <div
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-semibold text-white ${getAvatarColor(status)}`}
                    >
                      {(patient.displayName || patient.email)?.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-[#0E2340] sm:text-base">
                        {patient.displayName || patient.email}
                      </p>
                      <p className="truncate text-xs text-[#8394AE] sm:text-sm">{patient.email}</p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <span
                      className={`inline-block rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide whitespace-nowrap sm:px-3 sm:text-xs ${getStatusColor(status)}`}
                    >
                      {status}
                    </span>
                    <button
                      type="button"
                      className="px-1 text-lg leading-none text-[#B8C5D6] hover:text-[#93A4B8]"
                      onClick={(e) => e.stopPropagation()}
                      aria-label="More actions"
                    >
                      ⋮
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
