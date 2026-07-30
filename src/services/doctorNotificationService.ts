import {
  addDoc,
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { USERS_COLLECTION } from '../shared/constants';

export type DoctorNotificationType =
  | 'booking_request'
  | 'booking_cancelled'
  | 'invoice_paid'
  | 'system';

export interface DoctorNotificationPayload {
  type: DoctorNotificationType;
  title: string;
  body: string;
  appointmentId?: string;
  invoiceId?: string;
  read?: boolean;
}

export interface DoctorNotification extends DoctorNotificationPayload {
  id: string;
  createdAt: Date;
}

/**
 * Writes a durable notification to Users/{doctorId}/notifications.
 * The doctor portal NotificationsPage merges these with derived appointment alerts.
 */
export const createDoctorNotification = async (
  doctorId: string,
  payload: DoctorNotificationPayload
): Promise<void> => {
  if (!doctorId) return;
  const notifRef = collection(db, USERS_COLLECTION, doctorId, 'notifications');
  await addDoc(notifRef, {
    ...payload,
    read: payload.read ?? false,
    createdAt: serverTimestamp(),
  });
};

export const listDoctorNotifications = async (
  doctorId: string,
  max = 50
): Promise<DoctorNotification[]> => {
  if (!doctorId) return [];
  const notifRef = collection(db, USERS_COLLECTION, doctorId, 'notifications');
  try {
    const snap = await getDocs(query(notifRef, orderBy('createdAt', 'desc'), limit(max)));
    return snap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        type: (data.type as DoctorNotificationType) || 'system',
        title: String(data.title ?? 'Notification'),
        body: String(data.body ?? ''),
        appointmentId: typeof data.appointmentId === 'string' ? data.appointmentId : undefined,
        invoiceId: typeof data.invoiceId === 'string' ? data.invoiceId : undefined,
        read: Boolean(data.read),
        createdAt: data.createdAt?.toDate?.() || new Date(),
      };
    });
  } catch (error) {
    // Fallback without orderBy if index is missing
    console.warn('[doctorNotificationService] listDoctorNotifications fallback:', error);
    const snap = await getDocs(notifRef);
    return snap.docs
      .map((d) => {
        const data = d.data();
        return {
          id: d.id,
          type: (data.type as DoctorNotificationType) || 'system',
          title: String(data.title ?? 'Notification'),
          body: String(data.body ?? ''),
          appointmentId: typeof data.appointmentId === 'string' ? data.appointmentId : undefined,
          invoiceId: typeof data.invoiceId === 'string' ? data.invoiceId : undefined,
          read: Boolean(data.read),
          createdAt: data.createdAt?.toDate?.() || new Date(),
        };
      })
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, max);
  }
};
