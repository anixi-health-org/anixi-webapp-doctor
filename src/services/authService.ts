import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  User,
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { DOCTORS_COLLECTION, USERS_COLLECTION } from '../shared/constants';
import { linkCaregiverToNominatedPatients } from './caregiverService';
import { Caregiver, Doctor, ProfessionalUser, StaffUser } from '../types';
import { AuthRole, JoinPath } from '../types/auth';
import { getCurrencyForCountry } from '../constants/countries';
import {
  resolveDoctorProfilePhotoUrl,
  resolvePracticeLogoUrl,
} from '../lib/doctorAvatar';

async function resolveAccountRole(uid: string): Promise<AuthRole | null> {
  const userRef = doc(db, USERS_COLLECTION, uid);
  const userDoc = await getDoc(userRef);

  if (userDoc.exists()) {
    const userData = userDoc.data();
    const accountType = (userData.accountType || userData.role) as string | undefined;

    if (accountType === 'doctor' || accountType === 'caregiver' || accountType === 'staff') {
      return accountType;
    }

    if (!userData.role) {
      const doctorDoc = await getDoc(doc(db, DOCTORS_COLLECTION, uid));
      if (doctorDoc.exists()) {
        return 'doctor';
      }
    }
  } else {
    const doctorDoc = await getDoc(doc(db, DOCTORS_COLLECTION, uid));
    if (doctorDoc.exists()) {
      return 'doctor';
    }
  }

  return null;
}

async function mapDoctorUser(firebaseUser: User): Promise<Doctor> {
  const ref = doc(db, DOCTORS_COLLECTION, firebaseUser.uid);
  const [doctorDoc, userDoc] = await Promise.all([
    getDoc(ref),
    getDoc(doc(db, USERS_COLLECTION, firebaseUser.uid)),
  ]);

  const userData = userDoc.exists() ? userDoc.data() : {};
  const accountType = (userData.accountType || userData.role) as string | undefined;
  const isDoctorAccount =
    doctorDoc.exists() || accountType === 'doctor';

  if (!isDoctorAccount) {
    throw new Error('Access denied. This portal is for registered doctors only.');
  }

  const doctorData = doctorDoc.exists() ? doctorDoc.data() : {};
  if (doctorData.role && doctorData.role !== 'doctor') {
    throw new Error('Access denied. This portal is for registered doctors only.');
  }

  return {
    id: firebaseUser.uid,
    email: firebaseUser.email || userData.email || '',
    displayName:
      doctorData.displayName ||
      doctorData.fullName ||
      userData.displayName ||
      userData.fullName ||
      firebaseUser.displayName ||
      undefined,
    role: 'doctor',
    specialty: doctorData.specialty || doctorData.medicalSpecialty || userData.medicalSpecialty,
    licenseNumber: doctorData.licenseNumber || doctorData.hpcsaRegistrationNumber,
    phoneNumber: doctorData.phoneNumber || userData.phoneNumber,
    officeAddress: doctorData.officeAddress || doctorData.practiceAddress,
    practiceName: doctorData.practiceName,
    logoUrl: resolvePracticeLogoUrl(
      doctorData.logoUrl ||
        (userData.practiceBranding as { logoUrl?: string } | undefined)?.logoUrl,
      doctorData.profileImageUrl
    ),
    profileImageUrl: resolveDoctorProfilePhotoUrl(
      doctorData.profileImageUrl,
      doctorData.logoUrl
    ),
    practiceNumberBhf: doctorData.practiceNumberBhf || doctorData.practiceNumber,
    vatNumber: doctorData.vatNumber,
    country: doctorData.country || userData.country,
    currency: doctorData.currency,
    nationality: doctorData.nationality,
    verificationStatus: doctorData.verificationStatus,
    accountKind: doctorData.accountKind,
    requiresClinicalVerification:
      doctorData.requiresClinicalVerification === undefined
        ? undefined
        : Boolean(doctorData.requiresClinicalVerification),
    applicationComplete: Boolean(doctorData.applicationComplete),
    applicationSubmittedAt: doctorData.applicationSubmittedAt?.toDate?.() || undefined,
    verifiedAt: doctorData.verifiedAt?.toDate?.() || undefined,
    rejectionReason: doctorData.rejectionReason || doctorData.suspensionReason || undefined,
    createdAt: doctorData.createdAt?.toDate() || userData.createdAt?.toDate() || new Date(),
    updatedAt: doctorData.updatedAt?.toDate() || userData.updatedAt?.toDate() || new Date(),
  };
}

