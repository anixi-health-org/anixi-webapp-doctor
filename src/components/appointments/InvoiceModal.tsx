import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { Toast } from '../ui';
import { InvoiceLineItem } from '../../types';

interface InvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (lineItems: InvoiceLineItem[], notes?: string) => Promise<void>;
  appointmentType?: string;
}

export const InvoiceModal: React.FC<InvoiceModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  appointmentType = 'Consultation',
}) => {
  const [lineItems, setLineItems] = useState<InvoiceLineItem[]>([
    { description: appointmentType, quantity: 1, amount: 0 },
  ]);
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ visible: boolean; message: string; type: 'success' | 'error' }>({
    visible: false,
    message: '',
    type: 'success',
  });

  if (!isOpen) return null;

  const totalAmount = lineItems.reduce((sum, item) => sum + item.amount * item.quantity, 0);

  const handleAddLineItem = () => {
    setLineItems([
      ...lineItems,
      { description: '', quantity: 1, amount: 0 },
    ]);
  };

  const handleRemoveLineItem = (index: number) => {
    if (lineItems.length === 1) {
      setError('Must have at least one line item');
      return;
    }
    setLineItems(lineItems.filter((_, i) => i !== index));
    setError(null);
  };

  const handleLineItemChange = (
    index: number,
    field: keyof InvoiceLineItem,
    value: string | number
  ) => {
    const updated = [...lineItems];
    if (field === 'amount' || field === 'quantity') {
      updated[index][field] = Number(value);
    } else {
      updated[index][field] = value as string;
    }
    setLineItems(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (lineItems.length === 0) {
      setError('Add at least one line item');
      return;
    }

    for (const item of lineItems) {
      if (!item.description.trim()) {
        setError('All line items must have a description');
        return;
      }
      if (item.quantity <= 0 || item.amount <= 0) {
        setError('Quantity and amount must be greater than 0');
        return;
      }
    }

    if (totalAmount <= 0) {
      setError('Total invoice amount must be greater than 0');
      return;
    }

    setIsSubmitting(true);

    try {
      await onSubmit(lineItems, notes.trim() || undefined);
      setToast({ visible: true, message: 'Invoice created successfully', type: 'success' });
      resetForm();
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to create invoice';
      setError(msg);
      setToast({ visible: true, message: msg, type: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setLineItems([{ description: appointmentType, quantity: 1, amount: 0 }]);
    setNotes('');
    setError(null);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      {toast.visible && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast({ visible: false, message: '', type: 'success' })}
        />
      )}
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <Card className="border-0 shadow-none">
          <CardHeader>
            <CardTitle className="text-xl font-bold text-gray-900">Create Invoice</CardTitle>
            <button
              onClick={handleClose}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Line Items */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">
                  Line Items *
                </label>
                <div className="space-y-3 mb-4">
                  {lineItems.map((item, index) => (
                    <div key={index} className="p-3 border border-gray-300 rounded-lg bg-gray-50">
                      <div className="grid grid-cols-12 gap-3 items-end">
                        {/* Description */}
                        <div className="col-span-5">
                          <label className="block text-xs font-medium text-gray-600 mb-1">
                            Description
                          </label>
                          <input
                            type="text"
                            value={item.description}
                            onChange={(e) =>
                              handleLineItemChange(index, 'description', e.target.value)
                            }
                            placeholder="e.g., Consultation, Procedure"
                            className="w-full px-2 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                            required
                          />
                        </div>

                        {/* Quantity */}
                        <div className="col-span-2">
                          <label className="block text-xs font-medium text-gray-600 mb-1">
                            Qty
                          </label>
                          <input
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={(e) =>
                              handleLineItemChange(index, 'quantity', e.target.value)
                            }
                            className="w-full px-2 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                            required
                          />
                        </div>

                        {/* Amount */}
                        <div className="col-span-3">
                          <label className="block text-xs font-medium text-gray-600 mb-1">
                            Amount (ZAR)
                          </label>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.amount}
                            onChange={(e) =>
                              handleLineItemChange(index, 'amount', e.target.value)
                            }
                            placeholder="0.00"
                            className="w-full px-2 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                            required
                          />
                        </div>

                        {/* Subtotal */}
                        <div className="col-span-2">
                          <label className="block text-xs font-medium text-gray-600 mb-1">
                            Subtotal
                          </label>
                          <div className="px-2 py-2 text-sm bg-white border border-gray-300 rounded text-gray-700 font-medium">
                            R {(item.quantity * item.amount).toFixed(2)}
                          </div>
                        </div>

                        {/* Remove Button */}
                        {lineItems.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveLineItem(index)}
                            className="text-red-600 hover:text-red-800 font-bold"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={handleAddLineItem}
                  className="text-sm px-3 py-2 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition"
                >
                  + Add Line Item
                </button>
              </div>

              {/* Total */}
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-gray-700">Total Invoice Amount:</span>
                  <span className="text-2xl font-bold text-blue-600">R {totalAmount.toFixed(2)}</span>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notes (optional)
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Add any notes or payment terms..."
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={3}
                />
              </div>

              {error && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-2">
                  {error}
                </p>
              )}

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={handleClose}
                  className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition disabled:opacity-50"
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition disabled:opacity-50"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Creating...' : 'Create Invoice'}
                </button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
