export type PracticeDashboardStats = {
  appointmentsThisWeek: number;
  appointmentsToday: number;
  pendingAppointments: number;
  completedThisMonth: number;
  checkedInToday?: number;
  noShowsThisMonth?: number;
  appointmentCount?: number;
  rosterPatients?: number;
  pendingInvites?: number;
  activeMembers?: number;
  roomUtilizationToday?: Record<string, number>;
};

function toCount(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Practice-wide appointment volume stats for clinic dashboards.
 */
export const getPracticeDashboardStats = async (
  practiceId: string,
): Promise<PracticeDashboardStats> => {
  if (!practiceId) {
    throw new Error('Practice ID is required for dashboard stats');
  }
  const { djangoGetPracticeStats } = await import('./djangoApiService');
  const data = await djangoGetPracticeStats(practiceId);
  const roomUtilization =
    data.roomUtilizationToday && typeof data.roomUtilizationToday === 'object'
      ? (data.roomUtilizationToday as Record<string, number>)
      : {};
  return {
    appointmentsToday: toCount(data.appointmentsToday),
    appointmentsThisWeek: toCount(data.appointmentsThisWeek),
    pendingAppointments: toCount(data.pendingAppointments),
    completedThisMonth: toCount(data.completedThisMonth),
    checkedInToday: toCount(data.checkedInToday),
    noShowsThisMonth: toCount(data.noShowsThisMonth),
    rosterPatients: toCount(data.rosterPatients),
    pendingInvites: toCount(data.pendingInvites),
    activeMembers: toCount(data.activeMembers),
    appointmentCount: toCount(data.appointmentCount),
    roomUtilizationToday: roomUtilization,
  };
};
