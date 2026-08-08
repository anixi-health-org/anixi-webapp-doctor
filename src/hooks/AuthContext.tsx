import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import {
  loginProfessional,
  logoutDoctor,
  getCurrentProfessionalWithRetry,
} from '../services/authService';
import { linkCaregiverToNominatedPatients } from '../services/caregiverService';
import {
  getPracticeForUser,
  getPracticeMember,
  ensureOwnerMembership,
  ensureBookingPolicy,
  resolvePracticeForUser,
  provisionPracticeForDoctor,
} from '../services/practiceSettingsService';
import { resolveEffectivePermissions } from '../services/permissions/practicePermissionsService';
import { USERS_COLLECTION } from '../shared/constants';
import type { PracticeSession, ProfessionalUser } from '../types';
import { AuthRole, JoinPath, parseJoinPath } from '../types/auth';

export type AuthContextType = {
  user: ProfessionalUser | null;
  practiceSession: PracticeSession | null;
  joinIntent: JoinPath | null;
  /** Clinic owner finished bulk setup (doctors + patients) */
  clinicOnboardingComplete: boolean;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string, role?: AuthRole) => Promise<ProfessionalUser | null>;
  logout: () => Promise<void>;
  refreshPracticeSession: () => Promise<void>;
  refreshUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const readUserFlags = async (
  uid: string
): Promise<{ joinIntent: JoinPath | null; clinicOnboardingComplete: boolean }> => {
  try {
    const userSnap = await getDoc(doc(db, USERS_COLLECTION, uid));
    const data = userSnap.data() || {};
    return {
      joinIntent: parseJoinPath(typeof data.joinIntent === 'string' ? data.joinIntent : null),
      clinicOnboardingComplete: Boolean(data.clinicOnboardingComplete),
    };
  } catch {
    return { joinIntent: null, clinicOnboardingComplete: false };
  }
};

/**
 * Load practice session without forcing solo auto-provision when the user
 * is mid-clinic-setup or waiting to accept an invite.
 */
const loadPracticeSession = async (
  uid: string,
  options?: { allowAutoProvision?: boolean }
): Promise<PracticeSession | null> => {
  const allowAutoProvision = options?.allowAutoProvision !== false;

  try {
    const userSnap = await getDoc(doc(db, USERS_COLLECTION, uid));
    const userData = userSnap.data() || {};
    const joinIntent = userData.joinIntent as string | undefined;
    const skipProvision =
      joinIntent === 'clinic' || joinIntent === 'invite' || userData.skipPracticeProvision === true;

    const ownedPractice = await resolvePracticeForUser(uid);
    if (ownedPractice && ownedPractice.ownerId === uid) {
      const member = await ensureOwnerMembership(ownedPractice.id, uid, {
        isClinician: ownedPractice.orgType !== 'clinic',
      });
      const bookingPolicy = await ensureBookingPolicy(ownedPractice.id);
      return { practice: ownedPractice, member, bookingPolicy };
    }

    const memberPractice = ownedPractice ?? (await getPracticeForUser(uid));
    if (memberPractice) {
      const member = await getPracticeMember(memberPractice.id, uid);
      if (member && member.status === 'active') {
        const bookingPolicy = await ensureBookingPolicy(memberPractice.id);
        return { practice: memberPractice, member, bookingPolicy };
      }
    }

    const delegatingForDoctorId = userData.delegatingForDoctorId as string | undefined;
    if (delegatingForDoctorId) {
      const doctorPractice = await resolvePracticeForUser(delegatingForDoctorId);
      if (doctorPractice) {
        const { permissions, isOwner } = await resolveEffectivePermissions(
          delegatingForDoctorId,
          uid
        );
        const bookingPolicy = await ensureBookingPolicy(doctorPractice.id);
        return {
          practice: doctorPractice,
          member: {
            uid,
            practiceId: doctorPractice.id,
            role: isOwner ? 'owner' : 'delegate',
            permissions: {
              manageAppointments: permissions.manageAppointments,
              manageSoftBlocks: permissions.manageSoftBlocks,
              overrideConflicts: permissions.overrideConflicts,
              editBookingPolicies: permissions.editBookingPolicies,
              managePatients: false,
              manageMembers: false,
              viewAllDoctors: false,
              viewBilling: false,
            },
            status: 'active',
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          bookingPolicy,
        };
      }
    }

    if (!allowAutoProvision || skipProvision) {
      return null;
    }

    const provisioned = await provisionPracticeForDoctor(uid);
    return {
      practice: provisioned.practice,
      member: provisioned.member,
      bookingPolicy: provisioned.bookingPolicy,
    };
  } catch (error) {
    console.error('[AuthContext] loadPracticeSession failed:', error);
    return null;
  }
};

const shouldLoadPracticeSession = (user: ProfessionalUser | null): boolean =>
  Boolean(user && (user.role === 'doctor' || user.role === 'staff'));

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<ProfessionalUser | null>(null);
  const [practiceSession, setPracticeSession] = useState<PracticeSession | null>(null);
  const [joinIntent, setJoinIntent] = useState<JoinPath | null>(null);
  const [clinicOnboardingComplete, setClinicOnboardingComplete] = useState(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const syncSessionForUser = async (professional: ProfessionalUser | null) => {
    if (!professional) {
      setUser(null);
      setPracticeSession(null);
      setJoinIntent(null);
      setClinicOnboardingComplete(false);
      return;
    }

    setUser(professional);
    const flags = await readUserFlags(professional.id);
    setJoinIntent(flags.joinIntent);
    setClinicOnboardingComplete(flags.clinicOnboardingComplete);

    if (shouldLoadPracticeSession(professional)) {
      const session = await loadPracticeSession(professional.id);
      setPracticeSession(session);
    } else {
      setPracticeSession(null);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setIsLoading(true);
      try {
        if (firebaseUser) {
          const professional = await getCurrentProfessionalWithRetry(firebaseUser);
          await syncSessionForUser(professional);
          if (professional?.role === 'caregiver' && firebaseUser.email) {
            void linkCaregiverToNominatedPatients(firebaseUser.uid, firebaseUser.email);
          }
        } else {
          await syncSessionForUser(null);
        }
      } catch (err) {
        console.error('[AuthContext] auth state error:', err);
        await syncSessionForUser(null);
      } finally {
        setIsLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  const login = async (
    email: string,
    password: string,
    role?: AuthRole
  ): Promise<ProfessionalUser | null> => {
    setIsLoading(true);
    try {
      const professional = await loginProfessional(email, password, role);
      await syncSessionForUser(professional);
      return professional;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async (): Promise<void> => {
    setIsLoading(true);
    try {
      await logoutDoctor();
      await syncSessionForUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  const refreshPracticeSession = async (): Promise<void> => {
    if (!user || !shouldLoadPracticeSession(user)) return;
    const flags = await readUserFlags(user.id);
    setJoinIntent(flags.joinIntent);
    setClinicOnboardingComplete(flags.clinicOnboardingComplete);
    const session = await loadPracticeSession(user.id);
    setPracticeSession(session);
  };

  const refreshUser = async (): Promise<void> => {
    const firebaseUser = auth.currentUser;
    if (!firebaseUser) {
      await syncSessionForUser(null);
      return;
    }
    const professional = await getCurrentProfessionalWithRetry(firebaseUser);
    await syncSessionForUser(professional);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        practiceSession,
        joinIntent,
        clinicOnboardingComplete,
        isLoading,
        isAuthenticated: !!user,
        login,
        logout,
        refreshPracticeSession,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
};
