import { useQuery } from '@tanstack/react-query';
import { getPracticeDashboardStats } from '../services/practiceDashboardService';

export function usePracticeDashboardStats(practiceId: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: ['practice-dashboard-stats', practiceId ?? ''],
    queryFn: () => getPracticeDashboardStats(practiceId!),
    enabled: Boolean(enabled && practiceId),
    staleTime: 45_000,
  });
}
