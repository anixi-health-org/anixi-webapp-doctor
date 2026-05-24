import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { listInvoices } from '../services/invoiceService';

const InvoiceList: React.FC = () => {
  const navigate = useNavigate();
  const invoices = listInvoices();

  return (
    <div className="max-w-3xl mx-auto p-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Invoices</h1>
        <button onClick={() => navigate('/invoices/new')} className="px-3 py-2 rounded border">New</button>
      </div>

      {invoices.length === 0 ? (
        <Card>
          <CardContent>
            <p className="text-sm text-gray-600">No invoices saved yet.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {invoices.map((inv) => (
            <Card key={inv.id}>
              <CardHeader>
                <CardTitle>{inv.invoiceNumber}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold">{inv.patientName || 'Unknown patient'}</div>
                    <div className="text-sm text-gray-600">{new Date(inv.createdAt).toLocaleString()}</div>
                    <div className="text-sm text-gray-600 mt-2">Total: {inv.total} {inv.lineItems?.[0]?.currency || 'ZAR'}</div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <button onClick={() => navigate(`/invoices/${inv.id}`)} className="px-3 py-2 border rounded">Open</button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default InvoiceList;
