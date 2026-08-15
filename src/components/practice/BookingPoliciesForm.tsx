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
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to save booking rules');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-[17px] font-semibold text-[#0E2340]">Booking Rules</h3>
        <p className="mt-1 text-[13px] text-[#65758b]">
          Control confirmation, cancellation windows, and no-show policy. Availability
          hours are managed separately under Availability.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-[#e1e7ef] bg-[#f8fafc] p-4">
          <label className="mb-1 block text-[13px] font-semibold text-[#344256]">
            Patient cancellation window
          </label>
          <p className="mb-2 text-[12px] text-[#65758b]">
            Patients must cancel at least this many hours before the appointment.
          </p>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={0}
              value={form.patientCancellationWindowHours}
              disabled={readOnly}
              onChange={(e) =>
                setForm({
                  ...form,
                  patientCancellationWindowHours: Number(e.target.value),
                })
              }
              className="h-10 w-28 rounded-lg border border-[#e1e7ef] bg-white px-3 text-sm outline-none focus:border-anixi-green disabled:bg-slate-100"
            />
            <span className="text-[13px] text-[#65758b]">hours</span>
          </div>
        </div>

        <div className="rounded-xl border border-[#e1e7ef] bg-[#f8fafc] p-4">
          <label className="mb-1 block text-[13px] font-semibold text-[#344256]">
            Practice cancellation window
          </label>
          <p className="mb-2 text-[12px] text-[#65758b]">
            Minimum notice before the practice cancels or reschedules.
          </p>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={0}
              value={form.doctorCancellationWindowHours}
              disabled={readOnly}
              onChange={(e) =>
                setForm({
                  ...form,
                  doctorCancellationWindowHours: Number(e.target.value),
                })
              }
              className="h-10 w-28 rounded-lg border border-[#e1e7ef] bg-white px-3 text-sm outline-none focus:border-anixi-green disabled:bg-slate-100"
            />
            <span className="text-[13px] text-[#65758b]">hours</span>
          </div>
        </div>

        <div className="rounded-xl border border-[#e1e7ef] bg-white p-4 md:col-span-2">
          <label className="mb-2 block text-[13px] font-semibold text-[#344256]">
            Confirmation mode
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              {
                value: 'auto' as const,
                label: 'Automatic confirmation',
                desc: 'Bookings are confirmed immediately',
              },
              {
                value: 'doctor_confirms' as const,
                label: 'Doctor confirms',
                desc: 'You review and confirm each request',
              },
            ].map((opt) => (
              <label
                key={opt.value}
                className={`rounded-xl border p-3.5 transition ${
                  form.confirmationMode === opt.value
                    ? 'border-anixi-green bg-[#eef4f1]'
                    : 'border-[#e1e7ef] bg-white hover:border-[#cfd8e3]'
                } ${readOnly ? 'cursor-default' : 'cursor-pointer'}`}
              >
                <input
                  type="radio"
                  className="sr-only"
                  disabled={readOnly}
                  checked={form.confirmationMode === opt.value}
                  onChange={() =>
                    setForm({ ...form, confirmationMode: opt.value })
                  }
                />
                <p className="text-sm font-semibold text-[#0E2340]">{opt.label}</p>
                <p className="mt-0.5 text-[12px] text-[#65758b]">{opt.desc}</p>
              </label>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-[#e1e7ef] bg-white p-4 md:col-span-2">
          <label className="mb-1 block text-[13px] font-semibold text-[#344256]">
            No-show policy
          </label>
          <textarea
            rows={3}
            value={form.noShowPolicyText}
            disabled={readOnly}
            onChange={(e) => setForm({ ...form, noShowPolicyText: e.target.value })}
            className="w-full rounded-lg border border-[#e1e7ef] px-3 py-2.5 text-sm outline-none focus:border-anixi-green disabled:bg-slate-100"
            placeholder="Describe your no-show policy…"
          />
        </div>
      </div>

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-700">
          {error}
        </p>
      )}
      {saved && (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-[13px] text-emerald-800">
          Booking rules saved.
        </p>
      )}

      {!readOnly && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving}
            className="inline-flex h-10 items-center rounded-lg bg-anixi-green px-5 text-sm font-semibold text-white shadow-sm hover:bg-[#365c4f] disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save booking rules'}
          </button>
        </div>
      )}
    </div>
  );
};
