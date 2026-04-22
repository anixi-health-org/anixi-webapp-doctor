import { useEffect, useState } from 'react';
import { fetchPatientInfo, PatientInfo } from '../services/patientService';
const patientCache = new Map<string, PatientInfo>();
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
    if (patientCache.has(patientId)) {
      const cached = patientCache.get(patientId);
      setPatientName(cached?.displayName || `Patient ${patientId.substring(0, 8)}`);
      setIsLoading(false);
      return;
    }
    const fetchPatient = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const patient = await fetchPatientInfo(patientId);
        if (patient) {
          patientCache.set(patientId, patient);
          setPatientName(patient.displayName || `Patient ${patientId.substring(0, 8)}`);
        } else {
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
export const getCachedPatients = () => {
  return Array.from(patientCache.entries());
};
export const clearPatientCache = () => {
  patientCache.clear();
};
