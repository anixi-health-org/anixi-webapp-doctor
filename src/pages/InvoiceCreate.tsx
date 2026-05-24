import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { createInvoice } from '../services/invoiceService';
import { useAuth } from '../hooks/useAuth';
import { getAppointmentById } from '../services/appointmentService';

const InvoiceCreate: React.FC = () => {
  const { appointmentId } = useParams<{ appointmentId?: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('ZAR');
  const [saving, setSaving] = useState(false);
  const [patientName, setPatientName] = useState<string | undefined>(undefined);

  const handleSave = () => {
    const amt = parseFloat(amount) || 0;
    setSaving(true);
    const inv = createInvoice({
      appointmentId: appointmentId || undefined,
      patientName: patientName || undefined,
      status: 'pending',
      lineItems: [{ description: description || 'Item', amount: amt, currency }],
    });
    setSaving(false);
    navigate(`/invoices/${inv.id}`);
  };

  useEffect(() => {
    const load = async () => {
      if (!appointmentId || !user?.id) return;
      try {
        const apt = await getAppointmentById(user.id, appointmentId);
        if (apt) setPatientName(apt.patientName);
      } catch {

      }
    };
    load();
  }, [appointmentId, user?.id]);

  return (
    <div className="bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="relative mb-6">
          <button
            onClick={() => navigate(-1)}
            className="absolute left-0 inline-flex h-11 w-11 items-center justify-center rounded-full border border-border bg-card text-2xl text-foreground"
            aria-label="Back"
          >
            ←
          </button>
          <h1 className="text-3xl font-bold text-[#0E2340] text-center">Invoice</h1>
          <div />
        </div>

        <div className="rounded-[30px] border border-[#D8DEE5] bg-white shadow-sm p-6 space-y-4">
          {patientName && (
            <p className="text-sm text-gray-700 mb-3">Patient: <span className="font-semibold">{patientName}</span></p>
          )}

          <div className="grid gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Generate invoice</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600">Anixi does not process payments. This record is for tracking only.</p>
                <p className="text-sm text-gray-600 mt-2">Patient may not be Anixi-linked. Use PDF export after saving.</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Invoice</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm text-gray-700">Description</label>
                    <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g. Consultation fee" className="w-full rounded-md border px-3 py-2" />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-700">Amount</label>
                    <input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" className="w-full rounded-md border px-3 py-2" />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-700">Currency</label>
                    <select value={currency} onChange={(e) => setCurrency(e.target.value)} className="w-full rounded-md border px-3 py-2">
                      <option value="ZAR">South African rand (ZAR)</option>
                      <option value="USD">US Dollar (USD)</option>
                    </select>
                  </div>
                  <div>
                    <button onClick={handleSave} disabled={saving} className="w-full bg-[#06A66A] hover:bg-[#099760] text-white px-4 py-3 rounded-2xl">
                      {saving ? 'Saving...' : 'Save invoice'}
                    </button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InvoiceCreate;
