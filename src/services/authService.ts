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
import { Caregiver, Doctor, ProfessionalUser } from '../types';
import { AuthRole } from '../types/auth';
import { getCurrencyForCountry } from '../constants/countries';

async function resolveAccountRole(uid: string): Promise<AuthRole | null> {
  const userRef = doc(db, USERS_COLLECTION, uid);
  const userDoc = await getDoc(userRef);

  if (userDoc.exists()) {
    const userData = userDoc.data();
    const accountType = (userData.accountType || userData.role) as string | undefined;

    if (accountType === 'doctor' || accountType === 'caregiver') {
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
  const doctorDoc = await getDoc(ref);

  if (!doctorDoc.exists()) {
    throw new Error('Access denied. This portal is for registered doctors only.');
  }

  const doctorData = doctorDoc.data();
  if (doctorData.role && doctorData.role !== 'doctor') {
    throw new Error('Access denied. This portal is for registered doctors only.');
  }

  return {
    id: firebaseUser.uid,
    email: firebaseUser.email!,
    displayName:
      doctorData.displayName ||
      doctorData.fullName ||
      firebaseUser.displayName ||
      undefined,
    role: 'doctor',
    specialty: doctorData.specialty || doctorData.medicalSpecialty,
    licenseNumber: doctorData.licenseNumber || doctorData.hpcsaRegistrationNumber,
    phoneNumber: doctorData.phoneNumber,
    officeAddress: doctorData.officeAddress || doctorData.practiceAddress,
    practiceName: doctorData.practiceName,
    logoUrl: doctorData.logoUrl || doctorData.profileImageUrl,
    practiceNumberBhf: doctorData.practiceNumberBhf || doctorData.practiceNumber,
    vatNumber: doctorData.vatNumber,
    country: doctorData.country,
    currency: doctorData.currency,
    nationality: doctorData.nationality,
    verificationStatus: doctorData.verificationStatus,
    applicationComplete: Boolean(doctorData.applicationComplete),
    applicationSubmittedAt: doctorData.applicationSubmittedAt?.toDate?.() || undefined,
    verifiedAt: doctorData.verifiedAt?.toDate?.() || undefined,
    rejectionReason: doctorData.rejectionReason || doctorData.suspensionReason || undefined,
    createdAt: doctorData.createdAt?.toDate() || new Date(),
    updatedAt: doctorData.updatedAt?.toDate() || new Date(),
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
  countryCode?: string
): Promise<void> => {
  const userCredential = await createUserWithEmailAndPassword(auth, email, password);
  await updateProfile(userCredential.user, { displayName });

  await setDoc(
    doc(db, USERS_COLLECTION, userCredential.user.uid),
    {
      id: userCredential.user.uid,
      email,
      displayName,
      role,
      accountType: role,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    { merge: true }
  );

  if (role === 'doctor') {
    const country = countryCode?.toUpperCase();
    const currency = country ? getCurrencyForCountry(country) : undefined;

    await setDoc(
      doc(db, DOCTORS_COLLECTION, userCredential.user.uid),
      {
        email,
        displayName,
        role: 'doctor',
        verificationStatus: 'pending',
        applicationComplete: false,
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
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const firebaseUser = userCredential.user;
    const resolvedRole = await resolveAccountRole(firebaseUser.uid);

    if (!resolvedRole) {
      await signOut(auth);
      throw new Error(
        'Access denied. Please register as a doctor or caregiver before signing in.'
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

    return mapCaregiverUser(firebaseUser);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Login failed';
    throw new Error(message);
  }
};

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

    return mapCaregiverUser(firebaseUser);
  } catch {
    return null;
  }
};

export const getCurrentDoctor = async (firebaseUser: User): Promise<Doctor | null> => {
  const user = await getCurrentProfessional(firebaseUser);
  if (!user || user.role !== 'doctor') {
    return null;
  }
  return user;
};
