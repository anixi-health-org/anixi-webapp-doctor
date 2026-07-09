import { useEffect, useState } from 'react';
import { Patient } from '../types';
import { listenToCaregiverPatients } from '../services/caregiverService';

export const useCaregiverPatients = (caregiverId: string | undefined) => {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!caregiverId) {
      setPatients([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const unsubscribe = listenToCaregiverPatients(
      caregiverId,
      (next) => {
        setPatients(next);
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      }
    );

    return unsubscribe;
  }, [caregiverId]);

  return { patients, loading, error };
};
