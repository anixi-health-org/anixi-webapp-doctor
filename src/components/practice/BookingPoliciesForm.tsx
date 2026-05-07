import React, { useState } from 'react';
import { BookingPolicy } from '../../types';
import { updateBookingPolicy } from '../../services/practiceSettingsService';

interface Props {
  practiceId: string;
  policy: BookingPolicy;
  onSaved: () => void;
  readOnly?: boolean;
}

export const BookingPoliciesForm: React.FC<Props> = ({
  practiceId,
  policy,
  onSaved,
  readOnly = false,
}) => {
  const [form, setForm] = useState({
    patientCancellationWindowHours: policy.patientCancellationWindowHours,
    doctorCancellationWindowHours: policy.doctorCancellationWindowHours,
    noShowPolicyText: policy.noShowPolicyText,
    confirmationMode: policy.confirmationMode,
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      await updateBookingPolicy(practiceId, form);
      setSaved(true);
      onSaved();
      setTimeout(() => setSaved(false), 3000);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to save policy');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-gray-900">Booking Policies</h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Patient Cancellation Window (hours)
          </label>
          <input
            type="number"
            min={0}
            value={form.patientCancellationWindowHours}
            disabled={readOnly}
            onChange={(e) =>
              setForm({ ...form, patientCancellationWindowHours: Number(e.target.value) })
            }
            className="w-full text-sm border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#516059] disabled:bg-gray-100"
          />
          <p className="text-xs text-gray-500 mt-1">
            Patients must cancel at least this many hours before the appointment.
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Doctor / Practice Cancellation Window (hours)
          </label>
          <input
            type="number"
            min={0}
            value={form.doctorCancellationWindowHours}
            disabled={readOnly}
            onChange={(e) =>
              setForm({ ...form, doctorCancellationWindowHours: Number(e.target.value) })
            }
            className="w-full text-sm border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#516059] disabled:bg-gray-100"
          />
        </div>

        <div className="col-span-full">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            No-Show Policy Text
          </label>
          <textarea
            rows={3}
            value={form.noShowPolicyText}
            disabled={readOnly}
            onChange={(e) => setForm({ ...form, noShowPolicyText: e.target.value })}
            className="w-full text-sm border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#516059] disabled:bg-gray-100"
            placeholder="Describe your no-show policy…"
          />
        </div>

        <div className="col-span-full">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Confirmation Mode
          </label>
          <div className="flex gap-4">
            {[
              { value: 'auto', label: 'Auto-confirm', desc: 'Appointments confirmed immediately' },
              {
                value: 'doctor_confirms',
                label: 'Doctor Confirms',
                desc: 'Doctor / practice must confirm each request',
              },
            ].map((opt) => (
              <label
                key={opt.value}
                className={`flex-1 border rounded-lg p-3 cursor-pointer transition-colors ${
                  form.confirmationMode === opt.value
                    ? 'border-[#516059] bg-[#EEF2F0]'
                    : 'border-gray-200 bg-white hover:border-gray-300'
                } ${readOnly ? 'cursor-default' : ''}`}
              >
                <input
                  type="radio"
                  name="confirmationMode"
                  value={opt.value}
                  checked={form.confirmationMode === opt.value}
                  disabled={readOnly}
                  onChange={() =>
                    setForm({
                      ...form,
                      confirmationMode: opt.value as 'auto' | 'doctor_confirms',
                    })
                  }
                  className="sr-only"
                />
                <p className="text-sm font-medium text-gray-900">{opt.label}</p>
                <p className="text-xs text-gray-500 mt-0.5">{opt.desc}</p>
              </label>
            ))}
          </div>
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {saved && <p className="text-sm text-[#45524D]">Policy saved.</p>}

      {!readOnly && (
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-5 py-2 bg-[#516059] text-white text-sm rounded-lg hover:bg-[#45524D] disabled:opacity-50 transition-colors"
        >
          {saving ? 'Saving…' : 'Save Policies'}
        </button>
      )}
    </div>
  );
};
