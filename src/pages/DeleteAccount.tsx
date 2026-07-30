import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useNavigateWithFallback } from '../hooks/useNavigateWithFallback';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { deleteUser, reauthenticateWithCredential, EmailAuthProvider } from 'firebase/auth';
import { auth, db } from '../lib/firebase';
import { logoutDoctor } from '../services/authService';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  serverTimestamp,
  where,
  writeBatch,
} from 'firebase/firestore';
import {
  USERS_COLLECTION,
  DOCTORS_COLLECTION,
} from '../shared/constants';

const INVOICES_COLLECTION = 'invoices';

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
      const currentUser = auth.currentUser;
      if (!currentUser) throw new Error('No authenticated user');

      const uid = currentUser.uid;

      await addDoc(
        collection(db, USERS_COLLECTION, uid, 'deletion_requests'),
        {
          requestedAt: serverTimestamp(),
          status: 'completed',
          scope: 'account',
        }
      );

      try {
        const invoiceQuery = query(
          collection(db, INVOICES_COLLECTION),
          where('doctorId', '==', uid)
        );
        const invoiceSnap = await getDocs(invoiceQuery);
        if (!invoiceSnap.empty) {
          const invoiceBatch = writeBatch(db);
          invoiceSnap.docs.forEach((invoiceDoc) => {
            invoiceBatch.delete(invoiceDoc.ref);
          });
          await invoiceBatch.commit();
        }
      } catch (invoiceErr) {
        console.warn('[DeleteAccount] invoice cleanup failed:', invoiceErr);
      }

      try {
        const appointmentsRef = collection(db, USERS_COLLECTION, uid, 'appointments');
        const appointmentsSnap = await getDocs(appointmentsRef);
        if (!appointmentsSnap.empty) {
          const aptBatch = writeBatch(db);
          appointmentsSnap.docs.forEach((aptDoc) => {
            aptBatch.delete(aptDoc.ref);
          });
          await aptBatch.commit();
        }
      } catch (aptErr) {
        console.warn('[DeleteAccount] appointment cleanup failed:', aptErr);
      }

      try {
        await deleteDoc(doc(db, DOCTORS_COLLECTION, uid, 'settings', 'softBlocks'));
        await deleteDoc(doc(db, DOCTORS_COLLECTION, uid, 'settings', 'availability'));
      } catch (settingsErr) {
        console.warn('[DeleteAccount] doctor settings cleanup failed:', settingsErr);
      }

      const batch = writeBatch(db);
      batch.delete(doc(db, USERS_COLLECTION, uid));
      batch.delete(doc(db, DOCTORS_COLLECTION, uid));
      await batch.commit();

      const deleteAuthUser = async () => {
        try {
          await deleteUser(currentUser);
        } catch (authErr: unknown) {
          const code = (authErr as { code?: string })?.code;
          if (code !== 'auth/requires-recent-login') throw authErr;
          const email = currentUser.email;
          const password = window.prompt('To delete your account, please re-enter your password:');
          if (!password) throw new Error('Re-authentication cancelled');
          if (!email) throw new Error('No email available for re-authentication');
          await reauthenticateWithCredential(
            currentUser,
            EmailAuthProvider.credential(email, password)
          );
          await deleteUser(currentUser);
        }
      };

      await deleteAuthUser();
      await logoutDoctor();
      navigate('/login');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to delete. You may need to re-authenticate.';
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
            retained for periods required by law, regulation, or legitimate clinical audit — even
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
