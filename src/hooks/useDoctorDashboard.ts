import { useEffect, useMemo, useState } from 'react';
import {
  getActiveBoard,
  listenToDoctorDashboardWorkspace,
  setActiveDashboardBoard,
} from '../services/doctorDashboardService';
import type { DoctorDashboardBoard, DoctorDashboardWorkspace } from '../types/doctorDashboard';

export function useDoctorDashboard(doctorId: string | undefined) {
  const [workspace, setWorkspace] = useState<DoctorDashboardWorkspace | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!doctorId) {
      setWorkspace(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsub = listenToDoctorDashboardWorkspace(doctorId, (next) => {
      setWorkspace(next);
      setLoading(false);
    });

    return unsub;
  }, [doctorId]);

  const activeBoard = useMemo(() => getActiveBoard(workspace), [workspace]);
  const hasBoards = !loading && Boolean(workspace?.boards.length);

  const selectBoard = async (boardId: string) => {
    if (!doctorId) return;
    await setActiveDashboardBoard(doctorId, boardId);
  };

  return {
    workspace,
    activeBoard,
    layout: activeBoard,
    loading,
    hasBoards,
    isEmpty: !loading && !hasBoards,
    selectBoard,
  };
}

export type { DoctorDashboardBoard, DoctorDashboardWorkspace };
