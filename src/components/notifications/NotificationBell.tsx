import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BellIcon } from '@heroicons/react/24/outline';
import { getDoctorAppointments } from '../../services/appointmentService';
import { Appointment } from '../../types';
import { useAuth } from '../../hooks/useAuth';
import { convertTimestamp } from '../../utils/dateFormatter';

const isSameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

const withinDays = (date: Date, days: number) => {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  return date >= cutoff;
};

const getSafeTimeLabel = (value: unknown): string => {
  if (typeof value === 'string') return value;
  const converted = convertTimestamp(value);
  if (converted) {
    return converted.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  }
  return '10:00 AM';
};

export const NotificationBell: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const panelRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    if (!user?.id) return;
    try {
      const apts = await getDoctorAppointments(user.id);
      setAppointments(apts);
    } catch {

    }
  }, [user?.id]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (open) {
      load();
    }
  }, [open, load]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const today = new Date();
  const todaysApts = appointments.filter((a) => isSameDay(a.date, today));
  const pending = appointments.filter((a) => a.status === 'pending');
  const recentCancellations = appointments.filter(
    (a) => a.status === 'cancelled' && withinDays(a.updatedAt, 2)
  );

  const badgeCount = pending.length + recentCancellations.length;

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => {
          setOpen((v) => {
            const next = !v;
            if (next) {
              void load();
            }
            return next;
          });
        }}
        className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-600 transition-all hover:border-anixi-green/30 hover:text-anixi-green hover:shadow-soft"
        aria-label="Notifications"
      >
        <BellIcon className="h-5 w-5" />
        {badgeCount > 0 && (
          <span className="absolute -top-1 -right-1 h-4 w-4 flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold">
            {badgeCount > 9 ? '9+' : badgeCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-elevated z-50">
          <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
            <h3 className="font-heading text-sm font-semibold text-gray-900">Notifications</h3>
            <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600 text-lg leading-none">×</button>
          </div>

          <div className="max-h-96 overflow-y-auto divide-y divide-gray-100">
            
            <div className="px-4 py-3">
              <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Today's Schedule</p>
              {todaysApts.length === 0 ? (
                <p className="text-sm text-gray-500">No appointments today.</p>
              ) : (
                <>
                  <p className="text-sm font-medium text-gray-700 mb-1">
                    {todaysApts.length} appointment{todaysApts.length !== 1 ? 's' : ''} today
                  </p>
                  <ul className="space-y-1">
                    {todaysApts.slice(0, 5).map((a) => (
                      <li key={a.id} className="text-xs text-gray-600 flex items-center gap-1">
                        <span className="w-14 shrink-0 text-gray-400">{getSafeTimeLabel(a.time)}</span>
                        <span className="truncate">{a.patientName}</span>
                        <span className={`ml-auto shrink-0 text-[10px] px-1 rounded ${
                          a.status === 'confirmed' ? 'bg-green-100 text-green-700' :
                          a.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                          'bg-gray-100 text-gray-600'
                        }`}>{a.status}</span>
                      </li>
                    ))}
                    {todaysApts.length > 5 && (
                      <li className="text-xs text-gray-400">+{todaysApts.length - 5} more</li>
                    )}
                  </ul>
                </>
              )}
            </div>

            
            {pending.length > 0 && (
              <div className="px-4 py-3">
                <p className="text-xs font-semibold text-yellow-700 uppercase mb-2">
                  ⏳ New Booking Requests ({pending.length})
                </p>
                <ul className="space-y-1">
                  {pending.slice(0, 4).map((a) => {
                    const dateObj = convertTimestamp(a.date) || a.date as Date;
                    return (
                      <li key={a.id} className="text-xs text-gray-700 flex items-center justify-between gap-2">
                        <span className="truncate">{a.patientName}</span>
                        <span className="text-gray-400 shrink-0">
                          {dateObj instanceof Date ? dateObj.toLocaleDateString('en-ZA', { month: 'short', day: 'numeric' }) : 'N/A'} {getSafeTimeLabel(a.time)}
                        </span>
                      </li>
                    );
                  })}
                </ul>
                <button
                  onClick={() => { navigate('/appointments'); setOpen(false); }}
                  className="mt-2 text-xs text-blue-600 hover:underline"
                >
                  View all →
                </button>
              </div>
            )}

            
            {recentCancellations.length > 0 && (
              <div className="px-4 py-3">
                <p className="text-xs font-semibold text-red-600 uppercase mb-2">
                  ❌ Recent Cancellations
                </p>
                <ul className="space-y-1">
                  {recentCancellations.slice(0, 3).map((a) => {
                    const dateObj = convertTimestamp(a.date) || a.date as Date;
                    return (
                      <li key={a.id} className="text-xs text-gray-700 truncate">
                        {a.patientName} -{' '}
                        {dateObj instanceof Date ? dateObj.toLocaleDateString('en-ZA', { month: 'short', day: 'numeric' }) : 'N/A'}
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            {badgeCount === 0 && todaysApts.length === 0 && (
              <div className="px-4 py-6 text-center text-sm text-gray-400">
                All clear - nothing to action.
              </div>
            )}
          </div>

          <div className="px-4 py-2 bg-gray-50 border-t border-gray-100">
            <button
              onClick={() => { navigate('/appointments'); setOpen(false); }}
              className="text-xs text-gray-500 hover:text-gray-700 hover:underline w-full text-center"
            >
              Go to Appointments
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
