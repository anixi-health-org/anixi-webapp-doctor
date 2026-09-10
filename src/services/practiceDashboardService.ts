export type PracticeDashboardStats = {
  appointmentsThisWeek: number;
  appointmentsToday: number;
  pendingAppointments: number;
  completedThisMonth: number;
};

/**
 * Lightweight practice-wide appointment volume stats for clinic dashboards.
 * TODO: replace with Django practice-stats endpoint once available.
 */
export const getPracticeDashboardStats = async (
  _practiceId: string,
): Promise<PracticeDashboardStats> => {
  return {
    appointmentsToday: 0,
    appointmentsThisWeek: 0,
    pendingAppointments: 0,
    completedThisMonth: 0,
  };
};
