import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Appointment, BookableBlock, SoftBlock } from '../../types';
import {
  appointmentDurationMinutes,
  appointmentSortMinutes,
  formatHourLabel,
  formatMinutesClock,
  parseHhmmToMinutes,
  toDateKey,
  visibleHourRange,
} from './calendarDateUtils';
import { formatAppointmentStatusLabel } from '../../services/appointmentCanonical';

const ROW_HEIGHT = 64;
/** Keeps a long open day scannable instead of stretching the page. */
const GRID_MAX_HEIGHT = 560;

const STATUS_STYLES: Record<string, string> = {
  confirmed: 'border-l-emerald-500 bg-emerald-50 text-emerald-900',
  pending: 'border-l-amber-500 bg-amber-50 text-amber-900',
  completed: 'border-l-slate-400 bg-slate-100 text-slate-700',
  cancelled: 'border-l-red-300 bg-red-50 text-red-700 opacity-60',
  no_show: 'border-l-orange-500 bg-orange-50 text-orange-900',
  rescheduled: 'border-l-amber-500 bg-amber-50 text-amber-900',
};

interface DayAgendaViewProps {
  dateLabel: string;
  /** Local YYYY-MM-DD of the day shown, used to surface "now" on today. */
  dateKey?: string;
  appointments: Appointment[];
  clinicHours?: BookableBlock[];
  blockedTime?: SoftBlock[];
  isLoading?: boolean;
  onSelectAppointment: (apt: Appointment) => void;
  onQuickAdd?: () => void;
  onManageHours?: () => void;
  doctorLabels?: Record<string, string>;
  showDoctor?: boolean;
}

function clinicWindows(blocks: BookableBlock[]): { start: number; end: number }[] {
  return blocks
    .map((block) => {
      const start = parseHhmmToMinutes(block.startTime);
      const end = parseHhmmToMinutes(block.endTime);
      if (start == null || end == null || end <= start) return null;
      return { start, end };
    })
    .filter((window): window is { start: number; end: number } => window != null)
    .sort((a, b) => a.start - b.start);
}

