import { db } from '../lib/firebase';
import {
  collection,
  addDoc,
  getDocs,
  updateDoc,
  doc,
  query,
  where,
  Timestamp,
  orderBy,
} from 'firebase/firestore';
import { Invoice, InvoiceLineItem, InvoiceStatus } from '../types';

const INVOICES_COLLECTION = 'invoices';

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
  notes?: string
): Promise<Invoice> => {
  if (!doctorId || !patientId || !appointmentId || !lineItems.length) {
    throw new Error('Missing required invoice fields');
  }

  const totalAmount = lineItems.reduce((sum, item) => sum + item.amount * item.quantity, 0);
  const invoiceNumber = generateInvoiceNumber(appointmentId);
  const now = new Date();

  const invoiceData: any = {
    doctorId,
    patientId,
    appointmentId,
    invoiceNumber,
    status: 'issued' as InvoiceStatus,
    lineItems,
    totalAmount,
    currency: 'ZAR',
    issuedAt: Timestamp.fromDate(now),
    dueDate: Timestamp.fromDate(new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)), // 30 days
    createdAt: Timestamp.fromDate(now),
    updatedAt: Timestamp.fromDate(now),
  };

  // Only include optional fields if they have values
  if (notes) {
    invoiceData.notes = notes;
  }

  const docRef = await addDoc(collection(db, INVOICES_COLLECTION), invoiceData);

  return {
    id: docRef.id,
    doctorId,
    patientId,
    appointmentId,
    invoiceNumber,
    status: 'issued' as InvoiceStatus,
    lineItems,
    totalAmount,
    currency: 'ZAR',
    issuedAt: invoiceData.issuedAt.toDate(),
    dueDate: invoiceData.dueDate.toDate(),
    paidAt: undefined,
    notes: notes || undefined,
    createdAt: invoiceData.createdAt.toDate(),
    updatedAt: invoiceData.updatedAt.toDate(),
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
    let invoices: Invoice[] = snapshot.docs.map((d) => ({
      id: d.id,
      ...(d.data() as Omit<Invoice, 'id'>),
      issuedAt: d.data().issuedAt?.toDate() || new Date(),
      dueDate: d.data().dueDate?.toDate(),
      paidAt: d.data().paidAt?.toDate(),
      createdAt: d.data().createdAt?.toDate() || new Date(),
      updatedAt: d.data().updatedAt?.toDate() || new Date(),
    }));

    // Sort by issuedAt descending (most recent first) - client-side to avoid index requirement
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

  const docSnap = await getDocs(
    query(collection(db, INVOICES_COLLECTION), where('id', '==', invoiceId))
  );

  if (docSnap.empty) return null;

  const d = docSnap.docs[0];
  return {
    id: d.id,
    ...(d.data() as Omit<Invoice, 'id'>),
    issuedAt: d.data().issuedAt?.toDate() || new Date(),
    dueDate: d.data().dueDate?.toDate(),
    paidAt: d.data().paidAt?.toDate(),
    createdAt: d.data().createdAt?.toDate() || new Date(),
    updatedAt: d.data().updatedAt?.toDate() || new Date(),
  };
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
 * Resend invoice (mark as resent in audit trail - creates notification record)
 * For Phase 1: Just log the resend; Phase 2 would integrate with notification service
 */
export const resendInvoice = async (invoiceId: string): Promise<void> => {
  if (!invoiceId) throw new Error('Invoice ID is required');

  const invoiceRef = doc(db, INVOICES_COLLECTION, invoiceId);
  await updateDoc(invoiceRef, {
    updatedAt: Timestamp.fromDate(new Date()),
    lastResentAt: Timestamp.fromDate(new Date()),
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
