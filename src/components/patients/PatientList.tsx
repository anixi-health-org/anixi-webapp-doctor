import React from 'react';
import { Users } from 'lucide-react';
import { Patient } from '../../types';
import { getPatientStatus } from '../../services/patientManagementService';
import { ListRowsSkeleton } from '../ui/Skeleton';

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
    return <ListRowsSkeleton rows={6} />;
  }

  if (patients.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-gray-500">
        <Users className="mb-4 h-14 w-14 text-gray-300" />
        <p className="font-heading text-lg font-medium text-gray-800">No patients connected yet</p>
        <p className="mt-1 font-sans text-sm">Pending patient requests will appear here</p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-gray-100">
      {patients.map((patient) => {
        const status = getPatientStatus(patient);
        const statusColor =
          status === 'stable'
            ? 'bg-emerald-50 text-emerald-700'
            : status === 'warning'
              ? 'bg-amber-50 text-amber-700'
              : 'bg-gray-100 text-gray-600';
        const avatarColor =
          status === 'warning'
            ? 'bg-amber-500'
            : status === 'inactive'
              ? 'bg-slate-400'
              : 'bg-emerald-500';

        return (
          <div
            key={patient.id}
            onClick={() => onPatientClick(patient)}
            className="cursor-pointer px-5 py-5 transition-colors hover:bg-gray-50/80"
          >
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex min-w-0 items-center gap-4">
                <div
                  className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl font-sans text-sm font-bold text-white shadow-soft ${avatarColor}`}
                >
                  {(patient.displayName || patient.email || '?').charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="truncate font-sans font-semibold text-gray-900">
                    {patient.displayName || 'Unnamed Patient'}
                  </p>
                  <p className="truncate font-sans text-sm text-gray-500">{patient.email}</p>
                </div>
              </div>
              <span
                className={`inline-flex w-fit rounded-full px-3 py-1 font-sans text-xs font-semibold capitalize ${statusColor}`}
              >
                {status}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
};
