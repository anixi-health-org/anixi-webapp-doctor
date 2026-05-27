import React, { useEffect, useState } from 'react';
import { Patient } from '../../types';

interface Props {
  isOpen: boolean;
  patient: Patient;
  onClose: () => void;
  onSave: (updates: Partial<Patient>) => Promise<void>;
}

export const EditPatientModal: React.FC<Props> = ({ isOpen, patient, onClose, onSave }) => {
  const [displayName, setDisplayName] = useState(patient.displayName || '');
  const [email, setEmail] = useState(patient.email || '');
  const [phoneNumber, setPhoneNumber] = useState(patient.phoneNumber || '');
  const [address, setAddress] = useState(patient.address || '');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setDisplayName(patient.displayName || '');
    setEmail(patient.email || '');
    setPhoneNumber(patient.phoneNumber || '');
    setAddress(patient.address || '');
    setDateOfBirth(patient.dateOfBirth ? new Date(patient.dateOfBirth).toISOString().substring(0, 10) : '');
    setError(null);
  }, [isOpen, patient]);

  if (!isOpen) return null;

  const handleSave = async () => {
    if (!displayName.trim()) {
      setError('Name is required');
      return;
    }
    setSaving(true);
    setError(null);

    try {
      const updates: Partial<Patient> = {
        displayName: displayName.trim(),
        email: email.trim() || undefined,
        phoneNumber: phoneNumber.trim() || undefined,
        address: address.trim() || undefined,
      };

      if (dateOfBirth) {
        updates.dateOfBirth = new Date(dateOfBirth);
      } else {
        updates.dateOfBirth = undefined;
      }

      await onSave(updates);
      onClose();
    } catch (e: any) {
      setError(e?.message || 'Failed to save updates');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-lg p-6 max-w-lg w-full">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">Edit Patient</h2>
          <button onClick={onClose} className="text-gray-600 hover:text-gray-900">✕</button>
        </div>
        {error && <div className="text-sm text-red-600 mb-3">{error}</div>}
        <div className="grid gap-3">
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Full name"
            className="w-full px-3 py-2 border rounded"
          />
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            className="w-full px-3 py-2 border rounded"
          />
          <input
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
            placeholder="Phone number"
            className="w-full px-3 py-2 border rounded"
          />
          <input
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Address"
            className="w-full px-3 py-2 border rounded"
          />
          <label className="block text-sm font-medium text-gray-700">Date of Birth</label>
          <input
            type="date"
            value={dateOfBirth}
            onChange={(e) => setDateOfBirth(e.target.value)}
            className="w-full px-3 py-2 border rounded"
          />
        </div>
        <div className="flex gap-2 mt-5">
          <button onClick={onClose} className="flex-1 px-4 py-2 border rounded">Cancel</button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 px-4 py-2 bg-anixi-green text-white rounded hover:bg-anixi-green/90 disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
};
