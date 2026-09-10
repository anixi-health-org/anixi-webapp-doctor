import React, { useState } from 'react';
import { SoftBlock, SoftBlockCategory } from '../../types';
import {
  createSoftBlock,
  deleteSoftBlock,
} from '../../services/practiceSettingsService';
import { useAuth } from '../../hooks/AuthContext';

const CATEGORIES: { value: SoftBlockCategory; label: string; icon: string }[] = [
  { value: 'surgery', label: 'Surgery', icon: '🏥' },
  { value: 'hospital_rounds', label: 'Hospital Rounds', icon: '🩺' },
  { value: 'admin', label: 'Admin / Buffer', icon: '📋' },
  { value: 'on_call', label: 'On-Call', icon: '📟' },
  { value: 'other', label: 'Other', icon: '🔒' },
];

const fmt = (d: Date) =>
  d.toLocaleString('en-ZA', { dateStyle: 'medium', timeStyle: 'short' });

interface Props {
  practiceId: string;
  softBlocks: SoftBlock[];
  onChanged: () => void;
  /** When set, manage blocks for this doctor (clinic admin). Defaults to signed-in user. */
  doctorId?: string;
  readOnly?: boolean;
}

interface SoftForm {
  title: string;
  category: SoftBlockCategory;
  startAt: string;
  endAt: string;
  recurring: boolean;
  recurrenceFrequency: 'daily' | 'weekly';
  recurrenceEndDate: string;
}

const defaultForm = (): SoftForm => {
  const now = new Date();
  const pad = (n: number) => n.toString().padStart(2, '0');
  const local = (d: Date) =>
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const later = new Date(now.getTime() + 60 * 60_000);
  return {
    title: '',
    category: 'admin',
    startAt: local(now),
    endAt: local(later),
    recurring: false,
    recurrenceFrequency: 'weekly',
    recurrenceEndDate: '',
  };
};

