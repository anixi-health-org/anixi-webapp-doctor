import React from 'react';
import clsx from 'clsx';

interface DashboardStatsCardProps {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  color: 'blue' | 'orange' | 'green' | 'red';
  onClick?: () => void;
  isActive?: boolean;
  description?: string;
}

const colorStyles = {
  blue: {
    bg: 'bg-slate-50',
    border: 'border-slate-200/80',
    icon: 'bg-white text-slate-600',
    value: 'text-slate-900',
    label: 'text-slate-500',
    ring: 'ring-slate-300/50',
  },
  orange: {
    bg: 'bg-amber-50/60',
    border: 'border-amber-200/70',
    icon: 'bg-white text-amber-600',
    value: 'text-amber-900',
    label: 'text-amber-700/70',
    ring: 'ring-amber-300/50',
  },
  green: {
    bg: 'bg-emerald-50/60',
    border: 'border-emerald-200/70',
    icon: 'bg-white text-emerald-600',
    value: 'text-emerald-900',
    label: 'text-emerald-700/70',
    ring: 'ring-emerald-300/50',
  },
  red: {
    bg: 'bg-rose-50/60',
    border: 'border-rose-200/70',
    icon: 'bg-white text-rose-600',
    value: 'text-rose-900',
    label: 'text-rose-700/70',
    ring: 'ring-rose-300/50',
  },
};

export const DashboardStatsCard: React.FC<DashboardStatsCardProps> = ({
  label,
  value,
  icon,
  color,
  onClick,
  isActive,
  description,
}) => {
  const styles = colorStyles[color];

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={clsx(
        'w-full rounded-2xl border p-4 text-left transition-all duration-200',
        styles.bg,
        styles.border,
        onClick && 'cursor-pointer hover:-translate-y-0.5 hover:shadow-card',
        isActive && `ring-2 ring-offset-2 shadow-card ${styles.ring}`,
        !onClick && 'cursor-default'
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className={clsx(
            'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-gray-100 shadow-soft [&>svg]:h-5 [&>svg]:w-5',
            styles.icon
          )}
        >
          {icon}
        </div>
        <div className="min-w-0">
          {description && <p className="mb-0.5 font-sans text-xs text-gray-500">{description}</p>}
          <p className={clsx('font-sans text-2xl font-semibold tabular-nums leading-none', styles.value)}>
            {value}
          </p>
          <p className={clsx('mt-1.5 font-sans text-[11px] font-semibold uppercase tracking-wider', styles.label)}>
            {label}
          </p>
        </div>
      </div>
    </button>
  );
};
