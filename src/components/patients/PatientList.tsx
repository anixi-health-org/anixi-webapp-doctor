import React from 'react';
import { Patient } from '../../types';
import { getPatientStatus } from '../../services/patientManagementService';
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
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#425950]"></div>
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
    <div className="divide-y divide-[#E9EEF4]">
      {patients.map((patient) => {
        const status = getPatientStatus(patient);
        const statusColor =
          status === 'stable'
            ? 'bg-[#DDF6E9] text-[#0E9F6E]'
            : status === 'warning'
              ? 'bg-[#FFEAD1] text-[#D9480F]'
              : 'bg-[#EEF2F7] text-[#5C6775]';
        return (
          <div
            key={patient.id}
            onClick={() => onPatientClick(patient)}
            className="cursor-pointer px-5 py-5 transition-colors hover:bg-[#FBFCFD]"
          >
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-center gap-4 min-w-0">
                <div className={`h-12 w-12 rounded-2xl ${status === 'warning' ? 'bg-[#FF7A00]' : status === 'inactive' ? 'bg-[#94A3B8]' : 'bg-[#10B981]'} text-white font-bold flex items-center justify-center shadow-sm flex-shrink-0`}>
                  {(patient.displayName || patient.email || 'P').charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <h3 className="text-lg sm:text-xl font-semibold text-[#0E2340] truncate">
                    {patient.displayName}
                  </h3>
                  <p className="text-sm text-[#8A99AF] truncate">{patient.email}</p>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6 lg:pr-2">
                <div className="text-left sm:text-right">
                  <p className="text-[11px] font-semibold tracking-[0.12em] uppercase text-[#C0CAD8]">Last Seen</p>
                  <p className="text-sm font-semibold text-[#0E2340]">No visits</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold tracking-[0.08em] uppercase ${statusColor}`}>
                    {status.charAt(0).toUpperCase() + status.slice(1)}
                  </span>
                  <button
                    type="button"
                    className="text-[#CBD5E1] hover:text-[#8FA0B6] text-2xl leading-none px-2"
                    onClick={(event) => event.stopPropagation()}
                    aria-label="More actions"
                  >
                    ⋮
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
