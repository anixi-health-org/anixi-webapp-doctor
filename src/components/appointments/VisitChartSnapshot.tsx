import React, { useEffect, useMemo, useState } from 'react';
import { getDoctorPatients } from '../../services/doctorService';
import { getDoctorMonthlyAdherenceDetails } from '../../services/adherenceService';
import {
  getMoodEntriesForMonth,
  getVitalsLogs,
} from '../../services/logsService';
import { Patient } from '../../types';
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
  timestamp: Date;
  mood: string;
  notes?: string;
}

const TABS: { id: BriefingTab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'profile', label: 'Profile' },
  { id: 'vitals', label: 'Vitals' },
  { id: 'adherence', label: 'Adherence' },
  { id: 'mood', label: 'Mood' },
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

        const [patients, monthDetails, moodEntries, ...vitalsMonths] = await Promise.all([
          getDoctorPatients(doctorId),
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

        const found = patients.find((p) => p.id === patientId) ?? null;
        setPatient(found);

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
            timestamp: m.timestamp instanceof Date ? m.timestamp : new Date(m.timestamp || m.date),
            mood: String(m.mood || m.score || '—'),
            notes: m.notes,
          }))
          .sort((a: MoodRow, b: MoodRow) => b.timestamp.getTime() - a.timestamp.getTime());
        setMoods(moodRows);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [doctorId, patientId, isManual]);

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

  if (isManual || patientId === 'unknown' || patientId === 'manual') {
    return (
      <div className="rounded-[14px] border border-dashed border-[#e1e7ef] bg-[#f8fafc] p-5 text-sm text-[#65758b]">
        Manual patient — no linked Anixi chart. Confirm identity verbally, then start the call when ready.
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

  return (
    <div className="overflow-hidden rounded-[14px] border border-[#e1e7ef] bg-white shadow-sm">
      <div className="border-b border-[#eef2f6] px-4 pt-4">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[#8FA0B6]">
              Patient briefing
            </p>
            <h2 className="mt-0.5 text-lg font-bold text-[#0E2340]">
              {formatName(patient?.displayName) || 'Patient'}
            </h2>
            <p className="mt-0.5 text-sm text-[#65758b]">
              {[
                formatPhone(patient?.phoneNumber),
                formatEmail(patient?.email),
                patient?.dateOfBirth ? `Age ${calculateAge(patient.dateOfBirth)}` : null,
              ]
                .filter(Boolean)
                .join(' · ') || 'Contact details not recorded'}
            </p>
          </div>
          {adherencePct != null && (
            <div className="rounded-[10px] border border-[#e1e7ef] bg-[#f8fafc] px-3 py-2 text-center">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[#8FA0B6]">
                Adherence
              </p>
              <p className="text-xl font-bold text-anixi-green">{adherencePct}%</p>
            </div>
          )}
        </div>

        <div className="flex gap-1 overflow-x-auto pb-3">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`shrink-0 rounded-[8px] px-3 py-1.5 text-sm font-medium transition ${
                tab === t.id
                  ? 'bg-anixi-green text-white'
                  : 'bg-[#f1f5f9] text-[#65758b] hover:bg-white hover:text-anixi-green'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="max-h-[min(58vh,640px)] overflow-y-auto p-4">
        {tab === 'overview' && (
          <div className="space-y-5">
            {allergies.length > 0 && (
              <div className="rounded-[10px] border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
                <span className="font-semibold">Allergies: </span>
                {allergies.join(', ')}
              </div>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-[#8FA0B6]">
                  Allergies
                </p>
                <p className="mt-1 text-sm text-[#344256]">
                  {allergies.length ? allergies.join(', ') : 'None recorded'}
                </p>
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-[#8FA0B6]">
                  Conditions
                </p>
                <p className="mt-1 text-sm text-[#344256]">
                  {conditions.length ? conditions.join(', ') : 'None recorded'}
                </p>
              </div>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[#8FA0B6]">
                Current treatments
              </p>
              {treatments.length ? (
                <ul className="mt-2 space-y-1.5">
                  {treatments.map((t, i) => (
                    <li
                      key={`${t.name}-${i}`}
                      className="rounded-[8px] border border-[#eef2f6] bg-[#f8fafc] px-3 py-2 text-sm text-[#344256]"
                    >
                      <span className="font-medium">{t.name}</span>
                      {(t.dosage || t.frequency) && (
                        <span className="text-[#65758b]">
                          {' '}
                          · {[t.dosage, t.frequency].filter(Boolean).join(' · ')}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1 text-sm text-[#94a3b8]">None recorded</p>
              )}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-[10px] border border-[#e1e7ef] p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-[#8FA0B6]">
                  Latest vitals
                </p>
                {latestVital ? (
                  <div className="mt-2 space-y-1 text-sm text-[#344256]">
                    {latestVital.systolic && latestVital.diastolic && (
                      <p>
                        BP {latestVital.systolic}/{latestVital.diastolic}
                      </p>
                    )}
                    {latestVital.heartRate != null && <p>HR {latestVital.heartRate}</p>}
                    {latestVital.bloodSugar != null && <p>Glucose {latestVital.bloodSugar}</p>}
                    {latestVital.temperature != null && <p>Temp {latestVital.temperature}</p>}
                    <p className="text-xs text-[#8FA0B6]">
                      {latestVital.timestamp.toLocaleString()}
                    </p>
                  </div>
                ) : (
                  <p className="mt-2 text-sm text-[#94a3b8]">No recent vitals</p>
                )}
              </div>
              <div className="rounded-[10px] border border-[#e1e7ef] p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-[#8FA0B6]">
                  This month adherence
                </p>
                <p className="mt-2 text-2xl font-bold text-[#0E2340]">
                  {adherencePct != null ? `${adherencePct}%` : '—'}
                </p>
                <p className="mt-1 text-xs text-[#65758b]">
                  Taken {adherenceTaken} · Missed {adherenceMissed} · Pending {adherencePending}
                </p>
              </div>
            </div>
            {patient?.emergencyContact?.name && (
              <div className="rounded-[10px] border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
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
                        ? ` — ${[t.dosage, t.frequency].filter(Boolean).join(', ')}`
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
                          {v.systolic && v.diastolic ? `${v.systolic}/${v.diastolic}` : '—'}
                        </td>
                        <td className="px-3 py-2">{v.heartRate ?? '—'}</td>
                        <td className="px-3 py-2">{v.bloodSugar ?? '—'}</td>
                        <td className="px-3 py-2">{v.temperature ?? '—'}</td>
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
                {adherencePct != null ? `${adherencePct}%` : '—'}
              </span>
            </p>
          </div>
        )}

        {tab === 'mood' && (
          <div className="space-y-2">
            {moods.length === 0 ? (
              <p className="text-sm text-[#94a3b8]">No mood entries this month.</p>
            ) : (
              moods.slice(0, 15).map((m, i) => (
                <div
                  key={i}
                  className="flex items-start justify-between gap-3 rounded-[10px] border border-[#eef2f6] px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium capitalize text-[#344256]">{m.mood}</p>
                    {m.notes && (
                      <p className="mt-0.5 truncate text-xs text-[#65758b]">{m.notes}</p>
                    )}
                  </div>
                  <p className="shrink-0 text-xs text-[#8FA0B6]">
                    {m.timestamp.toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                    })}
                  </p>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};

/** @deprecated Use VisitPatientBriefing */
export const VisitChartSnapshot = VisitPatientBriefing;
