import { db } from '../lib/firebase';
import {
  collection,
  addDoc,
  getDocs,
  getDoc,
  updateDoc,
  doc,
  query,
  where,
  Timestamp,
} from 'firebase/firestore';
import { Doctor, Invoice, InvoiceLineItem, InvoiceStatus } from '../types';
import { SA_VAT_RATE, computeVatBreakdown } from '../lib/southAfrica';
import { sendPatientNotification } from './notificationService';
import { createDoctorNotification } from './doctorNotificationService';

const INVOICES_COLLECTION = 'invoices';

export interface CreateInvoiceOptions {
  vatRate?: number;
  vatNumber?: string;
  bhfPracticeNumber?: string;
  hpcsaNumber?: string;
  paymentReference?: string;
  bankDetailsNote?: string;
  diagnosisCodes?: string[];
}

/** Snapshot SA practice identity + EFT reference onto a new invoice. */
export const invoiceOptionsFromDoctor = (
  doctor: Doctor | null | undefined,
  appointmentId?: string
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
  };
};

function mapInvoiceDoc(id: string, data: Record<string, unknown>): Invoice {
  return {
    id,
    ...(data as Omit<Invoice, 'id'>),
    issuedAt: (data.issuedAt as { toDate?: () => Date })?.toDate?.() || new Date(),
    dueDate: (data.dueDate as { toDate?: () => Date })?.toDate?.(),
    paidAt: (data.paidAt as { toDate?: () => Date })?.toDate?.(),
    lastResentAt: (data.lastResentAt as { toDate?: () => Date })?.toDate?.(),
    createdAt: (data.createdAt as { toDate?: () => Date })?.toDate?.() || new Date(),
    updatedAt: (data.updatedAt as { toDate?: () => Date })?.toDate?.() || new Date(),
  };
}

/**
 * Generate invoice number based on appointment ID
 */
export const generateInvoiceNumber = (appointmentId: string): string => {
  return `INV-${appointmentId.slice(0, 8).toUpperCase()}-${new Date().getFullYear()}`;
};

/**
 * Create a new invoice record
 */
export const createInvoiceRecord = async (
  doctorId: string,
  patientId: string,
  appointmentId: string,
  lineItems: InvoiceLineItem[],
  notes?: string,
  currency: string = 'ZAR',
  opts?: CreateInvoiceOptions
): Promise<Invoice> => {
  if (!doctorId || !patientId || !appointmentId || !lineItems.length) {
    throw new Error('Missing required invoice fields');
  }

  const subtotalExVat = lineItems.reduce((sum, item) => sum + item.amount * item.quantity, 0);
  const vatRate = opts?.vatRate ?? SA_VAT_RATE;
  const { subtotal, vatAmount, total } = computeVatBreakdown(subtotalExVat, vatRate);
  const invoiceNumber = generateInvoiceNumber(appointmentId);
  const now = new Date();

  const invoiceData: Record<string, unknown> = {
    doctorId,
    patientId,
    appointmentId,
    invoiceNumber,
    status: 'issued' as InvoiceStatus,
    lineItems,
    subtotalExVat: subtotal,
    vatRate,
    vatAmount,
    totalAmount: total,
    currency,
    issuedAt: Timestamp.fromDate(now),
    dueDate: Timestamp.fromDate(new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)), // 30 days
    createdAt: Timestamp.fromDate(now),
    updatedAt: Timestamp.fromDate(now),
  };

  if (notes) {
    invoiceData.notes = notes;
  }
  if (opts?.vatNumber) invoiceData.vatNumber = opts.vatNumber;
  if (opts?.bhfPracticeNumber) invoiceData.bhfPracticeNumber = opts.bhfPracticeNumber;
  if (opts?.hpcsaNumber) invoiceData.hpcsaNumber = opts.hpcsaNumber;
  if (opts?.paymentReference) invoiceData.paymentReference = opts.paymentReference;
  if (opts?.bankDetailsNote) invoiceData.bankDetailsNote = opts.bankDetailsNote;
  if (opts?.diagnosisCodes?.length) invoiceData.diagnosisCodes = opts.diagnosisCodes;

  const docRef = await addDoc(collection(db, INVOICES_COLLECTION), invoiceData);

  return {
    id: docRef.id,
    doctorId,
    patientId,
    appointmentId,
    invoiceNumber,
    status: 'issued' as InvoiceStatus,
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
};

/**
 * Get invoices for a doctor with optional filters
 */
