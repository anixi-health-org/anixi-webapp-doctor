import React from 'react';
import type { DjangoPracticePatient } from '../../services/djangoApiService';
import { unichartsChartNameLabel } from '../../lib/patientDisplayName';
import { PatientWarriorAvatar } from './PatientWarriorAvatar';

type Props = {
  patient: DjangoPracticePatient;
  isEditing?: boolean;
  className?: string;
};

function formatDob(value?: string | null): string {
  if (!value?.trim()) return '—';
  const parsed = new Date(value.includes('T') ? value : `${value}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' });
}

function MetaChip({ label, value }: { label: string; value?: string | null }) {
  const text = value?.trim();
  if (!text) return null;
  return (
    <span className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-[#e1e7ef] bg-white/80 px-2.5 py-1 text-xs text-[#344256]">
      <span className="font-medium text-[#8FA0B6]">{label}</span>
      <span className="truncate font-semibold">{text}</span>
    </span>
  );
}

export const PracticePatientHero: React.FC<Props> = ({ patient, isEditing, className = '' }) => {
  const chartLabel = unichartsChartNameLabel(patient.displayName, patient.unichartChartName);
  const hasPhoto = Boolean(patient.profileImageUrl?.trim());
  const statusLabel = patient.isActive === false ? 'Inactive' : 'Active roster';

  return (
    <section
      className={`relative overflow-hidden rounded-2xl border border-[#427160]/15 bg-gradient-to-br from-[#f4faf7] via-white to-[#f8fafc] p-5 shadow-sm ${className}`}
    >
      <div
        className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-[#427160]/5"
        aria-hidden
      />
      <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center">
        <PatientWarriorAvatar
          displayName={patient.displayName}
          profileImageUrl={patient.profileImageUrl}
          size="hero"
          showWarriorBadge={hasPhoto}
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-2xl font-bold tracking-tight text-[#0E2340]">
              {patient.displayName || 'Patient'}
            </h2>
            <span
              className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                patient.isActive === false
                  ? 'bg-[#fef2f2] text-[#b91c1c]'
                  : 'bg-[#427160]/10 text-[#427160]'
              }`}
            >
              {statusLabel}
            </span>
            {hasPhoto ? (
              <span className="rounded-full bg-[#0E2340]/90 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                Warrior photo
              </span>
            ) : null}
          </div>
          {isEditing ? (
            <p className="mt-1 text-xs text-[#65758b]">Editing chart — save when finished.</p>
          ) : (
            <p className="mt-1 text-sm text-[#65758b]">
              {hasPhoto
                ? 'Profile photo syncs from the patient’s Anixi app.'
                : 'No app photo yet — initials shown until the Warrior adds one.'}
            </p>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            <MetaChip label="DOB" value={formatDob(patient.dateOfBirth)} />
            <MetaChip label="Gender" value={patient.gender} />
            <MetaChip label="Blood" value={patient.bloodGroup} />
            <MetaChip label="ID" value={patient.idNumber} />
            <MetaChip label="MRN" value={patient.mrn} />
            {chartLabel ? <MetaChip label="Chart" value={chartLabel} /> : null}
          </div>
        </div>
      </div>
    </section>
  );
};
