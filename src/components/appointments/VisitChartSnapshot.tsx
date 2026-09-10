import React, { useEffect, useMemo, useState } from 'react';
import { Activity, HeartPulse, Pill, Smile, UserRound } from 'lucide-react';
import { getPatientForDoctorView } from '../../services/patientManagementService';
import { getDoctorMonthlyAdherenceDetails } from '../../services/adherenceService';
import {
  getMoodEntriesForMonth,
  getVitalsLogs,
} from '../../services/logsService';
import { Patient } from '../../types';
import {
  averageMoodScore,
  getMoodEmoji,
  getMoodEntryStyles,
  getMoodScore,
  normalizeMoodLabel,
  type MoodValue,
} from '../../lib/moodDisplay';
import {
  calculateAge,
  formatAddress,
  formatDate,
  formatEmail,
  formatGender,
  formatName,
  formatPhone,
  isEmpty,
} from '../../utils/dataFormatter';

type BriefingTab = 'overview' | 'profile' | 'vitals' | 'adherence' | 'mood';

interface VisitPatientBriefingProps {
  doctorId: string;
  patientId: string;
  isManual?: boolean;
  patientName?: string;
  patientEmail?: string;
}

interface VitalsRow {
  timestamp: Date;
  heartRate?: number;
  systolic?: number;
  diastolic?: number;
  temperature?: number;
  bloodSugar?: number;
}

interface MoodRow {
  timestamp: Date | null;
  mood: MoodValue;
  notes?: string;
}

/** Mood entries are stamped `createdAt`; older rows used other field names. */
function moodEntryDate(entry: Record<string, unknown>): Date | null {
  const raw = entry.createdAt ?? entry.timestamp ?? entry.date;
  if (raw instanceof Date) return Number.isNaN(raw.getTime()) ? null : raw;
  if (typeof raw === 'string' || typeof raw === 'number') {
    const parsed = new Date(raw);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
}

const TABS: { id: BriefingTab; label: string; icon: React.ElementType }[] = [
  { id: 'overview', label: 'Overview', icon: Activity },
  { id: 'profile', label: 'Profile', icon: UserRound },
  { id: 'vitals', label: 'Vitals', icon: HeartPulse },
  { id: 'adherence', label: 'Adherence', icon: Pill },
  { id: 'mood', label: 'Mood', icon: Smile },
];

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-[#8FA0B6]">{label}</p>
      <p className={`mt-1 text-sm ${isEmpty(value) ? 'text-[#94a3b8]' : 'font-medium text-[#344256]'}`}>
        {isEmpty(value) ? 'Not recorded' : value}
      </p>
    </div>
  );
}

function SparkBars({ values, maxHint }: { values: number[]; maxHint?: number }) {
  const max = Math.max(maxHint || 0, ...values, 1);
  return (
    <div className="flex h-16 items-end gap-1">
      {values.map((v, i) => (
        <div
          key={i}
          className="min-w-[6px] flex-1 rounded-t bg-anixi-green/80"
          style={{ height: `${Math.max(8, (v / max) * 100)}%` }}
          title={String(v)}
        />
      ))}
    </div>
  );
}

