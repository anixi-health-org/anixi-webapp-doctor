import React, { useState } from 'react';
import { BookableBlock, ConsultType, DayOfWeek } from '../../types';
import {
  createBookableBlock,
  updateBookableBlock,
  deleteBookableBlock,
} from '../../services/practiceSettingsService';
import { useAuth } from '../../hooks/AuthContext';

const PRACTICE_BRAND = {
  primary: '#516059',
  primaryDark: '#45524D',
};

const DAYS: { label: string; value: DayOfWeek }[] = [
  { label: 'Sun', value: 0 },
  { label: 'Mon', value: 1 },
  { label: 'Tue', value: 2 },
  { label: 'Wed', value: 3 },
  { label: 'Thu', value: 4 },
  { label: 'Fri', value: 5 },
  { label: 'Sat', value: 6 },
];

const CONSULT_TYPES: ConsultType[] = [
  'initial',
  'follow-up',
  'urgent',
  'procedure',
  'teleconsult',
  'other',
];

const DAY_LABELS: Record<DayOfWeek, string> = {
  0: 'Sunday', 1: 'Monday', 2: 'Tuesday', 3: 'Wednesday',
  4: 'Thursday', 5: 'Friday', 6: 'Saturday',
};

interface Props {
  practiceId: string;
  blocks: BookableBlock[];
  locations: { id: string; name: string }[];
  onChanged: () => void;
}

interface BlockForm {
  doctorId: string;
  dayOfWeek: DayOfWeek;
  startTime: string;
  endTime: string;
  locationId: string;
  allowedConsultTypes: ConsultType[];
  slotDurationMinutes: number;
  bufferBeforeMinutes: number;
  bufferAfterMinutes: number;
}

const defaultForm = (doctorId: string): BlockForm => ({
  doctorId,
  dayOfWeek: 1,
  startTime: '08:00',
  endTime: '17:00',
  locationId: '',
  allowedConsultTypes: ['initial', 'follow-up'],
  slotDurationMinutes: 30,
  bufferBeforeMinutes: 0,
  bufferAfterMinutes: 5,
});

export const BookableBlocksEditor: React.FC<Props> = ({
  practiceId,
  blocks,
  locations,
  onChanged,
}) => {
  const { user } = useAuth();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<BlockForm>(defaultForm(user?.id ?? ''));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleConsultType = (ct: ConsultType) => {
    setForm((prev) => ({
      ...prev,
      allowedConsultTypes: prev.allowedConsultTypes.includes(ct)
        ? prev.allowedConsultTypes.filter((t) => t !== ct)
        : [...prev.allowedConsultTypes, ct],
    }));
  };

  const handleSave = async () => {
    if (!form.locationId) { setError('Please select a location'); return; }
    if (form.allowedConsultTypes.length === 0) { setError('Select at least one consult type'); return; }
    setSaving(true);
    setError(null);
    try {
      await createBookableBlock(practiceId, { ...form, practiceId, active: true });
      setShowForm(false);
      setForm(defaultForm(user?.id ?? ''));
      onChanged();
    } catch (e: any) {
      setError(e?.message ?? 'Failed to save block');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (blockId: string) => {
    if (!window.confirm('Remove this availability block?')) return;
    await deleteBookableBlock(practiceId, blockId);
    onChanged();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Bookable Blocks</h3>
        <button
          onClick={() => setShowForm((s) => !s)}
          className="px-3 py-1.5 text-sm bg-[#516059] text-white rounded-lg hover:bg-[#45524D] transition-colors"
        >
          {showForm ? 'Cancel' : '+ Add Block'}
        </button>
      </div>

      {showForm && (
        <div className="border border-gray-200 rounded-lg p-4 bg-gray-50 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Day of Week</label>
              <select
                value={form.dayOfWeek}
                onChange={(e) => setForm({ ...form, dayOfWeek: Number(e.target.value) as DayOfWeek })}
                className="w-full text-sm border border-gray-300 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#516059]"
              >
                {DAYS.map((d) => (
                  <option key={d.value} value={d.value}>{d.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Location</label>
              <select
                value={form.locationId}
                onChange={(e) => setForm({ ...form, locationId: e.target.value })}
                className="w-full text-sm border border-gray-300 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#516059]"
              >
                <option value="">Select…</option>
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Start Time</label>
              <input
                type="time"
                value={form.startTime}
                onChange={(e) => setForm({ ...form, startTime: e.target.value })}
                className="w-full text-sm border border-gray-300 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#516059]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">End Time</label>
              <input
                type="time"
                value={form.endTime}
                onChange={(e) => setForm({ ...form, endTime: e.target.value })}
                className="w-full text-sm border border-gray-300 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#516059]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Slot Duration (min)</label>
              <input
                type="number"
                min={5}
                max={180}
                step={5}
                value={form.slotDurationMinutes}
                onChange={(e) => setForm({ ...form, slotDurationMinutes: Number(e.target.value) })}
                className="w-full text-sm border border-gray-300 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#516059]"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Buffer Before</label>
                <input
                  type="number"
                  min={0}
                  step={5}
                  value={form.bufferBeforeMinutes}
                  onChange={(e) => setForm({ ...form, bufferBeforeMinutes: Number(e.target.value) })}
                  className="w-full text-sm border border-gray-300 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#516059]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Buffer After</label>
                <input
                  type="number"
                  min={0}
                  step={5}
                  value={form.bufferAfterMinutes}
                  onChange={(e) => setForm({ ...form, bufferAfterMinutes: Number(e.target.value) })}
                  className="w-full text-sm border border-gray-300 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#516059]"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Allowed Consult Types</label>
            <div className="flex flex-wrap gap-2">
              {CONSULT_TYPES.map((ct) => (
                <button
                  key={ct}
                  type="button"
                  onClick={() => toggleConsultType(ct)}
                  className={`px-2.5 py-1 text-xs rounded-full border transition-colors ${
                    form.allowedConsultTypes.includes(ct)
                      ? 'bg-[#B7A06A] text-white border-[#B7A06A]'
                      : 'bg-white text-gray-700 border-gray-300 hover:border-[#B7A06A]'
                  }`}
                >
                  {ct}
                </button>
              ))}
            </div>
          </div>

          {error && <p className="text-xs text-red-600">{error}</p>}

          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 text-sm bg-[#516059] text-white rounded-lg hover:bg-[#45524D] disabled:opacity-50 transition-colors"
          >
            {saving ? 'Saving…' : 'Save Block'}
          </button>
        </div>
      )}

      {blocks.length === 0 ? (
        <p className="text-sm text-gray-500 italic">No bookable blocks configured yet.</p>
      ) : (
        <div className="space-y-2">
          {blocks.map((b) => {
            const loc = locations.find((l) => l.id === b.locationId);
            return (
              <div
                key={b.id}
                className="flex items-center justify-between border border-gray-200 rounded-lg px-4 py-3 bg-white"
              >
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {DAY_LABELS[b.dayOfWeek]} · {b.startTime} – {b.endTime}
                  </p>
                  <p className="text-xs text-gray-500">
                    {loc?.name ?? b.locationId} · {b.slotDurationMinutes} min slots
                    {b.bufferAfterMinutes > 0 ? ` · +${b.bufferAfterMinutes} min buffer` : ''} ·{' '}
                    {b.allowedConsultTypes.join(', ')}
                  </p>
                </div>
                <button
                  onClick={() => handleDelete(b.id)}
                  className="text-xs text-red-500 hover:text-red-700 transition-colors"
                >
                  Remove
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
