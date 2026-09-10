import { useEffect, useState } from 'react';
import {
  loadAyahPatientChart,
  type AyahPatientChartSnapshot,
} from '../services/ayahPatientChart';

export function useAyahPatientChart(doctorId?: string, patientId?: string) {
  const [chart, setChart] = useState<AyahPatientChartSnapshot | undefined>();

  useEffect(() => {
    if (!doctorId || !patientId) {
      setChart(undefined);
      return;
    }

    let cancelled = false;
    void loadAyahPatientChart(doctorId, patientId)
      .then((next) => {
        if (!cancelled) setChart(next);
      })
      .catch(() => {
        if (!cancelled) setChart(undefined);
      });

    return () => {
      cancelled = true;
    };
  }, [doctorId, patientId]);

  return chart;
}
