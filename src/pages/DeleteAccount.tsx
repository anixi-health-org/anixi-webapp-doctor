import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { deleteUser } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { logoutDoctor } from '../services/authService';

const DeleteAccount: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleDelete = async () => {
    const confirmed = window.confirm('Êtes-vous sûr·e de vouloir supprimer définitivement votre compte ? Cette action est irréversible.');
    if (!confirmed) return;
    setLoading(true);
    setError(null);
    try {
      const user = auth.currentUser;
      if (user) {
        await deleteUser(user);
      }
      await logoutDoctor();
      navigate('/login');
    } catch (err: any) {
      setError(err?.message || 'Échec de la suppression. Vous devrez peut-être vous ré-authentifier.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-6">
      <h2 className="text-2xl font-bold mb-4">Supprimer le compte</h2>
      <p className="text-gray-600 mb-6">
        Cliquer sur le bouton ci‑dessous supprimera définitivement votre compte et toutes les données associées.
      </p>
      {error && <div className="text-red-600 mb-4">{error}</div>}
      <div className="flex gap-3">
        <button
          onClick={handleDelete}
          disabled={loading}
          className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-60"
        >
          {loading ? 'Suppression…' : 'Supprimer le compte'}
        </button>
        <button
          onClick={() => navigate(-1)}
          className="px-4 py-2 bg-gray-100 text-gray-800 rounded-md hover:bg-gray-200"
        >
          Annuler
        </button>
      </div>
    </div>
  );
};

export default DeleteAccount;
