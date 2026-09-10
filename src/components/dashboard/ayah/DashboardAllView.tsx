import clsx from 'clsx';
import React from 'react';
import { ArrowRightIcon } from '@heroicons/react/24/outline';
import type { DoctorDashboardBoard } from '../../../types/doctorDashboard';
import type { DashboardResolvedData } from '../../../hooks/useDoctorDashboardData';
import { prepareDashboardWidgets } from '../../../lib/dashboardPresets';
import { resolveWidgetStat } from '../../../hooks/useDoctorDashboardData';
import { DashboardWidgetGridItem } from './DashboardWidget';

type Props = {
  boards: DoctorDashboardBoard[];
  resolved: DashboardResolvedData;
  onOpenBoard: (boardId: string) => void;
};

function BoardKpiStrip({
  board,
  resolved,
}: {
  board: DoctorDashboardBoard;
  resolved: DashboardResolvedData;
}) {
  const widgets = prepareDashboardWidgets(board.widgets);
  const statRow = widgets.find((widget) => widget.type === 'stat_row');
  const looseStats = widgets.filter((widget) => widget.type === 'stat');

  const stats = statRow?.config?.stats
    ? (statRow.config.stats as Array<{ label: string; dataBinding?: string; value?: string }>)
    : looseStats.map((widget) => ({
        label: widget.title ?? 'Metric',
        dataBinding: widget.dataBinding,
      }));

  if (stats.length === 0) return null;

  return (
    <div
      className={clsx(
        'grid gap-2',
        stats.length >= 4
          ? 'grid-cols-2 sm:grid-cols-4'
          : stats.length === 3
            ? 'grid-cols-3'
            : 'grid-cols-2',
      )}
    >
      {stats.slice(0, 4).map((stat) => {
        const live = stat.dataBinding
          ? resolveWidgetStat(stat.dataBinding, stat, resolved)
          : { value: 'value' in stat && stat.value ? stat.value : '-' };
        return (
          <div
            key={stat.label}
            className="rounded-md border border-[#eef2f6] bg-[#fafafa] px-2.5 py-2"
          >
            <p className="truncate text-[10px] font-medium uppercase tracking-wide text-[#65758b]">
              {stat.label}
            </p>
            <p className="mt-1 text-lg font-bold leading-none text-[#1c2731]">{live.value}</p>
          </div>
        );
      })}
    </div>
  );
}

function BoardOverviewCard({
  board,
  resolved,
  onOpen,
}: {
  board: DoctorDashboardBoard;
  resolved: DashboardResolvedData;
  onOpen: () => void;
}) {
  const widgets = prepareDashboardWidgets(board.widgets);
  const panelWidgets = widgets.filter((widget) => widget.type !== 'stat_row' && widget.type !== 'stat');

  return (
    <article className="flex flex-col rounded-lg border border-[#e8eaed] bg-white shadow-[0_1px_2px_rgba(28,39,49,0.04)]">
      <div className="border-b border-[#eef2f6] px-4 py-3">
        <h2 className="font-heading text-[15px] font-semibold text-[#1c2731]">{board.title}</h2>
        {board.subtitle ? (
          <p className="mt-0.5 line-clamp-2 text-xs text-[#65758b]">{board.subtitle}</p>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col gap-3 p-3">
        <BoardKpiStrip board={board} resolved={resolved} />

        {panelWidgets.length > 0 ? (
          <div
            className={clsx(
              'grid gap-2',
              panelWidgets.length > 1 ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1',
            )}
          >
            {panelWidgets.map((widget, index) => (
              <div key={widget.id} className="min-h-0 [&_.min-h-\\[260px\\]]:min-h-[180px]">
                <DashboardWidgetGridItem
                  widget={{ ...widget, span: panelWidgets.length === 1 ? 12 : 6 }}
                  resolved={resolved}
                  index={index}
                />
              </div>
            ))}
          </div>
        ) : null}
      </div>

      <div className="border-t border-[#eef2f6] px-4 py-2.5">
        <button
          type="button"
          onClick={onOpen}
          className="inline-flex items-center gap-1 text-xs font-medium text-[#427160] hover:text-[#365c4e]"
        >
          Open dashboard
          <ArrowRightIcon className="h-3.5 w-3.5" />
        </button>
      </div>
    </article>
  );
}

export function DashboardAllView({ boards, resolved, onOpenBoard }: Props) {
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-heading text-xl font-bold tracking-tight text-[#1c2731] sm:text-[1.35rem]">
            All dashboards
          </h1>
          <p className="mt-0.5 text-sm text-[#65758b]">
            {boards.length} workspace{boards.length !== 1 ? 's' : ''} · tap one to focus
          </p>
        </div>
        <p className="text-xs text-[#94a3b8]">Live from your practice</p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3">
        {boards.map((board) => (
          <BoardOverviewCard
            key={board.id}
            board={board}
            resolved={resolved}
            onOpen={() => onOpenBoard(board.id)}
          />
        ))}
      </div>
    </div>
  );
}