export const SoftBlocksEditor: React.FC<Props> = ({
  practiceId,
  softBlocks,
  onChanged,
  doctorId: doctorIdProp,
  readOnly = false,
}) => {
  const { user } = useAuth();
  const doctorId = doctorIdProp || user?.id || '';
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<SoftForm>(defaultForm());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSave = async () => {
    if (!form.title.trim()) { setError('Title is required'); return; }
    const startAt = new Date(form.startAt);
    const endAt = new Date(form.endAt);
    if (endAt <= startAt) { setError('End time must be after start time'); return; }
    if (form.recurring && form.recurrenceEndDate) {
      const recurrenceEnd = new Date(form.recurrenceEndDate);
      if (recurrenceEnd < startAt) {
        setError('Recurrence end date must be on or after the start date');
        return;
      }
    }

    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await createSoftBlock(practiceId, {
        practiceId,
        doctorId,
        title: form.title.trim(),
        category: form.category,
        startAt,
        endAt,
        recurrence: form.recurring
          ? {
              frequency: form.recurrenceFrequency,
              interval: 1,
              endDate: form.recurrenceEndDate ? new Date(form.recurrenceEndDate) : undefined,
            }
          : undefined,
        createdBy: user!.id,
        updatedBy: user!.id,
      });
      setShowForm(false);
      setForm(defaultForm());
      setSuccess('Soft block saved successfully.');
      onChanged();
    } catch (e: any) {
      setError(e?.message ?? 'Failed to save soft block');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this soft block?')) return;
    await deleteSoftBlock(practiceId, id);
    onChanged();
  };

  return (
    <div className="space-y-4">
      {success && (
        <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
          {success}
        </p>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">
            {readOnly ? 'Blocked time' : 'Soft Blocks'}
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">
            {readOnly
              ? 'Time blocked by your clinic administrator'
              : 'Non-bookable time - never visible to patients'}
          </p>
        </div>
        {!readOnly && (
          <button
            onClick={() => setShowForm((s) => !s)}
            className="px-4 py-2.5 text-sm bg-[#516059] text-white rounded-lg hover:bg-[#45524D] transition-colors w-full sm:w-auto"
          >
            {showForm ? 'Cancel' : '+ Add Soft Block'}
          </button>
        )}
      </div>

      {!readOnly && showForm && (
        <div className="border border-[#C6CFCA] rounded-lg p-4 bg-[#EEF2F0] space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-700 mb-1">Title</label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="e.g. Morning surgery"
                className="w-full text-sm border border-gray-300 rounded px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-[#516059]"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-700 mb-1">Category</label>
              <div className="flex flex-wrap gap-2">
                {CATEGORIES.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => setForm({ ...form, category: c.value })}
                    className={`px-2.5 py-1.5 text-xs rounded-full border transition-colors ${
                      form.category === c.value
                        ? 'bg-[#B7A06A] text-white border-[#B7A06A]'
                        : 'bg-white text-gray-700 border-gray-300 hover:border-[#B7A06A]'
                    }`}
                  >
                    {c.icon} {c.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Start</label>
              <input
                type="datetime-local"
                value={form.startAt}
                onChange={(e) => setForm({ ...form, startAt: e.target.value })}
                className="w-full text-sm border border-gray-300 rounded px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-[#516059]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">End</label>
              <input
                type="datetime-local"
                value={form.endAt}
                onChange={(e) => setForm({ ...form, endAt: e.target.value })}
                className="w-full text-sm border border-gray-300 rounded px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-[#516059]"
              />
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
            <input
              type="checkbox"
              checked={form.recurring}
              onChange={(e) => setForm({ ...form, recurring: e.target.checked })}
              className="rounded"
            />
            Recurring
          </label>

          {form.recurring && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Frequency</label>
                <select
                  value={form.recurrenceFrequency}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      recurrenceFrequency: e.target.value as 'daily' | 'weekly',
                    })
                  }
                  className="w-full text-sm border border-gray-300 rounded px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-[#516059]"
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Recurrence End Date
                </label>
                <input
                  type="date"
                  value={form.recurrenceEndDate}
                  onChange={(e) => setForm({ ...form, recurrenceEndDate: e.target.value })}
                  className="w-full text-sm border border-gray-300 rounded px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-[#516059]"
                />
              </div>
            </div>
          )}

          {error && <p className="text-xs text-red-600">{error}</p>}
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2.5 text-sm bg-[#516059] text-white rounded-lg hover:bg-[#45524D] disabled:opacity-50 transition-colors w-full sm:w-auto"
          >
            {saving ? 'Saving…' : 'Save Soft Block'}
          </button>
        </div>
      )}

      {softBlocks.length === 0 ? (
        <p className="text-sm text-gray-500 italic">No soft blocks configured.</p>
      ) : (
        <div className="space-y-2">
          {softBlocks
            .sort((a, b) => a.startAt.getTime() - b.startAt.getTime())
            .map((sb) => {
              const cat = CATEGORIES.find((c) => c.value === sb.category);
              return (
                <div
                  key={sb.id}
                  className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border border-[#DDE4E0] rounded-lg px-4 py-3 bg-white"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {cat?.icon} {sb.title}
                    </p>
                    <p className="text-xs text-gray-500">
                      {fmt(sb.startAt)} → {fmt(sb.endAt)}
                      {sb.recurrence && (
                        <span className="ml-2 inline-block px-1.5 py-0.5 bg-[#EEF2F0] text-[#45524D] rounded text-xs">
                          {sb.recurrence.frequency}
                        </span>
                      )}
                    </p>
                  </div>
                  {!readOnly && (
                    <button
                      onClick={() => handleDelete(sb.id)}
                      className="text-sm text-red-500 hover:text-red-700 transition-colors self-start sm:self-auto px-2 py-1"
                    >
                      Delete
                    </button>
                  )}
                </div>
              );
            })}
        </div>
      )}
    </div>
  );
};
