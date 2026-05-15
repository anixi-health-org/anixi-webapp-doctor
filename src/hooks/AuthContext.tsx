import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { loginDoctor, logoutDoctor, getCurrentDoctor } from '../services/authService';
import {
  getPracticeForUser,
  getPracticeMember,
  getBookingPolicy,
  createPractice,
  updateBookingPolicy,
} from '../services/practiceSettingsService';
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
    let practice = await getPracticeForUser(uid);
    
    if (!practice) {
      const practiceId = await createPractice(uid, {
        name: 'My Practice',
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
      });
      practice = await getPracticeForUser(uid);
      if (!practice) return null;
    }
    const [member, existingPolicy] = await Promise.all([
      getPracticeMember(practice.id, uid),
      getBookingPolicy(practice.id),
    ]);
    if (!member) return null;
    let bookingPolicy = existingPolicy;
    if (!bookingPolicy) {
      
      await updateBookingPolicy(practice.id, {
        patientCancellationWindowHours: 24,
        doctorCancellationWindowHours: 1,
        noShowPolicyText:
          'Patients who do not attend without 24-hour notice may be charged a no-show fee.',
        confirmationMode: 'doctor_confirms',
      });
      bookingPolicy = await getBookingPolicy(practice.id);
      if (!bookingPolicy) return null;
    }
    return { practice, member, bookingPolicy };
  } catch {
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
