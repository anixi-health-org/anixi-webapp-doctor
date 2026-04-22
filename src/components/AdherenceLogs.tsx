import React, { useState, useEffect, useRef, useCallback } from 'react';
import { collection, query, where, orderBy, limit, startAfter, getDocs, QueryConstraint } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { formatTimestamp, getTimeSlot, transformAdherenceRecord } from '../utils/dateFormatter';
interface AdherenceLogsProps {
  patientId: string;
}
interface AdherenceLog {
  id: string;
  timestamp?: Date;
  scheduledTime?: Date;
  takenTime?: Date;
  status: 'taken' | 'missed' | 'pending';
  medicationName: string;
  dosage: string;
  notes?: string;
}
const PAGE_SIZE = 10;
export const AdherenceLogs: React.FC<AdherenceLogsProps> = ({ patientId }) => {
  const [logs, setLogs] = useState<AdherenceLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [lastDoc, setLastDoc] = useState<any>(null);
  const [isPulling, setIsPulling] = useState(false);
  const pullStartRef = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const loadInitialLogs = useCallback(async () => {
    try {
      setIsLoading(true);
      const constraints: QueryConstraint[] = [
        where('patientId', '==', patientId),
        orderBy('timestamp', 'desc'),
        limit(PAGE_SIZE),
      ];
      const q = query(collection(db, 'adherence_records'), ...constraints);
      const snapshot = await getDocs(q);
      const fetchedLogs = snapshot.docs.map((doc) => {
        const data = doc.data();
        const transformed = transformAdherenceRecord(data);
        return {
          id: doc.id,
          ...transformed,
          timestamp: transformed?.timestamp || transformed?.scheduledTime,
        };
      });
      setLogs(fetchedLogs);
      setLastDoc(snapshot.docs[snapshot.docs.length - 1]);
      setHasMore(snapshot.docs.length === PAGE_SIZE);
    } catch (error) {
      ;
    } finally {
      setIsLoading(false);
    }
  }, [patientId]);
  const loadMore = useCallback(async () => {
    if (!lastDoc || !hasMore) return;
    try {
      setIsLoadingMore(true);
      const constraints: QueryConstraint[] = [
        where('patientId', '==', patientId),
        orderBy('timestamp', 'desc'),
        startAfter(lastDoc),
        limit(PAGE_SIZE),
      ];
      const q = query(collection(db, 'adherence_records'), ...constraints);
      const snapshot = await getDocs(q);
      const fetchedLogs = snapshot.docs.map((doc) => {
        const data = doc.data();
        const transformed = transformAdherenceRecord(data);
        return {
          id: doc.id,
          ...transformed,
          timestamp: transformed?.timestamp || transformed?.scheduledTime,
        };
      });
      setLogs((prev) => [...prev, ...fetchedLogs]);
      setLastDoc(snapshot.docs[snapshot.docs.length - 1]);
      setHasMore(snapshot.docs.length === PAGE_SIZE);
    } catch (error) {
      ;
    } finally {
      setIsLoadingMore(false);
    }
  }, [patientId, lastDoc, hasMore]);

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
    return (
      <div className="flex items-center justify-center h-[10vh]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading adherence logs...</p>
        </div>
      </div>
    );
  }
  return (
    <div
      ref={containerRef}
      onTouchStart={handlePullToRefresh}
      onTouchMove={handlePullToRefresh}
      onTouchEnd={handlePullToRefresh}
      className="h-[10vh] overflow-y-auto space-y-3 p-4 bg-gray-50 rounded-lg"
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
