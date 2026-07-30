import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Appointment, SoftBlock, BookableBlock } from '../../types';
import { useAuth } from '../../hooks/AuthContext';
import { usePermissions } from '../../hooks/usePermissions';
import { getDoctorAppointments } from '../../services/appointmentService';
import { getSoftBlocks, getBookableBlocks } from '../../services/practiceSettingsService';
import { AppointmentDetails } from '../appointments/AppointmentDetails';
import { CreateAppointmentModal } from '../appointments/CreateAppointmentModal';
import { CalendarPageSkeleton } from '../ui/Skeleton';
import { appointmentOnDate, parseTimeToMinutes, toDateKey } from './calendarDateUtils';

const isSameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

const startOfWeek = (date: Date): Date => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
};

const addDays = (date: Date, days: number): Date => {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
};

const ROW_HEIGHT = 64;
const DAY_START_HOUR = 7;
const DAY_END_HOUR = 20;
const VISIBLE_HOURS = DAY_END_HOUR - DAY_START_HOUR;
const DEFAULT_DURATION_MIN = 30;

const toMinutes = (h: number, m: number) => h * 60 + m;
const minToTop = (min: number) => ((min - DAY_START_HOUR * 60) / 60) * ROW_HEIGHT;

/**
 * Parse appointment time labels into minutes-from-midnight.
 * Prefer this over Date#getHours() so the grid matches the displayed time
 * even when startAt has drifted due to timezone / UTC storage.
 */
const parseLocalTimeToMinutes = parseTimeToMinutes;

const appointmentStartMinutes = (apt: Appointment): number => {
  const fromLabel = parseLocalTimeToMinutes(apt.time);
  if (fromLabel != null) return fromLabel;
  const source = apt.startAt ?? apt.date;
  return toMinutes(source.getHours(), source.getMinutes());
};

const appointmentEndMinutes = (apt: Appointment, startMin: number): number => {
  if (apt.startAt && apt.endAt) {
    const duration = Math.round((apt.endAt.getTime() - apt.startAt.getTime()) / 60_000);
    if (duration > 0 && duration < 24 * 60) {
      return startMin + duration;
    }
  }
  return startMin + DEFAULT_DURATION_MIN;
};

const getEventStyleFromMinutes = (startMin: number, endMin: number): React.CSSProperties => {
  const clampedStart = Math.max(startMin, DAY_START_HOUR * 60);
  const clampedEnd = Math.max(endMin, clampedStart + 15);
  const top = minToTop(clampedStart);
  const height = Math.max(((clampedEnd - clampedStart) / 60) * ROW_HEIGHT, ROW_HEIGHT / 2);
  return { position: 'absolute', top, height, left: 2, right: 2 };
};

const STATUS_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  confirmed: { bg: 'bg-emerald-50', border: 'border-emerald-400', text: 'text-emerald-800' },
  pending: { bg: 'bg-amber-50', border: 'border-amber-400', text: 'text-amber-800' },
  completed: { bg: 'bg-slate-100', border: 'border-slate-400', text: 'text-slate-700' },
  cancelled: { bg: 'bg-red-50', border: 'border-red-300', text: 'text-red-700' },
  no_show: { bg: 'bg-orange-50', border: 'border-orange-400', text: 'text-orange-700' },
};

const SOFT_BLOCK_COLORS: Record<string, string> = {
  surgery: 'bg-red-50 border-red-300 text-red-700',
  hospital_rounds: 'bg-purple-50 border-purple-300 text-purple-700',
  admin: 'bg-blue-50 border-blue-300 text-blue-700',
  buffer: 'bg-gray-100 border-gray-300 text-gray-600',
  on_call: 'bg-indigo-50 border-indigo-300 text-indigo-700',
  other: 'bg-slate-50 border-slate-300 text-slate-600',
};

interface CalendarGridViewProps {
  onStatusChange?: (appointmentId: string, newStatus: Appointment['status']) => void;
  showCreateButton?: boolean;
  showLegend?: boolean;
  /** YYYY-MM-DD — keeps the week grid aligned with the mini-calendar selection */
  focusDate?: string;
  /** Bump to force a reload after external creates/edits */
  reloadToken?: number;
}

