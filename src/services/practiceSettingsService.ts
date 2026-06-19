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
} from '../shared/constants';
import type {
  BookableBlock,
  BookingPolicy,
  ConsultType,
  Practice,
  PracticeLocation,
  PracticeMember,
  PracticePermissions,
  SoftBlock,
} from '../types';



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
    locations: d.locations ?? [],
    consultTypes: d.consultTypes ?? [],
    createdAt: toDate(d.createdAt),
    updatedAt: toDate(d.updatedAt),
  };
};

const OWNER_PERMISSIONS: PracticePermissions = {
  manageAppointments: true,
  manageSoftBlocks: true,
  overrideConflicts: true,
  editBookingPolicies: true,
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
  ownerId: string
): Promise<PracticeMember> => {
  const memberRef = doc(
    db,
    PRACTICES_COLLECTION,
    practiceId,
    PRACTICE_MEMBERS_SUBCOLLECTION,
    ownerId
  );
  const memberSnap = await getDoc(memberRef);
  if (memberSnap.exists() && memberSnap.data().status === 'active') {
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
    Partial<Pick<Practice, 'locations' | 'consultTypes'>>
): Promise<string> => {
  const ref = collection(db, PRACTICES_COLLECTION);
  const docRef = await addDoc(ref, {
    name: data.name,
    timezone: data.timezone,
    ownerId,
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
      permissions: {
        manageAppointments: true,
        manageSoftBlocks: true,
        overrideConflicts: true,
        editBookingPolicies: true,
      },
      status: 'active',
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
  updates: Partial<Pick<Practice, 'name' | 'timezone' | 'locations' | 'consultTypes'>>
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
  return {
    uid: snap.id,
    practiceId,
    role: d.role,
    permissions: d.permissions,
    status: d.status,
    displayName: d.displayName,
    email: d.email,
    createdAt: toDate(d.createdAt),
    updatedAt: toDate(d.updatedAt),
  };
};

export const listPracticeMembers = async (practiceId: string): Promise<PracticeMember[]> => {
  const ref = collection(db, PRACTICES_COLLECTION, practiceId, PRACTICE_MEMBERS_SUBCOLLECTION);
  const snap = await getDocs(query(ref, where('status', '==', 'active')));
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      uid: d.id,
      practiceId,
      role: data.role,
      permissions: data.permissions,
      status: data.status,
      displayName: data.displayName,
      email: data.email,
      createdAt: toDate(data.createdAt),
      updatedAt: toDate(data.updatedAt),
    };
  });
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
};

export const deleteBookableBlock = async (
  practiceId: string,
  blockId: string
): Promise<void> => {
  await updateDoc(
    doc(db, PRACTICES_COLLECTION, practiceId, BOOKABLE_BLOCKS_SUBCOLLECTION, blockId),
    { active: false, updatedAt: serverTimestamp() }
  );
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
};

export const deleteSoftBlock = async (
  practiceId: string,
  softBlockId: string
): Promise<void> => {
  await deleteDoc(
    doc(db, PRACTICES_COLLECTION, practiceId, SOFT_BLOCKS_SUBCOLLECTION, softBlockId)
  );
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
