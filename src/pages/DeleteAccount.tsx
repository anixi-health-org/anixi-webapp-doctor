import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { deleteUser, reauthenticateWithCredential, EmailAuthProvider } from 'firebase/auth';
import { auth, db } from '../lib/firebase';
import { logoutDoctor } from '../services/authService';
import { doc, writeBatch } from 'firebase/firestore';
import { USERS_COLLECTION, DOCTORS_COLLECTION } from '../shared/constants';

const DeleteAccount: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleDelete = async () => {
    const confirmed = window.confirm('Are you sure you want to permanently delete your account? This action is irreversible.');
    if (!confirmed) return;
    setLoading(true);
    setError(null);
    try {
      const user = auth.currentUser;
      if (!user) throw new Error('No authenticated user');

      
      const uid = user.uid;
      const batch = writeBatch(db);

      const userRef = doc(db, USERS_COLLECTION, uid);
      batch.delete(userRef);

      const doctorRef = doc(db, DOCTORS_COLLECTION, uid);
      batch.delete(doctorRef);

      await batch.commit();

      
      try {
        await deleteUser(user);
      } catch (authErr: any) {
        
        if (authErr.code === 'auth/requires-recent-login') {
          const email = user.email;
          const password = window.prompt('To delete your account, please re-enter your password:');
          if (!password) throw new Error('Re-authentication cancelled');
          if (!email) throw new Error('No email available for re-authentication');
          const credential = EmailAuthProvider.credential(email, password);
          await reauthenticateWithCredential(user, credential);
          await deleteUser(user);
        } else {
          throw authErr;
        }
      }

      await logoutDoctor();
      navigate('/login');
    } catch (err: any) {
      setError(err?.message || 'Failed to delete. You may need to re-authenticate.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-6">
      <h2 className="text-2xl font-bold mb-4">Delete Account</h2>
      <p className="text-gray-600 mb-6">
        Clicking the button below will permanently delete your account and all associated data.
      </p>
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
          onClick={() => navigate(-1)}
          className="px-4 py-2 bg-gray-100 text-gray-800 rounded-md hover:bg-gray-200"
        >
          Cancel
        </button>
      </div>
    </div>
  );
};

export default DeleteAccount;
