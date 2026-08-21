import { useEffect, useState } from 'react';
import {
  listenToPendingRecordShares,
  type PendingRecordShareRequest,
} from '../services/medicalRecordShareService';

interface IncomingRecordShares {
  requests: PendingRecordShareRequest[];
  loading: boolean;
}

/** Realtime feed of patients waiting for this doctor to accept their records. */
export const useIncomingRecordShares = (
  doctorId: string | undefined
): IncomingRecordShares => {
  const [requests, setRequests] = useState<PendingRecordShareRequest[]>([]);
  const [loading, setLoading] = useState(Boolean(doctorId));

  useEffect(() => {
    if (!doctorId) {
      setRequests([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    return listenToPendingRecordShares(
      doctorId,
      (next) => {
        setRequests(next);
        setLoading(false);
      },
      () => {
        setRequests([]);
        setLoading(false);
      }
    );
  }, [doctorId]);

  return { requests, loading };
};
