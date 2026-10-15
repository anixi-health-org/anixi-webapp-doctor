import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { createInvoiceRecord, invoiceOptionsFromPracticeContext } from '../services/invoiceService';
import { useAuth } from '../hooks/useAuth';
import { useDoctorCurrency } from '../hooks/useDoctorCurrency';
import { useNavigateWithFallback } from '../hooks/useNavigateWithFallback';
import { getAppointmentById } from '../services/appointmentService';
import { LetterheadSetupBanner } from '../components/invoices/LetterheadSetupBanner';
import type { Doctor } from '../types';
import { COMMON_ICD10_CODES, SA_VAT_RATE, computeVatBreakdown } from '../lib/southAfrica';

const InvoiceCreate: React.FC = () => {
  const { appointmentId } = useParams<{ appointmentId?: string }>();
  const { user, practiceSession } = useAuth();
  const doctor = user?.role === 'doctor' ? (user as Doctor) : null;
  const practice = practiceSession?.practice;
  const { currency: doctorCurrency } = useDoctorCurrency();
  const { navigateBack } = useNavigateWithFallback();
  const navigate = useNavigate();
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState(doctorCurrency || 'ZAR');
  const [icd10Code, setIcd10Code] = useState('');
  const [bankDetailsNote, setBankDetailsNote] = useState(
    'Pay by EFT using the payment reference on the PDF. Anixi does not collect card payments.'
  );
  const [saving, setSaving] = useState(false);
  const [patientId, setPatientId] = useState<string>('');
  const [practiceId, setPracticeId] = useState<string>('');
  const [patientName, setPatientName] = useState<string | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (doctorCurrency) setCurrency(doctorCurrency);
  }, [doctorCurrency]);

  const amountNum = parseFloat(amount);
  const vatPreview = useMemo(() => {
    if (Number.isNaN(amountNum) || amountNum <= 0) return null;
    return computeVatBreakdown(amountNum, SA_VAT_RATE);
  }, [amountNum]);

  const selectedIcd = COMMON_ICD10_CODES.find((c) => c.code === icd10Code);

  const handleSave = async () => {
    const amt = parseFloat(amount);
    setError(null);

    if (!user?.id) {
      setError('User not authenticated');
      return;
    }

    if (!appointmentId) {
      setError('Appointment is required to create an invoice.');
      return;
    }

    if (!patientId) {
      setError('Could not determine the patient for this appointment.');
      return;
    }

    if (!description.trim()) {
      setError('Please enter an invoice description.');
      return;
    }

    if (Number.isNaN(amt) || amt <= 0) {
      setError('Please enter a valid invoice amount (ex VAT).');
      return;
    }

    setSaving(true);

    try {
      const opts = {
        ...invoiceOptionsFromPracticeContext(
          doctor,
          practice,
          appointmentId,
          practiceId || practice?.id,
        ),
        bankDetailsNote: bankDetailsNote.trim() || undefined,
        diagnosisCodes: icd10Code ? [icd10Code] : undefined,
      };

      const inv = await createInvoiceRecord(
        user.id,
        patientId,
        appointmentId,
        [
          {
            description: description.trim(),
            amount: amt,
            quantity: 1,
            ...(icd10Code
              ? {
                  icd10Code,
                  icd10Description: selectedIcd?.description,
                }
              : {}),
          },
        ],
        '',
        currency,
        opts
      );
      navigate(`/invoices/${inv.id}`);
    } catch (err) {
      console.error(err);
      setError('Failed to save invoice: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    const load = async () => {
      if (!appointmentId || !user?.id) return;
      try {
        const apt = await getAppointmentById(user.id, appointmentId);
        if (apt) {
          setPatientId(apt.patientId || '');
          setPatientName(apt.patientName);
          setPracticeId(apt.practiceId || practice?.id || '');
        }
      } catch {
        // Appointment load failure is handled by empty patient fields on save
      }
    };
    void load();
  }, [appointmentId, user?.id, practice?.id]);

  return (
    <div className="min-h-screen bg-[#f5f7fa]">
      <div className="mx-auto max-w-2xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-6 flex items-center gap-4">
          <button
            type="button"
            onClick={() => navigateBack('/invoices')}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#e1e7ef] bg-white text-[#65758b] shadow-sm transition hover:border-[#c5cdd8] hover:text-[#0E2340]"
            aria-label="Back"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path
                d="M10 3L5 8l5 5"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="text-[22px] font-bold tracking-tight text-[#0E2340]">Generate invoice</h1>
            {patientName ? (
              <p className="mt-0.5 truncate text-[13px] text-[#65758b]">
                Patient: <span className="font-semibold text-[#344256]">{patientName}</span>
              </p>
            ) : (
              <p className="mt-0.5 text-[13px] text-[#65758b]">
                Amounts are ex VAT · 15% VAT applied on save · EFT reference on PDF
              </p>
            )}
          </div>
        </div>

        <LetterheadSetupBanner doctor={doctor} practice={practice} compact className="mb-5" />

        <div className="rounded-xl border border-[#e1e7ef] bg-white shadow-sm">
          <div className="border-b border-[#e1e7ef] px-5 py-4">
            <p className="text-sm font-semibold text-[#0E2340]">Invoice details</p>
            <p className="mt-1 text-[13px] leading-relaxed text-[#65758b]">
              Enter amounts exclusive of VAT. HPCSA, BHF, and VAT numbers from your profile are
              printed on the PDF. Payment is tracked as EFT - Anixi does not process card payments.
            </p>
          </div>

          <div className="space-y-4 px-5 py-5">
            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Description *</label>
              <input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g. Consultation fee"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Amount (ex VAT) *
                </label>
                <input
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  inputMode="decimal"
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Currency</label>
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="ZAR">South African rand (ZAR)</option>
                  <option value="USD">US Dollar (USD)</option>
                  <option value="EUR">Euro (EUR)</option>
                  <option value="GBP">British pound (GBP)</option>
                </select>
              </div>
            </div>

            {vatPreview && (
              <div className="rounded-lg border border-[#e1e7ef] bg-[#f8fafc] px-3 py-2 text-sm text-[#344256]">
                <div className="flex justify-between">
                  <span>Subtotal (ex VAT)</span>
                  <span>R {vatPreview.subtotal.toFixed(2)}</span>
                </div>
                <div className="mt-1 flex justify-between">
                  <span>VAT (15%)</span>
                  <span>R {vatPreview.vatAmount.toFixed(2)}</span>
                </div>
                <div className="mt-1 flex justify-between font-semibold">
                  <span>Total (incl VAT)</span>
                  <span>R {vatPreview.total.toFixed(2)}</span>
                </div>
              </div>
            )}

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                ICD-10 diagnosis (optional)
              </label>
              <select
                value={icd10Code}
                onChange={(e) => setIcd10Code(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">None</option>
                {COMMON_ICD10_CODES.map((entry) => (
                  <option key={entry.code} value={entry.code}>
                    {entry.code} - {entry.description}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                EFT / bank payment note
              </label>
              <textarea
                value={bankDetailsNote}
                onChange={(e) => setBankDetailsNote(e.target.value)}
                rows={2}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="mt-1 text-xs text-[#65758b]">
                Payment reference will be{' '}
                {appointmentId
                  ? `ANIXI-${appointmentId.slice(0, 8).toUpperCase()}`
                  : 'generated from the appointment'}
                . Profile VAT: {doctor?.vatNumber || 'not set'} · BHF:{' '}
                {doctor?.practiceNumberBhf || 'not set'}
              </p>
            </div>
          </div>

          <div className="flex gap-3 border-t border-[#e1e7ef] px-5 py-4">
            <button
              type="button"
              onClick={() => navigateBack('/invoices')}
              className="flex-1 rounded-lg border border-[#e1e7ef] bg-white px-4 py-2.5 text-sm font-medium text-[#344256] transition hover:bg-[#f3f6fa]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={saving}
              className="flex-1 rounded-lg bg-anixi-green px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#365c4f] disabled:opacity-60"
            >
              {saving ? 'Saving…' : 'Save invoice'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InvoiceCreate;
