import React from 'react';
import { EllipsisVerticalIcon, EnvelopeIcon, PhoneIcon } from '@heroicons/react/24/outline';
import clsx from 'clsx';
import { Patient } from '../../types';
import { patientContactLabel } from '../../utils/patientContact';
import {
  patientAccountStatus,
  patientAccountStatusLabel,
  type PatientAccountStatus,
} from '../../utils/patientRosterStatus';

function ageFromDob(dob?: Date) {
  if (!dob) return null;
  const d = dob instanceof Date ? dob : new Date(dob);
  if (Number.isNaN(d.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - d.getFullYear();
  const m = today.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < d.getDate())) age -= 1;
  return age;
}

function statusClass(status: PatientAccountStatus) {
  if (status === 'active') return 'bg-[rgba(33,196,93,0.1)] text-[#21c45d]';
  if (status === 'pending') return 'bg-[rgba(245,158,11,0.12)] text-[#d97706]';
  return 'bg-slate-100 text-slate-600';
}

type Props = {
  patients: Patient[];
  emptyMessage: string;
  onOpen: (patientId: string) => void;
  assignedDoctorName?: (patient: Patient) => string;
};

export const DoctorPatientRecordsTable: React.FC<Props> = ({
  patients,
  emptyMessage,
  onOpen,
  assignedDoctorName,
}) => {
  const showAssigned = Boolean(assignedDoctorName);
  const columns = showAssigned ? 6 : 5;

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-left text-sm">
        <thead>
          <tr className="border-b border-[#e1e7ef] text-[#65758b]">
            <th className="px-4 py-3 font-medium sm:px-6">Patient</th>
            <th className="px-4 py-3 font-medium">Contact</th>
            <th className="px-4 py-3 font-medium">Condition</th>
            {showAssigned ? <th className="px-4 py-3 font-medium">Assigned doctor</th> : null}
            <th className="px-4 py-3 font-medium">Status</th>
            <th className="px-4 py-3 font-medium text-right sm:px-6">Actions</th>
          </tr>
        </thead>
        <tbody>
          {patients.map((patient) => {
            const status = patientAccountStatus(patient);
            const contact = patientContactLabel(patient.email);
            const age = ageFromDob(patient.dateOfBirth);
            const initials = (patient.displayName || contact || '?')
              .split(' ')
              .map((part) => part[0])
              .join('')
              .slice(0, 2)
              .toUpperCase();
            return (
              <tr
                key={patient.id}
                className="cursor-pointer border-b border-[#e1e7ef]/70 last:border-0 hover:bg-[#f8fafc]"
                onClick={() => onOpen(patient.id)}
              >
                <td className="px-4 py-4 sm:px-6">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#eef4f1] text-xs font-semibold text-[#427160]">
                      {initials}
                    </div>
                    <div>
                      <p className="font-semibold text-[#344256]">
                        {patient.displayName || 'Unnamed Patient'}
                      </p>
                      <p className="text-xs text-[#65758b]">
                        {[age != null ? `${age}y` : null, patient.gender].filter(Boolean).join(' · ') ||
                          ' '}
                      </p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-4">
                  <div className="space-y-1 text-[#65758b]">
                    {patient.phoneNumber ? (
                      <p className="flex items-center gap-1.5">
                        <PhoneIcon className="h-3.5 w-3.5" />
                        {patient.phoneNumber}
                      </p>
                    ) : null}
                    {contact ? (
                      <p className="flex items-center gap-1.5">
                        <EnvelopeIcon className="h-3.5 w-3.5" />
                        <span className="truncate">{contact}</span>
                      </p>
                    ) : null}
                    {!patient.phoneNumber && !contact ? '—' : null}
                  </div>
                </td>
                <td className="px-4 py-4 text-[#344256]">{patient.chronicDiseases?.[0] || '—'}</td>
                {showAssigned ? (
                  <td className="px-4 py-4 text-[#344256]">{assignedDoctorName?.(patient) || 'Unassigned'}</td>
                ) : null}
                <td className="px-4 py-4">
                  <span className={clsx('rounded-full px-2.5 py-0.5 text-xs font-semibold', statusClass(status))}>
                    {patientAccountStatusLabel(status)}
                  </span>
                </td>
                <td className="px-4 py-4 text-right sm:px-6">
                  <button
                    type="button"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[#65758b] hover:bg-[#f1f5f9]"
                    onClick={(event) => {
                      event.stopPropagation();
                      onOpen(patient.id);
                    }}
                    aria-label="Open patient"
                  >
                    <EllipsisVerticalIcon className="h-5 w-5" />
                  </button>
                </td>
              </tr>
            );
          })}
          {patients.length === 0 ? (
            <tr>
              <td colSpan={columns} className="px-4 py-12 text-center text-[#65758b]">
                {emptyMessage}
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
};
