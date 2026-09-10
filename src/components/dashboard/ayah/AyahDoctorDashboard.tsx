import React, { useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import { useAuth } from '../../../hooks/useAuth';
import { useDoctorDashboard } from '../../../hooks/useDoctorDashboard';
import { useDoctorDashboardData } from '../../../hooks/useDoctorDashboardData';
import { useDoctorBriefingData } from '../../../hooks/useDoctorBriefingData';
import type { DoctorDashboardWorkspace } from '../../../types/doctorDashboard';
import { prepareDashboardWidgets } from '../../../lib/dashboardPresets';
import { DashboardCanvas } from './DashboardCanvas';
import { DashboardAyahChat } from './DashboardAyahChat';
import { DashboardCreatingState } from './DashboardCreatingState';
import type { DashboardView } from './DashboardTabs';

export function AyahDoctorDashboard() {
  const { user } = useAuth();
  const { workspace, activeBoard, loading, hasBoards, selectBoard } = useDoctorDashboard(user?.id);
  const { resolved, loading: dataLoading } = useDoctorDashboardData();
  const { practiceSnapshot } = useDoctorBriefingData();
  const [isCreating, setIsCreating] = useState(false);
  const [view, setView] = useState<DashboardView>('board');
  const [optimisticWorkspace, setOptimisticWorkspace] = useState<DoctorDashboardWorkspace | null>(null);

  const firstName = user?.displayName?.split(' ')[0] || 'Doctor';
  const liveWorkspace = workspace ?? optimisticWorkspace;
  const boards = liveWorkspace?.boards ?? [];
  const displayBoard =
    activeBoard ??
    (liveWorkspace?.activeBoardId
      ? boards.find((board) => board.id === liveWorkspace.activeBoardId) ?? boards[0]
      : boards[0]) ??
    null;
  const widgetCount = displayBoard
    ? prepareDashboardWidgets(displayBoard.widgets).length
    : 0;
  const hasLayout = !loading && widgetCount > 0;
  const showWorkspace = hasLayout || hasBoards || isCreating;

  useEffect(() => {
    if (workspace && workspace.boards.length > 0) {
      setOptimisticWorkspace(null);
    }
  }, [workspace]);

  const chatProps = useMemo(
    () => ({
      practiceSnapshot: practiceSnapshot as unknown as Record<string, unknown>,
      onCreatingChange: setIsCreating,
      onWorkspaceSaved: (saved: DoctorDashboardWorkspace) => {
        setOptimisticWorkspace(saved);
        setIsCreating(false);
      },
    }),
    [practiceSnapshot],
  );

  if (isCreating && !hasLayout && !hasBoards) {
    return (
      <div className="flex h-full min-h-0 flex-col bg-[#f7f6f3]">
        <DashboardCreatingState />
      </div>
    );
  }

  if (!showWorkspace) {
    return (
      <div className="flex h-full min-h-0 flex-col bg-[#f7f6f3]">
        <div className="flex min-h-0 flex-1 items-center justify-center overflow-y-auto px-5 py-8 lg:px-8">
          <DashboardAyahChat {...chatProps} mode="landing" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#f7f6f3]">
      <section
        className={clsx(
          'min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5 lg:px-8',
          hasLayout && 'animate-ayah-fade-in-up motion-reduce:animate-none',
        )}
        style={hasLayout ? { animationFillMode: 'both' } : undefined}
      >
        <div className="mx-auto max-w-6xl pb-4">
          {hasLayout && displayBoard ? (
            <DashboardCanvas
              boards={boards}
              activeBoard={displayBoard}
              activeBoardId={liveWorkspace?.activeBoardId ?? displayBoard?.id ?? null}
              view={view}
              resolved={resolved}
              loading={loading || dataLoading}
              firstName={firstName}
              onViewAll={() => setView('all')}
              onSelectBoard={(boardId) => {
                setView('board');
                void selectBoard(boardId);
              }}
            />
          ) : null}
        </div>
      </section>

      <DashboardAyahChat {...chatProps} mode="dock" />
    </div>
  );
}

export default AyahDoctorDashboard;
