import React, { useEffect, useState } from 'react';
import { Invoice, InvoiceStatus } from '../../types';
import { getInvoicesByDoctor, updateInvoiceStatus, resendInvoice } from '../../services/invoiceService';
import { Card, CardContent } from '../ui/Card';
import { Toast } from '../ui';

interface InvoiceListProps {
  doctorId: string;
  patientId?: string;
  onSelectInvoice?: (invoice: Invoice) => void;
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

export const InvoiceList: React.FC<InvoiceListProps> = ({ doctorId, patientId, onSelectInvoice }) => {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [filter, setFilter] = useState<InvoiceStatus | 'all'>('all');
  const [toast, setToast] = useState<{ visible: boolean; message: string; type: 'success' | 'error' }>({
    visible: false,
    message: '',
    type: 'success',
  });
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const loadInvoices = async () => {
    if (!doctorId) return;
    setIsLoading(true);
    try {
      const invoiceList = await getInvoicesByDoctor(doctorId, {
        patientId,
        status: filter === 'all' ? undefined : filter,
      });
      setInvoices(invoiceList);
    } catch (error) {
      console.error('Failed to load invoices:', error);
      setToast({
        visible: true,
        message: 'Failed to load invoices',
        type: 'error',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadInvoices();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doctorId, patientId, filter]);

  const handleMarkAsPaid = async (invoiceId: string) => {
    setUpdatingId(invoiceId);
    try {
      await updateInvoiceStatus(invoiceId, 'paid');
      setInvoices((prev) =>
        prev.map((inv) => (inv.id === invoiceId ? { ...inv, status: 'paid' as InvoiceStatus } : inv))
      );
      showToast('Invoice marked as paid', 'success');
    } catch (err) {
      showToast('Failed to update invoice', 'error');
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
      showToast('Invoice marked as outstanding', 'success');
    } catch (err) {
      showToast('Failed to update invoice', 'error');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleResendInvoice = async (invoiceId: string) => {
    setUpdatingId(invoiceId);
    try {
      await resendInvoice(invoiceId);
      showToast('Invoice resent', 'success');
    } catch (err) {
      showToast('Failed to resend invoice', 'error');
    } finally {
      setUpdatingId(null);
    }
  };

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ visible: true, message, type });
    setTimeout(() => setToast({ visible: false, message: '', type: 'success' }), 3000);
  };

  const filteredInvoices = invoices;

  if (isLoading) {
    return <p className="text-gray-500">Loading invoices...</p>;
  }

  if (invoices.length === 0) {
    return <p className="text-gray-500">No invoices yet.</p>;
  }

  return (
    <>
      {toast.visible && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast({ visible: false, message: '', type: 'success' })}
        />
      )}

      <div className="space-y-2 mb-4">
        <label className="block text-sm font-medium text-gray-700">Filter by Status</label>
        <div className="flex gap-2">
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

                {onSelectInvoice && (
                  <button
                    onClick={() => onSelectInvoice(invoice)}
                    className="px-3 py-1 text-xs bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition"
                  >
                    View
                  </button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
};
