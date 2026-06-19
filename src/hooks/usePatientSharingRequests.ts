import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createSharingRequest,
  getPatientSharingRequests,
  listenToPatientSharingRequests,
  PatientSharingRequest,
  searchDoctors,
  SearchDoctorsFilters,
} from '../services/sharing';
import { sharingQueryKeys } from './queries/queryKeys';
import { useEffect, useState } from 'react';

export const usePatientSharingRequests = (patientUid: string | undefined) => {
  const [liveRequests, setLiveRequests] = useState<PatientSharingRequest[]>([]);
  const [liveError, setLiveError] = useState<Error | null>(null);

  const query = useQuery({
    queryKey: sharingQueryKeys.patientRequests(patientUid ?? ''),
    queryFn: () => getPatientSharingRequests(patientUid!),
    enabled: Boolean(patientUid),
  });

  useEffect(() => {
    if (!patientUid) return;
    const unsubscribe = listenToPatientSharingRequests(
      patientUid,
      (requests) => {
        setLiveRequests(requests);
        setLiveError(null);
      },
      (error) => setLiveError(error)
    );
    return unsubscribe;
  }, [patientUid]);

  const requests = liveRequests.length > 0 || liveError ? liveRequests : query.data ?? [];

  return {
    requests,
    isLoading: query.isLoading && requests.length === 0,
    error: liveError ?? (query.error instanceof Error ? query.error : null),
    refetch: query.refetch,
  };
};

export const useSearchDoctors = (filters: SearchDoctorsFilters = {}) =>
  useQuery({
    queryKey: ['search-doctors', filters],
    queryFn: () => searchDoctors(filters),
  });

export const useCreateSharingRequest = (patientUid: string | undefined) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (doctorId: string) =>
      createSharingRequest({ patientId: patientUid!, doctorId }),
    onSuccess: () => {
      if (patientUid) {
        void queryClient.invalidateQueries({
          queryKey: sharingQueryKeys.patientRequests(patientUid),
        });
      }
    },
  });
};
