import React, { useEffect, useState } from 'react';
import { useAuth } from '../hooks/AuthContext';
import { getInvoicesByDoctor, updateInvoiceStatus, resendInvoice } from '../services/invoiceService';
import { generateInvoicePDF } from '../services/invoicePdfService';
import { Invoice, InvoiceStatus } from '../types';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Toast } from '../components/ui';

interface Summary {
  issued: number;
  outstanding: number;
  paid: number;
  total: number;
}

const getStatusColor = (status: InvoiceStatus): string => {
  switch (status) {
    case 'issued':
      return 'bg-blue-100 text-blue-800 border-blue-300';
    case 'outstanding':
      return 'bg-yellow-100 text-yellow-800 border-yellow-300';
    case 'paid':
      return 'bg-green-100 text-green-800 border-green-300';
    default:
      return 'bg-gray-100 text-gray-800 border-gray-300';
  }
};

const getStatusIcon = (status: InvoiceStatus): string => {
  switch (status) {
    case 'issued':
      return '📤';
    case 'outstanding':
      return '⏳';
    case 'paid':
      return '✅';
    default:
      return '📋';
  }
};

export const InvoicesPage: React.FC = () => {
  const { user } = useAuth();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [summary, setSummary] = useState<Summary>({ issued: 0, outstanding: 0, paid: 0, total: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<InvoiceStatus | 'all'>('all');
  const [toast, setToast] = useState<{ visible: boolean; message: string; type: 'success' | 'error' }>({
    visible: false,
    message: '',
    type: 'success',
  });
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, [user?.id]);

  useEffect(() => {
    if (toast.visible) {
      const timer = setTimeout(() => {
        setToast({ visible: false, message: '', type: 'success' });
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [toast.visible]);

  const loadData = async () => {
    if (!user?.id) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const allInvoices = await getInvoicesByDoctor(user.id);
      setInvoices(allInvoices);

      // Calculate summary
      const newSummary: Summary = {
        issued: allInvoices.filter((i) => i.status === 'issued').reduce((sum, i) => sum + i.totalAmount, 0),
        outstanding: allInvoices
          .filter((i) => i.status === 'outstanding')
          .reduce((sum, i) => sum + i.totalAmount, 0),
        paid: allInvoices.filter((i) => i.status === 'paid').reduce((sum, i) => sum + i.totalAmount, 0),
        total: allInvoices.reduce((sum, i) => sum + i.totalAmount, 0),
      };
      setSummary(newSummary);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load invoices';
      console.error('[InvoicesPage] Error loading invoices:', err);
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleMarkAsPaid = async (invoiceId: string) => {
    setUpdatingId(invoiceId);
    try {
      await updateInvoiceStatus(invoiceId, 'paid');
      setInvoices((prev) =>
        prev.map((inv) => (inv.id === invoiceId ? { ...inv, status: 'paid' as InvoiceStatus } : inv))
      );
      setToast({ visible: true, message: 'Invoice marked as paid', type: 'success' });
    } catch (err) {
      setToast({ visible: true, message: 'Failed to update invoice', type: 'error' });
    } finally {
      setUpdatingId(null);
    }
  };

  const handleMarkAsOutstanding = async (invoiceId: string) => {
    setUpdatingId(invoiceId);
    try {
      await updateInvoiceStatus(invoiceId, 'outstanding');
      setInvoices((prev) =>
        prev.map((inv) =>
          inv.id === invoiceId ? { ...inv, status: 'outstanding' as InvoiceStatus } : inv
        )
      );
      setToast({ visible: true, message: 'Invoice marked as outstanding', type: 'success' });
    } catch (err) {
      setToast({ visible: true, message: 'Failed to update invoice', type: 'error' });
    } finally {
      setUpdatingId(null);
    }
  };

  const handleResendInvoice = async (invoiceId: string) => {
    setUpdatingId(invoiceId);
    try {
      await resendInvoice(invoiceId);
      setToast({ visible: true, message: 'Invoice resent', type: 'success' });
    } catch (err) {
      setToast({ visible: true, message: 'Failed to resend invoice', type: 'error' });
    } finally {
      setUpdatingId(null);
    }
  };

  const handleDownloadPDF = async (invoice: Invoice) => {
    setUpdatingId(invoice.id);
    try {
      await generateInvoicePDF(invoice, {
        displayName: user?.displayName ?? 'Doctor',
        specialty: user?.specialty,
        licenseNumber: user?.licenseNumber,
        phoneNumber: user?.phoneNumber,
        email: user?.email,
        officeAddress: user?.officeAddress,
        logoUrl: user?.logoUrl,
        practiceName: user?.practiceName,
      });
    } catch {
      setToast({ visible: true, message: 'Failed to generate PDF', type: 'error' });
    } finally {
      setUpdatingId(null);
    }
  };

  const filteredInvoices = filter === 'all' ? invoices : invoices.filter((inv) => inv.status === filter);

  if (isLoading) {
    return (
      <div className="p-6">
        <p className="text-gray-500">Loading invoices...</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {toast.visible && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast({ visible: false, message: '', type: 'success' })}
        />
      )}

      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">💰 Invoicing & Financial Tracking</h1>
        <p className="text-gray-600">Manage your invoices and track payment status</p>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-700">{error}</p>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-sm text-gray-600 mb-1">Total Issued</p>
              <p className="text-2xl font-bold text-blue-600">R {summary.issued.toFixed(2)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-sm text-gray-600 mb-1">Outstanding</p>
              <p className="text-2xl font-bold text-amber-600">R {summary.outstanding.toFixed(2)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-sm text-gray-600 mb-1">Paid</p>
              <p className="text-2xl font-bold text-green-600">R {summary.paid.toFixed(2)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-sm text-gray-600 mb-1">Total Amount</p>
              <p className="text-2xl font-bold text-gray-900">R {summary.total.toFixed(2)}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Invoices List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-xl font-bold text-gray-900">📋 All Invoices</CardTitle>
        </CardHeader>
        <CardContent>
          {/* Filter Buttons */}
          <div className="space-y-2 mb-4">
            <label className="block text-sm font-medium text-gray-700">Filter by Status</label>
            <div className="flex gap-2 flex-wrap">
              {['all', 'issued', 'outstanding', 'paid'].map((status) => (
                <button
                  key={status}
                  onClick={() => setFilter(status as any)}
                  className={`px-3 py-1 rounded text-sm font-medium transition ${
                    filter === status
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Empty State */}
          {filteredInvoices.length === 0 ? (
            <p className="text-gray-500">No invoices yet. Invoices are created when appointments are completed.</p>
          ) : (
            <div className="space-y-3">
              {filteredInvoices.map((invoice) => (
                <Card key={invoice.id} className="border-l-4" style={{ borderLeftColor: '#3F544D' }}>
                  <CardContent className="pt-4">
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span>{getStatusIcon(invoice.status)}</span>
                          <h3 className="font-semibold text-gray-900">{invoice.invoiceNumber}</h3>
                          <span
                            className={`px-2 py-0.5 rounded text-xs font-semibold border ${getStatusColor(
                              invoice.status
                            )}`}
                          >
                            {invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600">
                          Issued: {new Date(invoice.issuedAt).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xl font-bold text-gray-900">
                          R {invoice.totalAmount.toFixed(2)}
                        </p>
                      </div>
                    </div>

                    {/* Line Items */}
                    <div className="mb-3 bg-gray-50 p-2 rounded text-sm">
                      {invoice.lineItems.map((item, idx) => (
                        <div key={idx} className="flex justify-between text-gray-700">
                          <span>
                            {item.description} x{item.quantity}
                          </span>
                          <span>R {(item.amount * item.quantity).toFixed(2)}</span>
                        </div>
                      ))}
                    </div>

                    {invoice.notes && (
                      <p className="text-xs text-gray-600 mb-3 italic">Notes: {invoice.notes}</p>
                    )}

                    {/* Dates */}
                    <div className="mb-3 text-xs text-gray-600 space-y-1">
                      <p>
                        <strong>Issued:</strong> {new Date(invoice.issuedAt).toLocaleDateString()}
                        {invoice.dueDate && ` • Due: ${new Date(invoice.dueDate).toLocaleDateString()}`}
                      </p>
                      {invoice.paidAt && (
                        <p>
                          <strong>✅ Paid:</strong> {new Date(invoice.paidAt).toLocaleDateString()}
                        </p>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 flex-wrap">
                      {invoice.status !== 'paid' && (
                        <button
                          onClick={() => handleMarkAsPaid(invoice.id)}
                          disabled={updatingId === invoice.id}
                          className="px-3 py-1 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200 transition disabled:opacity-50"
                        >
                          ✅ Mark Paid
                        </button>
                      )}

                      {invoice.status === 'issued' && (
                        <button
                          onClick={() => handleMarkAsOutstanding(invoice.id)}
                          disabled={updatingId === invoice.id}
                          className="px-3 py-1 text-xs bg-yellow-100 text-yellow-700 rounded hover:bg-yellow-200 transition disabled:opacity-50"
                        >
                          ⏳ Outstanding
                        </button>
                      )}

                      <button
                        onClick={() => handleResendInvoice(invoice.id)}
                        disabled={updatingId === invoice.id}
                        className="px-3 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition disabled:opacity-50"
                      >
                        📤 Resend
                      </button>

                      <button
                        onClick={() => handleDownloadPDF(invoice)}
                        disabled={updatingId === invoice.id}
                        className="px-3 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition disabled:opacity-50"
                      >
                        🖨️ Download PDF
                      </button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Info Box */}
      <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-sm text-blue-900">
          <strong>💡 How it works:</strong> Invoices are created when you complete an appointment. You can then track 
          payment status (Issued, Outstanding, Paid) and resend invoices to patients. Anixi does not process payments — 
          funds go directly to you via Phase 2 payment integrations.
        </p>
      </div>
    </div>
  );
};

export default InvoicesPage;
