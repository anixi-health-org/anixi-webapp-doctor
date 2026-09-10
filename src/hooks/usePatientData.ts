import { useState, useEffect } from 'react';
import { transformPatientData, transformMoodEntry } from '../utils/dateFormatter';
import { Patient } from '../types';
import { getPatientById } from '../services/unifiedPatientDataSource';
import {
  getAdherenceRecordsForDate,
  getMoodEntriesForMonth,
  getVitalsRecordsForDate,
} from '../services/logsService';

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
        const row = await getPatientById(patientId);
        setPatient(row ? transformPatientData(row) : null);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to load patient';
        setError(message);
      } finally {
        setIsLoading(false);
      }
    };

    void fetchPatient();
  }, [patientId]);

  return { patient, isLoading, error };
};

export const useMoodEntries = (patientId: string, dateRange?: { start: Date; end: Date }) => {
  const [entries, setEntries] = useState<ReturnType<typeof transformMoodEntry>[]>([]);
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
        const anchor = dateRange?.start ?? new Date();
        const rows = await getMoodEntriesForMonth(
          patientId,
          anchor.getFullYear(),
          anchor.getMonth() + 1,
        );
        setEntries(rows.map((row) => transformMoodEntry(row)));
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to load mood entries';
        setError(message);
      } finally {
        setIsLoading(false);
      }
    };

    void fetchEntries();
  }, [patientId, dateRange]);

  return { entries, isLoading, error };
};

export const useAdherenceRecords = (patientId: string, dateRange?: { start: Date; end: Date }) => {
  const [records, setRecords] = useState<unknown[]>([]);
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
        const anchor = dateRange?.start ?? new Date();
        const dateStr = anchor.toISOString().slice(0, 10);
        const rows = await getAdherenceRecordsForDate(patientId, dateStr);
        setRecords(rows);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to load adherence records';
        setError(message);
      } finally {
        setIsLoading(false);
      }
    };

    void fetchRecords();
  }, [patientId, dateRange]);

  return { records, isLoading, error };
};

export const useVitals = (patientId: string) => {
  const [vitals, setVitals] = useState<unknown | null>(null);
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
        const dateStr = new Date().toISOString().slice(0, 10);
        const rows = await getVitalsRecordsForDate(patientId, dateStr);
        setVitals(rows);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to load vitals';
        setError(message);
      } finally {
        setIsLoading(false);
      }
    };

    void fetchVitals();
  }, [patientId]);

  return { vitals, isLoading, error };
};
