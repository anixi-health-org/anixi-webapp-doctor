import React, { useMemo } from 'react';
import { Appointment } from '../../types';
import {
  formatMinutesClock,
  parseTimeToMinutes,
  appointmentSortMinutes,
} from './calendarDateUtils';

const DAY_START_HOUR = 7;
const DAY_END_HOUR = 20;
const ROW_HEIGHT = 72;
const VISIBLE_HOURS = DAY_END_HOUR - DAY_START_HOUR;

const STATUS_STYLES: Record<string, string> = {
  confirmed: 'border-l-emerald-500 bg-emerald-50 text-emerald-900',
  pending: 'border-l-amber-500 bg-amber-50 text-amber-900',
  completed: 'border-l-slate-400 bg-slate-100 text-slate-700',
  cancelled: 'border-l-red-300 bg-red-50 text-red-700 opacity-60',
  no_show: 'border-l-orange-500 bg-orange-50 text-orange-900',
};

interface DayAgendaViewProps {
  dateLabel: string;
  appointments: Appointment[];
  isLoading?: boolean;
  onSelectAppointment: (apt: Appointment) => void;
  onQuickAdd?: () => void;
  doctorLabels?: Record<string, string>;
  showDoctor?: boolean;
}

export const DayAgendaView: React.FC<DayAgendaViewProps> = ({
  dateLabel,
  appointments,
  isLoading = false,
  onSelectAppointment,
  onQuickAdd,
  doctorLabels,
  showDoctor = false,
}) => {
  const hours = useMemo(
    () => Array.from({ length: VISIBLE_HOURS }, (_, i) => DAY_START_HOUR + i),
    []
  );

  const visible = useMemo(
    () =>
      appointments
        .filter((a) => a.status !== 'cancelled')
        .slice()
        .sort((a, b) => appointmentSortMinutes(a) - appointmentSortMinutes(b)),
    [appointments]
  );

  const positioned = useMemo(() => {
    return visible.map((apt) => {
      const startMin = appointmentSortMinutes(apt);
      const duration =
        apt.startAt && apt.endAt
          ? Math.max(15, Math.round((apt.endAt.getTime() - apt.startAt.getTime()) / 60_000))
          : 30;
      const top = ((Math.max(startMin, DAY_START_HOUR * 60) - DAY_START_HOUR * 60) / 60) * ROW_HEIGHT;
      const height = Math.max((duration / 60) * ROW_HEIGHT, 44);
      return { apt, startMin, top, height };
    });
  }, [visible]);

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
          <h3 className="text-[15px] font-semibold text-[#0E2340]">Today&apos;s schedule</h3>
          <p className="mt-0.5 text-[13px] text-[#65758b]">{dateLabel}</p>
        </div>
        {onQuickAdd && (
          <button
            type="button"
            onClick={onQuickAdd}
            className="inline-flex h-9 items-center rounded-lg border border-[#e1e7ef] bg-white px-3.5 text-xs font-semibold text-[#344256] shadow-sm transition hover:border-anixi-green hover:text-anixi-green"
          >
            + Book into this day
          </button>
        )}
      </div>

      {visible.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center rounded-xl border border-dashed border-[#e1e7ef] bg-[#f8fafc] px-6 py-16 text-center">
          <p className="text-sm font-semibold text-[#0E2340]">No visits on this day</p>
          <p className="mt-1 max-w-xs text-[13px] leading-relaxed text-[#65758b]">
            When patients are booked, they appear here in time order - like your clinic day list.
          </p>
          {onQuickAdd && (
            <button
              type="button"
              onClick={onQuickAdd}
              className="mt-4 inline-flex h-10 items-center rounded-lg bg-anixi-green px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-[#365c4f]"
            >
              + Add appointment
            </button>
          )}
        </div>
      ) : (
        <>
          {/* List (clinician-friendly primary view) */}
          <div className="mb-5 space-y-2">
            {visible.map((apt) => {
              const mins = appointmentSortMinutes(apt);
              const style = STATUS_STYLES[apt.status] ?? STATUS_STYLES.confirmed;
              return (
                <button
                  key={apt.id}
                  type="button"
                  onClick={() => onSelectAppointment(apt)}
                  className={`flex w-full items-stretch gap-0 overflow-hidden rounded-xl border border-[#e1e7ef] text-left transition hover:border-anixi-green/40 hover:shadow-sm ${style}`}
                >
                  <div className="flex w-20 shrink-0 flex-col items-center justify-center border-r border-black/5 bg-white/50 px-2 py-3">
                    <span className="text-sm font-bold tabular-nums text-[#0E2340]">
                      {formatMinutesClock(mins).replace(/ (AM|PM)/, '')}
                    </span>
                    <span className="text-[10px] font-semibold uppercase text-[#8FA0B6]">
                      {mins >= 12 * 60 ? 'PM' : 'AM'}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1 px-4 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-semibold text-[#0E2340]">{apt.patientName}</p>
                      <span className="rounded-md bg-white/70 px-1.5 py-0.5 text-[10px] font-semibold capitalize text-[#65758b]">
                        {apt.status.replace('_', ' ')}
                      </span>
                    </div>
                    <p className="mt-0.5 text-[12px] capitalize text-[#65758b]">
                      {showDoctor && (
                        <span className="font-medium text-[#344256]">
                          {doctorLabels?.[apt.doctorId] || 'Doctor'}
                          {' · '}
                        </span>
                      )}
                      {apt.consultType ?? apt.type}
                      {apt.time ? ` · ${apt.time}` : ''}
                      {apt.isManual ? ' · Manual booking' : ''}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Compact timeline for visual orientation */}
          <div className="overflow-hidden rounded-xl border border-[#e1e7ef]">
            <div className="border-b border-[#e1e7ef] bg-[#f8fafc] px-4 py-2">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[#8FA0B6]">
                Day timeline
              </p>
            </div>
            <div
              className="relative"
              style={{ height: VISIBLE_HOURS * ROW_HEIGHT }}
            >
              {hours.map((h) => (
                <div
                  key={h}
                  className="absolute left-0 right-0 border-t border-[#eef2f6]"
                  style={{ top: (h - DAY_START_HOUR) * ROW_HEIGHT }}
                >
                  <span className="absolute left-2 top-0 -translate-y-1/2 bg-white px-1 text-[10px] font-medium text-[#8FA0B6]">
                    {h === 12 ? '12 PM' : h < 12 ? `${h} AM` : `${h - 12} PM`}
                  </span>
                </div>
              ))}
              {positioned.map(({ apt, startMin, top, height }) => {
                const style = STATUS_STYLES[apt.status] ?? STATUS_STYLES.confirmed;
                const labelMins = parseTimeToMinutes(apt.time) ?? startMin;
                return (
                  <button
                    key={`tl-${apt.id}`}
                    type="button"
                    onClick={() => onSelectAppointment(apt)}
                    className={`absolute left-16 right-3 overflow-hidden rounded-lg border border-black/5 border-l-4 px-2.5 py-1.5 text-left shadow-sm transition hover:brightness-95 ${style}`}
                    style={{ top, height }}
                    title={`${apt.patientName} · ${formatMinutesClock(labelMins)}`}
                  >
                    <p className="truncate text-xs font-semibold">{apt.patientName}</p>
                    <p className="truncate text-[10px] opacity-80">
                      {formatMinutesClock(labelMins)}
                      {apt.consultType ? ` · ${apt.consultType}` : ''}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default DayAgendaView;
