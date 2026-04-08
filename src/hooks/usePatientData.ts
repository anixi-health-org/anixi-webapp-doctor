import { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { transformPatientData, transformMoodEntry, transformAdherenceRecord, transformVitalsRecord } from '../utils/dateFormatter';
import { Patient } from '../types';

/**
 * Hook: Fetch patient data with automatic timestamp conversion
 * NEVER render raw Firestore timestamps - this hook handles conversion
 */
export const usePatientData = (patientId: string) => {
  const [patient, setPatient] = useState<Patient | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!patientId) {
      setIsLoading(false);
      return;
    }

    const fetchPatient = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const patientRef = doc(db, 'patients', patientId);
        const patientDoc = await getDoc(patientRef);

        if (!patientDoc.exists()) {
          setError('Patient not found');
          setPatient(null);
          return;
        }

        // Transform all timestamps BEFORE setting state
        const transformedPatient = transformPatientData(patientDoc.data());
        setPatient(transformedPatient as Patient);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to load patient';
        setError(message);
        console.error('Error fetching patient:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPatient();
  }, [patientId]);

  return { patient, isLoading, error };
};

/**
 * Hook: Fetch and transform mood entries
 * Safe for rendering - all timestamps converted
 */
export const useMoodEntries = (patientId: string, dateRange?: { start: Date; end: Date }) => {
  const [entries, setEntries] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!patientId) {
      setIsLoading(false);
      return;
    }

    const fetchEntries = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // In a real app, you'd query with date range
        // For now, just fetch from collection
        const moodRef = doc(db, `Users/${patientId}/mood_entries`, 'latest');
        const moodDoc = await getDoc(moodRef);

        if (moodDoc.exists()) {
          const transformed = transformMoodEntry(moodDoc.data());
          setEntries(transformed ? [transformed] : []);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to load mood entries';
        setError(message);
        console.error('Error fetching mood entries:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchEntries();
  }, [patientId, dateRange]);

  return { entries, isLoading, error };
};

/**
 * Hook: Fetch and transform adherence records
 * Safe for rendering - all timestamps converted
 */
export const useAdherenceRecords = (patientId: string, dateRange?: { start: Date; end: Date }) => {
  const [records, setRecords] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!patientId) {
      setIsLoading(false);
      return;
    }

    const fetchRecords = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // In a real app, you'd query with date range
        // For now, just set empty array
        setRecords([]);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to load adherence records';
        setError(message);
        console.error('Error fetching adherence records:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchRecords();
  }, [patientId, dateRange]);

  return { records, isLoading, error };
};

/**
 * Hook: Fetch and transform vitals
 * Safe for rendering - all timestamps converted
 */
export const useVitals = (patientId: string) => {
  const [vitals, setVitals] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!patientId) {
      setIsLoading(false);
      return;
    }

    const fetchVitals = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // In a real app, you'd fetch vitals
        setVitals(null);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to load vitals';
        setError(message);
        console.error('Error fetching vitals:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchVitals();
  }, [patientId]);

  return { vitals, isLoading, error };
};
