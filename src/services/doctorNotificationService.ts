import {
  djangoCreateNotification,
  djangoListNotifications,
  isDjangoApiEnabled,
} from './djangoApiService';

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

export const createDoctorNotification = async (
  doctorId: string,
  payload: DoctorNotificationPayload,
): Promise<void> => {
  if (!doctorId) return;

  if (isDjangoApiEnabled()) {
    await djangoCreateNotification({
      type: payload.type,
      title: payload.title,
      body: payload.body,
      appointmentId: payload.appointmentId,
      invoiceId: payload.invoiceId,
    });
    return;
  }

  // Firestore path removed. No-op until migration.
  return;
};

export const listDoctorNotifications = async (
  _doctorId: string,
  max = 50,
): Promise<DoctorNotification[]> => {
  if (isDjangoApiEnabled()) {
    const rows = await djangoListNotifications();
    return rows.slice(0, max).map((row) => ({
      id: row.id,
      type: (row.type as DoctorNotificationType) || 'system',
      title: row.title,
      body: row.body,
      appointmentId: row.appointmentId,
      invoiceId: row.invoiceId,
      read: row.read,
      createdAt: new Date(row.createdAt),
    }));
  }

  // Firestore path removed.
  return [];
};
