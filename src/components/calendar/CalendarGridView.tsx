import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Appointment, SoftBlock } from '../../types';
import { useAuth } from '../../hooks/AuthContext';
import { usePermissions } from '../../hooks/usePermissions';
import { getDoctorAppointments } from '../../services/appointmentService';
import { getSoftBlocks, createBookableBlock, deleteSoftBlock } from '../../services/practiceSettingsService';
import { AppointmentDetails } from '../appointments/AppointmentDetails';
import { CreateAppointmentModal } from '../appointments/CreateAppointmentModal';


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

const toMinutes = (h: number, m: number) => h * 60 + m;
const minToTop = (min: number, startHour: number) => ((min - startHour * 60) / 60) * ROW_HEIGHT;

const ROW_HEIGHT = 64; 
const DAY_START_HOUR = 7;
const DAY_END_HOUR = 20;
const VISIBLE_HOURS = DAY_END_HOUR - DAY_START_HOUR;

const STATUS_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  confirmed: { bg: 'bg-green-100', border: 'border-green-400', text: 'text-green-800' },
  pending: { bg: 'bg-yellow-100', border: 'border-yellow-400', text: 'text-yellow-800' },
  completed: { bg: 'bg-gray-100', border: 'border-gray-400', text: 'text-gray-700' },
  cancelled: { bg: 'bg-red-100', border: 'border-red-300', text: 'text-red-700' },
  no_show: { bg: 'bg-orange-100', border: 'border-orange-400', text: 'text-orange-700' },
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
}