export const getInvoicesByDoctor = async (
  doctorId: string,
  options?: { patientId?: string; status?: InvoiceStatus; appointmentId?: string }
): Promise<Invoice[]> => {
  if (!doctorId) throw new Error('Doctor ID is required');

  try {
    let q = query(
      collection(db, INVOICES_COLLECTION),
      where('doctorId', '==', doctorId)
    );

    if (options?.patientId) {
      q = query(
        collection(db, INVOICES_COLLECTION),
        where('doctorId', '==', doctorId),
        where('patientId', '==', options.patientId)
      );
    }

    const snapshot = await getDocs(q);
    let invoices: Invoice[] = snapshot.docs.map((d) => mapInvoiceDoc(d.id, d.data()));

    invoices = invoices.sort((a, b) => new Date(b.issuedAt).getTime() - new Date(a.issuedAt).getTime());

    if (options?.status) {
      invoices = invoices.filter((inv) => inv.status === options.status);
    }

    if (options?.appointmentId) {
      invoices = invoices.filter((inv) => inv.appointmentId === options.appointmentId);
    }

    return invoices;
  } catch (error) {
    console.error('[invoiceService] getInvoicesByDoctor error:', error);
    throw error;
  }
};

/**
 * Get a single invoice by ID
 */
export const getInvoiceById = async (invoiceId: string): Promise<Invoice | null> => {
  if (!invoiceId) throw new Error('Invoice ID is required');

  const invoiceRef = doc(db, INVOICES_COLLECTION, invoiceId);
  const docSnap = await getDoc(invoiceRef);

  if (!docSnap.exists()) return null;

  return mapInvoiceDoc(docSnap.id, docSnap.data());
};

/**
 * Update invoice status (e.g., mark as paid)
 */
export const updateInvoiceStatus = async (
  invoiceId: string,
  status: InvoiceStatus
): Promise<void> => {
  if (!invoiceId || !status) throw new Error('Invoice ID and status are required');

  const invoiceRef = doc(db, INVOICES_COLLECTION, invoiceId);
  const updates: Record<string, any> = {
    status,
    updatedAt: Timestamp.fromDate(new Date()),
  };

  if (status === 'paid') {
    updates.paidAt = Timestamp.fromDate(new Date());
  }

  await updateDoc(invoiceRef, updates);

  if (status === 'paid') {
    try {
      const invoice = await getInvoiceById(invoiceId);
      if (invoice) {
        await createDoctorNotification(invoice.doctorId, {
          type: 'invoice_paid',
          title: 'Invoice marked paid',
          body: `Invoice ${invoice.invoiceNumber} was marked as paid.`,
          invoiceId: invoice.id,
          appointmentId: invoice.appointmentId,
        });
      }
    } catch (error) {
      console.warn('[invoiceService] paid notification failed:', error);
    }
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
  }>
): Promise<Invoice> => {
  if (!invoiceId) throw new Error('Invoice ID is required');
  const invoiceRef = doc(db, INVOICES_COLLECTION, invoiceId);
  const updateData: Record<string, any> = {
    updatedAt: Timestamp.fromDate(new Date()),
  };

  if (patch.lineItems) {
    updateData.lineItems = patch.lineItems;
    const subtotalExVat = patch.lineItems.reduce(
      (sum, item) => sum + item.amount * item.quantity,
      0
    );
    const existing = await getDoc(invoiceRef);
    const vatRate = (existing.data()?.vatRate as number | undefined) ?? SA_VAT_RATE;
    const { subtotal, vatAmount, total } = computeVatBreakdown(subtotalExVat, vatRate);
    updateData.subtotalExVat = subtotal;
    updateData.vatAmount = vatAmount;
    updateData.totalAmount = total;
  }

  if (patch.notes !== undefined) {
    updateData.notes = patch.notes;
  }

  if (patch.currency) {
    updateData.currency = patch.currency;
  }

  if (patch.dueDate) {
    updateData.dueDate = Timestamp.fromDate(patch.dueDate);
  }

  if (patch.status) {
    updateData.status = patch.status;
    if (patch.status === 'paid') {
      updateData.paidAt = Timestamp.fromDate(new Date());
    }
  }

  await updateDoc(invoiceRef, updateData);
  const updatedDoc = await getDoc(invoiceRef);
  if (!updatedDoc.exists()) throw new Error('Invoice not found after update');
  return mapInvoiceDoc(updatedDoc.id, updatedDoc.data());
};

/**
 * Generate statement of account for a patient (all invoices from doctor)
 */
export const generateStatement = async (
  doctorId: string,
  patientId: string
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

/**
 * Resend invoice notification to patient and stamp lastResentAt.
 */
export const resendInvoice = async (invoiceId: string): Promise<void> => {
  if (!invoiceId) throw new Error('Invoice ID is required');

  const invoice = await getInvoiceById(invoiceId);
  if (!invoice) throw new Error('Invoice not found');

  const now = new Date();
  const invoiceRef = doc(db, INVOICES_COLLECTION, invoiceId);
  await updateDoc(invoiceRef, {
    updatedAt: Timestamp.fromDate(now),
    lastResentAt: Timestamp.fromDate(now),
  });

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