async function mapCaregiverUser(firebaseUser: User): Promise<Caregiver> {
  const userRef = doc(db, USERS_COLLECTION, firebaseUser.uid);
  const userDoc = await getDoc(userRef);
  const userData = userDoc.exists() ? userDoc.data() : {};

  return {
    id: firebaseUser.uid,
    email: firebaseUser.email || userData.email || '',
    displayName: userData.displayName || firebaseUser.displayName || undefined,
    role: 'caregiver',
    phoneNumber: userData.phoneNumber,
    createdAt: userData.createdAt?.toDate() || new Date(),
    updatedAt: userData.updatedAt?.toDate() || new Date(),
  };
}

async function mapStaffUser(firebaseUser: User): Promise<StaffUser> {
  const userRef = doc(db, USERS_COLLECTION, firebaseUser.uid);
  const userDoc = await getDoc(userRef);
  const userData = userDoc.exists() ? userDoc.data() : {};

  return {
    id: firebaseUser.uid,
    email: firebaseUser.email || userData.email || '',
    displayName: userData.displayName || firebaseUser.displayName || undefined,
    role: 'staff',
    phoneNumber: userData.phoneNumber,
    primaryPracticeId: userData.primaryPracticeId,
    createdAt: userData.createdAt?.toDate() || new Date(),
    updatedAt: userData.updatedAt?.toDate() || new Date(),
  };
}

