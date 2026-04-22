import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { USERS_COLLECTION } from '../../shared/constants';

interface AdherenceLog {
  id: string;
  date: string;
  medications: string[];
  taken: boolean;
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

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        setLoading(true);
        const logsRef = collection(db, USERS_COLLECTION, patientId, 'medication_adherence');
        const q = query(logsRef, orderBy('date', 'desc'), limit(10));
        const snapshot = await getDocs(q);

        const data: AdherenceLog[] = [];
        snapshot.docs.forEach((doc) => {
          data.push({
            id: doc.id,
            date: doc.data().date,
            medications: doc.data().medications || [],
            taken: doc.data().taken || false,
            notes: doc.data().notes,
          });
        });

        setLogs(data);
      } catch (err) {
        ;
        setError('Failed to load logs');
      } finally {
        setLoading(false);
      }
    };

    fetchLogs();
  }, [patientId]);

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-gray-900">📋 Adherence Logs</h3>
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
      ) : logs.length === 0 ? (
        <div className="text-gray-500 text-center py-8">
          <p className="text-sm">No adherence logs yet</p>
        </div>
      ) : (
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {logs.map((log) => (
            <div
              key={log.id}
              className={`
                p-4 rounded-lg border-l-4 transition-all
                ${
                  log.taken
                    ? 'bg-green-50 border-green-400'
                    : 'bg-red-50 border-red-400'
                }
              `}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-lg">{log.taken ? '✓' : '✗'}</span>
                    <p className="font-bold text-gray-900">
                      {formatDate(log.date)}
                    </p>
                    <span
                      className={`
                        px-2 py-1 rounded text-xs font-medium
                        ${
                          log.taken
                            ? 'bg-green-200 text-green-800'
                            : 'bg-red-200 text-red-800'
                        }
                      `}
                    >
                      {log.taken ? 'Taken' : 'Missed'}
                    </span>
                  </div>

                  {}
                  {log.medications && log.medications.length > 0 && (
                    <div className="mb-2">
                      <p className="text-xs text-gray-600 font-medium mb-1">Medications:</p>
                      <div className="flex flex-wrap gap-1">
                        {log.medications.map((med, idx) => (
                          <span
                            key={idx}
                            className="bg-gray-100 text-gray-700 px-2 py-1 rounded text-xs"
                          >
                            💊 {med}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {}
                  {log.notes && (
                    <p className="text-sm text-gray-700 italic mt-2">
                      <span className="font-medium">Note:</span> {log.notes}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
