import type { BulkRoomRow, BulkRoomResult } from './bulkRoomImportService';
import type { Practice, PracticeRoom } from '../types';
import { updatePractice } from './practiceSettingsService';

export function generateRoomId(): string {
  return `room_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function roomKey(name: string, locationId?: string): string {
  return `${name.trim().toLowerCase()}::${locationId ?? ''}`;
}

export async function addPracticeRoom(
  practice: Practice,
  input: Pick<PracticeRoom, 'name' | 'type'> & {
    locationId?: string;
    capacity?: number;
  },
): Promise<PracticeRoom[]> {
  const room: PracticeRoom = {
    id: generateRoomId(),
    name: input.name.trim(),
    locationId: input.locationId,
    type: input.type,
    capacity: input.capacity,
    active: true,
  };
  const rooms = [...(practice.rooms ?? []), room];
  await updatePractice(practice.id, { rooms });
  return rooms;
}

export async function addPracticeRoomsBulk(
  practice: Practice,
  rows: BulkRoomRow[],
): Promise<BulkRoomResult[]> {
  const existingKeys = new Set(
    (practice.rooms ?? [])
      .filter((room) => room.active !== false)
      .map((room) => roomKey(room.name, room.locationId)),
  );

  const results: BulkRoomResult[] = [];
  const toAdd: PracticeRoom[] = [];

  for (const row of rows) {
    const key = roomKey(row.name, row.locationId);
    if (existingKeys.has(key)) {
      results.push({ name: row.name, success: true, skippedDuplicate: true });
      continue;
    }

    toAdd.push({
      id: generateRoomId(),
      name: row.name.trim(),
      locationId: row.locationId,
      type: row.type,
      capacity: row.capacity,
      active: true,
    });
    existingKeys.add(key);
    results.push({ name: row.name, success: true });
  }

  if (toAdd.length > 0) {
    const rooms = [...(practice.rooms ?? []), ...toAdd];
    await updatePractice(practice.id, { rooms });
  }

  return results;
}

export async function updatePracticeRoom(
  practice: Practice,
  roomId: string,
  updates: Partial<Pick<PracticeRoom, 'name' | 'locationId' | 'type' | 'capacity' | 'active'>>,
): Promise<PracticeRoom[]> {
  const rooms = (practice.rooms ?? []).map((room) =>
    room.id === roomId ? { ...room, ...updates } : room,
  );
  await updatePractice(practice.id, { rooms });
  return rooms;
}

export async function removePracticeRoom(
  practice: Practice,
  roomId: string,
): Promise<PracticeRoom[]> {
  const rooms = (practice.rooms ?? []).filter((room) => room.id !== roomId);
  await updatePractice(practice.id, { rooms });
  return rooms;
}

export function roomTypeLabel(type: PracticeRoom['type']): string {
  switch (type) {
    case 'consult':
      return 'Consult';
    case 'procedure':
      return 'Procedure';
    case 'virtual':
      return 'Virtual';
    default:
      return 'Other';
  }
}

export function activeRooms(practice: Practice | null | undefined): PracticeRoom[] {
  return (practice?.rooms ?? []).filter((room) => room.active !== false);
}