export const DayAgendaView: React.FC<DayAgendaViewProps> = ({
  dateLabel,
  dateKey,
  appointments,
  clinicHours = [],
  blockedTime = [],
  isLoading = false,
  onSelectAppointment,
  onQuickAdd,
  onManageHours,
  doctorLabels,
  showDoctor = false,
}) => {
  const windows = useMemo(() => clinicWindows(clinicHours), [clinicHours]);

  const { startHour, endHour } = useMemo(
    () => visibleHourRange(windows, appointments),
    [windows, appointments],
  );

  const visibleHours = endHour - startHour;
  const dayStartMin = startHour * 60;
  const dayEndMin = endHour * 60;
  const hours = useMemo(
    () => Array.from({ length: visibleHours }, (_, i) => startHour + i),
    [startHour, visibleHours],
  );

  const visible = useMemo(
    () =>
      appointments
        .filter((a) => a.status !== 'cancelled')
        .slice()
        .sort((a, b) => appointmentSortMinutes(a) - appointmentSortMinutes(b)),
    [appointments],
  );

  const positioned = useMemo(
    () =>
      visible.map((apt) => {
        const startMin = appointmentSortMinutes(apt);
        const duration = appointmentDurationMinutes(apt);
        const top = ((Math.max(startMin, dayStartMin) - dayStartMin) / 60) * ROW_HEIGHT;
        const height = Math.max((duration / 60) * ROW_HEIGHT, 48);
        return { apt, startMin, top, height };
      }),
    [dayStartMin, visible],
  );

  const unavailable = useMemo(() => {
    const ranges: { start: number; end: number }[] = [];
    if (windows.length === 0) {
      return [{ start: dayStartMin, end: dayEndMin }];
    }
    let cursor = dayStartMin;
    for (const window of windows) {
      if (window.start > cursor) {
        ranges.push({ start: cursor, end: Math.min(window.start, dayEndMin) });
      }
      cursor = Math.max(cursor, window.end);
    }
    if (cursor < dayEndMin) ranges.push({ start: cursor, end: dayEndMin });
    return ranges.filter((range) => range.end > range.start);
  }, [dayEndMin, dayStartMin, windows]);

  const toTop = (minutes: number) => ((minutes - dayStartMin) / 60) * ROW_HEIGHT;
  const hourLabel = formatHourLabel;

  const isToday = dateKey != null && dateKey === toDateKey(new Date());
  const [nowMinutes, setNowMinutes] = useState(() => {
    const now = new Date();
    return now.getHours() * 60 + now.getMinutes();
  });

  useEffect(() => {
    if (!isToday) return;
    const tick = setInterval(() => {
      const now = new Date();
      setNowMinutes(now.getHours() * 60 + now.getMinutes());
    }, 60_000);
    return () => clearInterval(tick);
  }, [isToday]);

  const upNext = useMemo(() => {
    if (visible.length === 0) return null;
    if (!isToday) return visible[0];
    return (
      visible.find((apt) => appointmentSortMinutes(apt) >= nowMinutes) ?? null
    );
  }, [isToday, nowMinutes, visible]);

  const gridRef = useRef<HTMLDivElement>(null);

  // Open the grid on what matters now rather than at the top of a long day.
  useEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;
    const anchor = upNext
      ? appointmentSortMinutes(upNext)
      : isToday
        ? nowMinutes
        : null;
    if (anchor == null) return;
    grid.scrollTop = Math.max(0, toTop(anchor) - ROW_HEIGHT);
    // Re-anchor when the day or its bookings change, not on every clock tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateKey, upNext?.id, startHour, isLoading]);

  if (isLoading) {
    return (
      <div className="space-y-3 p-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-14 animate-pulse rounded-lg bg-[#f0f4f8]" />
        ))}
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-[15px] font-semibold text-[#0E2340]">
            {isToday ? 'Today\u2019s schedule' : 'Day schedule'}
          </h3>
          <p className="mt-0.5 text-[13px] text-[#65758b]">{dateLabel}</p>
          {windows.length > 0 ? (
            <p className="mt-1 text-[12px] font-medium text-anixi-green">
              Open {formatMinutesClock(windows[0].start)}
              {windows.length > 1 ? `-${formatMinutesClock(windows[windows.length - 1].end)}` : `-${formatMinutesClock(windows[0].end)}`}
            </p>
          ) : (
            <p className="mt-1 text-[12px] text-[#94a3b8]">No clinic hours set for this day</p>
          )}
          {upNext ? (
            <button
              type="button"
              onClick={() => onSelectAppointment(upNext)}
              className="mt-2 inline-flex items-center gap-2 rounded-lg border border-[#e1e7ef] bg-[#f8fafc] px-2.5 py-1.5 text-left transition hover:border-anixi-green"
            >
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[#8FA0B6]">
                {isToday ? 'Up next' : 'First visit'}
              </span>
              <span className="text-[12px] font-semibold text-[#0E2340]">
                {formatMinutesClock(appointmentSortMinutes(upNext))} · {upNext.patientName}
              </span>
            </button>
          ) : (
            visible.length > 0 && (
              <p className="mt-2 text-[12px] text-[#94a3b8]">
                No visits left today · {visible.length} earlier{' '}
                {visible.length === 1 ? 'visit' : 'visits'}
              </p>
            )
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {onManageHours && (
            <button
              type="button"
              onClick={onManageHours}
              className="inline-flex h-9 items-center rounded-lg border border-[#e1e7ef] bg-white px-3.5 text-xs font-semibold text-[#344256] shadow-sm transition hover:border-anixi-green hover:text-anixi-green"
            >
              Edit hours
            </button>
          )}
          {onQuickAdd && (
            <button
              type="button"
              onClick={onQuickAdd}
              className="inline-flex h-9 items-center rounded-lg bg-anixi-green px-3.5 text-xs font-semibold text-white shadow-sm transition hover:bg-[#365c4f]"
            >
              + Book into this day
            </button>
          )}
        </div>
      </div>

      <div
        ref={gridRef}
        className="overflow-y-auto overscroll-contain rounded-xl border border-[#e1e7ef]"
        style={{ maxHeight: GRID_MAX_HEIGHT }}
      >
        <div
          className="relative bg-white"
          style={{ height: visibleHours * ROW_HEIGHT }}
        >
          {hours.map((hour) => (
            <div
              key={hour}
              className="absolute left-0 right-0 border-t border-[#eef2f6]"
              style={{ top: (hour - startHour) * ROW_HEIGHT }}
            >
              <span className="absolute left-2 top-0 z-10 -translate-y-1/2 bg-white px-1 text-[10px] font-medium text-[#8FA0B6]">
                {hourLabel(hour)}
              </span>
            </div>
          ))}

          {unavailable.map((range, index) => (
            <div
              key={`off-${index}`}
              className="pointer-events-none absolute left-16 right-0 bg-[#f1f5f9]"
              style={{
                top: toTop(range.start),
                height: toTop(range.end) - toTop(range.start),
              }}
              title="Outside clinic hours"
            />
          ))}

          {windows.map((window, index) => (
            <div
              key={`open-${index}`}
              className="pointer-events-none absolute left-16 right-0 border-l-2 border-anixi-green/40 bg-emerald-50/40"
              style={{
                top: toTop(window.start),
                height: toTop(window.end) - toTop(window.start),
              }}
              title="Clinic hours"
            />
          ))}

          {blockedTime.map((block) => {
            const start =
              block.startAt.getHours() * 60 + block.startAt.getMinutes();
            const end = block.endAt.getHours() * 60 + block.endAt.getMinutes();
            if (end <= start) return null;
            return (
              <div
                key={block.id}
                className="absolute left-16 right-3 overflow-hidden rounded-lg border border-slate-200 bg-slate-100/90 px-2.5 py-1.5 text-left"
                style={{
                  top: toTop(Math.max(start, dayStartMin)),
                  height: Math.max(toTop(Math.min(end, dayEndMin)) - toTop(Math.max(start, dayStartMin)), 28),
                }}
                title={block.title}
              >
                <p className="truncate text-xs font-semibold text-slate-600">{block.title}</p>
                <p className="text-[10px] text-slate-500">Blocked</p>
              </div>
            );
          })}

          {positioned.map(({ apt, startMin, top, height }) => {
            const style = STATUS_STYLES[apt.status] ?? STATUS_STYLES.confirmed;
            return (
              <button
                key={apt.id}
                type="button"
                onClick={() => onSelectAppointment(apt)}
                className={`absolute left-16 right-3 z-20 overflow-hidden rounded-lg border border-black/5 border-l-4 px-2.5 py-1.5 text-left shadow-sm transition hover:brightness-95 ${style}`}
                style={{ top, height }}
                title={`${apt.patientName} · ${formatMinutesClock(startMin)}`}
              >
                <p className="truncate text-xs font-semibold">{apt.patientName}</p>
                <p className="truncate text-[10px] opacity-80">
                  {formatMinutesClock(startMin)}
                  {apt.consultType === 'teleconsult' || apt.type === 'Virtual'
                    ? ' · Video'
                    : apt.consultType
                      ? ` · ${apt.consultType}`
                      : ''}
                  {showDoctor ? ` · ${doctorLabels?.[apt.doctorId] || 'Doctor'}` : ''}
                  {' · '}
                  {formatAppointmentStatusLabel(apt.status)}
                </p>
              </button>
            );
          })}

          {isToday && nowMinutes >= dayStartMin && nowMinutes <= dayEndMin && (
            <div
              className="pointer-events-none absolute left-12 right-0 z-30 border-t border-red-400"
              style={{ top: toTop(nowMinutes) }}
            >
              <span className="absolute -top-1.5 left-0 h-3 w-3 -translate-x-1/2 rounded-full bg-red-400" />
            </div>
          )}

          {visible.length === 0 && windows.length > 0 && (
            <p className="pointer-events-none absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 text-[13px] text-[#94a3b8]">
              No visits booked in these hours
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default DayAgendaView;
