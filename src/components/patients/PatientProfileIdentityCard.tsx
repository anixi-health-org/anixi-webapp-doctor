import React, { useEffect, useState } from 'react';
import { ArrowRightIcon, CalendarDaysIcon } from '@heroicons/react/24/outline';
import {
  getDoctorAdherenceDetailsInRange,
  getDoctorMonthlyAdherenceDetails,
} from '../../services/adherenceService';
import { getPatientMedications } from '../../services/logsService';
import { Patient } from '../../types';
import { getDateString } from '../../utils/dateFormatter';
import {
  calculateAge,
  formatDate,
  formatGender,
  formatName,
} from '../../utils/dataFormatter';

export interface PatientHealthSnapshot {
  adherencePercent: number;
  taken: number;
  missed: number;
  pending: number;
  weeklyTrend: number[];
  /** Labels for each weeklyTrend bar (local weekday). */
  weeklyLabels: string[];
  /** Count from patient Pill Box (`Users/{id}/medications`). */
  pillBoxMedicationCount: number;
}

interface PatientProfileIdentityCardProps {
  patient: Patient;
  onViewAllDetails: () => void;
  upcomingAppointments?: number;
  healthSnapshot?: PatientHealthSnapshot | null;
  snapshotLoading?: boolean;
}

function MiniRing({ percent }: { percent: number }) {
  const clamped = Math.min(100, Math.max(0, percent));
  return (
    <div className="relative h-14 w-14 shrink-0">
      <svg viewBox="0 0 36 36" className="h-full w-full -rotate-90">
        <circle cx="18" cy="18" r="15.5" fill="none" stroke="#e5e7eb" strokeWidth="3" />
        <circle
          cx="18"
          cy="18"
          r="15.5"
          fill="none"
          stroke="#1f5c45"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={`${(clamped / 100) * 97.4} 97.4`}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-xs font-bold text-anixi-green">{clamped}%</span>
      </div>
    </div>
  );
}

function WeeklyBars({ values, labels }: { values: number[]; labels?: string[] }) {
  const fallback = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  return (
    <div className="flex items-end justify-between gap-1">
      {values.map((value, idx) => (
        <div key={idx} className="flex flex-1 flex-col items-center gap-1">
          <div className="flex h-12 w-full items-end justify-center rounded-sm bg-gray-100 px-0.5">
            <div
              className="w-full max-w-[14px] rounded-sm bg-anixi-green/80 transition-all"
              style={{ height: `${Math.max(value > 0 ? 12 : 4, (value / 100) * 100)}%` }}
              title={`${value}%`}
            />
          </div>
          <span className="text-[9px] font-medium text-gray-400">
            {labels?.[idx] ?? fallback[idx]}
          </span>
        </div>
      ))}
    </div>
  );
}

