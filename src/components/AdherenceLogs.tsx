import React, { useState, useEffect, useRef, useCallback } from 'react';
import { formatTimestamp, getTimeSlot } from '../utils/dateFormatter';
import {
  getDoctorAdherenceLogsPage,
  type DoctorAdherenceLog,
} from '../services/adherenceService';
import { AdherenceLogsSkeleton } from './ui/Skeleton';

interface AdherenceLogsProps {
  patientId: string;
  doctorId: string;
}
const PAGE_SIZE = 10;
export const AdherenceLogs: React.FC<AdherenceLogsProps> = ({ patientId, doctorId }) => {
  const [logs, setLogs] = useState<DoctorAdherenceLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [cursor, setCursor] = useState<Date | null>(null);
  const [isPulling, setIsPulling] = useState(false);
  const pullStartRef = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const loadInitialLogs = useCallback(async () => {
    try {
      setIsLoading(true);
      const page = await getDoctorAdherenceLogsPage(doctorId, patientId, PAGE_SIZE);
      setLogs(page.logs);
      setCursor(page.cursor);
      setHasMore(page.hasMore);
    } catch (error) {
      ;
    } finally {
      setIsLoading(false);
    }
  }, [doctorId, patientId]);
  const loadMore = useCallback(async () => {
    if (!cursor || !hasMore) return;
    try {
      setIsLoadingMore(true);
      const page = await getDoctorAdherenceLogsPage(doctorId, patientId, PAGE_SIZE, cursor);
      setLogs((prev) => [...prev, ...page.logs]);
      setCursor(page.cursor);
      setHasMore(page.hasMore);
    } catch (error) {
      ;
    } finally {
      setIsLoadingMore(false);
    }
  }, [doctorId, patientId, cursor, hasMore]);

  useEffect(() => {
    loadInitialLogs();
  }, [loadInitialLogs]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const handleScroll = () => {
      if (container.scrollTop + container.clientHeight >= container.scrollHeight - 100) {
        if (!isLoadingMore && hasMore) {
          loadMore();
        }
      }
    };
    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, [isLoadingMore, hasMore, loadMore]);

  const handlePullToRefresh = async (e: React.TouchEvent) => {
    const container = containerRef.current;
    if (!container) return;
    if (e.type === 'touchstart') {
      pullStartRef.current = e.touches[0].clientY;
    }
    if (e.type === 'touchmove') {
      const currentY = e.touches[0].clientY;
      const diff = currentY - pullStartRef.current;
      if (container.scrollTop === 0 && diff > 50) {
        setIsPulling(true);
      } else {
        setIsPulling(false);
      }
    }
    if (e.type === 'touchend' && isPulling) {
      setIsPulling(false);
      await loadInitialLogs();
    }
  };
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'taken':
        return 'bg-green-100 text-green-800';
      case 'missed':
        return 'bg-red-100 text-red-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };
  if (isLoading) {
    return <AdherenceLogsSkeleton />;
  }
  return (
    <div
      ref={containerRef}
      onTouchStart={handlePullToRefresh}
      onTouchMove={handlePullToRefresh}
      onTouchEnd={handlePullToRefresh}
      className="min-h-[24rem] max-h-[70vh] overflow-y-auto space-y-3 p-4 bg-gray-50 rounded-lg"
    >
      {isPulling && (
        <div className="text-center py-2 text-blue-600 font-medium">
          ↓ Release to refresh
        </div>
      )}
      {logs.length === 0 ? (
        <div className="flex items-center justify-center h-64">
          <p className="text-gray-600">No adherence logs available</p>
        </div>
      ) : (
        logs.map((log) => (
          <div key={log.id} className="p-4 bg-white rounded-lg border border-gray-200 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between mb-2">
              <div>
                <h4 className="font-semibold text-gray-900">{log.medicationName}</h4>
                <p className="text-xs text-gray-600">{log.dosage}</p>
              </div>
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(log.status)}`}>
                {log.status.charAt(0).toUpperCase() + log.status.slice(1)}
              </span>
            </div>
            <div className="flex items-center gap-4 text-sm text-gray-700 mb-2">
              {log.timestamp && (
                <>
                  <span className="font-medium">{formatTimestamp(log.timestamp, 'datetime')}</span>
                  <span className="text-xs bg-gray-100 px-2 py-1 rounded">
                    {getTimeSlot(log.timestamp)}
                  </span>
                </>
              )}
            </div>
            {log.notes && (
              <p className="text-sm text-gray-600 italic">💬 {log.notes}</p>
            )}
            {log.takenTime && log.status === 'taken' && (
              <p className="text-xs text-green-700 mt-2">✓ Taken at {formatTimestamp(log.takenTime, 'time')}</p>
            )}
          </div>
        ))
      )}
      {isLoadingMore && (
        <div className="flex justify-center py-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      )}
      {!hasMore && logs.length > 0 && (
        <div className="text-center py-4 text-gray-600 text-sm">
          No more logs to load
        </div>
      )}
    </div>
  );
};
