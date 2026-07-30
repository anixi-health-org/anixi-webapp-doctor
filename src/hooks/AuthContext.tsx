import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { loginProfessional, logoutDoctor, getCurrentProfessional } from '../services/authService';
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
import { PracticeSession, ProfessionalUser } from '../types';
import { AuthRole } from '../types/auth';

export type AuthContextType = {
  user: ProfessionalUser | null;
  practiceSession: PracticeSession | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string, role?: AuthRole) => Promise<ProfessionalUser | null>;
  logout: () => Promise<void>;
  refreshPracticeSession: () => Promise<void>;
  refreshUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const loadPracticeSession = async (uid: string): Promise<PracticeSession | null> => {
  try {
    const ownedPractice = await resolvePracticeForUser(uid);
    if (ownedPractice && ownedPractice.ownerId === uid) {
      const member = await ensureOwnerMembership(ownedPractice.id, uid);
      const bookingPolicy = await ensureBookingPolicy(ownedPractice.id);
      return { practice: ownedPractice, member, bookingPolicy };
    }

    const memberPractice = ownedPractice ?? (await getPracticeForUser(uid));
    if (memberPractice) {
      const member = await getPracticeMember(memberPractice.id, uid);
      if (member) {
        const bookingPolicy = await ensureBookingPolicy(memberPractice.id);
        return { practice: memberPractice, member, bookingPolicy };
      }
    }

    const userSnap = await getDoc(doc(db, USERS_COLLECTION, uid));
    const delegatingForDoctorId = userSnap.data()?.delegatingForDoctorId as string | undefined;
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
            permissions,
            status: 'active',
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          bookingPolicy,
        };
      }
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

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<ProfessionalUser | null>(null);
  const [practiceSession, setPracticeSession] = useState<PracticeSession | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setIsLoading(true);
      try {
        if (firebaseUser) {
          const professional = await getCurrentProfessional(firebaseUser);
          setUser(professional);
          if (professional?.role === 'doctor') {
            const session = await loadPracticeSession(professional.id);
            setPracticeSession(session);
          } else {
            setPracticeSession(null);
            if (professional?.role === 'caregiver' && firebaseUser.email) {
              void linkCaregiverToNominatedPatients(firebaseUser.uid, firebaseUser.email);
            }
          }
        } else {
          setUser(null);
          setPracticeSession(null);
        }
      } catch (err) {
        console.error('[AuthContext] auth state error:', err);
        setUser(null);
        setPracticeSession(null);
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
      setUser(professional);
      if (professional.role === 'doctor') {
        const session = await loadPracticeSession(professional.id);
        setPracticeSession(session);
      } else {
        setPracticeSession(null);
      }
      return professional;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async (): Promise<void> => {
    setIsLoading(true);
    try {
      await logoutDoctor();
      setUser(null);
      setPracticeSession(null);
    } finally {
      setIsLoading(false);
    }
  };

  const refreshPracticeSession = async (): Promise<void> => {
    if (!user || user.role !== 'doctor') return;
    const session = await loadPracticeSession(user.id);
    setPracticeSession(session);
  };

  const refreshUser = async (): Promise<void> => {
    const firebaseUser = auth.currentUser;
    if (!firebaseUser) {
      setUser(null);
      setPracticeSession(null);
      return;
    }
    const professional = await getCurrentProfessional(firebaseUser);
    setUser(professional);
    if (professional?.role === 'doctor') {
      const session = await loadPracticeSession(professional.id);
      setPracticeSession(session);
    } else {
      setPracticeSession(null);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        practiceSession,
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
