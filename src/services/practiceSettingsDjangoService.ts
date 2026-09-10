/**
 * Django-backed practice settings — used when Firebase is disabled.
 */
import type {
  BookableBlock,
  BookingPolicy,
  Practice,
  PracticeMember,
} from '../types';
import {
  djangoCreateBookableBlock,
  djangoCreateSoftBlock,
  djangoDeleteBookableBlock,
  djangoDeleteSoftBlock,
  djangoFetchPractice,
  djangoFetchPracticeMembers,
  djangoGetBookingPolicy,
  djangoGetBookableBlocks,
  djangoGetSoftBlocks,
  djangoListMyPractices,
  djangoPatchPractice,
  djangoProvisionPractice,
  djangoUpdateBookableBlock,
  djangoUpdateBookingPolicy,
} from './djangoApiService';
import type { SoftBlock } from '../types';

function mapPractice(row: Record<string, unknown>): Practice {
  return {
    id: String(row.id),
    name: String(row.name ?? 'Practice'),
    timezone: String(row.timezone ?? 'Africa/Johannesburg'),
    ownerId: String(row.ownerId ?? ''),
    orgType: row.orgType === 'clinic' ? 'clinic' : 'solo',
    tradingName: row.tradingName as string | undefined,
    bhfPracticeNumber: row.bhfPracticeNumber as string | undefined,
    locations: (row.locations as Practice['locations']) ?? [],
    rooms: (row.rooms as Practice['rooms']) ?? [],
    consultTypes: (row.consultTypes as Practice['consultTypes']) ?? [],
    consultTypeSettings: row.consultTypeSettings as Practice['consultTypeSettings'],
    createdAt: row.createdAt ? new Date(String(row.createdAt)) : new Date(),
    updatedAt: row.updatedAt ? new Date(String(row.updatedAt)) : new Date(),
  };
}

function mapMember(row: Record<string, unknown>): PracticeMember {
  return {
    uid: String(row.uid),
    practiceId: String(row.practiceId),
    role: row.role as PracticeMember['role'],
    permissions: (row.permissions as PracticeMember['permissions']) ?? {},
    status: (row.status as PracticeMember['status']) ?? 'active',
    isClinician: Boolean(row.isClinician),
    displayName: row.displayName as string | undefined,
    email: row.email as string | undefined,
    createdAt: row.createdAt ? new Date(String(row.createdAt)) : new Date(),
    updatedAt: row.updatedAt ? new Date(String(row.updatedAt)) : new Date(),
  };
}

function mapBookingPolicy(row: Record<string, unknown>): BookingPolicy {
  return {
    practiceId: String(row.practiceId),
    patientCancellationWindowHours: Number(row.patientCancellationWindowHours ?? 24),
    doctorCancellationWindowHours: Number(row.doctorCancellationWindowHours ?? 2),
    noShowPolicyText: String(row.noShowPolicyText ?? ''),
    confirmationMode: (row.confirmationMode === 'doctor_confirms' ? 'doctor_confirms' : 'auto'),
    updatedAt: row.updatedAt ? new Date(String(row.updatedAt)) : new Date(),
  };
}

function mapBookableBlock(row: Record<string, unknown>): BookableBlock {
  return {
    id: String(row.id),
    practiceId: String(row.practiceId),
    doctorId: String(row.doctorId),
    dayOfWeek: Number(row.dayOfWeek) as BookableBlock['dayOfWeek'],
    startTime: String(row.startTime),
    endTime: String(row.endTime),
    locationId: String(row.locationId),
    allowedConsultTypes: (row.allowedConsultTypes as BookableBlock['allowedConsultTypes']) ?? [],
    slotDurationMinutes: Number(row.slotDurationMinutes ?? 30),
    bufferBeforeMinutes: Number(row.bufferBeforeMinutes ?? 0),
    bufferAfterMinutes: Number(row.bufferAfterMinutes ?? 0),
    active: Boolean(row.active ?? true),
    createdAt: row.createdAt ? new Date(String(row.createdAt)) : new Date(),
    updatedAt: row.updatedAt ? new Date(String(row.updatedAt)) : new Date(),
  };
}

export async function djangoGetPractice(practiceId: string): Promise<Practice | null> {
  try {
    const row = await djangoFetchPractice(practiceId);
    return mapPractice(row);
  } catch {
    return null;
  }
}

export async function djangoGetPracticeForUser(uid: string): Promise<Practice | null> {
  const practices = await djangoListMyPractices();
  if (!practices.length) return null;
  return mapPractice(practices[0] as Record<string, unknown>);
}

export async function djangoResolvePracticeForUser(uid: string): Promise<Practice | null> {
  return djangoGetPracticeForUser(uid);
}

export async function djangoEnsureBookingPolicy(practiceId: string): Promise<BookingPolicy> {
  const row = await djangoGetBookingPolicy(practiceId);
  return mapBookingPolicy(row);
}

export async function djangoGetPracticeMember(
  practiceId: string,
  uid: string,
): Promise<PracticeMember | null> {
  const members = await djangoFetchPracticeMembers(practiceId);
  const found = members.find((m) => String(m.uid) === uid);
  return found ? mapMember(found) : null;
}

export async function djangoListPracticeMembers(practiceId: string): Promise<PracticeMember[]> {
  const members = await djangoFetchPracticeMembers(practiceId);
  return members.map(mapMember);
}

export async function djangoGetBookableBlocksForPractice(practiceId: string): Promise<BookableBlock[]> {
  const rows = await djangoGetBookableBlocks(practiceId);
  return rows.map(mapBookableBlock);
}

