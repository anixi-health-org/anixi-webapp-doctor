import clsx from 'clsx';
import React from 'react';
import type { DoctorDashboardWidget } from '../../../types/doctorDashboard';
import {
  resolveWidgetList,
  resolveWidgetStat,
  type DashboardListItem,
  type DashboardResolvedData,
} from '../../../hooks/useDoctorDashboardData';
import { ayahWidgetClass, ayahWidgetStyle } from '../../ayah/AyahMotion';

const CARD =
  'rounded-lg border border-[#e8eaed] bg-white shadow-[0_1px_2px_rgba(28,39,49,0.04)]';

function toneBadge(tone?: DashboardListItem['tone']) {
  if (tone === 'urgent') return 'bg-rose-50 text-rose-700 ring-1 ring-rose-100';
  if (tone === 'soon') return 'bg-amber-50 text-amber-800 ring-1 ring-amber-100';
  if (tone === 'routine') return 'bg-[#eef4f1] text-[#427160] ring-1 ring-[#427160]/10';
  return 'bg-slate-50 text-slate-600 ring-1 ring-slate-100';
}

type Props = {
  widget: DoctorDashboardWidget;
  resolved: DashboardResolvedData;
  firstName?: string;
};

function KpiCard({ label, value }: { label: string; value: string }) {
  return (
    <div className={clsx(CARD, 'flex min-h-[92px] flex-col justify-center px-4 py-3.5')}>
      <p className="text-[11px] font-medium uppercase tracking-wide text-[#65758b]">{label}</p>
      <p className="mt-2 text-[28px] font-bold leading-none tracking-tight text-[#1c2731]">
        {value}
      </p>
    </div>
  );
}

function PanelShell({
  title,
  subtitle,
  children,
  className,
}: {
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={clsx(CARD, 'flex min-h-[260px] flex-col', className)}>
      <div className="border-b border-[#eef2f6] px-4 py-3">
        <p className="text-[13px] font-semibold text-[#344256]">{title ?? 'Details'}</p>
        {subtitle ? <p className="mt-0.5 text-xs text-[#65758b]">{subtitle}</p> : null}
      </div>
      <div className="flex-1">{children}</div>
    </div>
  );
}

