import type { Pharmacy, PharmacyOrder } from '../types';
import {
  djangoCreatePharmacyOrder,
  djangoListPharmacyOrders,
  djangoListWellnessProviders,
  isDjangoApiEnabled,
} from './djangoApiService';

function mapPharmacy(id: string, data: Record<string, unknown>): Pharmacy {
  const toDate = (v: unknown) => {
    if (v instanceof Date) return v;
    if (typeof v === 'string') return new Date(v);
    if (v && typeof v === 'object' && 'seconds' in v) {
      return new Date((v as { seconds: number }).seconds * 1000);
    }
    return new Date();
  };
  return {
    id,
    name: String(data.name ?? 'Pharmacy'),
    email: String(data.email ?? ''),
    phone: (data.phone as string) || undefined,
    address: (data.address as string) || undefined,
    city: (data.city as string) || undefined,
    province: (data.province as string) || undefined,
    deliveryAvailable: data.deliveryAvailable === true,
    published: data.published === true,
    verified: data.verified === true,
    createdAt: toDate(data.createdAt),
    updatedAt: toDate(data.updatedAt),
  };
}

function mapPharmacyOrder(row: Record<string, unknown>): PharmacyOrder {
  const toDate = (v: unknown) => {
    if (v instanceof Date) return v;
    if (typeof v === 'string') return new Date(v);
    return new Date();
  };
  return {
    id: String(row.id ?? ''),
    patientId: String(row.patientId ?? ''),
    doctorId: String(row.doctorId ?? ''),
    appointmentId: String(row.appointmentId ?? ''),
    pharmacyId: row.pharmacyId ? String(row.pharmacyId) : undefined,
    pharmacyName: String(row.pharmacyName ?? 'Pharmacy'),
    pharmacyEmail: String(row.pharmacyEmail ?? ''),
    prescriptionText: String(row.prescriptionText ?? ''),
    status: String(row.status ?? 'sent') as PharmacyOrder['status'],
    createdAt: toDate(row.createdAt),
    updatedAt: toDate(row.updatedAt),
  };
}

export async function listPublishedPharmacies(): Promise<Pharmacy[]> {
  try {
    const rows = await djangoListWellnessProviders('pharmacy');
    return (rows as Record<string, unknown>[]).map((row) =>
      mapPharmacy(String(row.id ?? ''), row),
    );
  } catch {
    return [];
  }
}

export async function getPharmacy(id: string): Promise<Pharmacy | null> {
  const pharmacies = await listPublishedPharmacies();
  return pharmacies.find((pharmacy) => pharmacy.id === id) ?? null;
}

export async function upsertPharmacy(
  _id: string | null,
  _input: Omit<Pharmacy, 'id' | 'createdAt' | 'updatedAt'>,
): Promise<string> {
  return `pharmacy-${Date.now()}`;
}

export async function listPatientPharmacyOrders(
  patientId: string,
): Promise<PharmacyOrder[]> {
  if (!isDjangoApiEnabled()) return [];
  const rows = await djangoListPharmacyOrders();
  return rows
    .filter((row) => String(row.patientId) === patientId)
    .map(mapPharmacyOrder);
}

export async function sendPrescriptionToPharmacy(params: {
  postConsultActionId?: string;
  patientId: string;
  appointmentId: string;
  pharmacyEmail: string;
  pharmacyName?: string;
  pharmacyId?: string;
  prescriptionText: string;
}): Promise<{ orderId: string; status: string }> {
  if (isDjangoApiEnabled()) {
    const order = await djangoCreatePharmacyOrder({
      patientId: params.patientId,
      appointmentId: params.appointmentId,
      pharmacyEmail: params.pharmacyEmail,
      pharmacyName: params.pharmacyName,
      pharmacyId: params.pharmacyId,
      prescriptionText: params.prescriptionText,
      postConsultActionId: params.postConsultActionId,
    });
    return {
      orderId: String(order.id ?? ''),
      status: String(order.status ?? 'sent'),
    };
  }

  return {
    orderId: `order-${Date.now()}`,
    status: 'sent',
  };
}
