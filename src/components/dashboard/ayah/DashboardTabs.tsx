import clsx from 'clsx';
import { Squares2X2Icon } from '@heroicons/react/24/outline';
import React from 'react';
import type { DoctorDashboardBoard } from '../../../types/doctorDashboard';

export type DashboardView = 'all' | 'board';

type Props = {
  boards: DoctorDashboardBoard[];
  activeBoardId: string | null;
  view: DashboardView;
  onViewAll: () => void;
  onSelectBoard: (boardId: string) => void;
};

export function DashboardTabs({
  boards,
  activeBoardId,
  view,
  onViewAll,
  onSelectBoard,
}: Props) {
  if (boards.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        onClick={onViewAll}
        className={clsx(
          'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors',
          view === 'all'
            ? 'bg-[#344256] text-white'
            : 'border border-[#e8eaed] bg-white text-[#65758b] hover:text-[#344256]',
        )}
      >
        <Squares2X2Icon className="h-3.5 w-3.5" />
        All
      </button>
      {boards.map((board) => {
        const active = view === 'board' && board.id === activeBoardId;
        return (
          <button
            key={board.id}
            type="button"
            onClick={() => onSelectBoard(board.id)}
            className={clsx(
              'rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors',
              active
                ? 'bg-[#344256] text-white'
                : 'border border-[#e8eaed] bg-white text-[#65758b] hover:text-[#344256]',
            )}
          >
            {board.title}
          </button>
        );
      })}
    </div>
  );
}