export async function djangoProvisionPracticeForDoctor(
  uid: string,
  options?: { name?: string; orgType?: 'solo' | 'clinic'; timezone?: string },
): Promise<{ practice: Practice; member: PracticeMember; bookingPolicy: BookingPolicy }> {
  const result = await djangoProvisionPractice(options as Record<string, unknown>);
  return {
    practice: mapPractice(result.practice as Record<string, unknown>),
    member: mapMember(result.member as Record<string, unknown>),
    bookingPolicy: mapBookingPolicy(result.bookingPolicy as Record<string, unknown>),
  };
}

export async function djangoUpdatePractice(
  practiceId: string,
  patch: Partial<Practice>,
): Promise<Practice> {
  const row = await djangoPatchPractice(practiceId, patch as Record<string, unknown>);
  return mapPractice(row);
}

export async function djangoGetBookingPolicyForPractice(practiceId: string): Promise<BookingPolicy | null> {
  try {
    return mapBookingPolicy(await djangoGetBookingPolicy(practiceId));
  } catch {
    return null;
  }
}

export async function djangoUpdateBookingPolicyForPractice(
  practiceId: string,
  patch: Partial<BookingPolicy>,
): Promise<BookingPolicy> {
  return mapBookingPolicy(await djangoUpdateBookingPolicy(practiceId, patch as Record<string, unknown>));
}

function mapSoftBlock(row: Record<string, unknown>): SoftBlock {
  return {
    id: String(row.id),
    practiceId: String(row.practiceId),
    doctorId: String(row.doctorId),
    title: String(row.title ?? 'Block'),
    category: (row.category as SoftBlock['category']) ?? 'other',
    startAt: row.startAt ? new Date(String(row.startAt)) : new Date(),
    endAt: row.endAt ? new Date(String(row.endAt)) : new Date(),
    recurrence: row.recurrence as SoftBlock['recurrence'],
    createdBy: row.createdBy ? String(row.createdBy) : '',
    updatedBy: row.updatedBy ? String(row.updatedBy) : '',
    createdAt: row.createdAt ? new Date(String(row.createdAt)) : new Date(),
    updatedAt: row.updatedAt ? new Date(String(row.updatedAt)) : new Date(),
  };
}

export async function djangoGetSoftBlocksForPractice(
  practiceId: string,
  doctorId?: string,
): Promise<SoftBlock[]> {
  const rows = await djangoGetSoftBlocks(practiceId, doctorId);
  return rows.map(mapSoftBlock);
}

export async function djangoCreateBookableBlockForPractice(
  practiceId: string,
  block: Omit<import('../types').BookableBlock, 'id' | 'createdAt' | 'updatedAt'>,
): Promise<string> {
  const row = await djangoCreateBookableBlock(practiceId, {
    doctorId: block.doctorId,
    dayOfWeek: block.dayOfWeek,
    startTime: block.startTime,
    endTime: block.endTime,
    locationId: block.locationId,
    allowedConsultTypes: block.allowedConsultTypes,
    slotDurationMinutes: block.slotDurationMinutes,
    bufferBeforeMinutes: block.bufferBeforeMinutes,
    bufferAfterMinutes: block.bufferAfterMinutes,
    active: block.active ?? true,
  });
  return String(row.id);
}

export async function djangoUpdateBookableBlockForPractice(
  practiceId: string,
  blockId: string,
  updates: Partial<Omit<import('../types').BookableBlock, 'id' | 'practiceId' | 'createdAt' | 'updatedAt'>>,
): Promise<void> {
  await djangoUpdateBookableBlock(practiceId, blockId, updates as Record<string, unknown>);
}

export async function djangoDeleteBookableBlockForPractice(
  practiceId: string,
  blockId: string,
): Promise<void> {
  await djangoDeleteBookableBlock(practiceId, blockId);
}

export async function djangoCreateSoftBlockForPractice(
  practiceId: string,
  block: Omit<SoftBlock, 'id' | 'createdAt' | 'updatedAt'>,
): Promise<string> {
  const row = await djangoCreateSoftBlock(practiceId, {
    doctorId: block.doctorId,
    title: block.title,
    category: block.category,
    startAt: block.startAt.toISOString(),
    endAt: block.endAt.toISOString(),
    recurrence: block.recurrence ?? null,
    createdBy: block.createdBy,
    updatedBy: block.updatedBy,
  });
  return String(row.id);
}

export async function djangoUpdateSoftBlockForPractice(
  practiceId: string,
  softBlockId: string,
  updates: Partial<Pick<SoftBlock, 'title' | 'category' | 'startAt' | 'endAt' | 'recurrence'>>,
  updatedBy: string,
): Promise<void> {
  const existing = (await djangoGetSoftBlocksForPractice(practiceId)).find((b) => b.id === softBlockId);
  if (!existing) throw new Error('Soft block not found');
  await djangoDeleteSoftBlock(practiceId, softBlockId);
  await djangoCreateSoftBlockForPractice(practiceId, {
    ...existing,
    ...updates,
    updatedBy,
  });
}

export async function djangoDeleteSoftBlockForPractice(
  practiceId: string,
  softBlockId: string,
): Promise<void> {
  await djangoDeleteSoftBlock(practiceId, softBlockId);
}

export async function djangoGetPracticeByOwnerId(ownerId: string) {
  const practices = await djangoListMyPractices();
  const owned = practices.find((p) => String((p as Record<string, unknown>).ownerId) === ownerId);
  return owned ? mapPractice(owned as Record<string, unknown>) : null;
}