export const PatientProfileIdentityCard: React.FC<PatientProfileIdentityCardProps> = ({
  patient,
  onViewAllDetails,
  upcomingAppointments = 0,
  healthSnapshot,
  snapshotLoading = false,
}) => {
  const name = formatName(patient.displayName) || 'Patient';
  const age = calculateAge(patient.dateOfBirth);
  const gender = formatGender(patient.gender);
  const initials = (name || patient.email || '?')
    .split(' ')
    .map((part) => part.charAt(0))
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const dobLabel = patient.dateOfBirth ? formatDate(patient.dateOfBirth, 'short') : null;

  const totalMeds =
    (healthSnapshot?.taken ?? 0) +
    (healthSnapshot?.missed ?? 0) +
    (healthSnapshot?.pending ?? 0);

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-gray-200/80 bg-white shadow-sm">
      <div className="border-b border-gray-100 bg-gradient-to-b from-anixi-green/[0.08] to-white px-5 pb-5 pt-6">
        <div className="flex flex-col items-center text-center">
          {patient.photoURL ? (
            <img
              src={patient.photoURL}
              alt={`${name} profile`}
              className="h-28 w-28 shrink-0 rounded-2xl border-4 border-white object-cover shadow-lg ring-2 ring-anixi-green/25"
            />
          ) : (
            <div className="flex h-28 w-28 shrink-0 items-center justify-center rounded-2xl border-4 border-white bg-anixi-green text-3xl font-bold text-white shadow-lg ring-2 ring-anixi-green/25">
              {initials}
            </div>
          )}
          <p className="mt-4 text-[10px] font-semibold uppercase tracking-[0.14em] text-anixi-green">
            Active patient
          </p>
          <h2 className="font-heading mt-1 text-xl font-semibold leading-tight text-gray-900">
            {name}
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            {[age !== null ? `${age} yrs` : null, gender, dobLabel ? `DOB ${dobLabel}` : null]
              .filter(Boolean)
              .join(' · ')}
          </p>
          {patient.medicalAid?.provider && (
            <p className="mt-2 text-xs text-gray-500">
              Medical aid · {patient.medicalAid.provider}
            </p>
          )}
        </div>
      </div>

      <div className="flex-1 space-y-4 px-5 py-4">
        <div className="rounded-xl border border-gray-100 bg-gray-50/50 p-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
              Medication adherence
            </p>
            <span className="text-[10px] text-gray-400">This month</span>
          </div>
          {snapshotLoading ? (
            <div className="h-16 animate-pulse rounded-lg bg-gray-200/60" />
          ) : healthSnapshot ? (
            <div className="flex gap-3">
              <MiniRing percent={healthSnapshot.adherencePercent} />
              <div className="min-w-0 flex-1 space-y-2">
                {totalMeds > 0 ? (
                  <div className="flex h-2 overflow-hidden rounded-full bg-gray-200">
                    <div
                      className="bg-green-500"
                      style={{ width: `${(healthSnapshot.taken / totalMeds) * 100}%` }}
                    />
                    <div
                      className="bg-red-400"
                      style={{ width: `${(healthSnapshot.missed / totalMeds) * 100}%` }}
                    />
                    <div
                      className="bg-amber-400"
                      style={{ width: `${(healthSnapshot.pending / totalMeds) * 100}%` }}
                    />
                  </div>
                ) : (
                  <div className="h-2 rounded-full bg-gray-200" />
                )}
                <div className="flex justify-between text-[10px] text-gray-500">
                  <span className="text-green-700">{healthSnapshot.taken} taken</span>
                  <span className="text-red-600">{healthSnapshot.missed} missed</span>
                  <span className="text-amber-600">{healthSnapshot.pending} pending</span>
                </div>
                <WeeklyBars
                  values={healthSnapshot.weeklyTrend}
                  labels={healthSnapshot.weeklyLabels}
                />
              </div>
            </div>
          ) : (
            <p className="text-xs text-gray-500">No adherence data yet this month.</p>
          )}
        </div>

        <div className="flex items-center justify-between rounded-lg border border-sky-100 bg-sky-50/50 px-3 py-2.5">
          <div className="flex items-center gap-2">
            <CalendarDaysIcon className="h-4 w-4 text-sky-600" />
            <span className="text-xs font-medium text-gray-700">Upcoming visits</span>
          </div>
          <span className="text-sm font-bold text-sky-800">{upcomingAppointments}</span>
        </div>
      </div>

      <div className="mt-auto border-t border-gray-100 bg-gray-50/60 px-5 py-3">
        <button
          type="button"
          onClick={onViewAllDetails}
          className="inline-flex w-full items-center justify-center gap-1 rounded-lg bg-anixi-green px-3 py-2.5 text-xs font-semibold text-white hover:opacity-90"
        >
          All details
          <ArrowRightIcon className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
};

/** Loads monthly adherence + rolling 7-day trend from the same patient collections. */
export function usePatientHealthSnapshot(patientId: string | undefined, doctorId: string | undefined) {
  const [snapshot, setSnapshot] = useState<PatientHealthSnapshot | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!patientId || !doctorId) {
      setLoading(false);
      return;
    }

    const load = async () => {
      setLoading(true);
      try {
        const now = new Date();
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - 6);
        weekStart.setHours(0, 0, 0, 0);
        const weekEnd = new Date(now);
        weekEnd.setHours(23, 59, 59, 999);

        const [details, weekDetails, medications] = await Promise.all([
          getDoctorMonthlyAdherenceDetails(
            doctorId,
            patientId,
            now.getFullYear(),
            now.getMonth()
          ),
          getDoctorAdherenceDetailsInRange(doctorId, patientId, weekStart, weekEnd),
          getPatientMedications(patientId).catch(() => []),
        ]);

        const weeklyTrend: number[] = [];
        const weeklyLabels: string[] = [];
        for (let i = 6; i >= 0; i--) {
          const d = new Date(now);
          d.setDate(d.getDate() - i);
          const key = getDateString(d);
          const day = weekDetails.dayMap.get(key);
          weeklyTrend.push(day?.percentage ?? 0);
          weeklyLabels.push(d.toLocaleDateString(undefined, { weekday: 'narrow' }));
        }

        setSnapshot({
          adherencePercent: details.monthStats.adherencePercentage,
          taken: details.monthStats.takenTotal,
          missed: details.monthStats.missedTotal,
          pending: details.monthStats.pendingTotal,
          weeklyTrend,
          weeklyLabels,
          pillBoxMedicationCount: Array.isArray(medications) ? medications.length : 0,
        });
      } catch {
        setSnapshot(null);
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [patientId, doctorId]);

  return { snapshot, loading };
}