async function ensureUserRoleDoc(firebaseUser: User, role: AuthRole): Promise<void> {
  const userRef = doc(db, USERS_COLLECTION, firebaseUser.uid);
  const userDoc = await getDoc(userRef);

  const payload = {
    id: firebaseUser.uid,
    email: firebaseUser.email,
    role,
    accountType: role,
    updatedAt: new Date(),
  };

  if (userDoc.exists()) {
    await setDoc(userRef, payload, { merge: true });
  } else {
    await setDoc(userRef, {
      ...payload,
      createdAt: new Date(),
    });
  }

  if (role === 'doctor') {
    const doctorRef = doc(db, DOCTORS_COLLECTION, firebaseUser.uid);
    const doctorDoc = await getDoc(doctorRef);
    if (!doctorDoc.exists()) {
      await setDoc(
        doctorRef,
        {
          email: firebaseUser.email,
          displayName: firebaseUser.displayName,
          role: 'doctor',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        { merge: true }
      );
    }
  }
}

export const registerProfessional = async (
  email: string,
  password: string,
  displayName: string,
  role: AuthRole,
  countryCode?: string,
  joinPath?: JoinPath
): Promise<void> => {
  const userCredential = await createUserWithEmailAndPassword(auth, email, password);
  await updateProfile(userCredential.user, { displayName });

  const skipPracticeProvision = joinPath === 'clinic' || joinPath === 'invite';

  await setDoc(
    doc(db, USERS_COLLECTION, userCredential.user.uid),
    {
      id: userCredential.user.uid,
      email,
      displayName,
      role,
      accountType: role,
      ...(joinPath ? { joinIntent: joinPath } : {}),
      ...(skipPracticeProvision ? { skipPracticeProvision: true } : {}),
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    { merge: true }
  );

  if (role === 'doctor') {
    const country = countryCode?.toUpperCase();
    const currency = country ? getCurrencyForCountry(country) : undefined;
    const isClinicAdmin = joinPath === 'clinic';

    await setDoc(
      doc(db, DOCTORS_COLLECTION, userCredential.user.uid),
      {
        email,
        displayName,
        role: 'doctor',
        ...(isClinicAdmin
          ? {
              accountKind: 'clinic_admin',
              requiresClinicalVerification: false,
              verificationStatus: 'not_required',
              applicationComplete: false,
              joinIntent: 'clinic',
            }
          : {
              verificationStatus: 'pending',
              applicationComplete: false,
            }),
        ...(country && { country }),
        ...(currency && { currency }),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      { merge: true }
    );
  }

  if (role === 'caregiver' && userCredential.user.email) {
    await linkCaregiverToNominatedPatients(
      userCredential.user.uid,
      userCredential.user.email
    );
  }
};

export const loginProfessional = async (
  email: string,
  password: string,
  expectedRole?: AuthRole
): Promise<ProfessionalUser> => {
  const trimmedEmail = email.trim();
  try {
    const userCredential = await signInWithEmailAndPassword(auth, trimmedEmail, password);
    const firebaseUser = userCredential.user;
    const resolvedRole = await resolveAccountRole(firebaseUser.uid);

    if (!resolvedRole) {
      await signOut(auth);
      throw new Error(
        'Access denied. Please register as a doctor, clinic staff, or caregiver before signing in.'
      );
    }

    if (expectedRole && resolvedRole !== expectedRole) {
      await signOut(auth);
      throw new Error(
        `This account is registered as a ${resolvedRole}. Please sign in with that account type.`
      );
    }

    await ensureUserRoleDoc(firebaseUser, resolvedRole);

    if (resolvedRole === 'caregiver' && firebaseUser.email) {
      await linkCaregiverToNominatedPatients(firebaseUser.uid, firebaseUser.email);
    }

    if (resolvedRole === 'doctor') {
      return mapDoctorUser(firebaseUser);
    }
    if (resolvedRole === 'staff') {
      return mapStaffUser(firebaseUser);
    }

    return mapCaregiverUser(firebaseUser);
  } catch (error: unknown) {
    throw new Error(loginErrorMessage(error));
  }
};

function loginErrorMessage(error: unknown): string {
  const code =
    typeof error === 'object' && error && 'code' in error
      ? String((error as { code?: string }).code)
      : '';
  const message = error instanceof Error ? error.message : '';
  const haystack = `${code} ${message}`.toLowerCase();

  if (
    haystack.includes('invalid-credential') ||
    haystack.includes('wrong-password') ||
    haystack.includes('user-not-found') ||
    haystack.includes('invalid-email') ||
    haystack.includes('invalid-login')
  ) {
    return 'Invalid email or password.';
  }
  if (haystack.includes('too-many-requests')) {
    return 'Too many sign-in attempts. Wait a few minutes, then try again.';
  }
  if (haystack.includes('network-request-failed') || haystack.includes('network error')) {
    return 'Network error. Check your connection and try again.';
  }
  if (
    haystack.includes('api-key') ||
    haystack.includes('app-not-authorized') ||
    haystack.includes('configuration-not')
  ) {
    return 'This portal could not reach Firebase. Refresh the page and try again.';
  }
  if (message) return message;
  return 'Could not sign in. Please try again.';
}

export const loginDoctor = async (email: string, password: string): Promise<Doctor> => {
  const user = await loginProfessional(email, password, 'doctor');
  return user as Doctor;
};

export const logoutDoctor = async (): Promise<void> => {
  await signOut(auth);
};

export const getCurrentProfessional = async (
  firebaseUser: User
): Promise<ProfessionalUser | null> => {
  try {
    const resolvedRole = await resolveAccountRole(firebaseUser.uid);
    if (!resolvedRole) {
      return null;
    }

    if (resolvedRole === 'doctor') {
      return mapDoctorUser(firebaseUser);
    }
    if (resolvedRole === 'staff') {
      return mapStaffUser(firebaseUser);
    }

    return mapCaregiverUser(firebaseUser);
  } catch {
    return null;
  }
};

/** Retries while Firestore profile docs catch up after registration. */
export const getCurrentProfessionalWithRetry = async (
  firebaseUser: User,
  attempts = 6,
  delayMs = 250
): Promise<ProfessionalUser | null> => {
  for (let i = 0; i < attempts; i++) {
    const professional = await getCurrentProfessional(firebaseUser);
    if (professional) return professional;
    if (i < attempts - 1) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  return null;
};

export const getCurrentDoctor = async (firebaseUser: User): Promise<Doctor | null> => {
  const user = await getCurrentProfessional(firebaseUser);
  if (!user || user.role !== 'doctor') {
    return null;
  }
  return user;
};
