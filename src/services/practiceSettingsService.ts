import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import {
  PRACTICES_COLLECTION,
  PRACTICE_MEMBERS_SUBCOLLECTION,
  BOOKABLE_BLOCKS_SUBCOLLECTION,
  SOFT_BLOCKS_SUBCOLLECTION,
  BOOKING_POLICIES_SUBCOLLECTION,
  BOOKING_POLICIES_DOC_ID,
  USERS_COLLECTION,
  DOCTORS_COLLECTION,
} from '../shared/constants';
import type {
  BookableBlock,
  BookingPolicy,
  ConsultType,
  DayOfWeek,
  Practice,
  PracticeLocation,
  PracticeMember,
  PracticeOrgType,
  PracticePermissions,
  SoftBlock,
} from '../types';
import { isClinicianRole, normalizePermissions, OWNER_PERMISSIONS } from '../lib/practiceRoles';



const toDate = (v: any): Date =>
  v instanceof Timestamp ? v.toDate() : v instanceof Date ? v : new Date(v);



export const getPractice = async (practiceId: string): Promise<Practice | null> => {
  const ref = doc(db, PRACTICES_COLLECTION, practiceId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  const d = snap.data();
  return {
    id: snap.id,
    name: d.name,
    timezone: d.timezone,
    ownerId: d.ownerId,
    orgType: (d.orgType as PracticeOrgType) || 'solo',
    tradingName: d.tradingName,
    bhfPracticeNumber: d.bhfPracticeNumber,
    locations: d.locations ?? [],
    consultTypes: d.consultTypes ?? [],
    createdAt: toDate(d.createdAt),
    updatedAt: toDate(d.updatedAt),
  };
};

const practiceFromSnapshot = (
  practiceDoc: { id: string; data: () => Record<string, unknown> }
): Practice => {
  const d = practiceDoc.data();
  return {
    id: practiceDoc.id,
    name: String(d.name ?? 'My Practice'),
    timezone: String(d.timezone ?? 'UTC'),
    ownerId: String(d.ownerId ?? ''),
    orgType: (d.orgType as PracticeOrgType) || 'solo',
    tradingName: d.tradingName ? String(d.tradingName) : undefined,
    bhfPracticeNumber: d.bhfPracticeNumber ? String(d.bhfPracticeNumber) : undefined,
    locations: (d.locations as PracticeLocation[]) ?? [],
    consultTypes: (d.consultTypes as ConsultType[]) ?? [],
    createdAt: toDate(d.createdAt),
    updatedAt: toDate(d.updatedAt),
  };
};

export const linkUserToPractice = async (uid: string, practiceId: string): Promise<void> => {
  await setDoc(
    doc(db, USERS_COLLECTION, uid),
    { primaryPracticeId: practiceId, updatedAt: serverTimestamp() },
    { merge: true }
  );
};

export const getPracticeByOwnerId = async (ownerId: string): Promise<Practice | null> => {
  if (!ownerId) return null;
  try {
    const q = query(collection(db, PRACTICES_COLLECTION), where('ownerId', '==', ownerId));
    const snap = await getDocs(q);
    if (snap.empty) return null;
    return practiceFromSnapshot(snap.docs[0]);
  } catch (error) {
    console.warn('[practiceSettings] getPracticeByOwnerId failed:', error);
    return null;
  }
};

export const ensureOwnerMembership = async (
  practiceId: string,
  ownerId: string,
  options?: { isClinician?: boolean }
): Promise<PracticeMember> => {
  const memberRef = doc(
    db,
    PRACTICES_COLLECTION,
    practiceId,
    PRACTICE_MEMBERS_SUBCOLLECTION,
    ownerId
  );
  const memberSnap = await getDoc(memberRef);
  const isClinician = options?.isClinician !== false;

  const [userSnap, doctorSnap] = await Promise.all([
    getDoc(doc(db, USERS_COLLECTION, ownerId)),
    getDoc(doc(db, DOCTORS_COLLECTION, ownerId)),
  ]);
  const userData = userSnap.exists() ? userSnap.data() : {};
  const doctorData = doctorSnap.exists() ? doctorSnap.data() : {};
  const displayName =
    (typeof userData.displayName === 'string' && userData.displayName.trim()) ||
    (typeof doctorData.fullName === 'string' && doctorData.fullName.trim()) ||
    (typeof doctorData.displayName === 'string' && doctorData.displayName.trim()) ||
    null;
  const email =
    (typeof userData.email === 'string' && userData.email.trim().toLowerCase()) ||
    (typeof doctorData.email === 'string' && doctorData.email.trim().toLowerCase()) ||
    null;

  if (memberSnap.exists() && memberSnap.data().status === 'active') {
    const updates: {
      updatedAt: ReturnType<typeof serverTimestamp>;
      isClinician?: boolean;
      displayName?: string;
      email?: string;
    } = { updatedAt: serverTimestamp() };
    if (options?.isClinician !== undefined && memberSnap.data().isClinician !== isClinician) {
      updates.isClinician = isClinician;
    }
    if (displayName && memberSnap.data().displayName !== displayName) {
      updates.displayName = displayName;
    }
    if (email && memberSnap.data().email !== email) {
      updates.email = email;
    }
    if (Object.keys(updates).length > 1) {
      await updateDoc(memberRef, updates);
    }
    return (await getPracticeMember(practiceId, ownerId))!;
  }

  await setDoc(
    memberRef,
    {
      uid: ownerId,
      practiceId,
      role: 'owner',
      permissions: OWNER_PERMISSIONS,
      status: 'active',
      isClinician,
      displayName,
      email,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );

  const member = await getPracticeMember(practiceId, ownerId);
  if (!member) {
    throw new Error('Failed to provision practice owner membership');
  }
  await linkUserToPractice(ownerId, practiceId);
  return member;
};

export const ensureBookingPolicy = async (practiceId: string): Promise<BookingPolicy> => {
  const existing = await getBookingPolicy(practiceId);
  if (existing) return existing;

  await setDoc(
    doc(
      db,
      PRACTICES_COLLECTION,
      practiceId,
      BOOKING_POLICIES_SUBCOLLECTION,
      BOOKING_POLICIES_DOC_ID
    ),
    {
      practiceId,
      patientCancellationWindowHours: 24,
      doctorCancellationWindowHours: 1,
      noShowPolicyText:
        'Patients who do not attend without 24-hour notice may be charged a no-show fee.',
      confirmationMode: 'doctor_confirms',
      updatedAt: serverTimestamp(),
    }
  );

  const policy = await getBookingPolicy(practiceId);
  if (!policy) {
    throw new Error('Failed to provision booking policy');
  }
  return policy;
};

/** Resolve the practice a user belongs to (owner or member). */
export const resolvePracticeForUser = async (uid: string): Promise<Practice | null> => {
  if (!uid) return null;

  const owned = await getPracticeByOwnerId(uid);
  if (owned) {
    await ensureOwnerMembership(owned.id, uid);
    return owned;
  }

  return getPracticeForUser(uid);
};

export const provisionPracticeForDoctor = async (
  ownerId: string,
  data?: Pick<Practice, 'name' | 'timezone'>
): Promise<PracticeSessionBundle> => {
  try {
    const existing = await resolvePracticeForUser(ownerId);
    if (existing) {
      const member = await ensureOwnerMembership(existing.id, ownerId);
      const bookingPolicy = await ensureBookingPolicy(existing.id);
      return { practice: existing, member, bookingPolicy };
    }
  } catch (error) {
    console.warn('[practiceSettings] resolvePracticeForUser failed, creating new practice:', error);
  }

  const practiceId = await createPractice(ownerId, {
    name: data?.name ?? 'My Practice',
    timezone: data?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'UTC',
  });

  await linkUserToPractice(ownerId, practiceId);

  const practice = await getPractice(practiceId);
  if (!practice) {
    throw new Error('Practice was created but could not be loaded');
  }

  const member = await ensureOwnerMembership(practiceId, ownerId);
  const bookingPolicy = await ensureBookingPolicy(practiceId);
  return { practice, member, bookingPolicy };
};

export type PracticeSessionBundle = {
  practice: Practice;
  member: PracticeMember;
  bookingPolicy: BookingPolicy;
};

export const createPractice = async (
  ownerId: string,
  data: Pick<Practice, 'name' | 'timezone'> &
    Partial<Pick<Practice, 'locations' | 'consultTypes' | 'orgType' | 'tradingName' | 'bhfPracticeNumber'>>
): Promise<string> => {
  const orgType: PracticeOrgType = data.orgType ?? 'solo';
  const ref = collection(db, PRACTICES_COLLECTION);
  const docRef = await addDoc(ref, {
    name: data.name,
    timezone: data.timezone,
    ownerId,
    orgType,
    tradingName: data.tradingName ?? null,
    bhfPracticeNumber: data.bhfPracticeNumber ?? null,
    locations: data.locations ?? [],
    consultTypes: data.consultTypes ?? ['initial', 'follow-up'],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  
  await setDoc(
    doc(db, PRACTICES_COLLECTION, docRef.id, PRACTICE_MEMBERS_SUBCOLLECTION, ownerId),
    {
      uid: ownerId,
      practiceId: docRef.id,
      role: 'owner',
      permissions: OWNER_PERMISSIONS,
      status: 'active',
      isClinician: (data.orgType ?? 'solo') !== 'clinic',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }
  );
  
  await setDoc(
    doc(db, PRACTICES_COLLECTION, docRef.id, BOOKING_POLICIES_SUBCOLLECTION, BOOKING_POLICIES_DOC_ID),
    {
      practiceId: docRef.id,
      patientCancellationWindowHours: 24,
      doctorCancellationWindowHours: 1,
      noShowPolicyText:
        'Patients who do not attend without 24-hour notice may be charged a no-show fee.',
      confirmationMode: 'doctor_confirms',
      updatedAt: serverTimestamp(),
    }
  );

  await linkUserToPractice(ownerId, docRef.id);
  return docRef.id;
};

export const updatePractice = async (
  practiceId: string,
  updates: Partial<
    Pick<
      Practice,
      'name' | 'timezone' | 'locations' | 'consultTypes' | 'orgType' | 'tradingName' | 'bhfPracticeNumber'
    >
  >
): Promise<void> => {
  await updateDoc(doc(db, PRACTICES_COLLECTION, practiceId), {
    ...updates,
    updatedAt: serverTimestamp(),
  });
};

/** Find practice via stored user link or active membership (never scans all practices). */
export const getPracticeForUser = async (uid: string): Promise<Practice | null> => {
  if (!uid) return null;

  try {
    const userSnap = await getDoc(doc(db, USERS_COLLECTION, uid));
    const primaryPracticeId = userSnap.data()?.primaryPracticeId as string | undefined;

    if (primaryPracticeId) {
      const member = await getPracticeMember(primaryPracticeId, uid);
      if (member?.status === 'active') {
        return getPractice(primaryPracticeId);
      }
    }
  } catch (error) {
    console.warn('[practiceSettings] getPracticeForUser via primaryPracticeId failed:', error);
  }

  return null;
};



export const getPracticeMember = async (
  practiceId: string,
  uid: string
): Promise<PracticeMember | null> => {
  const ref = doc(db, PRACTICES_COLLECTION, practiceId, PRACTICE_MEMBERS_SUBCOLLECTION, uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  const d = snap.data();
  const role = d.role;
  return {
    uid: snap.id,
    practiceId,
    role,
    permissions: normalizePermissions(d.permissions, role),
    status: d.status,
    displayName: d.displayName,
    email: d.email,
    isClinician: d.isClinician ?? isClinicianRole(role),
    invitedBy: d.invitedBy,
    invitedAt: d.invitedAt ? toDate(d.invitedAt) : undefined,
    createdAt: toDate(d.createdAt),
    updatedAt: toDate(d.updatedAt),
  };
};

export const listPracticeMembers = async (practiceId: string): Promise<PracticeMember[]> => {
  const ref = collection(db, PRACTICES_COLLECTION, practiceId, PRACTICE_MEMBERS_SUBCOLLECTION);
  const snap = await getDocs(query(ref, where('status', '==', 'active')));
  return snap.docs.map((d) => {
    const data = d.data();
    const role = data.role;
    return {
      uid: d.id,
      practiceId,
      role,
      permissions: normalizePermissions(data.permissions, role),
      status: data.status,
      displayName: data.displayName,
      email: data.email,
      isClinician: data.isClinician ?? isClinicianRole(role),
      invitedBy: data.invitedBy,
      invitedAt: data.invitedAt ? toDate(data.invitedAt) : undefined,
      createdAt: toDate(data.createdAt),
      updatedAt: toDate(data.updatedAt),
    };
  });
};

/** Doctors who can be selected when booking / managing diaries. */
export const listPracticeClinicians = async (practiceId: string): Promise<PracticeMember[]> => {
  const { enrichPracticeMembers } = await import('./practiceMemberService');
  const members = await enrichPracticeMembers(await listPracticeMembers(practiceId));
  return members.filter(
    (m) =>
      m.status === 'active' &&
      (m.role === 'doctor' || (m.isClinician === true && m.role !== 'practice_manager'))
  );
};

export const updatePracticeMember = async (
  practiceId: string,
  uid: string,
  updates: Partial<Pick<PracticeMember, 'role' | 'permissions' | 'status' | 'displayName'>>
): Promise<void> => {
  const payload: Record<string, any> = {
    ...updates,
    updatedAt: serverTimestamp(),
  };
  if (updates.role) {
    payload.isClinician = isClinicianRole(updates.role);
    if (!updates.permissions) {
      payload.permissions = normalizePermissions(undefined, updates.role);
    }
  }
  await updateDoc(
    doc(db, PRACTICES_COLLECTION, practiceId, PRACTICE_MEMBERS_SUBCOLLECTION, uid),
    payload
  );
};

export const deactivatePracticeMember = async (
  practiceId: string,
  uid: string
): Promise<void> => {
  await updatePracticeMember(practiceId, uid, { status: 'inactive' });
};

export const addDelegate = async (
  practiceId: string,
  uid: string,
  displayName: string,
  email: string,
  permissions: PracticePermissions
): Promise<void> => {
  await setDoc(
    doc(db, PRACTICES_COLLECTION, practiceId, PRACTICE_MEMBERS_SUBCOLLECTION, uid),
    {
      uid,
      practiceId,
      role: 'delegate',
      permissions,
      status: 'active',
      displayName,
      email,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }
  );
};

export const updateDelegatePermissions = async (
  practiceId: string,
  uid: string,
  permissions: PracticePermissions
): Promise<void> => {
  await updateDoc(
    doc(db, PRACTICES_COLLECTION, practiceId, PRACTICE_MEMBERS_SUBCOLLECTION, uid),
    { permissions, updatedAt: serverTimestamp() }
  );
};

export const removeDelegate = async (practiceId: string, uid: string): Promise<void> => {
  await updateDoc(
    doc(db, PRACTICES_COLLECTION, practiceId, PRACTICE_MEMBERS_SUBCOLLECTION, uid),
    { status: 'inactive', updatedAt: serverTimestamp() }
  );
};



const blockFromDoc = (d: any, id: string, practiceId: string): BookableBlock => ({
  id,
  practiceId,
  doctorId: d.doctorId,
  dayOfWeek: d.dayOfWeek,
  startTime: d.startTime,
  endTime: d.endTime,
  locationId: d.locationId,
  allowedConsultTypes: d.allowedConsultTypes ?? [],
  slotDurationMinutes: d.slotDurationMinutes ?? 30,
  bufferBeforeMinutes: d.bufferBeforeMinutes ?? 0,
  bufferAfterMinutes: d.bufferAfterMinutes ?? 0,
  active: d.active ?? true,
  createdAt: toDate(d.createdAt),
  updatedAt: toDate(d.updatedAt),
});

export const getBookableBlocks = async (practiceId: string): Promise<BookableBlock[]> => {
  const ref = collection(db, PRACTICES_COLLECTION, practiceId, BOOKABLE_BLOCKS_SUBCOLLECTION);
  const snap = await getDocs(query(ref, where('active', '==', true)));
  return snap.docs.map((d) => blockFromDoc(d.data(), d.id, practiceId));
};

const dateAtHm = (date: Date, hhmm: string): Date => {
  const [h, m] = hhmm.split(':').map(Number);
  const d = new Date(date);
  d.setHours(h || 0, m || 0, 0, 0);
  return d;
};

/**
 * Mirrors practice clinic hours into doctors/{doctorId}/settings/availability
 * so patients can see bookable windows without reading practice bookableBlocks.
 */
export const syncDoctorPublicAvailability = async (
  practiceId: string,
  doctorId: string
): Promise<void> => {
  if (!practiceId || !doctorId) return;

  const blocks = (await getBookableBlocks(practiceId)).filter(
    (b) => b.doctorId === doctorId && b.active !== false
  );

  const horizonDays = 60;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const availabilityBlocks: Array<{
    id: string;
    startDateTime: Timestamp;
    endDateTime: Timestamp;
    status: 'available';
    title: string;
  }> = [];

  for (let i = 0; i <= horizonDays; i++) {
    const day = new Date(today);
    day.setDate(today.getDate() + i);
    const dow = day.getDay() as DayOfWeek;
    const dayKey = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;

    for (const block of blocks) {
      if (block.dayOfWeek !== dow) continue;
      const start = dateAtHm(day, block.startTime);
      const end = dateAtHm(day, block.endTime);
      if (end.getTime() <= start.getTime()) continue;

      availabilityBlocks.push({
        id: `${block.id}_${dayKey}`,
        startDateTime: Timestamp.fromDate(start),
        endDateTime: Timestamp.fromDate(end),
        status: 'available',
        title: 'Clinic hours',
      });
    }
  }

  await setDoc(
    doc(db, DOCTORS_COLLECTION, doctorId, 'settings', 'availability'),
    {
      doctorId,
      source: 'practiceClinicHours',
      blocks: availabilityBlocks,
      clinicHours: blocks.map((b) => ({
        id: b.id,
        dayOfWeek: b.dayOfWeek,
        startTime: b.startTime,
        endTime: b.endTime,
        slotDurationMinutes: b.slotDurationMinutes,
        bufferAfterMinutes: b.bufferAfterMinutes,
        active: true,
      })),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
};

export const createBookableBlock = async (
  practiceId: string,
  block: Omit<BookableBlock, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string> => {
  const ref = collection(db, PRACTICES_COLLECTION, practiceId, BOOKABLE_BLOCKS_SUBCOLLECTION);
  const docRef = await addDoc(ref, {
    ...block,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  try {
    await syncDoctorPublicAvailability(practiceId, block.doctorId);
  } catch (error) {
    console.warn('[practiceSettings] syncDoctorPublicAvailability failed after create:', error);
  }
  return docRef.id;
};

export const updateBookableBlock = async (
  practiceId: string,
  blockId: string,
  updates: Partial<Omit<BookableBlock, 'id' | 'practiceId' | 'createdAt' | 'updatedAt'>>
): Promise<void> => {
  await updateDoc(
    doc(db, PRACTICES_COLLECTION, practiceId, BOOKABLE_BLOCKS_SUBCOLLECTION, blockId),
    { ...updates, updatedAt: serverTimestamp() }
  );
  const doctorId = updates.doctorId;
  if (doctorId) {
    try {
      await syncDoctorPublicAvailability(practiceId, doctorId);
    } catch (error) {
      console.warn('[practiceSettings] syncDoctorPublicAvailability failed after update:', error);
    }
  }
};

export const deleteBookableBlock = async (
  practiceId: string,
  blockId: string,
  doctorId?: string
): Promise<void> => {
  const blockRef = doc(db, PRACTICES_COLLECTION, practiceId, BOOKABLE_BLOCKS_SUBCOLLECTION, blockId);
  let resolvedDoctorId = doctorId;
  if (!resolvedDoctorId) {
    const snap = await getDoc(blockRef);
    resolvedDoctorId = snap.exists() ? String(snap.data()?.doctorId ?? '') : '';
  }

  await updateDoc(blockRef, { active: false, updatedAt: serverTimestamp() });

  if (resolvedDoctorId) {
    try {
      await syncDoctorPublicAvailability(practiceId, resolvedDoctorId);
    } catch (error) {
      console.warn('[practiceSettings] syncDoctorPublicAvailability failed after delete:', error);
    }
  }
};



const softBlockFromDoc = (d: any, id: string, practiceId: string): SoftBlock => ({
  id,
  practiceId,
  doctorId: d.doctorId,
  title: d.title,
  category: d.category ?? 'other',
  startAt: toDate(d.startAt),
  endAt: toDate(d.endAt),
  recurrence: d.recurrence
    ? {
        frequency: d.recurrence.frequency,
        interval: d.recurrence.interval ?? 1,
        endDate: d.recurrence.endDate ? toDate(d.recurrence.endDate) : undefined,
        daysOfWeek: d.recurrence.daysOfWeek,
      }
    : undefined,
  createdBy: d.createdBy,
  updatedBy: d.updatedBy,
  createdAt: toDate(d.createdAt),
  updatedAt: toDate(d.updatedAt),
});

export const getSoftBlocks = async (
  practiceId: string,
  from: Date,
  to: Date
): Promise<SoftBlock[]> => {
  const ref = collection(db, PRACTICES_COLLECTION, practiceId, SOFT_BLOCKS_SUBCOLLECTION);
  const snap = await getDocs(
    query(
      ref,
      where('startAt', '>=', Timestamp.fromDate(from)),
      where('startAt', '<=', Timestamp.fromDate(to))
    )
  );
  return snap.docs.map((d) => softBlockFromDoc(d.data(), d.id, practiceId));
};

export const getAllSoftBlocks = async (practiceId: string): Promise<SoftBlock[]> => {
  const ref = collection(db, PRACTICES_COLLECTION, practiceId, SOFT_BLOCKS_SUBCOLLECTION);
  const snap = await getDocs(ref);
  return snap.docs.map((d) => softBlockFromDoc(d.data(), d.id, practiceId));
};

const SOFT_BLOCK_HORIZON_DAYS = 60;

const softBlockStartOfDay = (date: Date): Date => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

const softBlockEndOfDay = (date: Date): Date => {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
};

const softBlockAddDays = (date: Date, days: number): Date => {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
};

const softBlockOverlaps = (aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean =>
  aStart < bEnd && aEnd > bStart;

const softBlockDayKey = (date: Date): string => {
  const d = softBlockStartOfDay(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const advanceSoftBlockOccurrence = (date: Date, recurrence: NonNullable<SoftBlock['recurrence']>): Date => {
  const interval = Math.max(1, recurrence.interval || 1);
  if (recurrence.frequency === 'daily') return softBlockAddDays(date, interval);
  if (recurrence.frequency === 'weekly') return softBlockAddDays(date, 7 * interval);
  const d = new Date(date);
  d.setMonth(d.getMonth() + interval);
  return d;
};

type PublicSoftBlockOccurrence = {
  id: string;
  blockId: string;
  title: string;
  startAt: Date;
  endAt: Date;
};

const expandSoftBlockOccurrencesInHorizon = (
  block: SoftBlock,
  horizonStart: Date,
  horizonEnd: Date
): PublicSoftBlockOccurrence[] => {
  const durationMs = block.endAt.getTime() - block.startAt.getTime();
  if (durationMs <= 0) return [];

  if (!block.recurrence) {
    if (softBlockOverlaps(block.startAt, block.endAt, horizonStart, horizonEnd)) {
      const dayStart = softBlockStartOfDay(block.startAt);
      return [{
        id: `${block.id}_${softBlockDayKey(dayStart)}`,
        blockId: block.id,
        title: block.title,
        startAt: block.startAt,
        endAt: block.endAt,
      }];
    }
    return [];
  }

  const recurrenceEnd = block.recurrence.endDate
    ? softBlockEndOfDay(block.recurrence.endDate)
    : null;
  const results: PublicSoftBlockOccurrence[] = [];

  if (
    block.recurrence.frequency === 'weekly' &&
    block.recurrence.daysOfWeek?.length
  ) {
    for (let i = 0; i <= SOFT_BLOCK_HORIZON_DAYS; i++) {
      const day = softBlockAddDays(horizonStart, i);
      if (day > horizonEnd) break;
      const dayStart = softBlockStartOfDay(day);
      if (dayStart < softBlockStartOfDay(block.startAt)) continue;
      if (recurrenceEnd && dayStart > recurrenceEnd) continue;

      const dow = day.getDay() as DayOfWeek;
      if (!block.recurrence.daysOfWeek.includes(dow)) continue;

      const occStart = dateAtHm(day, `${String(block.startAt.getHours()).padStart(2, '0')}:${String(block.startAt.getMinutes()).padStart(2, '0')}`);
      const occEnd = new Date(occStart.getTime() + durationMs);
      if (occStart >= block.startAt) {
        results.push({
          id: `${block.id}_${softBlockDayKey(dayStart)}`,
          blockId: block.id,
          title: block.title,
          startAt: occStart,
          endAt: occEnd,
        });
      }
    }
    return results;
  }

  let cursor = new Date(block.startAt);
  let safety = 0;
  while (cursor <= horizonEnd && safety < 5000) {
    if (recurrenceEnd && cursor > recurrenceEnd) break;
    const occurrenceEnd = new Date(cursor.getTime() + durationMs);
    if (softBlockOverlaps(cursor, occurrenceEnd, horizonStart, horizonEnd)) {
      results.push({
        id: `${block.id}_${softBlockDayKey(cursor)}`,
        blockId: block.id,
        title: block.title,
        startAt: new Date(cursor),
        endAt: occurrenceEnd,
      });
    }
    cursor = advanceSoftBlockOccurrence(cursor, block.recurrence);
    safety += 1;
  }

  return results;
};

/**
 * Mirrors practice soft blocks into doctors/{doctorId}/settings/softBlocks
 * and Users/{doctorId}/soft_blocks so patients can read blocked times when booking.
 */
export const syncDoctorPublicSoftBlocks = async (
  practiceId: string,
  doctorId: string
): Promise<void> => {
  if (!practiceId || !doctorId) return;

  const allBlocks = (await getAllSoftBlocks(practiceId)).filter((b) => b.doctorId === doctorId);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const horizonEnd = softBlockEndOfDay(softBlockAddDays(today, SOFT_BLOCK_HORIZON_DAYS));

  const occurrences = allBlocks.flatMap((block) =>
    expandSoftBlockOccurrencesInHorizon(block, today, horizonEnd)
  );

  const settingsBlocks = occurrences.map((occ) => ({
    id: occ.id,
    title: occ.title,
    startAt: Timestamp.fromDate(occ.startAt),
    endAt: Timestamp.fromDate(occ.endAt),
  }));

  await setDoc(
    doc(db, DOCTORS_COLLECTION, doctorId, 'settings', 'softBlocks'),
    {
      doctorId,
      source: 'practiceSoftBlocks',
      blocks: settingsBlocks,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );

  const newOccurrenceIds = new Set(occurrences.map((occ) => occ.id));
  const softBlocksRef = collection(db, USERS_COLLECTION, doctorId, 'soft_blocks');
  const existingSnap = await getDocs(softBlocksRef);
  const batch = writeBatch(db);
  let batchOps = 0;

  existingSnap.docs.forEach((existingDoc) => {
    const data = existingDoc.data();
    if (data.sourcePracticeBlockId && !newOccurrenceIds.has(existingDoc.id)) {
      batch.delete(existingDoc.ref);
      batchOps += 1;
    }
  });

  for (const occ of occurrences) {
    const dayStart = softBlockStartOfDay(occ.startAt);
    batch.set(
      doc(db, USERS_COLLECTION, doctorId, 'soft_blocks', occ.id),
      {
        doctorId,
        date: Timestamp.fromDate(dayStart),
        startTime: Timestamp.fromDate(occ.startAt),
        endTime: Timestamp.fromDate(occ.endAt),
        label: occ.title,
        updatedAt: serverTimestamp(),
        sourcePracticeBlockId: occ.blockId,
      },
      { merge: true }
    );
    batchOps += 1;
  }

  if (batchOps > 0) {
    await batch.commit();
  }
};

export const createSoftBlock = async (
  practiceId: string,
  block: Omit<SoftBlock, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string> => {
  const ref = collection(db, PRACTICES_COLLECTION, practiceId, SOFT_BLOCKS_SUBCOLLECTION);
  const payload: any = {
    doctorId: block.doctorId,
    title: block.title,
    category: block.category,
    startAt: Timestamp.fromDate(block.startAt),
    endAt: Timestamp.fromDate(block.endAt),
    createdBy: block.createdBy,
    updatedBy: block.updatedBy,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  if (block.recurrence) {
    payload.recurrence = {
      frequency: block.recurrence.frequency,
      interval: block.recurrence.interval,
      endDate: block.recurrence.endDate
        ? Timestamp.fromDate(block.recurrence.endDate)
        : null,
      daysOfWeek: block.recurrence.daysOfWeek ?? null,
    };
  }
  const docRef = await addDoc(ref, payload);
  try {
    await syncDoctorPublicSoftBlocks(practiceId, block.doctorId);
  } catch (error) {
    console.warn('[practiceSettings] syncDoctorPublicSoftBlocks failed after create:', error);
  }
  return docRef.id;
};

export const updateSoftBlock = async (
  practiceId: string,
  softBlockId: string,
  updates: Partial<Pick<SoftBlock, 'title' | 'category' | 'startAt' | 'endAt' | 'recurrence'>>,
  updatedBy: string
): Promise<void> => {
  const payload: any = { ...updates, updatedBy, updatedAt: serverTimestamp() };
  if (updates.startAt) payload.startAt = Timestamp.fromDate(updates.startAt);
  if (updates.endAt) payload.endAt = Timestamp.fromDate(updates.endAt);
  if (updates.recurrence?.endDate) {
    payload.recurrence = {
      ...updates.recurrence,
      endDate: Timestamp.fromDate(updates.recurrence.endDate),
    };
  }
  await updateDoc(
    doc(db, PRACTICES_COLLECTION, practiceId, SOFT_BLOCKS_SUBCOLLECTION, softBlockId),
    payload
  );

  const blockRef = doc(db, PRACTICES_COLLECTION, practiceId, SOFT_BLOCKS_SUBCOLLECTION, softBlockId);
  const blockSnap = await getDoc(blockRef);
  const doctorId = blockSnap.exists() ? String(blockSnap.data()?.doctorId ?? '') : '';
  if (doctorId) {
    try {
      await syncDoctorPublicSoftBlocks(practiceId, doctorId);
    } catch (error) {
      console.warn('[practiceSettings] syncDoctorPublicSoftBlocks failed after update:', error);
    }
  }
};

export const deleteSoftBlock = async (
  practiceId: string,
  softBlockId: string
): Promise<void> => {
  const blockRef = doc(db, PRACTICES_COLLECTION, practiceId, SOFT_BLOCKS_SUBCOLLECTION, softBlockId);
  const blockSnap = await getDoc(blockRef);
  const doctorId = blockSnap.exists() ? String(blockSnap.data()?.doctorId ?? '') : '';

  await deleteDoc(blockRef);

  if (doctorId) {
    try {
      await syncDoctorPublicSoftBlocks(practiceId, doctorId);
    } catch (error) {
      console.warn('[practiceSettings] syncDoctorPublicSoftBlocks failed after delete:', error);
    }
  }
};



export const getBookingPolicy = async (practiceId: string): Promise<BookingPolicy | null> => {
  const ref = doc(db, PRACTICES_COLLECTION, practiceId, BOOKING_POLICIES_SUBCOLLECTION, BOOKING_POLICIES_DOC_ID);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  const d = snap.data();
  return {
    practiceId,
    patientCancellationWindowHours: d.patientCancellationWindowHours ?? 24,
    doctorCancellationWindowHours: d.doctorCancellationWindowHours ?? 1,
    noShowPolicyText: d.noShowPolicyText ?? '',
    confirmationMode: d.confirmationMode ?? 'doctor_confirms',
    updatedAt: toDate(d.updatedAt),
  };
};

export const updateBookingPolicy = async (
  practiceId: string,
  updates: Partial<Omit<BookingPolicy, 'practiceId' | 'updatedAt'>>
): Promise<void> => {
  await setDoc(
    doc(db, PRACTICES_COLLECTION, practiceId, BOOKING_POLICIES_SUBCOLLECTION, BOOKING_POLICIES_DOC_ID),
    { ...updates, practiceId, updatedAt: serverTimestamp() },
    { merge: true }
  );
};