export const CalendarGridView: React.FC<CalendarGridViewProps> = ({
  onStatusChange,
  showCreateButton = true,
  showLegend = true,
  focusDate,
  reloadToken = 0,
}) => {
  const { user, practiceSession } = useAuth();
  const { can } = usePermissions();
  const navigate = useNavigate();

  const [weekStart, setWeekStart] = useState<Date>(() => {
    if (focusDate) {
      const [y, m, d] = focusDate.split('-').map(Number);
      if (y && m && d) return startOfWeek(new Date(y, m - 1, d));
    }
    return startOfWeek(new Date());
  });
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [softBlocks, setSoftBlocks] = useState<SoftBlock[]>([]);
  const [clinicHours, setClinicHours] = useState<BookableBlock[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const hours = Array.from({ length: VISIBLE_HOURS }, (_, i) => DAY_START_HOUR + i);

  const practiceId = practiceSession?.practice?.id;

  const getLocationName = (locationId?: string): string | null => {
    if (!locationId) return null;
    return (practiceSession?.practice?.locations ?? []).find((l) => l.id === locationId)?.name ?? null;
  };

  const load = useCallback(async () => {
    if (!user?.id) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const weekEnd = addDays(weekStart, 6);
      const [apts, blocks, hours] = await Promise.all([
        getDoctorAppointments(user.id),
        practiceId
          ? getSoftBlocks(practiceId, weekStart, addDays(weekEnd, 1))
          : Promise.resolve([] as SoftBlock[]),
        practiceId
          ? getBookableBlocks(practiceId)
          : Promise.resolve([] as BookableBlock[]),
      ]);
      setAppointments(apts);
      setSoftBlocks(blocks.filter((b) => b.doctorId === user.id));
      setClinicHours(hours.filter((b) => b.doctorId === user.id && b.active !== false));
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, practiceId, weekStart]);

  useEffect(() => {
    void load();
  }, [load, reloadToken]);

  useEffect(() => {
    if (!focusDate) return;
    const [y, m, d] = focusDate.split('-').map(Number);
    if (!y || !m || !d) return;
    const focused = startOfWeek(new Date(y, m - 1, d));
    setWeekStart((prev) => (prev.getTime() === focused.getTime() ? prev : focused));
  }, [focusDate]);

  const getSoftBlockStyle = (start: Date, end: Date): React.CSSProperties => {
    const startMin = toMinutes(start.getHours(), start.getMinutes());
    const endMin = toMinutes(end.getHours(), end.getMinutes());
    return getEventStyleFromMinutes(startMin, endMin);
  };

  const clinicWindowsForDay = (day: Date) => {
    const dow = day.getDay() as 0 | 1 | 2 | 3 | 4 | 5 | 6;
    return clinicHours
      .filter((b) => b.dayOfWeek === dow)
      .map((b) => {
        const [sh, sm] = b.startTime.split(':').map(Number);
        const [eh, em] = b.endTime.split(':').map(Number);
        return { start: toMinutes(sh || 0, sm || 0), end: toMinutes(eh || 0, em || 0) };
      })
      .filter((w) => w.end > w.start);
  };

  /** Outside clinic hours — shaded like non-working time on Google Calendar. */
  const outsideClinicRanges = (day: Date): { start: number; end: number }[] => {
    const windows = clinicWindowsForDay(day).sort((a, b) => a.start - b.start);
    const dayStart = DAY_START_HOUR * 60;
    const dayEnd = DAY_END_HOUR * 60;
    if (windows.length === 0) {
      return [{ start: dayStart, end: dayEnd }];
    }
    const ranges: { start: number; end: number }[] = [];
    let cursor = dayStart;
    for (const w of windows) {
      if (w.start > cursor) ranges.push({ start: cursor, end: Math.min(w.start, dayEnd) });
      cursor = Math.max(cursor, w.end);
    }
    if (cursor < dayEnd) ranges.push({ start: cursor, end: dayEnd });
    return ranges.filter((r) => r.end > r.start);
  };

  const handleAppointmentClick = (apt: Appointment) => {
    const isAnixiPatient = !apt.isManual && apt.patientId && apt.patientId !== 'unknown';
    if (isAnixiPatient) {
      navigate(`/patient-profile/${apt.patientId}`, {
        state: {
          appointmentId: apt.id,
          appointmentTime: apt.time,
          appointmentDate: apt.date ? new Date(apt.date).toLocaleDateString() : undefined,
          consultType: apt.consultType,
          status: apt.status,
        },
      });
    } else {
      setSelectedAppointment(apt);
    }
  };

  const handleStatusChange = (id: string, status: Appointment['status']) => {
    setAppointments((prev) => prev.map((a) => (a.id === id ? { ...a, status } : a)));
    setSelectedAppointment(null);
    onStatusChange?.(id, status);
  };

  const todayStr = new Date().toDateString();

  return (
    <div className="flex h-full flex-col">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setWeekStart((w) => addDays(w, -7))}
            className="rounded-lg border border-[#e1e7ef] bg-white px-3.5 py-2 text-sm font-medium text-[#344256] shadow-sm transition hover:border-[#c5cdd8]"
          >
            ← Prev
          </button>
          <button
            type="button"
            onClick={() => setWeekStart(startOfWeek(new Date()))}
            className="rounded-lg border border-[#e1e7ef] bg-white px-3.5 py-2 text-sm font-medium text-[#344256] shadow-sm transition hover:border-[#c5cdd8]"
          >
            Today
          </button>
          <button
            type="button"
            onClick={() => setWeekStart((w) => addDays(w, 7))}
            className="rounded-lg border border-[#e1e7ef] bg-white px-3.5 py-2 text-sm font-medium text-[#344256] shadow-sm transition hover:border-[#c5cdd8]"
          >
            Next →
          </button>
          <span className="ml-2 text-sm font-semibold text-[#0E2340]">
            {weekStart.toLocaleDateString('en-ZA', { month: 'long', year: 'numeric' })}
          </span>
        </div>

        {can('manageAppointments') && showCreateButton && (
          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="rounded-lg bg-anixi-green px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#365c4f]"
          >
            + Add schedule entry
          </button>
        )}
      </div>

      {isLoading ? (
        <CalendarPageSkeleton />
      ) : (
        <div className="overflow-auto rounded-xl border border-[#e1e7ef] bg-white shadow-sm">
          <div
            className="sticky top-0 z-10 grid border-b border-[#e1e7ef] bg-white"
            style={{ gridTemplateColumns: '56px repeat(7, 1fr)' }}
          >
            <div className="p-2 text-xs text-[#C0CAD8]" />
            {days.map((day) => {
              const isToday = day.toDateString() === todayStr;
              return (
                <div
                  key={day.toISOString()}
                  className={`border-l border-[#eef2f6] py-3 text-center text-xs font-semibold ${
                    isToday ? 'text-anixi-green' : 'text-[#6F7F95]'
                  }`}
                >
                  <div>{day.toLocaleDateString('en-ZA', { weekday: 'short' })}</div>
                  <div
                    className={`mx-auto mt-1 flex h-8 w-8 items-center justify-center rounded-full ${
                      isToday ? 'bg-anixi-green text-white' : 'text-[#0E2340]'
                    }`}
                  >
                    {day.getDate()}
                  </div>
                </div>
              );
            })}
          </div>

          <div
            className="grid"
            style={{
              gridTemplateColumns: '56px repeat(7, 1fr)',
              height: `${VISIBLE_HOURS * ROW_HEIGHT}px`,
              position: 'relative',
            }}
          >
            <div className="relative">
              {hours.map((h) => (
                <div
                  key={h}
                  className="absolute w-full pr-2 text-right text-[11px] text-[#8FA0B6]"
                  style={{ top: (h - DAY_START_HOUR) * ROW_HEIGHT - 8 }}
                >
                  {h === 12 ? '12 PM' : h < 12 ? `${h} AM` : `${h - 12} PM`}
                </div>
              ))}
            </div>

            {days.map((day) => {
              const dayKey = toDateKey(day);
              const dayApts = appointments.filter((a) => appointmentOnDate(a, dayKey));
              const daySoftBlocks = softBlocks.filter((b) => isSameDay(b.startAt, day));
              const unavailable = outsideClinicRanges(day);

              return (
                <div
                  key={day.toISOString()}
                  className="relative border-l border-[#eef2f6]"
                  style={{ height: `${VISIBLE_HOURS * ROW_HEIGHT}px` }}
                >
                  {hours.map((h) => (
                    <div
                      key={h}
                      className="absolute w-full border-t border-[#eef2f6]"
                      style={{ top: (h - DAY_START_HOUR) * ROW_HEIGHT }}
                    />
                  ))}

                  {unavailable.map((range, idx) => (
                    <div
                      key={`off-${idx}`}
                      className="pointer-events-none absolute inset-x-0 bg-[#f1f5f9]/80"
                      style={getEventStyleFromMinutes(range.start, range.end)}
                      title="Outside clinic hours"
                    />
                  ))}

                  {daySoftBlocks.map((block) => {
                    const style = getSoftBlockStyle(block.startAt, block.endAt);
                    const colorClass = SOFT_BLOCK_COLORS[block.category] ?? SOFT_BLOCK_COLORS.other;
                    return (
                      <div
                        key={block.id}
                        className={`absolute flex flex-col justify-center overflow-hidden rounded border px-1 py-0.5 text-xs ${colorClass}`}
                        style={{ ...style, opacity: 0.9 }}
                        title={`${block.title} (blocked — manage in Settings)`}
                      >
                        <span className="truncate font-medium">{block.title}</span>
                        <span className="text-[10px] uppercase opacity-70">
                          {block.category.replace('_', ' ')}
                        </span>
                      </div>
                    );
                  })}

                  {dayApts.map((apt) => {
                    const startMin = appointmentStartMinutes(apt);
                    const endMin = appointmentEndMinutes(apt, startMin);
                    const style = getEventStyleFromMinutes(startMin, endMin);
                    const colors = STATUS_COLORS[apt.status] ?? STATUS_COLORS.confirmed;
                    const isAnixiPatient = !apt.isManual && apt.patientId && apt.patientId !== 'unknown';
                    return (
                      <div
                        key={apt.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => handleAppointmentClick(apt)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') handleAppointmentClick(apt);
                        }}
                        className={`absolute cursor-pointer overflow-hidden rounded-md border-l-4 px-1.5 py-1 text-xs transition hover:brightness-95 ${colors.bg} ${colors.border} ${colors.text}`}
                        style={{ ...style, borderLeftWidth: 4 }}
                        title={`${apt.patientName} · ${apt.time} · ${apt.status}${apt.isManual ? ' (manual)' : ''}`}
                      >
                        <p className="truncate font-semibold">{apt.patientName}</p>
                        <p className="truncate opacity-70">{apt.time}</p>
                        {apt.locationId && getLocationName(apt.locationId) && (
                          <p className="truncate text-[10px] opacity-60">
                            📍 {getLocationName(apt.locationId)}
                          </p>
                        )}
                        {isAnixiPatient && <span className="text-[10px] opacity-60">→ Profile</span>}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>

          {showLegend && (
            <div className="flex flex-wrap gap-3 border-t border-[#e1e7ef] px-4 py-3 text-xs text-[#6F7F95]">
              <span className="font-semibold text-[#0E2340]">Status:</span>
              {Object.entries(STATUS_COLORS).map(([s, c]) => (
                <span key={s} className={`rounded border px-2 py-0.5 ${c.bg} ${c.border} ${c.text}`}>
                  {s.replace('_', '-')}
                </span>
              ))}
              <span className="ml-4 font-semibold text-[#0E2340]">Blocks:</span>
              {Object.entries(SOFT_BLOCK_COLORS).map(([cat, cls]) => (
                <span key={cat} className={`rounded border px-2 py-0.5 ${cls}`}>
                  {cat.replace('_', ' ')}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {selectedAppointment && (
        <AppointmentDetails
          appointment={selectedAppointment}
          onClose={() => setSelectedAppointment(null)}
          onStatusChange={handleStatusChange}
          onReschedule={(id, newDate, newTime) => {
            setAppointments((prev) =>
              prev.map((a) =>
                a.id === id ? { ...a, date: newDate, time: newTime, status: 'confirmed' } : a
              )
            );
            setSelectedAppointment(null);
          }}
        />
      )}

      {showCreateModal && (
        <CreateAppointmentModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onAppointmentCreated={async () => {
            await load();
            setShowCreateModal(false);
          }}
        />
      )}
    </div>
  );
};

export default CalendarGridView;
