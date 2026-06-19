import {
  arrayUnion,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import {
  DOCTORS_COLLECTION,
  PRACTICES_COLLECTION,
  PRACTICE_MEMBERS_SUBCOLLECTION,
  USERS_COLLECTION,
} from '../../shared/constants';
import { getPracticeByOwnerId } from '../practiceSettingsService';
import {
  PRACTICE_PERMISSIONS_DOC_ID,
  PRACTICE_PERMISSIONS_SUBCOLLECTION,
} from '../../shared/firestorePaths';
import { DelegatePermissions, DelegateUser, PracticePermissionsDocument } from '../../types/permissions';

const DEFAULT_DELEGATE_PERMISSIONS: DelegatePermissions = {
  manageAppointments: true,
  manageSoftBlocks: false,
  overrideConflicts: false,
  editBookingPolicies: false,
};

export const generateDelegateInviteId = (): string => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `delegate_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
};

const permissionsDocRef = (doctorId: string) =>
  doc(
    db,
    USERS_COLLECTION,
    doctorId,
    PRACTICE_PERMISSIONS_SUBCOLLECTION,
    PRACTICE_PERMISSIONS_DOC_ID
  );

const legacyPermissionsDocRef = (doctorId: string) =>
  doc(db, DOCTORS_COLLECTION, doctorId, 'settings', 'permissions');

export const getPracticePermissions = async (
  doctorId: string
): Promise<PracticePermissionsDocument | null> => {
  if (!doctorId) return null;

  const primarySnap = await getDoc(permissionsDocRef(doctorId));
  if (primarySnap.exists()) {
    return normalizePermissionsDoc(primarySnap.data(), doctorId);
  }

  const legacySnap = await getDoc(legacyPermissionsDocRef(doctorId));
  if (legacySnap.exists()) {
    return normalizePermissionsDoc(legacySnap.data(), doctorId);
  }

  return null;
};

export const ensurePracticePermissions = async (
  doctorId: string
): Promise<PracticePermissionsDocument> => {
  const existing = await getPracticePermissions(doctorId);
  if (existing) return existing;

  const defaults: PracticePermissionsDocument = {
    ownerId: doctorId,
    delegates: [],
    defaultDelegatePermissions: { ...DEFAULT_DELEGATE_PERMISSIONS },
  };

  await setDoc(permissionsDocRef(doctorId), defaults, { merge: true });
  return defaults;
};

export interface InviteDelegateInput {
  email: string;
  displayName?: string;
  permissions?: Partial<DelegatePermissions>;
}

export const inviteDelegate = async (
  doctorId: string,
  input: InviteDelegateInput
): Promise<{ delegateId: string; delegate: DelegateUser }> => {
  const email = input.email.trim().toLowerCase();
  if (!email) throw new Error('Email is required');

  await ensurePracticePermissions(doctorId);
  const permissions = await getPracticePermissions(doctorId);
  const defaults = permissions?.defaultDelegatePermissions ?? DEFAULT_DELEGATE_PERMISSIONS;

  const delegateId = generateDelegateInviteId();
  const delegate: DelegateUser = {
    id: delegateId,
    userId: '',
    email,
    displayName: input.displayName?.trim() || undefined,
    role: 'delegate',
    permissions: {
      ...defaults,
      ...input.permissions,
    },
    invitedAt: new Date().toISOString(),
    status: 'pending',
  };

  await updateDoc(permissionsDocRef(doctorId), {
    delegates: arrayUnion(delegate),
  });

  return { delegateId, delegate };
};

export const acceptDelegateInvitation = async (
  doctorId: string,
  delegateId: string,
  acceptingUser: { uid: string; email?: string | null; displayName?: string | null }
): Promise<void> => {
  if (!doctorId || !delegateId) {
    throw new Error('Invalid invitation link');
  }

  const permissions = await getPracticePermissions(doctorId);
  if (!permissions) {
    throw new Error('Practice permissions not found');
  }

  const delegates = permissions.delegates ?? [];
  const acceptingEmail = normalizeEmail(acceptingUser.email);

  const alreadyAccepted = delegates.find(
    (d) =>
      d.id === delegateId &&
      d.status === 'active' &&
      d.userId === acceptingUser.uid
  );
  if (alreadyAccepted) {
    await linkDelegateToDoctor(acceptingUser.uid, doctorId, alreadyAccepted);
    return;
  }

  const pendingInvite = delegates.find((d) => d.id === delegateId && d.status === 'pending');

  if (!pendingInvite) {
    throw new Error('Invitation not found or already accepted');
  }

  if (acceptingEmail && normalizeEmail(pendingInvite.email) !== acceptingEmail) {
    throw new Error(
      `This invitation was sent to ${pendingInvite.email}. Please sign in with that email address.`
    );
  }

  const updated = delegates.map((d) =>
    d.id === delegateId
      ? {
          ...d,
          userId: acceptingUser.uid,
          displayName: acceptingUser.displayName?.trim() || d.displayName,
          status: 'active' as const,
          acceptedAt: new Date().toISOString(),
        }
      : d
  );

  await updateDoc(permissionsDocRef(doctorId), { delegates: updated });
  await linkDelegateToDoctor(acceptingUser.uid, doctorId, pendingInvite);
};

async function linkDelegateToDoctor(
  delegateUid: string,
  doctorId: string,
  delegate?: DelegateUser
): Promise<void> {
  await setDoc(
    doc(db, USERS_COLLECTION, delegateUid),
    {
      delegatingForDoctorId: doctorId,
      updatedAt: new Date(),
    },
    { merge: true }
  );

  if (!delegate) return;

  const doctorUserSnap = await getDoc(doc(db, USERS_COLLECTION, doctorId));
  let practiceId = doctorUserSnap.data()?.primaryPracticeId as string | undefined;
  if (!practiceId) {
    const practice = await getPracticeByOwnerId(doctorId);
    practiceId = practice?.id;
  }
  if (!practiceId) return;

  await setDoc(
    doc(db, PRACTICES_COLLECTION, practiceId, PRACTICE_MEMBERS_SUBCOLLECTION, delegateUid),
    {
      uid: delegateUid,
      practiceId,
      role: 'delegate',
      permissions: delegate.permissions,
      status: 'active',
      email: delegate.email,
      displayName: delegate.displayName || '',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

function normalizeEmail(email?: string | null): string {
  return (email || '').trim().toLowerCase();
}

export const deactivateDelegate = async (
  doctorId: string,
  delegateId: string
): Promise<void> => {
  const snap = await getDoc(permissionsDocRef(doctorId));
  if (!snap.exists()) return;

  const data = snap.data();
  const delegates: DelegateUser[] = Array.isArray(data.delegates) ? data.delegates : [];
  const updated = delegates.map((d) =>
    d.id === delegateId ? { ...d, status: 'inactive' as const } : d
  );

  await updateDoc(permissionsDocRef(doctorId), { delegates: updated });
};

export type PermissionKey = keyof DelegatePermissions;

export const checkUserPermission = async (
  doctorId: string,
  userId: string,
  permissionKey: PermissionKey
): Promise<boolean> => {
  if (!doctorId || !userId) return false;
  if (userId === doctorId) return true;

  const permissions = await getPracticePermissions(doctorId);
  if (!permissions) return false;

  const delegate = permissions.delegates.find(
    (d) => d.userId === userId && d.status === 'active'
  );
  if (!delegate) return false;

  return Boolean(delegate.permissions[permissionKey]);
};

export const getActiveDelegates = (permissions: PracticePermissionsDocument): DelegateUser[] =>
  permissions.delegates.filter((d) => d.status === 'active' || d.status === 'pending');

function normalizePermissionsDoc(
  data: Record<string, unknown>,
  doctorId: string
): PracticePermissionsDocument {
  const defaults = DEFAULT_DELEGATE_PERMISSIONS;
  return {
    ownerId: String(data.ownerId ?? doctorId),
    delegates: Array.isArray(data.delegates) ? (data.delegates as DelegateUser[]) : [],
    defaultDelegatePermissions: {
      ...defaults,
      ...(data.defaultDelegatePermissions as Partial<DelegatePermissions> | undefined),
    },
  };
}

export const resolveEffectivePermissions = async (
  doctorId: string,
  userId: string
): Promise<{ isOwner: boolean; permissions: DelegatePermissions }> => {
  const full: DelegatePermissions = {
    manageAppointments: true,
    manageSoftBlocks: true,
    overrideConflicts: true,
    editBookingPolicies: true,
  };

  if (userId === doctorId) {
    return { isOwner: true, permissions: full };
  }

  const docData = await getPracticePermissions(doctorId);
  const delegate = docData?.delegates.find(
    (d) => d.userId === userId && d.status === 'active'
  );

  if (!delegate) {
    return {
      isOwner: false,
      permissions: {
        manageAppointments: false,
        manageSoftBlocks: false,
        overrideConflicts: false,
        editBookingPolicies: false,
      },
    };
  }

  return { isOwner: false, permissions: delegate.permissions };
};
