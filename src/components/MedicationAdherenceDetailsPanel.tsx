import React, { useState, useEffect } from 'react';
import { asDate } from './calendar/calendarDateUtils';
import { getDateString, getTimeSlot } from '../utils/dateFormatter';
import { getDailyAdherence, getDoctorDailyAdherence } from '../services/adherenceService';
import { ListRowsSkeleton } from './ui/Skeleton';

interface MedicationAdherenceDetailsPanelProps {
  patientId: string;
  doctorId?: string;
  selectedDate: Date | null;
  isOpen: boolean;
  onClose: () => void;
}

interface MedicationRecord {
  id: string;
  medicationName: string;
  dosage: string;
  scheduledTime: Date | null;
  status: 'taken' | 'missed' | 'pending';
  takenTime: Date | null;
  notes?: string;
  timeSlot: 'morning' | 'afternoon' | 'evening';
}

const getStatusColor = (status: string): string => {
  
  switch (status) {
    case 'taken':
      return 'bg-gray-50 border-green-300 text-green-800';
    case 'missed':
      return 'bg-gray-50 border-red-300 text-red-800';
    case 'pending':
      return 'bg-gray-50 border-yellow-300 text-yellow-800';
    default:
      return 'bg-gray-50 border-gray-300 text-gray-800';
  }
};

const getStatusIcon = (status: string): string => {
  switch (status) {
    case 'taken':
      return '✓';
    case 'missed':
      return '✗';
    case 'pending':
      return '⏱️';
    default:
      return '•';
  }
};

const getStatusLabel = (status: string): string => {
  switch (status) {
    case 'taken':
      return 'Taken';
    case 'missed':
      return 'Missed';
    case 'pending':
      return 'Pending';
    default:
      return 'Unknown';
  }
};

const formatTime = (date: Date | null): string => {
  if (!date) return 'Not recorded';
  if (date instanceof Date) {
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: true 
    });
  }
  return 'Not recorded';
};

