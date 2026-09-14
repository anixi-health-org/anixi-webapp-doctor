import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { PageHeader, PageShell } from '../../components/page-layout';
import { useAuth } from '../../hooks/AuthContext';
import { usePermissions } from '../../hooks/usePermissions';
import { getPracticeWideAppointments } from '../../services/appointmentService';
import { activeRooms } from '../../services/roomService';
import {
  arrivalStatusLabel,
  isTodayAppointment,
  updateAppointmentArrivalStatus,
  updateAppointmentRoom,
  type ArrivalStatus,
} from '../../services/queueService';
import type { Appointment } from '../../types';

const ACTIVE_STATUSES = new Set(['pending', 'confirmed', 'rescheduled']);

export const ClinicAdminQueuePage: React.FC = () => {
  const { user, practiceSession } = useAuth();
  const { can } = usePermissions();
  const practice = practiceSession?.practice;
  const practiceId = practice?.id;
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canManage = can('manageAppointments');
  const rooms = useMemo(() => activeRooms(practice), [practice]);

  const auditContext = useMemo(
    () => ({
      practiceId,
      actorUid: user?.id,
      actorName: user?.displayName,
    }),
    [practiceId, user?.displayName, user?.id],
  );

  const load = useCallback(async () => {
    if (!practiceId) return;
    setLoading(true);
    setError(null);
    try {
      const tz = practice?.timezone || 'Africa/Johannesburg';
      const today = new Intl.DateTimeFormat('en-CA', {
        timeZone: tz,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(new Date());
      const rows = await getPracticeWideAppointments(practiceId, {
        fromDate: today,
        toDate: today,
      });
      setAppointments(rows);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load the queue');
    } finally {
      setLoading(false);
    }
  }, [practiceId, practice?.timezone]);

  useEffect(() => {
    void load();
  }, [load]);

  const queue = useMemo(() => {
    return appointments
      .filter(
        (a) =>
          isTodayAppointment(a) &&
          ACTIVE_STATUSES.has(a.status) &&
          (a.arrivalStatus || 'expected') !== 'completed',
      )
      .sort((a, b) => {
        const aTime = (a.scheduledAt || a.date)?.getTime?.() ?? 0;
        const bTime = (b.scheduledAt || b.date)?.getTime?.() ?? 0;
        return aTime - bTime;
      });
  }, [appointments]);

  const setArrival = async (appointmentId: string, status: ArrivalStatus) => {
    if (!canManage) return;
    setUpdatingId(appointmentId);
    try {
      await updateAppointmentArrivalStatus(appointmentId, status, user?.id, auditContext);
      setAppointments((current) =>
        current.map((row) =>
          row.id === appointmentId ? { ...row, arrivalStatus: status } : row,
        ),
      );
    } finally {
      setUpdatingId(null);
    }
  };

  const setRoom = async (appointmentId: string, roomId: string) => {
    if (!canManage) return;
    setUpdatingId(appointmentId);
    const room = rooms.find((r) => r.id === roomId);
    try {
      await updateAppointmentRoom(appointmentId, roomId || null, {
        ...auditContext,
        roomName: room?.name,
      });
      setError(null);
      setAppointments((current) =>
        current.map((row) =>
          row.id === appointmentId ? { ...row, roomId: roomId || undefined } : row,
        ),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not assign that room');
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <PageShell maxWidth="wide" className="py-6 sm:py-8">
      <PageHeader
        title="Front desk queue"
        description="Check patients in, assign rooms, and track who is waiting for today's appointments."
      />

      {error ? (
        <p className="mt-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="mt-6 text-sm text-[#65758b]">Loading queue…</p>
      ) : queue.length === 0 ? (
        <p className="mt-6 text-sm text-[#65758b]">No active appointments for today.</p>
      ) : (
        <div className="mt-8 overflow-hidden rounded-2xl border border-[#e1e7ef] bg-white">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-[#fafcfb] text-xs font-semibold uppercase tracking-wide text-[#65758b]">
              <tr>
                <th className="px-4 py-3">Time</th>
                <th className="px-4 py-3">Patient</th>
                <th className="px-4 py-3">Doctor</th>
                <th className="px-4 py-3">Room</th>
                <th className="px-4 py-3">Arrival</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#eef2f6]">
              {queue.map((appointment) => (
                <tr key={appointment.id}>
                  <td className="px-4 py-3">{appointment.time}</td>
                  <td className="px-4 py-3">{appointment.patientName}</td>
                  <td className="px-4 py-3">{appointment.doctorName || 'Clinician'}</td>
                  <td className="px-4 py-3">
                    {canManage && rooms.length > 0 ? (
                      <select
                        value={appointment.roomId ?? ''}
                        disabled={updatingId === appointment.id}
                        onChange={(e) => void setRoom(appointment.id, e.target.value)}
                        className="rounded-lg border border-[#e1e7ef] px-2 py-1 text-xs"
                      >
                        <option value="">Unassigned</option>
                        {rooms.map((room) => (
                          <option key={room.id} value={room.id}>
                            {room.name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="text-xs text-[#65758b]">
                        {rooms.find((r) => r.id === appointment.roomId)?.name ?? '-'}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {arrivalStatusLabel(appointment.arrivalStatus)}
                  </td>
                  <td className="px-4 py-3">
                    {canManage ? (
                      <div className="flex flex-wrap gap-2">
                        {(appointment.arrivalStatus || 'expected') === 'expected' ? (
                          <button
                            type="button"
                            disabled={updatingId === appointment.id}
                            onClick={() => void setArrival(appointment.id, 'checked_in')}
                            className="rounded-lg bg-[#1a4d4d] px-3 py-1 text-xs font-semibold text-white"
                          >
                            Check in
                          </button>
                        ) : null}
                        {appointment.arrivalStatus === 'checked_in' ? (
                          <button
                            type="button"
                            disabled={updatingId === appointment.id}
                            onClick={() => void setArrival(appointment.id, 'with_doctor')}
                            className="rounded-lg border border-[#e1e7ef] px-3 py-1 text-xs font-semibold"
                          >
                            With doctor
                          </button>
                        ) : null}
                        {appointment.arrivalStatus === 'with_doctor' ? (
                          <button
                            type="button"
                            disabled={updatingId === appointment.id}
                            onClick={() => void setArrival(appointment.id, 'completed')}
                            className="rounded-lg border border-[#e1e7ef] px-3 py-1 text-xs font-semibold"
                          >
                            Complete
                          </button>
                        ) : null}
                      </div>
                    ) : (
                      <span className="text-xs text-[#65758b]">View only</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </PageShell>
  );
};

export default ClinicAdminQueuePage;
