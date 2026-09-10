import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import {
  loginProfessional,
  logoutDoctor,
  getCurrentProfessionalFromSession,
} from '../services/authService';
import { djangoGetMe, readClinicOnboardingComplete } from '../services/djangoApiService';
import { loadDjangoPracticeSession } from '../services/djangoPracticeSession';
import type { PracticeSession, ProfessionalUser } from '../types';
import { AuthRole, JoinPath, parseJoinPath } from '../types/auth';

export type AuthContextType = {
  user: ProfessionalUser | null;
  practiceSession: PracticeSession | null;
  joinIntent: JoinPath | null;
  clinicOnboardingComplete: boolean;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string, role?: AuthRole) => Promise<ProfessionalUser | null>;
  logout: () => Promise<void>;
  refreshPracticeSession: () => Promise<void>;
  refreshUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const readUserFlags = async (): Promise<{
  joinIntent: JoinPath | null;
  clinicOnboardingComplete: boolean;
}> => {
  try {
    const me = await djangoGetMe();
    if (!me) return { joinIntent: null, clinicOnboardingComplete: false };
    const userId = String(me.id ?? '');
    return {
      joinIntent: parseJoinPath(typeof me.joinIntent === 'string' ? me.joinIntent : null),
      clinicOnboardingComplete:
        Boolean(me.clinicOnboardingComplete) ||
        (userId ? readClinicOnboardingComplete(userId) : false),
    };
  } catch {
    return { joinIntent: null, clinicOnboardingComplete: false };
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
    const flags = await readUserFlags();
    setJoinIntent(flags.joinIntent);
    setClinicOnboardingComplete(flags.clinicOnboardingComplete);

    if (shouldLoadPracticeSession(professional)) {
      const session = await loadDjangoPracticeSession(professional.id);
      setPracticeSession(session);
    } else {
      setPracticeSession(null);
    }
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setIsLoading(true);
      try {
        const professional = await getCurrentProfessionalFromSession();
        if (cancelled) return;
        await syncSessionForUser(professional);
      } catch (err) {
        console.error('[AuthContext] session bootstrap failed:', err);
        if (!cancelled) await syncSessionForUser(null);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = async (
    email: string,
    password: string,
    role?: AuthRole,
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
    const session = await loadDjangoPracticeSession(user.id);
    setPracticeSession(session);
    const flags = await readUserFlags();
    setJoinIntent(flags.joinIntent);
    setClinicOnboardingComplete(flags.clinicOnboardingComplete);
  };

  const refreshUser = async (): Promise<void> => {
    const professional = await getCurrentProfessionalFromSession();
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
