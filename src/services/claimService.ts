import type { Invoice, InvoiceLineItem, Patient } from '../types';

export type MedicalAidClaimStatus =
  | 'draft'
  | 'submitted'
  | 'accepted'
  | 'rejected'
  | 'paid';

export interface MedicalAidClaim {
  id: string;
  practiceId?: string;
  doctorId: string;
  patientId: string;
  invoiceId: string;
  invoiceNumber?: string;
  status: MedicalAidClaimStatus;
  medicalSchemeName?: string;
  memberNumber?: string;
  planOption?: string;
  diagnosisCodes?: string[];
  lineItems: InvoiceLineItem[];
  totalAmount: number;
  currency?: string;
  notes?: string;
  submittedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

function toDate(value: unknown): Date | null {
  if (value instanceof Date) return value;
  if (typeof value === 'string') return new Date(value);
  if (value && typeof value === 'object' && 'seconds' in value) {
    return new Date((value as { seconds: number }).seconds * 1000);
  }
  return null;
}

function mapClaim(id: string, data: Record<string, unknown>): MedicalAidClaim {
  return {
    id,
    practiceId: (data.practiceId as string) || undefined,
    doctorId: String(data.doctorId ?? ''),
    patientId: String(data.patientId ?? ''),
    invoiceId: String(data.invoiceId ?? ''),
    invoiceNumber: (data.invoiceNumber as string) || undefined,
    status: (data.status as MedicalAidClaimStatus) || 'draft',
    medicalSchemeName: (data.medicalSchemeName as string) || undefined,
    memberNumber: (data.memberNumber as string) || undefined,
    planOption: (data.planOption as string) || undefined,
    diagnosisCodes: Array.isArray(data.diagnosisCodes)
      ? (data.diagnosisCodes as string[])
      : undefined,
    lineItems: Array.isArray(data.lineItems)
      ? (data.lineItems as InvoiceLineItem[])
      : [],
    totalAmount: Number(data.totalAmount ?? 0),
    currency: (data.currency as string) || 'ZAR',
    notes: (data.notes as string) || undefined,
    submittedAt: toDate(data.submittedAt) ?? undefined,
    createdAt: toDate(data.createdAt) || new Date(),
    updatedAt: toDate(data.updatedAt) || new Date(),
  };
}

export async function listPracticeClaims(
  practiceId: string,
): Promise<MedicalAidClaim[]> {
  // TODO: replace with a Django claims endpoint once available.
  return [];
}

export async function createClaimFromInvoice(
  invoice: Invoice,
  _patient: Patient | null,
): Promise<MedicalAidClaim> {
  // TODO: persist via Django claims endpoint once available.
  const payload: Record<string, unknown> = {
    practiceId: invoice.practiceId ?? null,
    doctorId: invoice.doctorId,
    patientId: invoice.patientId,
    invoiceId: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    status: 'draft',
    medicalSchemeName: '',
    memberNumber: '',
    planOption: '',
    diagnosisCodes: invoice.diagnosisCodes || [],
    lineItems: invoice.lineItems,
    totalAmount: invoice.totalAmount,
    currency: invoice.currency || 'ZAR',
    notes: '',
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  return mapClaim(`claim-${Date.now()}`, payload);
}

export async function updateClaimStatus(
  _claimId: string,
  _status: MedicalAidClaimStatus,
): Promise<void> {
  // TODO: persist via Django claims endpoint once available.
}

export function buildClaimExportCsv(claim: MedicalAidClaim): string {
  const header = [
    'Invoice',
    'Scheme',
    'Member number',
    'ICD-10',
    'Description',
    'Qty',
    'Amount',
    'Total',
  ].join(',');
  const icd = (claim.diagnosisCodes || []).join('; ');
  const lines = claim.lineItems.map((item) =>
    [
      claim.invoiceNumber || claim.invoiceId,
      claim.medicalSchemeName || '',
      claim.memberNumber || '',
      icd,
      `"${item.description.replace(/"/g, '""')}"`,
      item.quantity,
      item.amount.toFixed(2),
      (item.amount * item.quantity).toFixed(2),
    ].join(','),
  );
  return [header, ...lines].join('\n');
}