export const VisitPatientBriefing: React.FC<VisitPatientBriefingProps> = ({
  doctorId,
  patientId,
  isManual,
  patientName,
  patientEmail,
}) => {
  const [tab, setTab] = useState<BriefingTab>('overview');
  const [loading, setLoading] = useState(true);
  const [patient, setPatient] = useState<Patient | null>(null);
  const [vitals, setVitals] = useState<VitalsRow[]>([]);
  const [adherencePct, setAdherencePct] = useState<number | null>(null);
  const [adherenceTaken, setAdherenceTaken] = useState(0);
  const [adherenceMissed, setAdherenceMissed] = useState(0);
  const [adherencePending, setAdherencePending] = useState(0);
  const [weeklyTrend, setWeeklyTrend] = useState<number[]>([]);
  const [moods, setMoods] = useState<MoodRow[]>([]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!doctorId || !patientId || isManual || patientId === 'unknown' || patientId === 'manual') {
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const now = new Date();
        const months = [0, 1, 2].map((offset) => {
          const d = new Date(now.getFullYear(), now.getMonth() - offset, 1);
          return { year: d.getFullYear(), month: d.getMonth() + 1 };
        });

        const found = await getPatientForDoctorView(doctorId, patientId, {
          patientName,
          patientEmail,
        });
        if (cancelled) return;
        setPatient(found);

        const [monthDetails, moodEntries, ...vitalsMonths] = await Promise.all([
          getDoctorMonthlyAdherenceDetails(
            doctorId,
            patientId,
            now.getFullYear(),
            now.getMonth() + 1
          ).catch(() => null),
          getMoodEntriesForMonth(patientId, now.getFullYear(), now.getMonth() + 1).catch(() => []),
          ...months.map(({ year, month }) =>
            getVitalsLogs(patientId, year, month).catch(() => [])
          ),
        ]);

        if (cancelled) return;

        if (monthDetails?.monthStats) {
          setAdherencePct(Math.round(monthDetails.monthStats.adherencePercentage || 0));
          setAdherenceTaken(monthDetails.monthStats.takenTotal || 0);
          setAdherenceMissed(monthDetails.monthStats.missedTotal || 0);
          setAdherencePending(monthDetails.monthStats.pendingTotal || 0);
          const dayMap = monthDetails.dayMap;
          const days = Array.from(dayMap.keys()).sort().slice(-14);
          setWeeklyTrend(
            days.map((d) => {
              const day = dayMap.get(d);
              return typeof day?.percentage === 'number' ? day.percentage : 0;
            })
          );
        }

        const flatVitals: VitalsRow[] = vitalsMonths
          .flat()
          .map((v: any) => ({
            timestamp: v.timestamp instanceof Date ? v.timestamp : new Date(v.timestamp),
            heartRate: v.heartRate,
            systolic: v.bloodPressure?.systolic,
            diastolic: v.bloodPressure?.diastolic,
            temperature: v.temperature,
            bloodSugar: v.bloodSugar,
          }))
          .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
        setVitals(flatVitals);

        const moodRows: MoodRow[] = (moodEntries || [])
          .map((m: any) => ({
            timestamp: moodEntryDate(m),
            mood: (m.mood ?? m.score ?? null) as MoodValue,
            notes: m.note ?? m.notes,
          }))
          .sort(
            (a: MoodRow, b: MoodRow) =>
              (b.timestamp?.getTime() ?? 0) - (a.timestamp?.getTime() ?? 0)
          );
        setMoods(moodRows);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [doctorId, patientId, isManual, patientName, patientEmail]);

  const latestVital = vitals[0];
  const hrSeries = useMemo(
    () =>
      vitals
        .filter((v) => v.heartRate)
        .slice(0, 12)
        .reverse()
        .map((v) => v.heartRate as number),
    [vitals]
  );
  const sugarSeries = useMemo(
    () =>
      vitals
        .filter((v) => v.bloodSugar)
        .slice(0, 12)
        .reverse()
        .map((v) => v.bloodSugar as number),
    [vitals]
  );

  const moodSummary = useMemo(() => {
    const scores = moods
      .map((m) => getMoodScore(m.mood))
      .filter((score): score is number => score !== null);
    if (scores.length === 0) return null;

    const average = averageMoodScore(moods);

    return {
      average,
      // Labels are defined for whole scores only, so 4.2 reads as "Happy".
      averageBand: average != null ? Math.round(average) : null,
      lowDays: scores.filter((score) => score <= 2).length,
      entries: scores.length,
      latest: moods.find((m) => getMoodScore(m.mood) !== null) ?? null,
    };
  }, [moods]);

  if (isManual || patientId === 'unknown' || patientId === 'manual') {
    return (
      <div className="rounded-[14px] border border-dashed border-[#e1e7ef] bg-[#f8fafc] p-5 text-sm text-[#65758b]">
        Manual patient - no linked Anixi chart. Confirm identity verbally, then start the call when ready.
      </div>
    );
  }

  if (loading) {
    return (
      <div className="animate-pulse space-y-3 rounded-[14px] border border-[#e1e7ef] bg-white p-5">
        <div className="h-4 w-48 rounded bg-[#eef2f6]" />
        <div className="h-24 rounded bg-[#eef2f6]" />
        <div className="h-40 rounded bg-[#eef2f6]" />
      </div>
    );
  }

  const allergies = patient?.allergies?.filter(Boolean) ?? [];
  const conditions = patient?.chronicDiseases?.filter(Boolean) ?? [];
  const treatments = patient?.currentTreatments ?? [];

  const initials = (formatName(patient?.displayName) || 'P')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');

  return (
    <div className="overflow-hidden rounded-2xl border border-[#e1e7ef] bg-white shadow-sm">
      <div className="border-b border-[#eef2f6] px-5 pt-5">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-anixi-green text-sm font-bold text-white">
              {initials || 'P'}
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[#8FA0B6]">
                Patient chart
              </p>
              <h2 className="mt-0.5 truncate text-lg font-bold text-[#0E2340]">
                {formatName(patient?.displayName) || 'Patient'}
              </h2>
              <p className="mt-0.5 text-[13px] text-[#65758b]">
                {[
                  formatPhone(patient?.phoneNumber),
                  formatEmail(patient?.email),
                  patient?.dateOfBirth ? `Age ${calculateAge(patient.dateOfBirth)}` : null,
                ]
                  .filter(Boolean)
                  .join(' · ') || 'Contact details not recorded'}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {allergies.length > 0 && (
              <span className="rounded-full bg-red-50 px-2.5 py-1 text-[11px] font-semibold text-red-700">
                Allergy · {allergies.join(', ')}
              </span>
            )}
            {adherencePct != null && (
              <span className="rounded-full bg-[#eef4f1] px-2.5 py-1 text-[11px] font-semibold text-anixi-green">
                Adherence {adherencePct}%
              </span>
            )}
          </div>
        </div>

        <nav className="mb-4 flex gap-1 overflow-x-auto rounded-2xl bg-[#e8f0ec] p-1">
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`inline-flex min-w-max flex-1 items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-[13px] font-semibold transition ${
                  active
                    ? 'bg-anixi-green text-white shadow-sm'
                    : 'text-[#4d675c] hover:bg-white/70 hover:text-[#0E2340]'
                }`}
              >
                <Icon className="h-3.5 w-3.5 shrink-0" strokeWidth={2.2} />
                {t.label}
              </button>
            );
          })}
        </nav>
      </div>

      <div className="max-h-[min(58vh,640px)] overflow-y-auto p-5">
        {tab === 'overview' && (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl bg-[#f6f8fa] px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-[#8FA0B6]">
                  Allergies
                </p>
                <p className={`mt-1.5 text-sm ${allergies.length ? 'font-semibold text-red-700' : 'text-[#94a3b8]'}`}>
                  {allergies.length ? allergies.join(', ') : 'None recorded'}
                </p>
              </div>
              <div className="rounded-xl bg-[#f6f8fa] px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-[#8FA0B6]">
                  Conditions
                </p>
                <p className={`mt-1.5 text-sm ${conditions.length ? 'font-medium text-[#344256]' : 'text-[#94a3b8]'}`}>
                  {conditions.length ? conditions.join(', ') : 'None recorded'}
                </p>
              </div>
              <div className="rounded-xl bg-[#f6f8fa] px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-[#8FA0B6]">
                  Treatments
                </p>
                {treatments.length ? (
                  <ul className="mt-1.5 space-y-1 text-sm text-[#344256]">
                    {treatments.slice(0, 3).map((t, i) => (
                      <li key={`${t.name}-${i}`}>
                        <span className="font-medium">{t.name}</span>
                        {(t.dosage || t.frequency) ? (
                          <span className="text-[#65758b]">
                            {' '}
                            · {[t.dosage, t.frequency].filter(Boolean).join(' · ')}
                          </span>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-1.5 text-sm text-[#94a3b8]">None recorded</p>
                )}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-[#e1e7ef] px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-[#8FA0B6]">
                  Latest vitals
                </p>
                {latestVital ? (
                  <div className="mt-2 flex flex-wrap gap-2 text-sm text-[#344256]">
                    {latestVital.systolic && latestVital.diastolic ? (
                      <span className="rounded-lg bg-[#f6f8fa] px-2.5 py-1 font-medium">
                        BP {latestVital.systolic}/{latestVital.diastolic}
                      </span>
                    ) : null}
                    {latestVital.heartRate != null ? (
                      <span className="rounded-lg bg-[#f6f8fa] px-2.5 py-1 font-medium">
                        HR {latestVital.heartRate}
                      </span>
                    ) : null}
                    {latestVital.bloodSugar != null ? (
                      <span className="rounded-lg bg-[#f6f8fa] px-2.5 py-1 font-medium">
                        Glucose {latestVital.bloodSugar}
                      </span>
                    ) : null}
                    {latestVital.temperature != null ? (
                      <span className="rounded-lg bg-[#f6f8fa] px-2.5 py-1 font-medium">
                        Temp {latestVital.temperature}
                      </span>
                    ) : null}
                    <p className="w-full text-xs text-[#8FA0B6]">
                      {latestVital.timestamp.toLocaleString()}
                    </p>
                  </div>
                ) : (
                  <p className="mt-2 text-sm text-[#94a3b8]">No recent vitals</p>
                )}
              </div>
              <div className="rounded-xl border border-[#e1e7ef] px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-[#8FA0B6]">
                  This month adherence
                </p>
                <p className="mt-2 text-2xl font-bold text-[#0E2340]">
                  {adherencePct != null ? `${adherencePct}%` : '-'}
                </p>
                <p className="mt-1 text-xs text-[#65758b]">
                  {adherenceTaken} taken · {adherenceMissed} missed · {adherencePending} pending
                </p>
              </div>
            </div>
            {patient?.emergencyContact?.name && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
                <span className="font-semibold">Emergency contact: </span>
                {patient.emergencyContact.name}
                {patient.emergencyContact.relationship
                  ? ` (${patient.emergencyContact.relationship})`
                  : ''}
                {patient.emergencyContact.phone ? ` · ${patient.emergencyContact.phone}` : ''}
              </div>
            )}
          </div>
        )}

        {tab === 'profile' && (
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Full name" value={formatName(patient?.displayName)} />
            <Field label="Date of birth" value={formatDate(patient?.dateOfBirth)} />
            <Field
              label="Age"
              value={
                patient?.dateOfBirth ? String(calculateAge(patient.dateOfBirth)) : null
              }
            />
            <Field label="Gender" value={formatGender(patient?.gender)} />
            <Field label="Phone" value={formatPhone(patient?.phoneNumber)} />
            <Field label="Email" value={formatEmail(patient?.email)} />
            <Field label="Language" value={patient?.language} />
            <Field label="Marital status" value={patient?.maritalStatus} />
            <div className="sm:col-span-2">
              <Field label="Address" value={formatAddress(patient?.address)} />
            </div>
            <Field label="Medical aid" value={patient?.medicalAid?.provider} />
            <Field label="Member number" value={patient?.medicalAid?.memberNumber} />
            <div className="sm:col-span-2">
              <Field
                label="Emergency contact"
                value={
                  patient?.emergencyContact?.name
                    ? `${patient.emergencyContact.name}${
                        patient.emergencyContact.phone
                          ? ` · ${patient.emergencyContact.phone}`
                          : ''
                      }`
                    : null
                }
              />
            </div>
            <div className="sm:col-span-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[#8FA0B6]">
                Allergies
              </p>
              <p className="mt-1 text-sm text-[#344256]">
                {allergies.length ? allergies.join(', ') : 'None recorded'}
              </p>
            </div>
            <div className="sm:col-span-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[#8FA0B6]">
                Chronic conditions
              </p>
              <p className="mt-1 text-sm text-[#344256]">
                {conditions.length ? conditions.join(', ') : 'None recorded'}
              </p>
            </div>
            <div className="sm:col-span-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[#8FA0B6]">
                Current treatments
              </p>
              {treatments.length ? (
                <ul className="mt-2 space-y-1 text-sm text-[#344256]">
                  {treatments.map((t, i) => (
                    <li key={`${t.name}-${i}`}>
                      {t.name}
                      {[t.dosage, t.frequency].filter(Boolean).length
                        ? ` - ${[t.dosage, t.frequency].filter(Boolean).join(', ')}`
                        : ''}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1 text-sm text-[#94a3b8]">None recorded</p>
              )}
            </div>
          </div>
        )}

        {tab === 'vitals' && (
          <div className="space-y-5">
            {(hrSeries.length > 0 || sugarSeries.length > 0) && (
              <div className="grid gap-4 sm:grid-cols-2">
                {hrSeries.length > 0 && (
                  <div className="rounded-[10px] border border-[#e1e7ef] p-3">
                    <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[#8FA0B6]">
                      Heart rate trend
                    </p>
                    <SparkBars values={hrSeries} />
                  </div>
                )}
                {sugarSeries.length > 0 && (
                  <div className="rounded-[10px] border border-[#e1e7ef] p-3">
                    <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[#8FA0B6]">
                      Glucose trend
                    </p>
                    <SparkBars values={sugarSeries} />
                  </div>
                )}
              </div>
            )}
            {vitals.length === 0 ? (
              <p className="text-sm text-[#94a3b8]">No vitals logged in the last 3 months.</p>
            ) : (
              <div className="overflow-x-auto rounded-[10px] border border-[#e1e7ef]">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-[#f8fafc] text-[11px] uppercase tracking-wide text-[#8FA0B6]">
                    <tr>
                      <th className="px-3 py-2 font-semibold">When</th>
                      <th className="px-3 py-2 font-semibold">BP</th>
                      <th className="px-3 py-2 font-semibold">HR</th>
                      <th className="px-3 py-2 font-semibold">Glucose</th>
                      <th className="px-3 py-2 font-semibold">Temp</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vitals.slice(0, 20).map((v, i) => (
                      <tr key={i} className="border-t border-[#eef2f6] text-[#344256]">
                        <td className="px-3 py-2 whitespace-nowrap">
                          {v.timestamp.toLocaleString(undefined, {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </td>
                        <td className="px-3 py-2">
                          {v.systolic && v.diastolic ? `${v.systolic}/${v.diastolic}` : '-'}
                        </td>
                        <td className="px-3 py-2">{v.heartRate ?? '-'}</td>
                        <td className="px-3 py-2">{v.bloodSugar ?? '-'}</td>
                        <td className="px-3 py-2">{v.temperature ?? '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {tab === 'adherence' && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-[10px] border border-[#e1e7ef] p-3 text-center">
                <p className="text-xs text-[#8FA0B6]">Taken</p>
                <p className="text-lg font-bold text-emerald-700">{adherenceTaken}</p>
              </div>
              <div className="rounded-[10px] border border-[#e1e7ef] p-3 text-center">
                <p className="text-xs text-[#8FA0B6]">Missed</p>
                <p className="text-lg font-bold text-red-600">{adherenceMissed}</p>
              </div>
              <div className="rounded-[10px] border border-[#e1e7ef] p-3 text-center">
                <p className="text-xs text-[#8FA0B6]">Pending</p>
                <p className="text-lg font-bold text-amber-600">{adherencePending}</p>
              </div>
            </div>
            {weeklyTrend.length > 0 ? (
              <div className="rounded-[10px] border border-[#e1e7ef] p-3">
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[#8FA0B6]">
                  Recent daily adherence %
                </p>
                <SparkBars values={weeklyTrend} maxHint={100} />
              </div>
            ) : (
              <p className="text-sm text-[#94a3b8]">No adherence data for this month yet.</p>
            )}
            <p className="text-sm text-[#65758b]">
              Month rate:{' '}
              <span className="font-semibold text-[#0E2340]">
                {adherencePct != null ? `${adherencePct}%` : '-'}
              </span>
            </p>
          </div>
        )}

        {tab === 'mood' && (
          <div className="space-y-3">
            {moods.length === 0 || !moodSummary ? (
              <p className="text-sm text-[#94a3b8]">No mood entries this month.</p>
            ) : (
              <>
                <div className="rounded-[10px] border border-[#eef2f6] bg-[#f8fafc] px-3 py-3">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl" aria-hidden="true">
                      {getMoodEmoji(moodSummary.averageBand)}
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-[#0E2340]">
                        {normalizeMoodLabel(moodSummary.averageBand)} on average
                        {moodSummary.average != null
                          ? ` · ${moodSummary.average}/5`
                          : ''}
                      </p>
                      <p className="text-xs text-[#65758b]">
                        {moodSummary.entries} check-in
                        {moodSummary.entries === 1 ? '' : 's'} this month
                        {moodSummary.lowDays > 0
                          ? ` · ${moodSummary.lowDays} low day${moodSummary.lowDays === 1 ? '' : 's'} (2 or below)`
                          : ' · no low days'}
                      </p>
                    </div>
                  </div>
                  {moodSummary.latest?.notes && (
                    <p className="mt-2 border-t border-[#e1e7ef] pt-2 text-xs text-[#65758b]">
                      Latest note: “{moodSummary.latest.notes}”
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  {moods.slice(0, 15).map((m, i) => {
                    const score = getMoodScore(m.mood);
                    const styles = getMoodEntryStyles(m.mood);
                    return (
                      <div
                        key={i}
                        className={`flex items-start justify-between gap-3 rounded-[10px] border px-3 py-2.5 ${styles.border} ${styles.bg}`}
                      >
                        <div className="flex min-w-0 items-start gap-2.5">
                          <span className="text-lg leading-none" aria-hidden="true">
                            {getMoodEmoji(m.mood)}
                          </span>
                          <div className="min-w-0">
                            <p className={`text-sm font-medium ${styles.text}`}>
                              {normalizeMoodLabel(m.mood)}
                              {score !== null && (
                                <span className="ml-1.5 text-xs font-normal opacity-70">
                                  {score}/5
                                </span>
                              )}
                            </p>
                            {m.notes && (
                              <p className="mt-0.5 truncate text-xs text-[#65758b]">
                                {m.notes}
                              </p>
                            )}
                          </div>
                        </div>
                        <p className="shrink-0 text-xs text-[#8FA0B6]">
                          {m.timestamp
                            ? m.timestamp.toLocaleDateString(undefined, {
                                month: 'short',
                                day: 'numeric',
                              })
                            : 'Date unknown'}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

/** @deprecated Use VisitPatientBriefing */
export const VisitChartSnapshot = VisitPatientBriefing;
