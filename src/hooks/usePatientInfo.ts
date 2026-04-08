import { useEffect, useState } from 'react';
import { fetchPatientInfo, PatientInfo } from '../services/patientService';

// Simple cache for patient data to avoid redundant fetches
const patientCache = new Map<string, PatientInfo>();

/**
 * Custom hook to fetch and cache patient information
 * Usage: const { patientName, isLoading } = usePatientInfo(patientId);
 */
export const usePatientInfo = (patientId: string | undefined) => {
  const [patientName, setPatientName] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!patientId) {
      setPatientName('');
      setIsLoading(false);
      return;
    }

    // Check cache first
    if (patientCache.has(patientId)) {
      const cached = patientCache.get(patientId);
      setPatientName(cached?.displayName || `Patient ${patientId.substring(0, 8)}`);
      setIsLoading(false);
      return;
    }

    // Fetch from Firestore
    const fetchPatient = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const patient = await fetchPatientInfo(patientId);

        if (patient) {
          // Cache the result
          patientCache.set(patientId, patient);
          setPatientName(patient.displayName || `Patient ${patientId.substring(0, 8)}`);
        } else {
          // Fallback name
          setPatientName(`Patient ${patientId.substring(0, 8)}`);
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Failed to fetch patient info';
        setError(errorMsg);
        setPatientName(`Patient ${patientId.substring(0, 8)}`);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPatient();
  }, [patientId]);

  return { patientName, isLoading, error };
};

/**
 * List all cached patients for debugging
 */
export const getCachedPatients = () => {
  return Array.from(patientCache.entries());
};

/**
 * Clear patient cache (useful for testing/logout)
 */
export const clearPatientCache = () => {
  patientCache.clear();
};
