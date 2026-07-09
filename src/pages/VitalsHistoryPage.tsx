import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { useNavigateWithFallback } from '../hooks/useNavigateWithFallback';
import { getVitalsLogs } from '../services/logsService';
import { VitalsLog } from '../types';

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
      <div className="p-6 bg-anixi-beige min-h-screen">
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-700">Patient ID not found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-anixi-beige min-h-screen">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <button
            onClick={() => navigateBack(`/patient-profile/${patientId}`)}
            className="mb-4 px-4 py-2 bg-anixi-green text-white hover:opacity-90 rounded-lg transition-all"
          >
            ← Back to Patient Profile
          </button>
          <h1 className="text-3xl font-bold text-anixi-green">Vitals History</h1>
          <p className="mt-2 text-anixi-green">View patient vital signs and health measurements</p>
        </div>

        {loading ? (
          <Card>
            <CardContent className="py-12 text-center text-gray-600">Loading vitals…</CardContent>
          </Card>
        ) : error ? (
          <Card>
            <CardContent className="py-8 text-center text-red-600">{error}</CardContent>
          </Card>
        ) : (
          <>
            <Card className="mb-6">
              <CardHeader>
                <CardTitle>Latest readings</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-[#f0f2f1] p-6 rounded-lg border border-[#cbd5d2]">
                    <p className="text-sm text-gray-600 font-semibold mb-2">Blood Pressure</p>
                    <p className="text-3xl font-bold text-[#425950]">{formatBloodPressure(latest)}</p>
                    <p className="text-xs text-gray-500 mt-2">mmHg</p>
                  </div>
                  <div className="bg-red-50 p-6 rounded-lg border border-red-200">
                    <p className="text-sm text-gray-600 font-semibold mb-2">Heart Rate</p>
                    <p className="text-3xl font-bold text-red-600">
                      {latest?.heartRate ?? '—'}
                    </p>
                    <p className="text-xs text-gray-500 mt-2">bpm</p>
                  </div>
                  <div className="bg-orange-50 p-6 rounded-lg border border-orange-200">
                    <p className="text-sm text-gray-600 font-semibold mb-2">Body Temperature</p>
                    <p className="text-3xl font-bold text-orange-600">
                      {latest?.temperature ?? '—'}
                    </p>
                    <p className="text-xs text-gray-500 mt-2">°C</p>
                  </div>
                  <div className="bg-green-50 p-6 rounded-lg border border-green-200">
                    <p className="text-sm text-gray-600 font-semibold mb-2">Blood Sugar</p>
                    <p className="text-3xl font-bold text-green-600">
                      {latest?.bloodSugar ?? '—'}
                    </p>
                    <p className="text-xs text-gray-500 mt-2">mg/dL</p>
                  </div>
                </div>
                {!latest && (
                  <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 mt-6">
                    <p className="text-sm text-gray-600">No vitals recorded yet for this patient.</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {logs.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>History (last 90 days)</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="divide-y divide-gray-200">
                    {logs.map((log) => (
                      <li key={log.id} className="py-3 flex flex-wrap gap-x-6 gap-y-1 text-sm">
                        <span className="font-medium text-[#425950] w-36">
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
                        {log.notes && <span className="text-gray-500">{log.notes}</span>}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default VitalsHistoryPage;
