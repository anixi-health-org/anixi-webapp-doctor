import { Doctor, Invoice, InvoiceLineItem, InvoiceStatus } from '../types';
import { SA_VAT_RATE, computeVatBreakdown } from '../lib/southAfrica';
import { sendPatientNotification } from './notificationService';
import { createDoctorNotification } from './doctorNotificationService';
import {
  djangoCreateInvoice,
  djangoGetInvoice,
  djangoListInvoices,
  djangoPatchInvoice,
  isDjangoApiEnabled,
} from './djangoApiService';

export interface CreateInvoiceOptions {
  vatRate?: number;
  vatNumber?: string;
  bhfPracticeNumber?: string;
  hpcsaNumber?: string;
  paymentReference?: string;
  bankDetailsNote?: string;
  diagnosisCodes?: string[];
  practiceId?: string;
}

export const invoiceOptionsFromDoctor = (
  doctor: Doctor | null | undefined,
  appointmentId?: string,
  practiceId?: string,
): CreateInvoiceOptions => {
  const paymentReference = appointmentId
    ? `ANIXI-${appointmentId.slice(0, 8).toUpperCase()}`
    : undefined;
  return {
    vatRate: SA_VAT_RATE,
    vatNumber: doctor?.vatNumber || undefined,
    bhfPracticeNumber: doctor?.practiceNumberBhf || undefined,
    hpcsaNumber: doctor?.licenseNumber || undefined,
    paymentReference,
    bankDetailsNote:
      'Pay by EFT using the payment reference above. Anixi does not collect card payments.',
    practiceId: practiceId || undefined,
  };
};

function toNumber(value: unknown, fallback = 0): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeLineItems(raw: unknown): InvoiceLineItem[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((entry) => {
    const item = (entry ?? {}) as Record<string, unknown>;
    return {
      ...item,
      description: String(item.description ?? 'Consultation'),
      quantity: toNumber(item.quantity, 1),
      amount: toNumber(item.amount ?? item.unitAmount ?? item.price),
    } as InvoiceLineItem;
  });
}

function mapDjangoInvoice(row: Record<string, unknown>, doctorId: string): Invoice {
  return mapInvoiceDoc(String(row.id ?? ''), { ...row, doctorId });
}

function mapInvoiceDoc(id: string, data: Record<string, unknown>): Invoice {
  const lineItems = normalizeLineItems(data.lineItems);
  const lineItemTotal = lineItems.reduce(
    (sum, item) => sum + item.amount * item.quantity,
    0,
  );
  const totalAmount = toNumber(data.totalAmount ?? data.total, lineItemTotal);
  const vatRate = toNumber(data.vatRate, SA_VAT_RATE);

  return {
    id,
    ...(data as Omit<Invoice, 'id'>),
    lineItems,
    totalAmount,
    vatRate,
    subtotalExVat: toNumber(data.subtotalExVat, lineItemTotal),
    vatAmount: toNumber(data.vatAmount, 0),
    issuedAt: toDate(data.issuedAt) || new Date(),
    dueDate: toDate(data.dueDate) ?? undefined,
    paidAt: toDate(data.paidAt) ?? undefined,
    lastResentAt: toDate(data.lastResentAt) ?? undefined,
    createdAt: toDate(data.createdAt) || new Date(),
    updatedAt: toDate(data.updatedAt) || new Date(),
  };
}

function toDate(value: unknown): Date | null {
  if (value instanceof Date) return value;
  if (typeof value === 'string') return new Date(value);
  if (value && typeof value === 'object' && 'seconds' in value) {
    return new Date((value as { seconds: number }).seconds * 1000);
  }
  return null;
}

export const generateInvoiceNumber = (appointmentId: string): string => {
  return `INV-${appointmentId.slice(0, 8).toUpperCase()}-${new Date().getFullYear()}`;
};

