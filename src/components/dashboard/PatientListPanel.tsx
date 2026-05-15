import React, { useState, useEffect } from 'react';
import { Patient } from '../../types';
import { getPatientStatus } from '../../utils/patientStatusUtils';

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
  const [patientStatuses, setPatientStatuses] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    const calculateStatuses = async () => {
      const statusMap = new Map<string, string>();

      for (const patient of patients) {
        try {
          const status = await getPatientStatus(patient);
          statusMap.set(patient.id, status);
        } catch (err) {
          ;
          statusMap.set(patient.id, 'Stable'); 
        }
      }

      setPatientStatuses(statusMap);
    };

    if (patients.length > 0) {
      calculateStatuses();
    }
  }, [patients]);

  const filteredPatients = patients.filter((patient) =>
    (patient.displayName || patient.email)
      .toLowerCase()
      .includes(searchTerm.toLowerCase()) ||
    patient.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (!isVisible) {
    return null;
  }

  const getPatientStatusDisplay = (patient: Patient): string => {
    return patientStatuses.get(patient.id) || 'Loading...';
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'Action Required':
        return 'bg-[#FFEAD1] text-[#D9480F]';
      case 'Inactive':
        return 'bg-[#F2F4F7] text-[#5C6775]';
      case 'Stable':
        return 'bg-[#CFF2DE] text-[#0E9F6E]';
      default:
        return 'bg-[#F2F4F7] text-[#5C6775]';
    }
  };

  const getAvatarColor = (status: string): string => {
    switch (status) {
      case 'Action Required':
        return 'bg-[#FF6A00]';
      case 'Stable':
        return 'bg-[#10B981]';
      case 'Inactive':
        return 'bg-[#94A3B8]';
      default:
        return 'bg-[#425950]';
    }
  };

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-6 rounded-3xl bg-[#F2F4F7] border border-[#E6EAF0] px-4 py-3">
        <input
          type="text"
          placeholder="Search patients by name or email..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full bg-transparent text-base sm:text-lg text-[#8FA0B6] placeholder:text-[#8FA0B6] focus:outline-none"
        />
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 mb-4">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center items-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#425950]"></div>
          <span className="ml-2 text-gray-600">Loading patients...</span>
        </div>
      ) : filteredPatients.length === 0 ? (
        <div className="flex justify-center items-center py-8 text-gray-500">
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
                  p-5 cursor-pointer transition-all duration-200
                  ${
                    selectedPatientId === patient.id
                      ? 'bg-[#F8FAFC]'
                      : 'bg-white hover:bg-[#FBFCFD]'
                  }
                `}
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                  <div className="flex-1 min-w-0 flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-2xl ${getAvatarColor(status)} flex items-center justify-center text-white font-bold text-2xl flex-shrink-0`}>
                        {(patient.displayName || patient.email)?.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-[#0E2340] text-lg sm:text-[34px] sm:leading-[1.05] truncate">{patient.displayName || patient.email}</p>
                      <p className="text-sm sm:text-[24px] text-[#8394AE] sm:leading-[1.1] truncate">{patient.email}</p>
                    </div>
                  </div>
                  <div className="flex items-end sm:items-center gap-6">
                    <div className="text-right">
                      <p className="text-[11px] font-semibold tracking-[0.1em] uppercase text-[#90A0B5] mb-1">Status</p>
                      <span className={`inline-block px-4 py-1 rounded-full text-xs font-semibold tracking-[0.08em] uppercase whitespace-nowrap ${getStatusColor(status)}`}>
                      {status}
                      </span>
                    </div>
                    <button
                      type="button"
                      className="text-[#B8C5D6] hover:text-[#93A4B8] text-2xl leading-none px-1"
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
