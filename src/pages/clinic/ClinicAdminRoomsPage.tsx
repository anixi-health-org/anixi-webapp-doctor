import React, { useState } from 'react';
import { BulkRoomImportPanel } from '../../components/clinic/BulkRoomImportPanel';
import { ClinicSecondaryAction } from '../../components/clinic/ClinicSecondaryAction';
import { PageHeader, PageShell } from '../../components/page-layout';
import { useAuth } from '../../hooks/AuthContext';
import { usePermissions } from '../../hooks/usePermissions';
import {
  activeRooms,
  addPracticeRoom,
  removePracticeRoom,
  roomTypeLabel,
} from '../../services/roomService';
import type { PracticeRoom } from '../../types';

export const ClinicAdminRoomsPage: React.FC = () => {
  const { practiceSession, refreshPracticeSession } = useAuth();
  const { can } = usePermissions();
  const practice = practiceSession?.practice;
  const canManage = can('editBookingPolicies') || can('manageAppointments');

  const [name, setName] = useState('');
  const [type, setType] = useState<PracticeRoom['type']>('consult');
  const [locationId, setLocationId] = useState('');
  const [saving, setSaving] = useState(false);
  const [csvOpen, setCsvOpen] = useState(false);

  const rooms = activeRooms(practice);
  const hasRooms = rooms.length > 0;
  const showCsv = Boolean(canManage && practice && (!hasRooms || csvOpen));

  const onAdd = async () => {
    if (!practice || !name.trim()) return;
    setSaving(true);
    try {
      await addPracticeRoom(practice, {
        name: name.trim(),
        type,
        locationId: locationId || undefined,
      });
      setName('');
      await refreshPracticeSession();
    } finally {
      setSaving(false);
    }
  };

  const onRemove = async (roomId: string) => {
    if (!practice) return;
    setSaving(true);
    try {
      await removePracticeRoom(practice, roomId);
      await refreshPracticeSession();
    } finally {
      setSaving(false);
    }
  };

  return (
    <PageShell maxWidth="wide" className="py-6 sm:py-8">
      <PageHeader
        title="Rooms"
        description={
          hasRooms
            ? 'Rooms used for front-desk scheduling across this clinic.'
            : 'Bulk import your room list from CSV, or add rooms one at a time for front-desk scheduling.'
        }
        actions={
          canManage && hasRooms ? (
            <ClinicSecondaryAction
              open={csvOpen}
              onToggle={() => setCsvOpen((open) => !open)}
              revealLabel="Import rooms from CSV"
              hideLabel="Hide CSV import"
            />
          ) : null
        }
      />

      {showCsv && !hasRooms && practice ? (
        <div className="mt-2">
          <BulkRoomImportPanel
            practice={practice}
            onComplete={() => void refreshPracticeSession()}
          />
        </div>
      ) : null}

      {canManage ? (
        <div className="mt-6 rounded-2xl border border-[#e1e7ef] bg-white p-5">
          <h2 className="text-sm font-semibold text-[#1a4d4d]">Add single room</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-4">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Room name"
              className="rounded-xl border border-[#e1e7ef] px-3 py-2 text-sm sm:col-span-2"
            />
            <select
              value={type}
              onChange={(e) => setType(e.target.value as PracticeRoom['type'])}
              className="rounded-xl border border-[#e1e7ef] px-3 py-2 text-sm"
            >
              <option value="consult">Consult</option>
              <option value="procedure">Procedure</option>
              <option value="virtual">Virtual</option>
              <option value="other">Other</option>
            </select>
            <select
              value={locationId}
              onChange={(e) => setLocationId(e.target.value)}
              className="rounded-xl border border-[#e1e7ef] px-3 py-2 text-sm"
            >
              <option value="">Any location</option>
              {(practice?.locations ?? []).map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {loc.name}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            disabled={saving || !name.trim()}
            onClick={() => void onAdd()}
            className="mt-4 rounded-full bg-[#1a4d4d] px-5 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {saving ? 'Saving…' : 'Add room'}
          </button>
        </div>
      ) : null}

      <div className="mt-8 overflow-hidden rounded-2xl border border-[#e1e7ef] bg-white">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-[#fafcfb] text-xs font-semibold uppercase tracking-wide text-[#65758b]">
            <tr>
              <th className="px-4 py-3">Room</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Location</th>
              {canManage ? <th className="px-4 py-3">Actions</th> : null}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#eef2f6]">
            {rooms.map((room) => {
              const location = (practice?.locations ?? []).find((l) => l.id === room.locationId);
              return (
                <tr key={room.id}>
                  <td className="px-4 py-3 font-medium">{room.name}</td>
                  <td className="px-4 py-3">{roomTypeLabel(room.type)}</td>
                  <td className="px-4 py-3">{location?.name ?? '-'}</td>
                  {canManage ? (
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => void onRemove(room.id)}
                        className="text-xs font-semibold text-red-600"
                      >
                        Remove
                      </button>
                    </td>
                  ) : null}
                </tr>
              );
            })}
            {rooms.length === 0 ? (
              <tr>
                <td colSpan={canManage ? 4 : 3} className="px-4 py-8 text-center text-[#65758b]">
                  No rooms configured yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {showCsv && hasRooms && practice ? (
        <div className="mt-8">
          <BulkRoomImportPanel
            practice={practice}
            onComplete={() => void refreshPracticeSession()}
          />
        </div>
      ) : null}
    </PageShell>
  );
};

export default ClinicAdminRoomsPage;