export const createInvoiceRecord = async (
  doctorId: string,
  patientId: string,
  appointmentId: string,
  lineItems: InvoiceLineItem[],
  notes?: string,
  currency: string = 'ZAR',
  opts?: CreateInvoiceOptions,
): Promise<Invoice> => {
  if (!doctorId || !patientId || !appointmentId || !lineItems.length) {
    throw new Error('Missing required invoice fields');
  }

  const subtotalExVat = lineItems.reduce(
    (sum, item) => sum + item.amount * item.quantity,
    0,
  );
  const vatRate = opts?.vatRate ?? SA_VAT_RATE;
  const { subtotal, vatAmount, total } = computeVatBreakdown(subtotalExVat, vatRate);
  const invoiceNumber = generateInvoiceNumber(appointmentId);
  const now = new Date();

  if (isDjangoApiEnabled()) {
    const dueDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const row = await djangoCreateInvoice({
      patientId,
      appointmentId,
      practiceId: opts?.practiceId,
      currency,
      lineItems,
      totalAmount: total,
      status: 'issued',
      invoiceNumber,
      notes: notes || undefined,
      vatRate,
      vatNumber: opts?.vatNumber,
      bhfPracticeNumber: opts?.bhfPracticeNumber,
      hpcsaNumber: opts?.hpcsaNumber,
      metadata: {
        paymentReference: opts?.paymentReference,
        bankDetailsNote: opts?.bankDetailsNote,
        diagnosisCodes: opts?.diagnosisCodes,
        dueDate: dueDate.toISOString(),
        issuedAt: now.toISOString(),
      },
    });
    return mapDjangoInvoice(row, doctorId);
  }

  const invoice: Invoice = {
    id: `inv-${Date.now()}`,
    doctorId,
    patientId,
    appointmentId,
    invoiceNumber,
    status: 'issued',
    lineItems,
    subtotalExVat: subtotal,
    vatRate,
    vatAmount,
    totalAmount: total,
    currency,
    vatNumber: opts?.vatNumber,
    bhfPracticeNumber: opts?.bhfPracticeNumber,
    hpcsaNumber: opts?.hpcsaNumber,
    paymentReference: opts?.paymentReference,
    bankDetailsNote: opts?.bankDetailsNote,
    diagnosisCodes: opts?.diagnosisCodes,
    issuedAt: now,
    dueDate: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
    paidAt: undefined,
    notes: notes || undefined,
    createdAt: now,
    updatedAt: now,
  };

  return invoice;
};

export const getInvoicesByDoctor = async (
  doctorId: string,
  options?: { patientId?: string; status?: InvoiceStatus; appointmentId?: string },
): Promise<Invoice[]> => {
  if (!doctorId) throw new Error('Doctor ID is required');

  if (isDjangoApiEnabled()) {
    const rows = await djangoListInvoices();
    let invoices = rows.map((row) => mapDjangoInvoice(row, doctorId));
    if (options?.patientId) {
      invoices = invoices.filter((inv) => inv.patientId === options.patientId);
    }
    if (options?.status) {
      invoices = invoices.filter((inv) => inv.status === options.status);
    }
    if (options?.appointmentId) {
      invoices = invoices.filter((inv) => inv.appointmentId === options.appointmentId);
    }
    return invoices.sort(
      (a, b) => new Date(b.issuedAt).getTime() - new Date(a.issuedAt).getTime(),
    );
  }

  return [];
};

export const getInvoicesForPractice = async (
  practiceId: string,
  doctorIds: string[],
): Promise<Invoice[]> => {
  if (!practiceId) throw new Error('Practice ID is required');

  const seen = new Set<string>();
  const invoices: Invoice[] = [];

  for (const doctorId of doctorIds) {
    if (!doctorId) continue;
    try {
      const doctorInvoices = await getInvoicesByDoctor(doctorId);
      for (const invoice of doctorInvoices) {
        if (seen.has(invoice.id)) continue;
        seen.add(invoice.id);
        invoices.push(invoice);
      }
    } catch (error) {
      console.warn('[invoiceService] doctor invoice merge skipped', doctorId, error);
    }
  }

  return invoices.sort((a, b) => new Date(b.issuedAt).getTime() - new Date(a.issuedAt).getTime());
};

export const getInvoiceById = async (invoiceId: string): Promise<Invoice | null> => {
  if (!invoiceId) throw new Error('Invoice ID is required');
  if (isDjangoApiEnabled()) {
    const row = await djangoGetInvoice(invoiceId);
    if (!row) return null;
    return mapDjangoInvoice(row, String(row.doctorId ?? ''));
  }
  return null;
};

export const updateInvoiceStatus = async (
  invoiceId: string,
  status: InvoiceStatus,
): Promise<void> => {
  if (!invoiceId || !status) throw new Error('Invoice ID and status are required');
  if (isDjangoApiEnabled()) {
    await djangoPatchInvoice(invoiceId, { status });
    return;
  }
};

export const updateInvoiceRecord = async (
  invoiceId: string,
  patch: Partial<{
    lineItems: InvoiceLineItem[];
    notes: string;
    currency: string;
    dueDate: Date;
    status: InvoiceStatus;
  }>,
): Promise<Invoice> => {
  if (!invoiceId) throw new Error('Invoice ID is required');
  if (isDjangoApiEnabled()) {
    const row = await djangoPatchInvoice(invoiceId, {
      status: patch.status,
      lineItems: patch.lineItems,
      currency: patch.currency,
      metadata: patch.dueDate ? { dueDate: patch.dueDate.toISOString() } : undefined,
    });
    return mapDjangoInvoice(row, String(row.doctorId ?? ''));
  }
  const now = new Date();
  return {
    id: invoiceId,
    doctorId: '',
    patientId: '',
    appointmentId: '',
    invoiceNumber: '',
    status: patch.status || 'issued',
    currency: patch.currency || 'ZAR',
    lineItems: patch.lineItems || [],
    subtotalExVat: 0,
    vatAmount: 0,
    totalAmount: 0,
    issuedAt: now,
    createdAt: now,
    updatedAt: now,
  };
};

