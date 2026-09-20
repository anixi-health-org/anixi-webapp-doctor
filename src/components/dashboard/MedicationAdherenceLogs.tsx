import React, { useState, useEffect } from 'react';
import { djangoListAdherence, isDjangoApiEnabled } from '../../services/djangoApiService';

interface AdherenceLog {
  id: string;
  date: string;
  medicationName: string;
  status: 'taken' | 'missed' | 'pending';
  notes?: string;
}

interface MedicationAdherenceLogsProps {
  patientId: string;
  onViewDetails?: () => void;
}

export const MedicationAdherenceLogs: React.FC<MedicationAdherenceLogsProps> = ({
  patientId,
  onViewDetails,
}) => {
  const [logs, setLogs] = useState<AdherenceLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const PREVIEW_LIMIT = 2;

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        setLoading(true);
        setError(null);
        if (!isDjangoApiEnabled()) {
          setLogs([]);
          return;
        }
        const rows = await djangoListAdherence(patientId, {
          type: 'medication',
          limit: PREVIEW_LIMIT,
        });
        setLogs(
          rows.map((row, index) => ({
            id: String(row.id ?? `adherence-${index}`),
            date: String(row.scheduledFor ?? row.recordedAt ?? row.createdAt ?? ''),
            medicationName: String(row.medicationName ?? 'Medication'),
            status: (row.status === 'taken'
              ? 'taken'
              : row.status === 'missed'
                ? 'missed'
                : 'pending') as AdherenceLog['status'],
            notes: row.notes ? String(row.notes) : undefined,
          })),
        );
      } catch {
        setError('Failed to load logs');
      } finally {
        setLoading(false);
      }
    };

    void fetchLogs();
  }, [patientId]);

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-gray-900">💊 Medication Adherence</h3>
        <button
          onClick={onViewDetails}
          className="text-blue-600 hover:text-blue-800 text-sm font-medium"
        >
          View Details →
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-8">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
        </div>
      ) : error ? (
        <div className="text-red-600 text-sm">{error}</div>
      ) : logs.length > 0 ? (
        <div className="space-y-3">
          {logs.map((log) => (
            <div
              key={log.id}
              className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
            >
              <div>
                <p className="font-medium text-gray-900">{log.medicationName}</p>
                <p className="text-sm text-gray-500">{formatDate(log.date)}</p>
              </div>
              <span
                className={`text-xs font-semibold px-2 py-1 rounded-full ${
                  log.status === 'taken'
                    ? 'bg-green-100 text-green-700'
                    : log.status === 'missed'
                      ? 'bg-red-100 text-red-700'
                      : 'bg-yellow-100 text-yellow-700'
                }`}
              >
                {log.status}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-gray-500 text-center py-8">
          <p className="text-sm">No adherence logs yet</p>
        </div>
      )}
    </div>
  );
};
