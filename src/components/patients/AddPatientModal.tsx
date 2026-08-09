import React, { useState } from 'react';
import { useAuth } from '../../hooks/AuthContext';
import { addPatientManually } from '../../services/patientManagementService';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onAdded?: (result: { patientId: string; inviteWarning?: string }) => void;
}

export const AddPatientModal: React.FC<Props> = ({ isOpen, onClose, onAdded }) => {
  const { user, practiceSession } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [sending, setSending] = useState(false);
  const [sendInvite, setSendInvite] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleCreate = async () => {
    if (!user?.id) {
      setError('Not authenticated');
      return;
    }
    if (!name.trim()) {
      setError('Please enter a name');
      return;
    }
    if (sendInvite && !email.trim()) {
      setInviteError('Please enter an email address to send the invitation.');
      return;
    }
    setSending(true);
    setError(null);
    setInviteError(null);
    try {
      const { patientId, inviteQueued, inviteError: inviteErr } = await addPatientManually(
        user.id,
        {
          displayName: name.trim(),
          email: email.trim() || undefined,
          phoneNumber: phone.trim() || undefined,
          practiceId: practiceSession?.practice?.id,
        },
        {
          sendInvite: sendInvite,
          inviteEmail: email.trim() || undefined,
        }
      );

      if (sendInvite && inviteQueued === false) {
        onAdded?.({
          patientId,
          inviteWarning: inviteErr || 'Patient was added, but the invitation email could not be sent.',
        });
        onClose();
        setName('');
        setEmail('');
        setPhone('');
        return;
      }

      onAdded?.({ patientId });
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to create patient');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-lg p-6 max-w-md w-full">
        <h2 className="text-lg font-bold mb-4">Add Patient</h2>
        {error && <div className="text-sm text-red-600 mb-2">{error}</div>}
        {inviteError && <div className="text-sm text-orange-600 mb-2">{inviteError}</div>}
        <div className="space-y-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Full name"
            className="w-full px-3 py-2 border rounded"
          />
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email (optional)"
            className="w-full px-3 py-2 border rounded"
          />
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Phone (optional)"
            className="w-full px-3 py-2 border rounded"
          />
          <label className="flex items-center gap-2 mt-2">
            <input type="checkbox" checked={sendInvite} onChange={(e) => setSendInvite(e.target.checked)} />
            <span className="text-sm">Send signup invitation via email</span>
          </label>
        </div>

        <div className="flex gap-2 mt-4">
          <button onClick={onClose} className="flex-1 px-4 py-2 border rounded">Cancel</button>
          <button
            onClick={handleCreate}
            disabled={sending}
            className="flex-1 px-4 py-2 bg-anixi-green text-white rounded hover:bg-anixi-green/90 disabled:opacity-50"
          >
            {sending ? 'Creating…' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
};