export const MedicationAdherenceDetailsPanel: React.FC<MedicationAdherenceDetailsPanelProps> = ({
  patientId,
  doctorId,
  selectedDate,
  isOpen,
  onClose,
}) => {
  const [groupedByTimeSlot, setGroupedByTimeSlot] = useState<{
    morning: MedicationRecord[];
    afternoon: MedicationRecord[];
    evening: MedicationRecord[];
  }>({
    morning: [],
    afternoon: [],
    evening: [],
  });
  const [isLoading, setIsLoading] = useState(false);
  const [stats, setStats] = useState({
    total: 0,
    taken: 0,
    missed: 0,
    pending: 0,
  });

  useEffect(() => {
    const loadMedicationDetails = async () => {
      if (!selectedDate) return;

      try {
        setIsLoading(true);
        const selectedDateStr = getDateString(selectedDate);
        const dailyData = doctorId
          ? await getDoctorDailyAdherence(doctorId, patientId, selectedDateStr)
          : await getDailyAdherence(patientId, selectedDateStr);

        const medicationRecords: MedicationRecord[] = dailyData.medications.map((record, idx) => {
          const scheduledTime = asDate(record.scheduledTime);
          const takenTime = asDate(record.takenTime);
          const timeSlot = getTimeSlot(scheduledTime) as 'morning' | 'afternoon' | 'evening';

          return {
            id: `${record.medicationName}-${idx}`,
            medicationName: record.medicationName || 'Unknown Medication',
            dosage: record.dosage || 'Not specified',
            scheduledTime,
            status: (record.status || 'pending') as 'taken' | 'missed' | 'pending',
            takenTime,
            notes: record.notes,
            timeSlot,
          };
        });

        const grouped = {
          morning: medicationRecords.filter((m) => m.timeSlot === 'morning'),
          afternoon: medicationRecords.filter((m) => m.timeSlot === 'afternoon'),
          evening: medicationRecords.filter((m) => m.timeSlot === 'evening'),
        };

        setGroupedByTimeSlot(grouped);

        const taken = medicationRecords.filter((m) => m.status === 'taken').length;
        const missed = medicationRecords.filter((m) => m.status === 'missed').length;
        const pending = medicationRecords.filter((m) => m.status === 'pending').length;

        setStats({
          total: medicationRecords.length,
          taken,
          missed,
          pending,
        });
      } catch (error) {
        ;
      } finally {
        setIsLoading(false);
      }
    };

    if (isOpen && selectedDate) {
      loadMedicationDetails();
    }
  }, [isOpen, selectedDate, patientId, doctorId]);

  if (!isOpen) return null;

  const dateStr = selectedDate
    ? selectedDate.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : '';

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-end sm:items-center justify-center p-2 sm:p-4">
      <div className="bg-gray-50 w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl">
        {}
        <div className="sticky top-0 bg-gradient-to-r from-orange-500 to-orange-600 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-white">📅 Medication Adherence</h2>
            <p className="text-orange-100 text-sm">{dateStr}</p>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:bg-orange-700 rounded-lg p-2 transition-colors"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {}
        <div className="p-6 space-y-6">
          {}
          {stats.total > 0 && (
            <div className="grid grid-cols-4 gap-3">
              <div className={`rounded-lg p-3 border border-blue-200 bg-gray-50`}>
                <p className="text-xs font-semibold text-blue-600 mb-1">TOTAL</p>
                <p className="text-2xl font-bold text-blue-900">{stats.total}</p>
              </div>
              <div className={`rounded-lg p-3 border border-green-200 bg-gray-50`}>
                <p className="text-xs font-semibold text-green-600 mb-1">TAKEN</p>
                <p className="text-2xl font-bold text-green-900">{stats.taken}</p>
              </div>
              <div className={`rounded-lg p-3 border border-red-200 bg-gray-50`}>
                <p className="text-xs font-semibold text-red-600 mb-1">MISSED</p>
                <p className="text-2xl font-bold text-red-900">{stats.missed}</p>
              </div>
              <div className={`rounded-lg p-3 border border-yellow-200 bg-gray-50`}>
                <p className="text-xs font-semibold text-yellow-600 mb-1">PENDING</p>
                <p className="text-2xl font-bold text-yellow-900">{stats.pending}</p>
              </div>
            </div>
          )}

          {}
          {isLoading && <ListRowsSkeleton rows={4} />}

          {}
          {!isLoading && stats.total === 0 && (
            <div className="text-center py-8">
              <p className="text-gray-600">No medication records for this date</p>
            </div>
          )}

          {}
          {!isLoading && stats.total > 0 && (
            <div className="space-y-6">
              {}
              {groupedByTimeSlot.morning.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <span className="text-xl">🌅</span>
                    Morning
                  </h3>
                  <div className="space-y-2">
                    {groupedByTimeSlot.morning.map((med) => (
                      <div
                        key={med.id}
                        className={`p-4 border-l-4 rounded-lg ${getStatusColor(med.status)}`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-lg">{getStatusIcon(med.status)}</span>
                              <p className="font-semibold text-gray-900">{med.medicationName}</p>
                              <span className="text-xs font-medium px-2 py-1 bg-gray-100 rounded">
                                {getStatusLabel(med.status)}
                              </span>
                            </div>
                            <p className="text-sm text-gray-700 mb-1">
                              Dosage: <span className="font-medium">{med.dosage}</span>
                            </p>
                            <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
                              <p>
                                Scheduled: <span className="font-medium">{formatTime(med.scheduledTime)}</span>
                              </p>
                              {med.status === 'taken' && (
                                <p>
                                  Taken at: <span className="font-medium">{formatTime(med.takenTime)}</span>
                                </p>
                              )}
                            </div>
                            {med.notes && (
                              <p className="text-xs text-gray-600 mt-2">
                                Notes: <span className="italic">{med.notes}</span>
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {}
              {groupedByTimeSlot.afternoon.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <span className="text-xl">☀️</span>
                    Afternoon
                  </h3>
                  <div className="space-y-2">
                    {groupedByTimeSlot.afternoon.map((med) => (
                      <div
                        key={med.id}
                        className={`p-4 border-l-4 rounded-lg ${getStatusColor(med.status)}`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-lg">{getStatusIcon(med.status)}</span>
                              <p className="font-semibold text-gray-900">{med.medicationName}</p>
                              <span className="text-xs font-medium px-2 py-1 bg-gray-100 rounded">
                                {getStatusLabel(med.status)}
                              </span>
                            </div>
                            <p className="text-sm text-gray-700 mb-1">
                              Dosage: <span className="font-medium">{med.dosage}</span>
                            </p>
                            <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
                              <p>
                                Scheduled: <span className="font-medium">{formatTime(med.scheduledTime)}</span>
                              </p>
                              {med.status === 'taken' && (
                                <p>
                                  Taken at: <span className="font-medium">{formatTime(med.takenTime)}</span>
                                </p>
                              )}
                            </div>
                            {med.notes && (
                              <p className="text-xs text-gray-600 mt-2">
                                Notes: <span className="italic">{med.notes}</span>
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {}
              {groupedByTimeSlot.evening.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <span className="text-xl">🌙</span>
                    Evening
                  </h3>
                  <div className="space-y-2">
                    {groupedByTimeSlot.evening.map((med) => (
                      <div
                        key={med.id}
                        className={`p-4 border-l-4 rounded-lg ${getStatusColor(med.status)}`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-lg">{getStatusIcon(med.status)}</span>
                              <p className="font-semibold text-gray-900">{med.medicationName}</p>
                              <span className="text-xs font-medium px-2 py-1 bg-gray-100 rounded">
                                {getStatusLabel(med.status)}
                              </span>
                            </div>
                            <p className="text-sm text-gray-700 mb-1">
                              Dosage: <span className="font-medium">{med.dosage}</span>
                            </p>
                            <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
                              <p>
                                Scheduled: <span className="font-medium">{formatTime(med.scheduledTime)}</span>
                              </p>
                              {med.status === 'taken' && (
                                <p>
                                  Taken at: <span className="font-medium">{formatTime(med.takenTime)}</span>
                                </p>
                              )}
                            </div>
                            {med.notes && (
                              <p className="text-xs text-gray-600 mt-2">
                                Notes: <span className="italic">{med.notes}</span>
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {}
        <div className="bg-gray-50 border-t border-gray-200 px-6 py-4 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-gray-200 text-gray-900 rounded-lg font-medium hover:bg-gray-300 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
