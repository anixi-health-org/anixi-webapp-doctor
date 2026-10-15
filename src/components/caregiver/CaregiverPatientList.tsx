import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Patient } from '../../types';
import { patientContactLabel } from '../../utils/patientContact';
import { patientAccountStatus, patientAccountStatusLabel } from '../../utils/patientRosterStatus';
import { ListRowsSkeleton } from '../ui/Skeleton';

interface CaregiverPatientListProps {
  patients: Patient[];
  loading: boolean;
  adherenceByPatient?: Map<string, number>;
  onPatientClick?: (patient: Patient) => void;
  compact?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
}

export const CaregiverPatientList: React.FC<CaregiverPatientListProps> = ({
  patients,
  loading,
  adherenceByPatient,
  onPatientClick,
  compact = false,
  emptyTitle = 'No patients linked yet',
  emptyDescription = 'When a patient adds your email as their caregiver in the Anixi app, they will appear here automatically.',
}) => {
  const navigate = useNavigate();

  const handleClick = (patient: Patient) => {
    if (onPatientClick) {
      onPatientClick(patient);
      return;
    }
    navigate(`/caregiver/patients/${patient.id}`);
  };

  if (loading) {
    return <ListRowsSkeleton rows={compact ? 3 : 5} />;
  }

  if (patients.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-200 bg-gray-50/50 px-6 py-14 text-center">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-anixi-green/10 text-2xl">
          👥
        </div>
        <p className="font-heading text-lg font-semibold text-gray-900">{emptyTitle}</p>
        <p className="mt-2 max-w-md text-sm leading-relaxed text-gray-500">{emptyDescription}</p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-gray-100">
      {patients.map((patient) => {
        const status = patientAccountStatus(patient);
        const contact = patientContactLabel(patient.email);
        const adherence = adherenceByPatient?.get(patient.id);
        const statusStyles =
          status === 'active'
            ? 'bg-emerald-50 text-emerald-700'
            : status === 'pending'
              ? 'bg-amber-50 text-amber-700'
              : 'bg-gray-100 text-gray-600';

        return (
          <button
            key={patient.id}
            type="button"
            onClick={() => handleClick(patient)}
            className={`flex w-full items-center gap-4 text-left transition-colors hover:bg-gray-50/80 ${
              compact ? 'px-4 py-3' : 'px-5 py-4'
            }`}
          >
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-anixi-green text-sm font-bold text-white">
              {(patient.displayName || contact || '?').charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold text-gray-900">
                {patient.displayName || 'Unnamed patient'}
              </p>
              <p className="truncate text-sm text-gray-500">{contact || '—'}</p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1">
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${statusStyles}`}>
                {patientAccountStatusLabel(status)}
              </span>
              {adherence !== undefined && (
                <span className="text-xs text-gray-500">{Math.round(adherence)}% adherence</span>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
};
