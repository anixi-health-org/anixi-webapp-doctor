import React, { useState } from 'react';
import { useAuth } from '../../hooks/AuthContext';
import { addPatientManually } from '../../services/patientManagementService';

export type ClinicAddPatientResult = {
  patientId: string;
  displayName: string;
  activationCode?: string;
  inviteQueued?: boolean;
  inviteWarning?: string;
};

type Props = {
  open: boolean;
  onCancel: () => void;
  onAdded: (result: ClinicAddPatientResult) => void;
};

export const ClinicAddPatientPanel: React.FC<Props> = ({ open, onCancel, onAdded }) => {
  const { user, practiceSession } = useAuth();
  const practice = practiceSession?.practice;
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [sendInvite, setSendInvite] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const resetForm = () => {
    setName('');
    setEmail('');
    setPhone('');
    setDateOfBirth('');
    setSendInvite(true);
    setError(null);
  };

  const handleCancel = () => {
    resetForm();
    onCancel();
  };

  const handleCreate = async () => {
    if (!user?.id) {
      setError('Not authenticated.');
      return;
    }
    const displayName = name.trim();
    if (!displayName) {
      setError('Enter the patient name.');
      return;
    }
    if (!email.trim() && !phone.trim() && !dateOfBirth) {
      setError('Add an email, phone, or date of birth so we can match this person later.');
      return;
    }
    if (sendInvite && !email.trim()) {
      setError('Enter an email address to send activation instructions, or turn off the email.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const result = await addPatientManually(
        user.id,
        {
          displayName,
          email: email.trim() || undefined,
          phoneNumber: phone.trim() || undefined,
          dateOfBirth: dateOfBirth || undefined,
          practiceId: practice?.id,
          clinicName: practice?.name,
          clinicCode: practice?.clinicCode,
          invitedByName: user.displayName || practice?.name || 'Your clinic',
        },
        {
          sendInvite,
          inviteEmail: email.trim() || undefined,
        },
      );

      onAdded({
        patientId: result.patientId,
        displayName,
        activationCode: result.activationCode,
        inviteQueued: result.inviteQueued,
        inviteWarning: result.inviteError,
      });
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add this patient.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-2xl border border-anixi-green/20 bg-white p-5 shadow-sm">
      <h4 className="font-semibold text-gray-900">New patient</h4>
      <p className="mt-1 text-sm text-[#65758b]">
        Adds them to the clinic roster. They activate in the Anixi app
        {practice?.clinicCode ? (
          <>
            {' '}
            with clinic code <span className="font-mono font-semibold text-[#344256]">{practice.clinicCode}</span>
          </>
        ) : (
          '.'
        )}
        {practice?.clinicCode ? '.' : null}
      </p>
      {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="mb-1 block text-sm font-medium text-gray-700">Full name</label>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm"
            placeholder="Patient full name"
            autoComplete="name"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Email</label>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm"
            placeholder="patient@email.com"
            autoComplete="email"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Phone (optional)</label>
          <input
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm"
            placeholder="Mobile number"
            autoComplete="tel"
          />
        </div>
        <div className="sm:col-span-2">
          <label className="mb-1 block text-sm font-medium text-gray-700">Date of birth (optional)</label>
          <input
            type="date"
            value={dateOfBirth}
            onChange={(event) => setDateOfBirth(event.target.value)}
            className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm"
          />
        </div>
      </div>
      <label className="mt-4 flex items-start gap-2 text-sm text-[#344256]">
        <input
          type="checkbox"
          checked={sendInvite}
          onChange={(event) => setSendInvite(event.target.checked)}
          className="mt-0.5"
        />
        <span>
          Email activation instructions with the clinic code
          {practice?.clinicCode ? ` ${practice.clinicCode}` : ''}.
        </span>
      </label>
      <div className="mt-4 flex gap-3">
        <button
          type="button"
          disabled={saving}
          onClick={() => void handleCreate()}
          className="rounded-full bg-anixi-green px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
        >
          {saving ? 'Adding…' : 'Add patient'}
        </button>
        <button
          type="button"
          onClick={handleCancel}
          className="rounded-full border border-gray-200 px-5 py-2.5 text-sm font-semibold text-gray-700"
        >
          Cancel
        </button>
      </div>
    </div>
  );
};
