import React, { useMemo, useState } from 'react';
import { EyeIcon, EyeSlashIcon, LockClosedIcon } from '@heroicons/react/24/outline';
import { useLocation } from 'react-router-dom';
import { PageHeader, PageShell } from '../components/page-layout';
import { useNavigateWithFallback } from '../hooks/useNavigateWithFallback';
import { useAuth } from '../hooks/useAuth';
import { djangoChangePassword } from '../services/djangoApiService';

const MIN_PASSWORD_LENGTH = 10;

type PasswordFieldProps = {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  show: boolean;
  onToggleShow: () => void;
  placeholder: string;
  autoComplete: string;
};

const PasswordField: React.FC<PasswordFieldProps> = ({
  id,
  label,
  value,
  onChange,
  show,
  onToggleShow,
  placeholder,
  autoComplete,
}) => (
  <div>
    <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-[#344256]">
      {label}
    </label>
    <div className="relative">
      <input
        id={id}
        type={show ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        placeholder={placeholder}
        className="w-full rounded-xl border border-[#e1e7ef] bg-white px-3 py-2.5 pr-11 text-sm text-[#344256] outline-none transition focus:border-[#1a4d4d] focus:ring-2 focus:ring-[#1a4d4d]/15"
      />
      <button
        type="button"
        onClick={onToggleShow}
        className="absolute inset-y-0 right-0 flex items-center px-3 text-[#65758b] hover:text-[#344256]"
        aria-label={show ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
      >
        {show ? <EyeSlashIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
      </button>
    </div>
  </div>
);

const ChangePassword: React.FC = () => {
  const { user } = useAuth();
  const location = useLocation();
  const { navigateBack } = useNavigateWithFallback();

  const cancelPath = useMemo(() => {
    if (location.pathname.startsWith('/clinic')) return '/clinic';
    if (location.pathname.startsWith('/caregiver')) return '/caregiver';
    return user?.role === 'caregiver' ? '/caregiver' : '/dashboard';
  }, [location.pathname, user?.role]);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!currentPassword.trim()) {
      setError('Please enter your current password.');
      return;
    }
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      setError(`New password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('New password and confirmation do not match.');
      return;
    }
    if (currentPassword === newPassword) {
      setError('New password must be different from your current password.');
      return;
    }

    setLoading(true);
    try {
      await djangoChangePassword(currentPassword, newPassword);
      setSuccess('Your password has been updated successfully.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update password.');
    } finally {
      setLoading(false);
    }
  };

  const isClinicAdmin = location.pathname.startsWith('/clinic');

  return (
    <PageShell maxWidth={isClinicAdmin ? 'wide' : 'default'} className="py-6 sm:py-8">
      <PageHeader
        title="Change password"
        description="Enter your current password, then choose a new one. You will stay signed in on this device."
      />

      <div className="max-w-xl">
        <div className="rounded-2xl border border-[#e1e7ef] bg-white p-6 shadow-sm sm:p-8">
          <div className="mb-6 flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#1a4d4d]/10 text-[#1a4d4d]">
              <LockClosedIcon className="h-5 w-5" strokeWidth={1.75} />
            </span>
            <p className="text-sm leading-relaxed text-[#65758b]">
              Use at least {MIN_PASSWORD_LENGTH} characters. Avoid reusing passwords from other sites.
            </p>
          </div>

          {error ? (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              {error}
            </div>
          ) : null}

          {success ? (
            <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
              {success}
            </div>
          ) : null}

          <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
            <PasswordField
              id="current-password"
              label="Current password"
              value={currentPassword}
              onChange={setCurrentPassword}
              show={showCurrent}
              onToggleShow={() => setShowCurrent((s) => !s)}
              placeholder="Enter current password"
              autoComplete="current-password"
            />
            <PasswordField
              id="new-password"
              label="New password"
              value={newPassword}
              onChange={setNewPassword}
              show={showNew}
              onToggleShow={() => setShowNew((s) => !s)}
              placeholder="Enter new password"
              autoComplete="new-password"
            />
            <PasswordField
              id="confirm-password"
              label="Confirm new password"
              value={confirmPassword}
              onChange={setConfirmPassword}
              show={showConfirm}
              onToggleShow={() => setShowConfirm((s) => !s)}
              placeholder="Re-enter new password"
              autoComplete="new-password"
            />

            <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => navigateBack(cancelPath)}
                disabled={loading}
                className="rounded-full border border-[#e1e7ef] bg-white px-5 py-2.5 text-sm font-semibold text-[#344256] transition hover:bg-[#fafcfb] disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="rounded-full bg-[#1a4d4d] px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? 'Updating…' : 'Change password'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </PageShell>
  );
};

export default ChangePassword;
