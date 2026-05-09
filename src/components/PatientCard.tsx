import React from 'react';
import { Patient, PatientStatus } from '../types';
import { calculateAge, formatGender, formatPhone, isEmpty } from '../utils/dataFormatter';
import { customColors } from '../lib/customColors';

interface PatientCardProps {
  patient: Patient;
  status: PatientStatus;
  adherenceRate?: number;
  adherenceLabel?: string;
  onOpenAdherenceCalendar?: () => void;
  onOpenAdherenceLogs?: () => void;
  onClick: () => void;
}

const getStatusColor = (status: PatientStatus) => {
  switch (status) {
    case 'stable':
      return 'bg-green-50 border-green-200 hover:border-green-400';
    case 'warning':
      return 'bg-yellow-50 border-yellow-200 hover:border-yellow-400';
    case 'inactive':
      return 'bg-gray-50 border-gray-200 hover:border-gray-400';
    default:
      return 'bg-white border-gray-200';
  }
};

const getStatusBadgeColor = (status: PatientStatus) => {
  switch (status) {
    case 'stable':
      return 'bg-green-100 text-green-800';
    case 'warning':
      return 'bg-yellow-100 text-yellow-800';
    case 'inactive':
      return 'bg-gray-100 text-gray-800';
    default:
      return `bg-[${customColors.backgroundLight}] text-[${customColors.textPrimary}]`;
  }
};
const getAdherencePill = (label: string | undefined): string => {
  if (label === 'excellent') return 'bg-green-100 text-green-800';
  if (label === 'moderate') return 'bg-yellow-100 text-yellow-800';
  if (label === 'low') return 'bg-red-100 text-red-800';
  return 'bg-gray-100 text-gray-700';
};

export const PatientCard: React.FC<PatientCardProps> = ({
  patient,
  status,
  adherenceRate,
  adherenceLabel,
  onOpenAdherenceCalendar,
  onOpenAdherenceLogs,
  onClick,
}) => {
  const age = calculateAge(patient.dateOfBirth);
  const formattedGender = formatGender(patient.gender);
  const formattedPhone = formatPhone(patient.phoneNumber);
  const hasAdherence = typeof adherenceRate === 'number';
  return (
    <div
      onClick={onClick}
      className={`p-4 border rounded-lg cursor-pointer transition-all duration-200 transform hover:scale-102 hover:shadow-md ${getStatusColor(status)}`}
    >
      <div className="flex flex-col h-full">
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1">
            <h3 className="font-semibold text-gray-900 text-lg">
              {patient.displayName ? patient.displayName.toUpperCase() : 'Patient'}
            </h3>
          </div>
          <span
            className={`ml-2 px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${getStatusBadgeColor(status)}`}
          >
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </span>
        </div>
        <div className="space-y-2 text-sm flex-1">
          <div className="text-gray-700">
            {formattedGender && age !== null ? (
              <span>
                <span className="font-medium">{formattedGender}</span>
                {' • '}
                <span>{age} {age === 1 ? 'year' : 'years'} old</span>
              </span>
            ) : formattedGender ? (
              <span>{formattedGender}</span>
            ) : age !== null ? (
              <span>{age} {age === 1 ? 'year' : 'years'} old</span>
            ) : null}
          </div>
          {formattedPhone && (
            <div className="text-gray-700">
              <span className="text-xs text-gray-500">Phone: </span>
              <span>{formattedPhone}</span>
            </div>
          )}
          {patient.email && !isEmpty(patient.email) && (
            <div className="text-gray-700 truncate">
              <span className="text-xs text-gray-500">Email: </span>
              <span className="truncate">{patient.email}</span>
            </div>
          )}
          {hasAdherence && (
            <div className="mt-2">
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-gray-600">Adherence</span>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-gray-900">{adherenceRate}%</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${getAdherencePill(adherenceLabel)}`}>
                    {adherenceLabel || 'no-data'}
                  </span>
                </div>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-1.5">
                <div
                  className="bg-green-500 h-1.5 rounded-full"
                  style={{ width: `${adherenceRate}%` }}
                ></div>
              </div>
            </div>
          )}

          {(onOpenAdherenceCalendar || onOpenAdherenceLogs) && (
            <div className="mt-4 flex gap-2">
              {onOpenAdherenceCalendar && (
                <button
                  onClick={(event) => {
                    event.stopPropagation();
                    onOpenAdherenceCalendar();
                  }}
                  className="px-3 py-1.5 text-xs font-semibold rounded-md bg-blue-50 text-blue-700 hover:bg-blue-100"
                >
                  Calendar
                </button>
              )}
              {onOpenAdherenceLogs && (
                <button
                  onClick={(event) => {
                    event.stopPropagation();
                    onOpenAdherenceLogs();
                  }}
                  className="px-3 py-1.5 text-xs font-semibold rounded-md bg-green-50 text-green-700 hover:bg-green-100"
                >
                  Logs
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
