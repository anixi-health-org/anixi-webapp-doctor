import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  approveIncomingRequest,
  getIncomingSharingRequests,
  listenToIncomingSharingRequests,
  rejectIncomingRequest,
  IncomingSharingRequest,
} from '../services/sharing';
import { sharingQueryKeys } from './queries/queryKeys';
import { useEffect, useState } from 'react';

export const useIncomingSharingRequests = (doctorUid: string | undefined) => {
  const [liveRequests, setLiveRequests] = useState<IncomingSharingRequest[]>([]);
  const [liveError, setLiveError] = useState<Error | null>(null);

  const query = useQuery({
    queryKey: sharingQueryKeys.incomingRequests(doctorUid ?? ''),
    queryFn: () => getIncomingSharingRequests(doctorUid!),
    enabled: Boolean(doctorUid),
  });

  useEffect(() => {
    if (!doctorUid) return;
    const unsubscribe = listenToIncomingSharingRequests(
      doctorUid,
      (requests) => {
        setLiveRequests(requests);
        setLiveError(null);
      },
      (error) => setLiveError(error)
    );
    return unsubscribe;
  }, [doctorUid]);

  const requests = liveRequests.length > 0 || liveError ? liveRequests : query.data ?? [];

  return {
    requests,
    isLoading: query.isLoading && requests.length === 0,
    error: liveError ?? (query.error instanceof Error ? query.error : null),
    refetch: query.refetch,
  };
};

export const useApproveIncomingRequest = (doctorUid: string | undefined) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      requestId,
      patientId,
    }: {
      requestId: string;
      patientId: string;
    }) => approveIncomingRequest(doctorUid!, requestId, patientId),
    onSuccess: () => {
      if (doctorUid) {
        void queryClient.invalidateQueries({
          queryKey: sharingQueryKeys.incomingRequests(doctorUid),
        });
      }
    },
  });
};

export const useRejectIncomingRequest = (doctorUid: string | undefined) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      requestId,
      patientId,
    }: {
      requestId: string;
      patientId: string;
    }) => rejectIncomingRequest(doctorUid!, requestId, patientId),
    onSuccess: () => {
      if (doctorUid) {
        void queryClient.invalidateQueries({
          queryKey: sharingQueryKeys.incomingRequests(doctorUid),
        });
      }
    },
  });
};