export const generateStatement = async (
  doctorId: string,
  patientId: string,
): Promise<{ invoices: Invoice[]; summary: { issued: number; outstanding: number; paid: number; total: number } }> => {
  if (!doctorId || !patientId) throw new Error('Doctor ID and Patient ID are required');

  const invoices = await getInvoicesByDoctor(doctorId, { patientId });

  const summary = {
    issued: invoices.filter((i) => i.status === 'issued').reduce((sum, i) => sum + i.totalAmount, 0),
    outstanding: invoices
      .filter((i) => i.status === 'outstanding')
      .reduce((sum, i) => sum + i.totalAmount, 0),
    paid: invoices.filter((i) => i.status === 'paid').reduce((sum, i) => sum + i.totalAmount, 0),
    total: invoices.reduce((sum, i) => sum + i.totalAmount, 0),
  };

  return { invoices, summary };
};

export const resendInvoice = async (invoiceId: string): Promise<void> => {
  if (!invoiceId) throw new Error('Invoice ID is required');
  const invoice = await getInvoiceById(invoiceId);
  if (!invoice) throw new Error('Invoice not found');

  const totalFormatted = invoice.totalAmount.toLocaleString('en-ZA', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  await sendPatientNotification(invoice.patientId, {
    type: 'invoice_resent',
    title: 'Invoice resent',
    body: `Invoice ${invoice.invoiceNumber} for R ${totalFormatted} has been resent.`,
    appointmentId: invoice.appointmentId,
    doctorId: invoice.doctorId,
  });

  await createDoctorNotification(invoice.doctorId, {
    type: 'system',
    title: 'Invoice resent',
    body: `Invoice ${invoice.invoiceNumber} was resent to the patient.`,
    appointmentId: invoice.appointmentId,
    invoiceId,
  }).catch((error) => {
    console.warn('[invoiceService] createDoctorNotification failed:', error);
  });
};

interface LocalInvoiceLineItem {
  description: string;
  amount: number;
  currency: string;
}

interface LocalInvoice {
  id: string;
  invoiceNumber: string;
  appointmentId?: string;
  patientName?: string;
  createdAt: string;
  status: 'pending' | 'paid' | 'issued' | 'outstanding';
  lineItems: LocalInvoiceLineItem[];
  total: number;
}

const STORAGE_KEY = 'anixi_invoices_v1';

const readAll = (): LocalInvoice[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as LocalInvoice[];
  } catch {
    return [];
  }
};

const writeAll = (items: LocalInvoice[]) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
};

export const createInvoiceLocal = (payload: {
  appointmentId?: string;
  patientName?: string;
  status?: 'pending' | 'paid' | 'issued' | 'outstanding';
  lineItems: LocalInvoiceLineItem[];
}): LocalInvoice => {
  const all = readAll();
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const invoiceNumber = `INV-${new Date().getFullYear().toString().slice(-2)}-${Math.floor(1000 + Math.random() * 9000)}`;
  const total = payload.lineItems.reduce((s, li) => s + (li.amount || 0), 0);
  const inv: LocalInvoice = {
    id,
    invoiceNumber,
    appointmentId: payload.appointmentId,
    patientName: payload.patientName,
    createdAt: new Date().toISOString(),
    status: payload.status || 'pending',
    lineItems: payload.lineItems,
    total,
  };
  all.unshift(inv);
  writeAll(all);
  return inv;
};

export const getLocalInvoice = (id: string): LocalInvoice | null => {
  const all = readAll();
  return all.find((i) => i.id === id) || null;
};

export const updateLocalInvoice = (id: string, patch: Partial<LocalInvoice>): LocalInvoice | null => {
  const all = readAll();
  const idx = all.findIndex((i) => i.id === id);
  if (idx === -1) return null;
  const updated: LocalInvoice = { ...all[idx], ...patch };
  if (patch.lineItems) {
    updated.total = patch.lineItems.reduce((s, li) => s + (li.amount || 0), 0);
  }
  all[idx] = updated;
  writeAll(all);
  return updated;
};

export const listLocalInvoices = (): LocalInvoice[] => readAll();
