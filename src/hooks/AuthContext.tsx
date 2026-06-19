import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { loginDoctor, logoutDoctor, getCurrentDoctor } from '../services/authService';
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
import { Doctor, PracticeSession } from '../types';

export type AuthContextType = {
  user: Doctor | null;
  practiceSession: PracticeSession | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<Doctor | null>;
  logout: () => Promise<void>;
  refreshPracticeSession: () => Promise<void>;
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
  const [user, setUser] = useState<Doctor | null>(null);
  const [practiceSession, setPracticeSession] = useState<PracticeSession | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setIsLoading(true);
      try {
        if (firebaseUser) {
          const doctor = await getCurrentDoctor(firebaseUser);
          setUser(doctor);
          if (doctor) {
            const session = await loadPracticeSession(doctor.id);
            setPracticeSession(session);
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

  const login = async (email: string, password: string): Promise<Doctor | null> => {
    setIsLoading(true);
    try {
      const doctor = await loginDoctor(email, password);
      setUser(doctor);
      if (doctor) {
        const session = await loadPracticeSession(doctor.id);
        setPracticeSession(session);
      }
      return doctor;
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
    if (!user) return;
    const session = await loadPracticeSession(user.id);
    setPracticeSession(session);
  };

  return (
    <AuthContext.Provider
      value={{ user, practiceSession, isLoading, isAuthenticated: !!user, login, logout, refreshPracticeSession }}
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
