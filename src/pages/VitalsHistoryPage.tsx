import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';
import { useNavigateWithFallback } from '../hooks/useNavigateWithFallback';
import { getVitalsLogs } from '../services/logsService';
import { VitalsLog } from '../types';
import { PageHeader, PageShell } from '../components/page-layout';
import { VitalsPageSkeleton } from '../components/ui';

const formatBloodPressure = (log?: VitalsLog): string => {
  if (!log?.bloodPressure) return '—';
  const { systolic, diastolic } = log.bloodPressure;
  return `${systolic}/${diastolic}`;
};

export const VitalsHistoryPage: React.FC = () => {
  const { navigateBack } = useNavigateWithFallback();
  const { patientId } = useParams<{ patientId: string }>();
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
        description="View patient vital signs and health measurements."
      />

      {error ? (
        <div className="rounded-[12px] border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      ) : (
        <>
          <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                label: 'Blood Pressure',
                value: formatBloodPressure(latest),
                unit: 'mmHg',
                tone: 'border-[#e1e7ef] bg-white text-[#427160]',
              },
              {
                label: 'Heart Rate',
                value: latest?.heartRate ?? '—',
                unit: 'bpm',
                tone: 'border-rose-100 bg-rose-50 text-rose-600',
              },
              {
                label: 'Body Temperature',
                value: latest?.temperature ?? '—',
                unit: '°C',
                tone: 'border-amber-100 bg-amber-50 text-amber-700',
              },
              {
                label: 'Blood Sugar',
                value: latest?.bloodSugar ?? '—',
                unit: 'mg/dL',
                tone: 'border-emerald-100 bg-emerald-50 text-emerald-700',
              },
            ].map((card) => (
              <div
                key={card.label}
                className={`rounded-[12px] border p-5 shadow-sm ${card.tone}`}
              >
                <p className="text-sm font-semibold text-[#65758b]">{card.label}</p>
                <p className="mt-2 text-3xl font-bold">{card.value}</p>
                <p className="mt-2 text-xs text-[#94a3b8]">{card.unit}</p>
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
                {logs.map((log) => (
                  <li
                    key={log.id}
                    className="flex flex-wrap gap-x-6 gap-y-1 px-5 py-3 text-sm text-[#65758b]"
                  >
                    <span className="w-36 font-medium text-[#344256]">
                      {log.timestamp.toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </span>
                    <span>BP: {formatBloodPressure(log)}</span>
                    {log.heartRate != null && <span>HR: {log.heartRate} bpm</span>}
                    {log.temperature != null && <span>Temp: {log.temperature}°C</span>}
                    {log.bloodSugar != null && <span>Glucose: {log.bloodSugar}</span>}
                    {log.notes && <span className="text-[#94a3b8]">{log.notes}</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </PageShell>
  );
};

export default VitalsHistoryPage;
