import React, { useState } from 'react';
import { EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline';
import { useNavigate } from 'react-router-dom';
import { auth } from '../lib/firebase';
import { updatePassword, reauthenticateWithCredential, EmailAuthProvider } from 'firebase/auth';

const ChangePassword: React.FC = () => {
  const navigate = useNavigate();
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

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    const user = auth.currentUser;
    if (!user) {
      setError('User not authenticated.');
      return;
    }

    setLoading(true);
    try {
      try {
        await updatePassword(user, newPassword);
      } catch (err: any) {
        // requires recent login -> reauthenticate
        if (err.code === 'auth/requires-recent-login') {
          const email = user.email;
          if (!email) throw new Error('No email available for re-authentication.');
          if (!currentPassword) throw new Error('Please provide your current password to re-authenticate.');
          const credential = EmailAuthProvider.credential(email, currentPassword);
          await reauthenticateWithCredential(user, credential);
          await updatePassword(user, newPassword);
        } else {
          throw err;
        }
      }

      setSuccess('Password updated successfully.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setSuccess(null), 5000);
    } catch (e: any) {
      setError(e?.message || 'Failed to update password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-anixi-beige px-4 py-6">
      <div className="max-w-md mx-auto">
        <h2 className="text-xl font-bold mb-2">Change Password</h2>
        <p className="text-sm text-gray-600 mb-4">Enter your current password, then the new password.</p>

        <div className="bg-anixi-card rounded-lg border border-gray-200 p-6 shadow-sm">

        {error && <div className="mb-3 text-sm text-red-800 bg-anixi-card border border-red-100 rounded px-3 py-2">{error}</div>}
        {success && <div className="mb-3 text-sm text-green-800 bg-anixi-card border border-green-100 rounded px-3 py-2">{success}</div>}

        <form onSubmit={handleSubmit}>
          <div className="mb-3">
            <label className="block text-sm font-medium text-gray-700 mb-1">Current password</label>
            <div className="relative">
              <input
                type={showCurrent ? 'text' : 'password'}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full text-sm border border-gray-300 rounded px-3 py-2"
                placeholder="Current password"
              />
              <button
                type="button"
                onClick={() => setShowCurrent((s) => !s)}
                className="absolute inset-y-0 right-2 flex items-center px-2 text-gray-500"
                aria-label={showCurrent ? 'Hide current password' : 'Show current password'}
              >
                {showCurrent ? <EyeSlashIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
              </button>
            </div>
          </div>

          <div className="mb-3">
            <label className="block text-sm font-medium text-gray-700 mb-1">New password</label>
            <div className="relative">
              <input
                type={showNew ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full text-sm border border-gray-300 rounded px-3 py-2"
                placeholder="New password"
              />
              <button
                type="button"
                onClick={() => setShowNew((s) => !s)}
                className="absolute inset-y-0 right-2 flex items-center px-2 text-gray-500"
                aria-label={showNew ? 'Hide new password' : 'Show new password'}
              >
                {showNew ? <EyeSlashIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
              </button>
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Confirm password</label>
            <div className="relative">
              <input
                type={showConfirm ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full text-sm border border-gray-300 rounded px-3 py-2"
                placeholder="Confirm password"
              />
              <button
                type="button"
                onClick={() => setShowConfirm((s) => !s)}
                className="absolute inset-y-0 right-2 flex items-center px-2 text-gray-500"
                aria-label={showConfirm ? 'Hide confirm password' : 'Show confirm password'}
              >
                {showConfirm ? <EyeSlashIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="px-4 py-2 bg-gray-100 text-gray-800 rounded-md hover:bg-gray-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-anixi-green text-white rounded-md hover:bg-anixi-green/90 disabled:opacity-60"
            >
              {loading ? 'Updating…' : 'Change Password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
  );
};

export default ChangePassword;
