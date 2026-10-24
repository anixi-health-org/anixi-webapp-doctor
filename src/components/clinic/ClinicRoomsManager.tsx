import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import clsx from 'clsx';
import {
  ArrowTopRightOnSquareIcon,
  ChartBarIcon,
  MagnifyingGlassIcon,
  UsersIcon,
} from '@heroicons/react/24/outline';
import { BulkRoomImportPanel } from './BulkRoomImportPanel';
import { ClinicSecondaryAction } from './ClinicSecondaryAction';
import { PageHeader } from '../page-layout';
import { DataTablePageSkeleton } from '../ui';
import { ROOM_TYPE_OPTIONS, roomTypeBadgeClass } from '../../lib/roomCatalog';
import { getPracticeWideAppointments } from '../../services/appointmentService';
import { getPracticeDashboardStats } from '../../services/practiceDashboardService';
import { isTodayAppointment } from '../../services/queueService';
import {
  activeRooms,
  addPracticeRoom,
  allPracticeRooms,
  removePracticeRoom,
  roomTypeLabel,
  updatePracticeRoom,
  type PracticeRoomInput,
} from '../../services/roomService';
import type { Practice, PracticeRoom } from '../../types';

type RoomDraft = PracticeRoomInput & { active: boolean };

const EMPTY_DRAFT: RoomDraft = {
  name: '',
  type: 'consult',
  locationId: '',
  capacity: undefined,
  floor: '',
  equipment: '',
  notes: '',
  active: true,
};

type RoomLiveStats = {
  assignmentsToday: number;
  inUse: boolean;
  utilizationToday: number;
};

type Props = {
  practice: Practice;
  canManage: boolean;
  onPracticeUpdated: () => Promise<void>;
};

function locationName(practice: Practice, locationId?: string): string {
  if (!locationId) return 'Any location';
  return practice.locations?.find((l) => l.id === locationId)?.name ?? 'Unknown location';
}

function draftFromRoom(room: PracticeRoom): RoomDraft {
  return {
    name: room.name,
    type: room.type,
    locationId: room.locationId ?? '',
    capacity: room.capacity,
    floor: room.floor ?? '',
    equipment: room.equipment ?? '',
    notes: room.notes ?? '',
    active: room.active !== false,
  };
}

