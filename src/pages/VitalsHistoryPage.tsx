import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';
import { useNavigateWithFallback } from '../hooks/useNavigateWithFallback';
import { useVitalRules } from '../hooks/useVitalRules';
import { getVitalsLogs } from '../services/logsService';
import { VitalsLog } from '../types';
import { PageHeader, PageShell } from '../components/page-layout';
import { VitalsPageSkeleton } from '../components/ui';
import {
  VitalSeverityBadge,
  vitalSeverityCardTone,
} from '../components/vitals/VitalSeverityBadge';
import {
  evaluateVitalsReading,
  worstSeverity,
  type VitalSeverity,
} from '../lib/vitalMetricRules';

const formatBloodPressure = (log?: VitalsLog): string => {
  if (!log?.bloodPressure) return '-';
  const { systolic, diastolic } = log.bloodPressure;
  return `${systolic}/${diastolic}`;
};

export const VitalsHistoryPage: React.FC = () => {
  const { navigateBack } = useNavigateWithFallback();
  const { patientId } = useParams<{ patientId: string }>();
  const { config } = useVitalRules();
  const [logs, setLogs] = useState<VitalsLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!patientId) return;

    const loadVitals = async () => {
      setLoading(true);
      setError(null);
      try {
        const now = new Date();
        const months = [0, 1, 2].map((offset) => {
          const d = new Date(now.getFullYear(), now.getMonth() - offset, 1);
          return { year: d.getFullYear(), month: d.getMonth() };
        });
        const results = await Promise.all(
          months.map(({ year, month }) => getVitalsLogs(patientId, year, month))
        );
        const merged = results
          .flat()
          .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
        setLogs(merged);
      } catch {
        setError('Unable to load vitals history.');
      } finally {
        setLoading(false);
      }
    };

    void loadVitals();
  }, [patientId]);

  const latest = logs[0];
  const latestEval = useMemo(
    () =>
      latest
        ? evaluateVitalsReading(
            {
              heartRate: latest.heartRate,
              bloodPressure: latest.bloodPressure,
              temperature: latest.temperature,
              bloodSugar: latest.bloodSugar,
              spo2: latest.spo2,
            },
            config
          )
        : [],
    [latest, config]
  );

  const severityFor = (key: string): VitalSeverity =>
    latestEval.find((e) => e.key === key)?.severity ?? 'unknown';

  const bpSeverity = worstSeverity([
    severityFor('bp_systolic'),
    severityFor('bp_diastolic'),
  ]);

  if (!patientId) {
    return (
      <PageShell>
        <div className="rounded-[12px] border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Patient ID not found
        </div>
      </PageShell>
    );
  }

  if (loading) {
    return (
      <PageShell>
        <VitalsPageSkeleton />
      </PageShell>
    );
  }

  return (
    <PageShell>
      <button
        type="button"
        onClick={() => navigateBack(`/patient-profile/${patientId}`)}
        className="mb-4 inline-flex h-9 items-center gap-2 rounded-[10px] border border-[#e1e7ef] bg-white px-3 text-sm font-medium text-[#344256] hover:border-[#427160]/40 hover:text-[#427160]"
      >
        <ArrowLeftIcon className="h-4 w-4" />
        Back to Patient Profile
      </button>
      <PageHeader
        title="Vitals History"
        description="Patient vital signs classified with your practice alert rules (normal / warning / urgent)."
      />

      {error ? (
        <div className="rounded-[12px] border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      ) : (
        <>
          <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {[
              {
                label: 'Blood Pressure',
                value: formatBloodPressure(latest),
                unit: 'mmHg',
                severity: bpSeverity,
              },
              {
                label: 'Heart Rate',
                value: latest?.heartRate ?? '-',
                unit: 'bpm',
                severity: severityFor('heart_rate'),
              },
              {
                label: 'SpO₂',
                value: latest?.spo2 ?? '-',
                unit: '%',
                severity: severityFor('spo2'),
              },
              {
                label: 'Body Temperature',
                value: latest?.temperature ?? '-',
                unit: '°C',
                severity: severityFor('temperature'),
              },
              {
                label: 'Glucose',
                value: latest?.bloodSugar ?? '-',
                unit: 'mg/dL',
                severity: severityFor('glucose'),
              },
            ].map((card) => (
              <div
                key={card.label}
                className={`rounded-[12px] border p-5 shadow-sm ${vitalSeverityCardTone(card.severity)}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-semibold opacity-80">{card.label}</p>
                  {card.value !== '-' && <VitalSeverityBadge severity={card.severity} />}
                </div>
                <p className="mt-2 text-3xl font-bold">{card.value}</p>
                <p className="mt-2 text-xs opacity-70">{card.unit}</p>
              </div>
            ))}
          </div>

          {!latest && (
            <div className="mb-6 rounded-[12px] border border-[#e1e7ef] bg-[#f8fafc] p-4 text-sm text-[#65758b]">
              No vitals recorded yet for this patient.
            </div>
          )}

          {logs.length > 0 && (
            <div className="overflow-hidden rounded-[12px] border border-[#e1e7ef] bg-white shadow-sm">
              <div className="border-b border-[#eef2f6] px-5 py-4">
                <h2 className="font-semibold text-[#344256]">History (last 90 days)</h2>
              </div>
              <ul className="divide-y divide-[#eef2f6]">
                {logs.map((log) => {
                  const evaluated = evaluateVitalsReading(
                    {
                      heartRate: log.heartRate,
                      bloodPressure: log.bloodPressure,
                      temperature: log.temperature,
                      bloodSugar: log.bloodSugar,
                      spo2: log.spo2,
                    },
                    config
                  );
                  const overall = worstSeverity(evaluated.map((e) => e.severity));
                  return (
                    <li
                      key={log.id}
                      className="flex flex-wrap items-center gap-x-6 gap-y-2 px-5 py-3 text-sm text-[#65758b]"
                    >
                      <span className="w-36 font-medium text-[#344256]">
                        {log.timestamp.toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </span>
                      <VitalSeverityBadge severity={overall} />
                      <span>BP: {formatBloodPressure(log)}</span>
                      {log.heartRate != null && <span>HR: {log.heartRate} bpm</span>}
                      {log.spo2 != null && <span>SpO₂: {log.spo2}%</span>}
                      {log.temperature != null && <span>Temp: {log.temperature}°C</span>}
                      {log.bloodSugar != null && <span>Glucose: {log.bloodSugar}</span>}
                      {log.notes && <span className="text-[#94a3b8]">{log.notes}</span>}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </>
      )}
    </PageShell>
  );
};

export default VitalsHistoryPage;