export function DashboardWidget({ widget, resolved }: Props) {
  const config = widget.config ?? {};

  if (widget.type === 'divider') {
    return (
      <div className="col-span-full px-1 pt-1">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#65758b]">
          {widget.title}
        </p>
      </div>
    );
  }

  if (widget.type === 'hero') {
    return null;
  }

  if (widget.type === 'note') {
    return (
      <PanelShell title={widget.title} subtitle={widget.subtitle}>
        <p className="whitespace-pre-wrap px-4 py-3 text-sm leading-relaxed text-[#344256]">
          {String(config.body ?? widget.subtitle ?? '')}
        </p>
      </PanelShell>
    );
  }

  if (widget.type === 'stat') {
    const stat = resolveWidgetStat(widget.dataBinding, config, resolved);
    return <KpiCard label={widget.title ?? 'Metric'} value={stat.value} />;
  }

  if (widget.type === 'stat_row') {
    const stats = Array.isArray(config.stats)
      ? (config.stats as Array<{ label: string; value?: string; dataBinding?: string }>)
      : [];
    const colClass =
      stats.length <= 2
        ? 'grid-cols-1 sm:grid-cols-2'
        : stats.length === 3
          ? 'grid-cols-1 sm:grid-cols-3'
          : 'grid-cols-2 lg:grid-cols-4';

    return (
      <div className={clsx('col-span-full grid gap-3', colClass)}>
        {stats.map((stat) => {
          const live = stat.dataBinding
            ? resolveWidgetStat(stat.dataBinding, stat, resolved)
            : { value: stat.value ?? '-' };
          return <KpiCard key={stat.label} label={stat.label} value={live.value} />;
        })}
      </div>
    );
  }

  if (widget.type === 'progress') {
    const bindingValue = widget.dataBinding
      ? Number(String(resolved.stats[widget.dataBinding] ?? '0').replace('%', ''))
      : NaN;
    const value = Number.isFinite(bindingValue) ? bindingValue : Number(config.value ?? 0);
    const clamped = Math.min(100, Math.max(0, value));

    return (
      <PanelShell title={widget.title ?? 'Progress'} subtitle={widget.subtitle}>
        <div className="px-4 py-4">
          <span className="text-2xl font-bold text-[#1c2731]">{clamped}%</span>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-[#f1f5f9]">
            <div
              className="h-full rounded-full bg-[#427160] transition-all duration-700"
              style={{ width: `${clamped}%` }}
            />
          </div>
        </div>
      </PanelShell>
    );
  }

  if (widget.type === 'sparkline') {
    const points = Array.isArray(config.points) ? (config.points as number[]) : [2, 4, 3, 6, 5, 8, 7];
    const max = Math.max(...points, 1);
    const live = widget.dataBinding
      ? resolveWidgetStat(widget.dataBinding, config, resolved)
      : { value: String(config.value ?? '-') };

    return (
      <PanelShell title={widget.title ?? 'Trend'} subtitle={widget.subtitle}>
        <div className="px-4 py-3">
          <p className="text-2xl font-bold text-[#1c2731]">{live.value}</p>
          <div className="mt-4 flex h-16 items-end gap-1.5">
            {points.map((point, index) => (
              <div
                key={index}
                className="flex-1 rounded-sm bg-[#427160]/75"
                style={{ height: `${Math.max(10, (point / max) * 100)}%` }}
              />
            ))}
          </div>
        </div>
      </PanelShell>
    );
  }

  const items = resolveWidgetList(widget.dataBinding, config, resolved);
  const isSchedule = widget.type === 'schedule';

  return (
    <PanelShell title={widget.title} subtitle={widget.subtitle}>
      <div className="divide-y divide-[#eef2f6]">
        {items.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-[#94a3b8]">
            {isSchedule ? 'Nothing scheduled yet' : 'Nothing here right now'}
          </p>
        ) : (
          items.slice(0, isSchedule ? 8 : 6).map((item: DashboardListItem) => (
            <div key={item.id} className="flex items-start gap-3 px-4 py-3">
              {isSchedule ? (
                <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-[#427160]" />
              ) : null}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-[#344256]">{item.title}</p>
                {item.subtitle ? (
                  <p className="mt-0.5 truncate text-xs text-[#65758b]">{item.subtitle}</p>
                ) : null}
              </div>
              {item.badge ? (
                <span
                  className={clsx(
                    'shrink-0 rounded px-2 py-0.5 text-[10px] font-semibold uppercase',
                    toneBadge(item.tone),
                  )}
                >
                  {item.badge}
                </span>
              ) : null}
            </div>
          ))
        )}
      </div>
    </PanelShell>
  );
}

function spanClass(span: number, widget: DoctorDashboardWidget): string {
  if (widget.type === 'stat_row') return 'col-span-12';
  const map: Record<number, string> = {
    3: 'col-span-12 sm:col-span-6 lg:col-span-3',
    4: 'col-span-12 sm:col-span-6 lg:col-span-4',
    6: 'col-span-12 lg:col-span-6',
    8: 'col-span-12 lg:col-span-8',
    12: 'col-span-12',
  };
  return map[span] ?? 'col-span-12 lg:col-span-6';
}

export function DashboardWidgetGridItem({
  widget,
  resolved,
  firstName: _firstName,
  index = 0,
}: Props & { index?: number }) {
  return (
    <div
      className={ayahWidgetClass(index, spanClass(widget.span ?? 6, widget))}
      style={ayahWidgetStyle(index)}
    >
      <DashboardWidget widget={widget} resolved={resolved} />
    </div>
  );
}