export const CalendarGridView: React.FC<CalendarGridViewProps> = ({
  onStatusChange,
  showCreateButton = true,
  showLegend = true,
}) => {
  const { user, practiceSession } = useAuth();
  const { can } = usePermissions();
  const navigate = useNavigate();

  const [weekStart, setWeekStart] = useState<Date>(() => startOfWeek(new Date()));
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [softBlocks, setSoftBlocks] = useState<SoftBlock[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [convertingBlock, setConvertingBlock] = useState<string | null>(null);

  const weekEnd = addDays(weekStart, 6);
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const hours = Array.from({ length: VISIBLE_HOURS }, (_, i) => DAY_START_HOUR + i);

  const practiceId = practiceSession?.practice?.id;

  const load = useCallback(async () => {
    if (!user?.id) return;
    setIsLoading(true);
    try {
      const [apts, blocks] = await Promise.all([
        getDoctorAppointments(user.id),
        practiceId
          ? getSoftBlocks(practiceId, weekStart, addDays(weekEnd, 1))
          : Promise.resolve([] as SoftBlock[]),
      ]);
      setAppointments(apts);
      setSoftBlocks(blocks);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, practiceId, weekStart]);

  useEffect(() => { load(); }, [load]);


  const getEventStyle = (start: Date, end: Date): React.CSSProperties => {
    const startMin = toMinutes(start.getHours(), start.getMinutes());
    const endMin = toMinutes(end.getHours(), end.getMinutes());
    const top = minToTop(Math.max(startMin, DAY_START_HOUR * 60), DAY_START_HOUR);
    const height = Math.max(((endMin - startMin) / 60) * ROW_HEIGHT, ROW_HEIGHT / 2);
    return { position: 'absolute', top, height, left: 2, right: 2 };
  };


  const handleConvertSoftBlock = async (block: SoftBlock) => {
    if (!practiceId || !user?.id) return;
    if (!can('manageSoftBlocks')) return;
    setConvertingBlock(block.id);
    try {
      const durationMin =
        (block.endAt.getTime() - block.startAt.getTime()) / 60_000;
      const pad = (n: number) => n.toString().padStart(2, '0');
      const startHH = `${pad(block.startAt.getHours())}:${pad(block.startAt.getMinutes())}`;
      const endHH = `${pad(block.endAt.getHours())}:${pad(block.endAt.getMinutes())}`;

      await createBookableBlock(practiceId, {
        practiceId,
        doctorId: user.id,
        dayOfWeek: block.startAt.getDay() as any,
        startTime: startHH,
        endTime: endHH,
        locationId: practiceSession?.practice?.locations?.[0]?.id ?? '',
        allowedConsultTypes: ['initial', 'follow-up', 'urgent', 'other'],
        slotDurationMinutes: Math.min(durationMin, 30),
        bufferBeforeMinutes: 0,
        bufferAfterMinutes: 0,
        active: true,
      });

      await deleteSoftBlock(practiceId, block.id);
      await load();
    } catch {

    } finally {
      setConvertingBlock(null);
    }
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
    setAppointments((prev) =>
      prev.map((a) => (a.id === id ? { ...a, status } : a))
    );
    setSelectedAppointment(null);
    onStatusChange?.(id, status);
  };


  const todayStr = new Date().toDateString();

  return (
    <div className="flex flex-col h-full">
      
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setWeekStart((w) => addDays(w, -7))}
            className="px-4 py-2 rounded-2xl border border-[#E4EAF2] bg-white hover:bg-[#FBFCFD] text-sm font-semibold text-[#0E2340]"
          >
            ← Prev
          </button>
          <button
            onClick={() => setWeekStart(startOfWeek(new Date()))}
            className="px-4 py-2 rounded-2xl border border-[#E4EAF2] bg-white hover:bg-[#FBFCFD] text-sm font-semibold text-[#0E2340]"
          >
            Today
          </button>
          <button
            onClick={() => setWeekStart((w) => addDays(w, 7))}
            className="px-4 py-2 rounded-2xl border border-[#E4EAF2] bg-white hover:bg-[#FBFCFD] text-sm font-semibold text-[#0E2340]"
          >
            Next →
          </button>
          <span className="text-sm font-semibold text-[#6F7F95] ml-2">
            {weekStart.toLocaleDateString('en-ZA', { month: 'long', year: 'numeric' })}
          </span>
        </div>

        {can('manageAppointments') && showCreateButton && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-5 py-3 rounded-2xl text-white text-sm font-semibold shadow-lg shadow-[#1F2C45]/20 transition-colors"
            style={{ backgroundColor: '#1F2C45' }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#172238')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#1F2C45')}
          >
            + Add Schedule Entry
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <p className="text-[#8FA0B6] text-sm">Loading calendar…</p>
        </div>
      ) : (
        <div className="overflow-auto rounded-[30px] border border-[#E2E8F0] bg-white shadow-sm">
          
          <div className="grid sticky top-0 z-10 bg-white border-b border-[#E9EEF4]" style={{ gridTemplateColumns: '56px repeat(7, 1fr)' }}>
            <div className="text-xs text-[#C0CAD8] p-2" />
            {days.map((day) => {
              const isToday = day.toDateString() === todayStr;
              return (
                <div
                  key={day.toISOString()}
                  className={`text-center py-3 text-xs font-semibold border-l border-[#F1F4F8] ${isToday ? 'text-[#425950]' : 'text-[#6F7F95]'}`}
                >
                  <div>{day.toLocaleDateString('en-ZA', { weekday: 'short' })}</div>
                  <div className={`mx-auto w-8 h-8 flex items-center justify-center rounded-full mt-1 ${isToday ? 'bg-[#0FA968] text-white' : ''}`}>
                    {day.getDate()}
                  </div>
                </div>
              );
            })}
          </div>

          
          <div
            className="grid"
            style={{ gridTemplateColumns: '56px repeat(7, 1fr)', height: `${VISIBLE_HOURS * ROW_HEIGHT}px`, position: 'relative' }}
          >
            
            <div className="relative">
              {hours.map((h) => (
                <div
                  key={h}
                  className="absolute w-full text-right pr-2 text-xs text-gray-400"
                  style={{ top: (h - DAY_START_HOUR) * ROW_HEIGHT - 8 }}
                >
                  {h === 12 ? '12 PM' : h < 12 ? `${h} AM` : `${h - 12} PM`}
                </div>
              ))}
            </div>

            
            {days.map((day) => {
              const dayApts = appointments.filter((a) => isSameDay(a.date, day));
              const daySoftBlocks = softBlocks.filter((b) => isSameDay(b.startAt, day));

              return (
                <div
                  key={day.toISOString()}
                  className="relative border-l border-[#F1F4F8]"
                  style={{ height: `${VISIBLE_HOURS * ROW_HEIGHT}px` }}
                >
                  
                  {hours.map((h) => (
                    <div
                      key={h}
                      className="absolute w-full border-t border-[#F1F4F8]"
                      style={{ top: (h - DAY_START_HOUR) * ROW_HEIGHT }}
                    />
                  ))}

                  
                  {daySoftBlocks.map((block) => {
                    const style = getEventStyle(block.startAt, block.endAt);
                    const colorClass = SOFT_BLOCK_COLORS[block.category] ?? SOFT_BLOCK_COLORS.other;
                    const canConvert = can('manageSoftBlocks');
                    return (
                      <div
                        key={block.id}
                        className={`absolute rounded border text-xs px-1 py-0.5 flex flex-col justify-between overflow-hidden ${colorClass}`}
                        style={{ ...style, opacity: 0.85 }}
                      >
                        <span className="font-medium truncate">{block.title}</span>
                        <span className="uppercase text-[10px] opacity-70">{block.category.replace('_', ' ')}</span>
                        {canConvert && (
                          <button
                            onClick={() => handleConvertSoftBlock(block)}
                            disabled={convertingBlock === block.id}
                            className="mt-1 text-[10px] underline opacity-80 hover:opacity-100 text-left"
                          >
                            {convertingBlock === block.id ? 'Converting…' : '→ Make Bookable'}
                          </button>
                        )}
                      </div>
                    );
                  })}

                  
                  {dayApts.map((apt) => {
                    const aptStart = apt.startAt ?? apt.date;
                    const aptEnd = apt.endAt ?? addDays(aptStart, 0); 
                    if (!apt.endAt) aptEnd.setMinutes(aptEnd.getMinutes() + 30);
                    const style = getEventStyle(aptStart, aptEnd);
                    const colors = STATUS_COLORS[apt.status] ?? STATUS_COLORS.confirmed;
                    const isAnixiPatient = !apt.isManual && apt.patientId && apt.patientId !== 'unknown';
                    return (
                      <div
                        key={apt.id}
                        onClick={() => handleAppointmentClick(apt)}
                        className={`absolute rounded border-l-4 cursor-pointer text-xs px-1 py-0.5 overflow-hidden hover:brightness-95 transition-all ${colors.bg} ${colors.border} ${colors.text}`}
                        style={{ ...style, borderLeftWidth: 4 }}
                        title={`${apt.patientName} • ${apt.status}${apt.isManual ? ' (manual)' : ''}`}
                      >
                        <p className="font-semibold truncate">{apt.patientName}</p>
                        <p className="opacity-70 truncate">{apt.time}</p>
                        {isAnixiPatient && (
                          <span className="text-[10px] opacity-60">→ Profile</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>

          {showLegend && (
            <div className="flex flex-wrap gap-3 px-4 py-4 border-t border-[#E9EEF4] text-xs text-[#6F7F95]">
              <span className="font-semibold">Status:</span>
              {Object.entries(STATUS_COLORS).map(([s, c]) => (
                <span key={s} className={`px-2 py-0.5 rounded border ${c.bg} ${c.border} ${c.text}`}>
                  {s.replace('_', '-')}
                </span>
              ))}
              <span className="font-semibold ml-4">Blocks:</span>
              {Object.entries(SOFT_BLOCK_COLORS).map(([cat, cls]) => (
                <span key={cat} className={`px-2 py-0.5 rounded border ${cls}`}>
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
