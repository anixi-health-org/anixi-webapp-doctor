export interface InvoiceLineItem {
  description: string;
  amount: number;
  currency: string;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  appointmentId?: string;
  patientName?: string;
  createdAt: string;
  status: 'pending' | 'paid';
  lineItems: InvoiceLineItem[];
  total: number;
}

const STORAGE_KEY = 'anixi_invoices_v1';

const readAll = (): Invoice[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as Invoice[];
  } catch {
    return [];
  }
};

const writeAll = (items: Invoice[]) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
};

export const createInvoice = (payload: Omit<Invoice, 'id' | 'invoiceNumber' | 'createdAt' | 'total'>): Invoice => {
  const all = readAll();
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const invoiceNumber = `INV-${new Date().getFullYear().toString().slice(-2)}-${Math.floor(1000 + Math.random() * 9000)}`;
  const total = (payload.lineItems || []).reduce((s, li) => s + (li.amount || 0), 0);
  const inv: Invoice = {
    id,
    invoiceNumber,
    appointmentId: payload.appointmentId,
    patientName: payload.patientName,
    createdAt: new Date().toISOString(),
    status: payload.status || 'pending',
    lineItems: payload.lineItems || [],
    total,
  };
  all.unshift(inv);
  writeAll(all);
  return inv;
};

export const getInvoice = (id: string): Invoice | null => {
  const all = readAll();
  return all.find((i) => i.id === id) || null;
};

export const updateInvoice = (id: string, patch: Partial<Invoice>): Invoice | null => {
  const all = readAll();
  const idx = all.findIndex((i) => i.id === id);
  if (idx === -1) return null;
  const updated = { ...all[idx], ...patch };
  if (patch.lineItems) {
    updated.total = (patch.lineItems || []).reduce((s, li) => s + (li.amount || 0), 0);
  }
  all[idx] = updated;
  writeAll(all);
  return updated;
};

export const listInvoices = (): Invoice[] => readAll();