export const ClinicRoomsManager: React.FC<Props> = ({
  practice,
  canManage,
  onPracticeUpdated,
}) => {
  const [saving, setSaving] = useState(false);
  const [csvOpen, setCsvOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<RoomDraft>(EMPTY_DRAFT);
  const [search, setSearch] = useState('');
  const [filterLocation, setFilterLocation] = useState('');
  const [filterType, setFilterType] = useState<PracticeRoom['type'] | ''>('');
  const [showInactive, setShowInactive] = useState(false);
  const [liveLoading, setLiveLoading] = useState(true);
  const [liveByRoom, setLiveByRoom] = useState<Record<string, RoomLiveStats>>({});
  const [error, setError] = useState<string | null>(null);

  const allRooms = useMemo(() => allPracticeRooms(practice), [practice]);
  const activeCount = useMemo(() => activeRooms(practice).length, [practice]);

  const loadLive = useCallback(async () => {
    if (!practice.id) return;
    setLiveLoading(true);
    try {
      const tz = practice.timezone || 'Africa/Johannesburg';
      const today = new Intl.DateTimeFormat('en-CA', {
        timeZone: tz,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(new Date());

      const [dashboard, appointments] = await Promise.all([
        getPracticeDashboardStats(practice.id),
        getPracticeWideAppointments(practice.id, {
          fromDate: today,
          toDate: today,
        }),
      ]);

      const utilization = dashboard.roomUtilizationToday ?? {};
      const todayApts = appointments.filter(isTodayAppointment);
      const next: Record<string, RoomLiveStats> = {};

      for (const room of allRooms) {
        const roomApts = todayApts.filter((a) => a.roomId === room.id);
        const inUse = roomApts.some(
          (a) =>
            a.arrivalStatus === 'checked_in' ||
            a.arrivalStatus === 'with_doctor',
        );
        next[room.id] = {
          assignmentsToday: roomApts.length,
          inUse,
          utilizationToday: utilization[room.id] ?? roomApts.length,
        };
      }
      setLiveByRoom(next);
    } catch (err) {
      console.warn('[ClinicRoomsManager] live stats failed', err);
    } finally {
      setLiveLoading(false);
    }
  }, [allRooms, practice.id, practice.timezone]);

  useEffect(() => {
    void loadLive();
  }, [loadLive]);

  const filteredRooms = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allRooms.filter((room) => {
      if (!showInactive && room.active === false) return false;
      if (filterLocation && room.locationId !== filterLocation) return false;
      if (filterType && room.type !== filterType) return false;
      if (!q) return true;
      const hay = [
        room.name,
        room.floor,
        room.equipment,
        room.notes,
        roomTypeLabel(room.type),
        locationName(practice, room.locationId),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }, [allRooms, filterLocation, filterType, practice, search, showInactive]);

  const typeCounts = useMemo(() => {
    const counts: Record<PracticeRoom['type'], number> = {
      consult: 0,
      procedure: 0,
      virtual: 0,
      other: 0,
    };
    activeRooms(practice).forEach((r) => {
      counts[r.type] += 1;
    });
    return counts;
  }, [practice]);

  const inUseCount = useMemo(
    () => Object.values(liveByRoom).filter((s) => s.inUse).length,
    [liveByRoom],
  );

  const resetForm = () => {
    setEditingId(null);
    setDraft(EMPTY_DRAFT);
    setFormOpen(false);
    setError(null);
  };

  const openCreate = () => {
    setEditingId(null);
    setDraft(EMPTY_DRAFT);
    setFormOpen(true);
  };

  const openEdit = (room: PracticeRoom) => {
    setEditingId(room.id);
    setDraft(draftFromRoom(room));
    setFormOpen(true);
  };

  const persistDraft = async () => {
    if (!draft.name.trim()) {
      setError('Room name is required.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload: PracticeRoomInput = {
        name: draft.name.trim(),
        type: draft.type,
        locationId: draft.locationId || undefined,
        capacity:
          draft.capacity != null && !Number.isNaN(Number(draft.capacity))
            ? Math.max(1, Number(draft.capacity))
            : undefined,
        floor: draft.floor,
        equipment: draft.equipment,
        notes: draft.notes,
      };

      if (editingId) {
        await updatePracticeRoom(practice, editingId, {
          ...payload,
          active: draft.active,
        });
      } else {
        await addPracticeRoom(practice, payload);
      }
      await onPracticeUpdated();
      await loadLive();
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save room');
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (room: PracticeRoom) => {
    setSaving(true);
    setError(null);
    try {
      await updatePracticeRoom(practice, room.id, { active: room.active === false });
      await onPracticeUpdated();
      await loadLive();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update room');
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async (room: PracticeRoom) => {
    if (
      !window.confirm(
        `Permanently remove "${room.name}"? Assignments on today's queue will lose this room link.`,
      )
    ) {
      return;
    }
    setSaving(true);
    try {
      await removePracticeRoom(practice, room.id);
      await onPracticeUpdated();
      await loadLive();
      if (editingId === room.id) resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not remove room');
    } finally {
      setSaving(false);
    }
  };

  const hasRooms = allRooms.length > 0;
  const showCsv = canManage && (csvOpen || !hasRooms);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Rooms & spaces"
        actions={
          <div className="flex flex-wrap gap-2">
            <Link
              to="/clinic/queue"
              className="inline-flex items-center gap-1.5 rounded-full border border-[#e1e7ef] bg-white px-4 py-2 text-sm font-semibold text-[#344256] hover:bg-[#f8fafc]"
            >
              Front desk queue
              <ArrowTopRightOnSquareIcon className="h-4 w-4 text-[#65758b]" />
            </Link>
            <Link
              to="/clinic/reports"
              className="inline-flex items-center gap-1.5 rounded-full border border-[#e1e7ef] bg-white px-4 py-2 text-sm font-semibold text-[#344256] hover:bg-[#f8fafc]"
            >
              Utilization reports
              <ChartBarIcon className="h-4 w-4 text-[#65758b]" />
            </Link>
            {canManage && hasRooms ? (
              <ClinicSecondaryAction
                open={csvOpen}
                onToggle={() => setCsvOpen((o) => !o)}
                revealLabel="Import CSV"
                hideLabel="Hide CSV import"
              />
            ) : null}
            {canManage ? (
              <button
                type="button"
                onClick={openCreate}
                className="rounded-full bg-[#1a4d4d] px-5 py-2 text-sm font-semibold text-white hover:opacity-90"
              >
                Add room
              </button>
            ) : null}
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: 'Active rooms', value: activeCount, hint: `${allRooms.length} total configured` },
          { label: 'In use now', value: liveLoading ? '-' : inUseCount, hint: 'Checked in or with doctor' },
          {
            label: 'Consult rooms',
            value: typeCounts.consult,
            hint: `${typeCounts.procedure} procedure · ${typeCounts.virtual} virtual`,
          },
          {
            label: 'Locations',
            value: practice.locations?.length ?? 0,
            hint: 'Link rooms to a branch for filtering',
          },
        ].map((card) => (
          <div
            key={card.label}
            className="rounded-2xl border border-[#e1e7ef] bg-white p-5 shadow-sm"
          >
            <p className="text-xs font-medium uppercase tracking-wide text-[#94a3b8]">
              {card.label}
            </p>
            <p className="mt-1 font-heading text-2xl font-bold tabular-nums text-[#344256]">
              {card.value}
            </p>
            <p className="mt-1 text-xs text-[#65758b]">{card.hint}</p>
          </div>
        ))}
      </div>

      {error ? (
        <p className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      {canManage && formOpen ? (
        <div className="rounded-2xl border border-[#e1e7ef] bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold text-[#344256]">
                {editingId ? 'Edit room' : 'New room'}
              </h3>
              <p className="mt-1 text-sm text-[#65758b]">
                {ROOM_TYPE_OPTIONS.find((o) => o.value === draft.type)?.description}
              </p>
            </div>
            <button
              type="button"
              onClick={resetForm}
              className="text-sm font-semibold text-[#65758b] hover:text-[#344256]"
            >
              Cancel
            </button>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="block md:col-span-2">
              <span className="text-xs font-medium text-[#65758b]">Room name *</span>
              <input
                value={draft.name}
                onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                placeholder="e.g. Surgery Room 1"
                className="mt-1 w-full rounded-xl border border-[#e1e7ef] px-3 py-2.5 text-sm"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-[#65758b]">Type</span>
              <select
                value={draft.type}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, type: e.target.value as PracticeRoom['type'] }))
                }
                className="mt-1 w-full rounded-xl border border-[#e1e7ef] px-3 py-2.5 text-sm"
              >
                {ROOM_TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-medium text-[#65758b]">Location</span>
              <select
                value={draft.locationId ?? ''}
                onChange={(e) => setDraft((d) => ({ ...d, locationId: e.target.value }))}
                className="mt-1 w-full rounded-xl border border-[#e1e7ef] px-3 py-2.5 text-sm"
              >
                <option value="">Any location / clinic-wide</option>
                {(practice.locations ?? []).map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-medium text-[#65758b]">Floor / wing</span>
              <input
                value={draft.floor ?? ''}
                onChange={(e) => setDraft((d) => ({ ...d, floor: e.target.value }))}
                placeholder="Ground floor, Wing B"
                className="mt-1 w-full rounded-xl border border-[#e1e7ef] px-3 py-2.5 text-sm"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-[#65758b]">Capacity (people)</span>
              <input
                type="number"
                min={1}
                value={draft.capacity ?? ''}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    capacity: e.target.value ? Number(e.target.value) : undefined,
                  }))
                }
                placeholder="1"
                className="mt-1 w-full rounded-xl border border-[#e1e7ef] px-3 py-2.5 text-sm"
              />
            </label>
            <label className="block md:col-span-2">
              <span className="text-xs font-medium text-[#65758b]">Equipment & features</span>
              <input
                value={draft.equipment ?? ''}
                onChange={(e) => setDraft((d) => ({ ...d, equipment: e.target.value }))}
                placeholder="Exam bed, ECG, oxygen"
                className="mt-1 w-full rounded-xl border border-[#e1e7ef] px-3 py-2.5 text-sm"
              />
            </label>
            <label className="block md:col-span-2">
              <span className="text-xs font-medium text-[#65758b]">Internal notes</span>
              <textarea
                value={draft.notes ?? ''}
                onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))}
                rows={3}
                placeholder="Access codes, cleaning schedule, booking restrictions…"
                className="mt-1 w-full rounded-xl border border-[#e1e7ef] px-3 py-2.5 text-sm"
              />
            </label>
            {editingId ? (
              <label className="flex items-center gap-2 md:col-span-2">
                <input
                  type="checkbox"
                  checked={draft.active}
                  onChange={(e) => setDraft((d) => ({ ...d, active: e.target.checked }))}
                  className="rounded border-[#e1e7ef]"
                />
                <span className="text-sm text-[#344256]">Room is active for scheduling</span>
              </label>
            ) : null}
          </div>
          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="button"
              disabled={saving}
              onClick={() => void persistDraft()}
              className="rounded-full bg-[#1a4d4d] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
            >
              {saving ? 'Saving…' : editingId ? 'Save changes' : 'Create room'}
            </button>
          </div>
        </div>
      ) : null}

      {showCsv && canManage ? (
        <BulkRoomImportPanel practice={practice} onComplete={() => void onPracticeUpdated()} />
      ) : null}

      <div className="flex flex-col gap-3 rounded-2xl border border-[#e1e7ef] bg-white p-4 shadow-sm sm:flex-row sm:flex-wrap sm:items-center">
        <div className="relative min-w-[200px] flex-1">
          <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94a3b8]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search rooms, equipment, notes…"
            className="w-full rounded-xl border border-[#e1e7ef] py-2.5 pl-9 pr-3 text-sm"
          />
        </div>
        <select
          value={filterLocation}
          onChange={(e) => setFilterLocation(e.target.value)}
          className="rounded-xl border border-[#e1e7ef] px-3 py-2.5 text-sm"
        >
          <option value="">All locations</option>
          {(practice.locations ?? []).map((loc) => (
            <option key={loc.id} value={loc.id}>
              {loc.name}
            </option>
          ))}
        </select>
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value as PracticeRoom['type'] | '')}
          className="rounded-xl border border-[#e1e7ef] px-3 py-2.5 text-sm"
        >
          <option value="">All types</option>
          {ROOM_TYPE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm text-[#65758b]">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={(e) => setShowInactive(e.target.checked)}
            className="rounded border-[#e1e7ef]"
          />
          Show inactive
        </label>
      </div>

      {liveLoading && !hasRooms ? (
        <DataTablePageSkeleton columns={7} rows={4} withToolbar={false} />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-[#e1e7ef] bg-white shadow-sm">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-[#fafcfb] text-xs font-semibold uppercase tracking-wide text-[#65758b]">
              <tr>
                <th className="px-4 py-3">Room</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Location</th>
                <th className="px-4 py-3">Capacity</th>
                <th className="px-4 py-3">Today</th>
                <th className="px-4 py-3">Status</th>
                {canManage ? <th className="px-4 py-3 text-right">Actions</th> : null}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#eef2f6]">
              {filteredRooms.map((room) => {
                const live = liveByRoom[room.id];
                const inactive = room.active === false;
                return (
                  <tr key={room.id} className={clsx(inactive && 'bg-[#fafcfb] opacity-80')}>
                    <td className="px-4 py-3">
                      <p className="font-medium text-[#344256]">{room.name}</p>
                      {room.floor ? (
                        <p className="mt-0.5 text-xs text-[#94a3b8]">{room.floor}</p>
                      ) : null}
                      {room.equipment ? (
                        <p className="mt-0.5 text-xs text-[#65758b]">{room.equipment}</p>
                      ) : null}
                      {room.notes && canManage ? (
                        <p className="mt-1 line-clamp-2 text-xs italic text-[#94a3b8]">
                          {room.notes}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={clsx(
                          'inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset',
                          roomTypeBadgeClass(room.type),
                        )}
                      >
                        {roomTypeLabel(room.type)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[#65758b]">
                      {locationName(practice, room.locationId)}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-[#65758b]">
                      {room.capacity ?? '-'}
                    </td>
                    <td className="px-4 py-3">
                      {liveLoading ? (
                        <span className="text-[#94a3b8]">…</span>
                      ) : (
                        <div className="space-y-1">
                          <p className="tabular-nums text-[#344256]">
                            {live?.assignmentsToday ?? 0} assignment
                            {(live?.assignmentsToday ?? 0) === 1 ? '' : 's'}
                          </p>
                          {live?.inUse ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
                              <UsersIcon className="h-3 w-3" />
                              In use
                            </span>
                          ) : (
                            <span className="text-[11px] text-[#94a3b8]">Available</span>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {inactive ? (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                          Inactive
                        </span>
                      ) : (
                        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                          Active
                        </span>
                      )}
                    </td>
                    {canManage ? (
                      <td className="px-4 py-3 text-right">
                        <div className="flex flex-wrap justify-end gap-2">
                          <button
                            type="button"
                            disabled={saving}
                            onClick={() => openEdit(room)}
                            className="text-xs font-semibold text-anixi-green hover:underline"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            disabled={saving}
                            onClick={() => void toggleActive(room)}
                            className="text-xs font-semibold text-[#65758b] hover:underline"
                          >
                            {inactive ? 'Activate' : 'Deactivate'}
                          </button>
                          <button
                            type="button"
                            disabled={saving}
                            onClick={() => void onDelete(room)}
                            className="text-xs font-semibold text-red-600 hover:underline"
                          >
                            Remove
                          </button>
                        </div>
                      </td>
                    ) : null}
                  </tr>
                );
              })}
              {filteredRooms.length === 0 ? (
                <tr>
                  <td
                    colSpan={canManage ? 7 : 6}
                    className="px-4 py-12 text-center text-[#65758b]"
                  >
                    {hasRooms
                      ? 'No rooms match your filters.'
                      : 'No rooms yet. Add one above or import a CSV template.'}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      )}

      <div className="rounded-2xl border border-[#e1e7ef] bg-[#f8fafc] p-5 text-sm text-[#65758b]">
        <p className="font-semibold text-[#344256]">How rooms are used</p>
        <ul className="mt-2 list-inside list-disc space-y-1 leading-relaxed">
          <li>Front desk assigns rooms from today&apos;s queue; inactive rooms are hidden there.</li>
          <li>Reports show utilization counts per room for operational planning.</li>
          <li>
            CSV columns: <code className="text-xs">room_name, type, location, capacity</code>, use
            the import panel to download a template.
          </li>
        </ul>
      </div>
    </div>
  );
};
