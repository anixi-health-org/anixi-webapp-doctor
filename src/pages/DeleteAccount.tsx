import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useNavigateWithFallback } from '../hooks/useNavigateWithFallback';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { isDjangoAuthOnly } from '../lib/runtimeConfig';
import { djangoDeleteAccount } from '../services/djangoApiService';
import { logoutDoctor } from '../services/authService';

const DeleteAccount: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();
  const { navigateBack } = useNavigateWithFallback();
  const navigate = useNavigate();
  const homePath = user?.role === 'caregiver' ? '/caregiver' : '/dashboard';

  const handleDelete = async () => {
    const confirmed = window.confirm(
      'Are you sure you want to permanently delete your account? Clinical invoices and appointment records may be retained for legal periods as described in our privacy notice.'
    );
    if (!confirmed) return;
    setLoading(true);
    setError(null);
    try {
      if (isDjangoAuthOnly()) {
        await djangoDeleteAccount();
        await logoutDoctor();
        navigate('/login');
        return;
      }

      setError('Firebase account deletion is no longer available. Log in via the Django portal to delete your account.');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to delete.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-6">
      <div className="bg-anixi-card border border-gray-200 rounded-lg p-6 shadow-sm">
        <h2 className="text-2xl font-bold mb-4">Delete Account</h2>
        <p className="text-gray-600 mb-4">
          Clicking the button below will permanently delete your portal account and profile data.
        </p>
        <div className="mb-6 rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-medium">POPIA &amp; clinical record retention</p>
          <p className="mt-2">
            Invoices, appointment records, and clinical documents linked to patient care may be
            retained for periods required by law, regulation, or legitimate clinical audit - even
            after your account is deleted. See our{' '}
            <Link to="/privacy" className="font-medium text-anixi-green underline">
              privacy notice
            </Link>{' '}
            for details and how to exercise your POPIA rights.
          </p>
        </div>
        {error && <div className="text-red-600 mb-4">{error}</div>}
        <div className="flex gap-3">
          <button
            onClick={handleDelete}
            disabled={loading}
            className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-60"
          >
            {loading ? 'Deleting…' : 'Delete Account'}
          </button>
          <button
            onClick={() => navigateBack(homePath)}
            className="px-4 py-2 bg-gray-100 text-gray-800 rounded-md hover:bg-gray-200"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default DeleteAccount;
