import React from 'react';
import type { DoctorDashboardBoard } from '../../../types/doctorDashboard';
import type { DashboardResolvedData } from '../../../hooks/useDoctorDashboardData';
import { DashboardWidgetGridItem } from './DashboardWidget';
import { prepareDashboardWidgets } from '../../../lib/dashboardPresets';
import { DashboardTabs, type DashboardView } from './DashboardTabs';
import { DashboardAllView } from './DashboardAllView';

type Props = {
  boards: DoctorDashboardBoard[];
  activeBoard: DoctorDashboardBoard | null;
  activeBoardId: string | null;
  view: DashboardView;
  resolved: DashboardResolvedData;
  loading: boolean;
  firstName?: string;
  onViewAll: () => void;
  onSelectBoard: (boardId: string) => void;
};

export function DashboardCanvas({
  boards,
  activeBoard,
  activeBoardId,
  view,
  resolved,
  loading,
  firstName,
  onViewAll,
  onSelectBoard,
}: Props) {
  if (loading) {
    return (
      <div className="flex min-h-[240px] items-center justify-center">
        <p className="text-sm text-[#6b7280]">Loading your workspace…</p>
      </div>
    );
  }

  if (boards.length === 0) {
    return null;
  }

  const handleOpenBoard = (boardId: string) => {
    onSelectBoard(boardId);
  };

  return (
    <div className="space-y-4">
      <div className="border-b border-[#e8eaed] pb-4">
        <DashboardTabs
          boards={boards}
          activeBoardId={activeBoardId}
          view={view}
          onViewAll={onViewAll}
          onSelectBoard={onSelectBoard}
        />
      </div>

      {view === 'all' ? (
        <DashboardAllView boards={boards} resolved={resolved} onOpenBoard={handleOpenBoard} />
      ) : activeBoard ? (
        <SingleBoardView
          board={activeBoard}
          resolved={resolved}
          firstName={firstName}
        />
      ) : null}
    </div>
  );
}

function SingleBoardView({
  board,
  resolved,
  firstName,
}: {
  board: DoctorDashboardBoard;
  resolved: DashboardResolvedData;
  firstName?: string;
}) {
  const widgets = prepareDashboardWidgets(board.widgets);
  const kpiWidgets = widgets.filter((widget) => widget.type === 'stat_row' || widget.type === 'stat');
  const panelWidgets = widgets.filter((widget) => widget.type !== 'stat_row' && widget.type !== 'stat');

  if (widgets.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-heading text-xl font-bold tracking-tight text-[#1c2731] sm:text-[1.35rem]">
            {board.title}
          </h1>
          {board.subtitle ? (
            <p className="mt-0.5 text-sm text-[#65758b]">{board.subtitle}</p>
          ) : null}
        </div>
        <p className="shrink-0 text-xs text-[#94a3b8]">Live from your practice</p>
      </div>

      {kpiWidgets.length > 0 ? (
        <div className="grid grid-cols-12 gap-3">
          {kpiWidgets.map((widget, index) => (
            <DashboardWidgetGridItem
              key={widget.id}
              widget={widget}
              resolved={resolved}
              firstName={firstName}
              index={index}
            />
          ))}
        </div>
      ) : null}

      {panelWidgets.length > 0 ? (
        <div className="grid grid-cols-12 items-stretch gap-3">
          {panelWidgets.map((widget, index) => (
            <DashboardWidgetGridItem
              key={widget.id}
              widget={widget}
              resolved={resolved}
              firstName={firstName}
              index={kpiWidgets.length + index}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
