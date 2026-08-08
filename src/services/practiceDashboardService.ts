import {
  collection,
  getCountFromServer,
  getDocs,
  query,
  where,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { PRACTICES_COLLECTION, PRACTICE_APPOINTMENTS_SUBCOLLECTION } from '../shared/constants';

export type PracticeDashboardStats = {
  appointmentsThisWeek: number;
  appointmentsToday: number;
  pendingAppointments: number;
  completedThisMonth: number;
};

const startOfDay = (d: Date) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};

const endOfDay = (d: Date) => {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
};

/**
 * Lightweight practice-wide appointment volume stats for clinic dashboards.
 */
export const getPracticeDashboardStats = async (
  practiceId: string
): Promise<PracticeDashboardStats> => {
  const now = new Date();
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);

  const weekStart = startOfDay(now);
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  const weekEnd = endOfDay(now);
  weekEnd.setDate(weekStart.getDate() + 6);

  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = endOfDay(new Date(now.getFullYear(), now.getMonth() + 1, 0));

  const apptCol = collection(
    db,
    PRACTICES_COLLECTION,
    practiceId,
    PRACTICE_APPOINTMENTS_SUBCOLLECTION
  );

  try {
    const [todaySnap, weekSnap, pendingSnap, completedSnap] = await Promise.all([
      getCountFromServer(
        query(
          apptCol,
          where('startAt', '>=', Timestamp.fromDate(todayStart)),
          where('startAt', '<=', Timestamp.fromDate(todayEnd))
        )
      ),
      getCountFromServer(
        query(
          apptCol,
          where('startAt', '>=', Timestamp.fromDate(weekStart)),
          where('startAt', '<=', Timestamp.fromDate(weekEnd))
        )
      ),
      getCountFromServer(query(apptCol, where('status', '==', 'pending'))),
      getCountFromServer(
        query(
          apptCol,
          where('status', '==', 'completed'),
          where('startAt', '>=', Timestamp.fromDate(monthStart)),
          where('startAt', '<=', Timestamp.fromDate(monthEnd))
        )
      ),
    ]);

    return {
      appointmentsToday: todaySnap.data().count,
      appointmentsThisWeek: weekSnap.data().count,
      pendingAppointments: pendingSnap.data().count,
      completedThisMonth: completedSnap.data().count,
    };
  } catch (error) {
    // Fallback without composite indexes - scan recent docs lightly
    console.warn('[practiceDashboard] count queries failed, falling back:', error);
    const snap = await getDocs(apptCol);
    let appointmentsToday = 0;
    let appointmentsThisWeek = 0;
    let pendingAppointments = 0;
    let completedThisMonth = 0;

    snap.docs.forEach((d) => {
      const data = d.data();
      const start =
        data.startAt instanceof Timestamp
          ? data.startAt.toDate()
          : data.date instanceof Timestamp
            ? data.date.toDate()
            : null;
      if (data.status === 'pending') pendingAppointments += 1;
      if (!start) return;
      if (start >= todayStart && start <= todayEnd) appointmentsToday += 1;
      if (start >= weekStart && start <= weekEnd) appointmentsThisWeek += 1;
      if (data.status === 'completed' && start >= monthStart && start <= monthEnd) {
        completedThisMonth += 1;
      }
    });

    return {
      appointmentsToday,
      appointmentsThisWeek,
      pendingAppointments,
      completedThisMonth,
    };
  }
};
